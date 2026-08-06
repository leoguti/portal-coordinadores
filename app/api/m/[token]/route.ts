/**
 * GET /api/m/[token]
 *
 * Devuelve la información del magic-link para que la página /m/* renderice el
 * formulario adecuado: intent + datos precargados + contexto.
 *
 * No requiere auth (el token ES la auth). Si el token está expirado o ya
 * consumido, responde 410 Gone.
 *
 * Responde con info segura para el cliente (sin secrets de Airtable, sin DB).
 */

import { NextResponse } from "next/server";
import {
  leerToken,
  estaConsumido,
  estaExpirado,
  type EdicionToken,
  type Intent,
} from "@/lib/edicionTokens";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

// ─── Helpers Airtable ──────────────────────────────────────────────────────

async function getRecord(table: string, id: string) {
  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  return r.json() as Promise<{ id: string; fields: Record<string, unknown> }>;
}

async function getCoordinadoresActivos() {
  // Lista completa de coordinadores activos para los dropdown.
  // No es mucho: ~30 registros. La paginamos por si crece.
  const all: { id: string; nombre: string }[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams();
    p.set("filterByFormula", `{Rol}='Coordinador'`);
    p.set("pageSize", "100");
    p.append("fields[]", "Name");
    if (offset) p.set("offset", offset);
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Coordinadores?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    if (!r.ok) break;
    const d = await r.json();
    for (const rec of d.records || []) {
      all.push({ id: rec.id, nombre: String(rec.fields.Name || "") });
    }
    offset = d.offset;
  } while (offset);
  return all.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// ─── Datos precargados por intent ──────────────────────────────────────────

interface DatosFinca {
  id: string;
  nombre: string;
  municipioId: string | null;
  municipioLabel: string | null;
  cultivos: { id: string; nombre: string }[];
  movil: string;
  email: string;
}

interface DatosGenerador {
  id: string;
  nombre: string;
  nit: string;
  tipopersona: string;
  tipo: string;
  direccion: string;
  municipioId: string | null;
  municipioLabel: string | null;
  movil: string;
  email: string;
}

interface PayloadBase {
  intent: Intent;
  expiraEn: string; // ISO
  telefonoValidado: string;
  contexto: Record<string, unknown>;
  coordinadores?: { id: string; nombre: string }[];
}

interface PayloadCertNuevo extends PayloadBase {
  intent: "cert-nuevo";
  finca: DatosFinca | null;
  generador: DatosGenerador | null;
  fincasDisponibles: {
    id: string;
    nombre: string;
    generadorId: string;
    generadorNombre: string;
    generadorTipopersona: string;
    cultivos: { id: string; nombre: string }[];
    coordinadorSugerido: { id: string; nombre: string } | null;
  }[];
  coordinadorSugerido: { id: string; nombre: string } | null;
}

interface PayloadEditarFinca extends PayloadBase {
  intent: "editar-finca";
  finca: DatosFinca;
  generador: { id: string; nombre: string; tipopersona: string } | null;
}

interface PayloadEditarGenerador extends PayloadBase {
  intent: "editar-generador";
  generador: DatosGenerador;
  coordinadorSugerido: { id: string; nombre: string } | null;
}

interface PayloadEditarPerfil extends PayloadBase {
  intent: "editar-perfil";
  generador: DatosGenerador;
  fincas: DatosFinca[];
  coordinadorSugerido: { id: string; nombre: string } | null;
  /** True si alguna parte (empresa o alguna finca) tiene cambios_pendientes
   *  en revisión por el coordinador. La página lo usa para avisar al
   *  agricultor que sus últimos cambios todavía no están firmes. */
  hayCambiosEnRevision: boolean;
}

interface PayloadCrearFinca extends PayloadBase {
  intent: "crear-finca";
  generador: DatosGenerador;
}

interface PayloadRegistroGenerador extends PayloadBase {
  intent: "registro-generador";
}

interface PayloadCertCoordinador extends PayloadBase {
  intent: "cert-coordinador";
  coordinador: { id: string; nombre: string };
}

type Payload =
  | PayloadCertNuevo
  | PayloadEditarFinca
  | PayloadEditarGenerador
  | PayloadEditarPerfil
  | PayloadCrearFinca
  | PayloadRegistroGenerador
  | PayloadCertCoordinador;

// ─── Fetchers ──────────────────────────────────────────────────────────────

/**
 * Lee cambios_pendientes y devuelve los campos que el agricultor
 * propuso modificar. Se aplica encima de los valores actuales del
 * record para que cuando el agricultor vuelva a entrar al form vea lo
 * último que envió.
 */
function diffPendientes(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw)) as {
      cambios?: Record<string, unknown>;
    };
    return parsed.cambios && typeof parsed.cambios === "object"
      ? parsed.cambios
      : {};
  } catch {
    return {};
  }
}

async function cargarFinca(id: string): Promise<DatosFinca | null> {
  const f = await getRecord("FINCAS", id);
  if (!f) return null;
  const ff = f.fields;
  // Solo aplicar el diff si el record realmente está en revisión.
  // Hay records con cambios_pendientes residual de antes del refactor.
  const estado = String(ff.estado || "");
  const diff =
    estado === "pendiente_revision"
      ? diffPendientes(ff.cambios_pendientes)
      : {};
  const nombre = String(("nombre" in diff ? diff.nombre : ff.nombre) || "");
  const movil = String(("movil" in diff ? diff.movil : ff.movil) || "");
  const email = String(("email" in diff ? diff.email : ff.email) || "");
  // Municipio: el diff guarda [id] (array). Si está, usar ese.
  const municipioArr = (
    "municipio" in diff ? diff.municipio : ff.municipio
  ) as unknown;
  const municipioId = Array.isArray(municipioArr)
    ? String(municipioArr[0] || "") || null
    : null;
  let municipioLabel: string | null = null;
  if (municipioId) {
    const m = await getRecord("MUNICIPIOS", municipioId);
    municipioLabel = m ? String(m.fields?.mundep || "") : null;
  }
  const cultivoIds = (
    "cultivos" in diff ? diff.cultivos : ff.cultivos
  ) as unknown;
  const cultivosList = Array.isArray(cultivoIds)
    ? (cultivoIds as unknown[]).map(String)
    : [];
  const cultivos: { id: string; nombre: string }[] = [];
  for (const cid of cultivosList) {
    const c = await getRecord("CULTIVOS", cid);
    if (c) cultivos.push({ id: cid, nombre: String(c.fields?.nombre || "") });
  }
  return {
    id: f.id,
    nombre,
    municipioId,
    municipioLabel,
    cultivos,
    movil,
    email,
  };
}

/**
 * Devuelve el coordinador del último certificado APROBADO de la finca.
 * Si la finca no tiene historial, devuelve null. Usado como sugerencia
 * por defecto en cert-nuevo para evitar que el agricultor elija un coord
 * incorrecto.
 *
 * Implementación: la fórmula vieja `FIND('<fincaId>', ARRAYJOIN({FINCAS}))`
 * fallaba porque ARRAYJOIN sobre linked records devuelve display names,
 * no record IDs (mismo bug que se arregló en whatsappResolver). Ahora
 * leemos el reverse-lookup de la finca para obtener los IDs de sus certs
 * y buscamos entre esos.
 */
async function coordinadorSugeridoParaFinca(
  fincaId: string
): Promise<{ id: string; nombre: string } | null> {
  try {
    const finca = await getRecord("FINCAS", fincaId);
    if (!finca) return null;
    // Detectar el campo reverse-lookup de certificados (puede llamarse
    // "certificados", "Certificados", etc.). Filtramos por contenido:
    // array de strings que empiezan con "rec".
    let certIds: string[] = [];
    for (const [key, val] of Object.entries(finca.fields)) {
      if (
        /cert/i.test(key) &&
        Array.isArray(val) &&
        val.length > 0 &&
        typeof val[0] === "string" &&
        (val[0] as string).startsWith("rec")
      ) {
        certIds = (val as string[]).map(String);
        break;
      }
    }
    if (certIds.length === 0) return null;
    // Si hay muchos certs, cortamos a 200 — suficiente para encontrar
    // el más reciente y mantiene el filterByFormula bajo el límite.
    const chunk = certIds.slice(0, 200);
    const orParts = chunk.map((id) => `RECORD_ID()='${id}'`).join(",");
    const formula = `AND({estado}='aprobado', OR(${orParts}))`;
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    p.set("maxRecords", "1");
    p.set("sort[0][field]", "fecha_solicitud");
    p.set("sort[0][direction]", "desc");
    p.append("fields[]", "id_coordinador");
    p.append("fields[]", "nombrecoordinador");
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      records: Array<{ fields: Record<string, unknown> }>;
    };
    const rec = d.records?.[0];
    if (!rec) return null;
    const idArr = rec.fields.id_coordinador;
    const id = Array.isArray(idArr) ? String(idArr[0] || "") : String(idArr || "");
    if (!id) return null;
    const nombreArr = rec.fields.nombrecoordinador;
    const nombre = Array.isArray(nombreArr)
      ? String(nombreArr[0] || "")
      : String(nombreArr || "");
    return { id, nombre };
  } catch {
    return null;
  }
}

/**
 * Devuelve el coord del último cert APROBADO de cualquier finca del
 * generador. Sirve para sugerir quién debería revisar cambios al
 * generador (modelo: el coord que más le trabaja). Null si no tiene
 * historial.
 */
async function coordinadorSugeridoParaGenerador(
  generadorId: string
): Promise<{ id: string; nombre: string } | null> {
  try {
    const gen = await getRecord("GENERADORES", generadorId);
    if (!gen) return null;
    // Reverse-lookup: campo FINCAS en GENERADORES (ya usado por
    // whatsappResolver) — array de record IDs de las fincas hijas.
    const fincaIds = Array.isArray(gen.fields.FINCAS)
      ? (gen.fields.FINCAS as string[]).map(String)
      : [];
    if (fincaIds.length === 0) return null;
    // Pedimos el sugerido de cada finca en paralelo, tomamos el primero
    // que devuelva algo. Como cada uno ya viene ordenado por fecha desc
    // dentro de su finca, esto da el coord del último cert aprobado del
    // generador en cualquiera de sus fincas. Para máxima precisión
    // habría que combinar todos y reordenar; en la práctica el primer
    // resultado coincide en la mayoría de casos (1 coord por generador).
    const resultados = await Promise.all(
      fincaIds.map((fid) => coordinadorSugeridoParaFinca(fid))
    );
    return resultados.find((r) => r !== null) || null;
  } catch {
    return null;
  }
}

async function cargarGenerador(id: string): Promise<DatosGenerador | null> {
  const g = await getRecord("GENERADORES", id);
  if (!g) return null;
  const gf = g.fields;
  const estado = String(gf.estado || "");
  const diff =
    estado === "pendiente_revision"
      ? diffPendientes(gf.cambios_pendientes)
      : {};
  const nombre = String(("nombre" in diff ? diff.nombre : gf.nombre) || "");
  const tipo = String(("tipo" in diff ? diff.tipo : gf.tipo) || "");
  const direccion = String(
    ("direccion_sede" in diff ? diff.direccion_sede : gf.direccion_sede) || ""
  );
  const movil = String(("movil" in diff ? diff.movil : gf.movil) || "");
  const email = String(("email" in diff ? diff.email : gf.email) || "");
  const municipioArr = (
    "municipio" in diff ? diff.municipio : gf.municipio
  ) as unknown;
  const municipioId = Array.isArray(municipioArr)
    ? String(municipioArr[0] || "") || null
    : null;
  let municipioLabel: string | null = null;
  if (municipioId) {
    const m = await getRecord("MUNICIPIOS", municipioId);
    municipioLabel = m ? String(m.fields?.mundep || "") : null;
  }
  return {
    id: g.id,
    nombre,
    nit: String(gf.nit || ""),
    tipopersona: String(gf.tipopersona || ""),
    tipo,
    direccion,
    municipioId,
    municipioLabel,
    movil,
    email,
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const t = await leerToken(token);
  if (!t) {
    return NextResponse.json(
      { error: "Token no encontrado" },
      { status: 404 }
    );
  }
  if (estaConsumido(t)) {
    return NextResponse.json(
      { error: "Este link ya fue usado", code: "CONSUMED" },
      { status: 410 }
    );
  }
  if (estaExpirado(t)) {
    return NextResponse.json(
      {
        error:
          "Este link expiró. Vuelve a escribir al bot para recibir uno nuevo.",
        code: "EXPIRED",
      },
      { status: 410 }
    );
  }

  try {
    const payload = await armarPayload(t);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/m/token] Error armando payload:", err);
    return NextResponse.json(
      {
        error: "Error cargando datos",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

async function armarPayload(t: EdicionToken): Promise<Payload> {
  const base = {
    intent: t.intent,
    expiraEn: t.expira.toISOString(),
    telefonoValidado: t.telefonoValidado,
    contexto: t.contexto,
  };

  switch (t.intent) {
    case "cert-nuevo": {
      // Si el contexto tiene varias fincas, las exponemos todas; el form deja
      // elegir. Si solo hay una en recordId, esa pre-seleccionada.
      // Contexto por finca (incluye generadorId/Nombre reales — clave en
      // teléfonos multiempresa: un gestor con varias razones sociales).
      const ctxFincas: Array<{ id: string; generadorId?: string; generadorNombre?: string; generadorTipopersona?: string }> =
        Array.isArray(t.contexto.fincas)
          ? (t.contexto.fincas as Array<{ id: string; generadorId?: string; generadorNombre?: string; generadorTipopersona?: string }>)
          : t.recordId
            ? [{ id: t.recordId }]
            : [];
      const fincaIds = ctxFincas.map((f) => f.id);
      const ctxPorFinca = new Map(ctxFincas.map((f) => [f.id, f]));
      const fincasDisponibles: {
        id: string;
        nombre: string;
        generadorId: string;
        generadorNombre: string;
        generadorTipopersona: string;
        cultivos: { id: string; nombre: string }[];
        coordinadorSugerido: { id: string; nombre: string } | null;
      }[] = [];
      let fincaPrincipal: DatosFinca | null = null;
      let generadorPrincipal: DatosGenerador | null = null;
      for (const fid of fincaIds) {
        const f = await cargarFinca(fid);
        if (!f) continue;
        if (!fincaPrincipal && (fid === t.recordId || fincaIds.length === 1)) {
          fincaPrincipal = f;
        }
        // generadorId REAL de esta finca: del contexto; fallback al linked
        // record (tokens viejos sin contexto enriquecido).
        let genId = ctxPorFinca.get(fid)?.generadorId || "";
        if (!genId) {
          const fincaRec = await getRecord("FINCAS", fid);
          genId = Array.isArray(fincaRec?.fields.generador)
            ? String((fincaRec!.fields.generador as string[])[0])
            : "";
        }
        // Para mostrar generador en el header: el de la finca principal o
        // el primero que aparezca.
        if (!generadorPrincipal && genId) {
          generadorPrincipal = await cargarGenerador(genId);
        }
        fincasDisponibles.push({
          id: f.id,
          nombre: f.nombre,
          generadorId: genId,
          generadorNombre:
            ctxPorFinca.get(fid)?.generadorNombre ||
            (genId === generadorPrincipal?.id ? generadorPrincipal?.nombre || "" : ""),
          generadorTipopersona: ctxPorFinca.get(fid)?.generadorTipopersona || "",
          cultivos: f.cultivos,
          coordinadorSugerido: null,
        });
      }
      // Sugerir coordinador por finca según el último cert aprobado.
      await Promise.all(
        fincasDisponibles.map(async (fd) => {
          fd.coordinadorSugerido = await coordinadorSugeridoParaFinca(fd.id);
        })
      );
      const coordinadores = await getCoordinadoresActivos();
      // Top-level: si hay una finca pre-seleccionada, exponer su sugerido.
      const coordinadorSugerido = fincaPrincipal
        ? fincasDisponibles.find((fd) => fd.id === fincaPrincipal!.id)
            ?.coordinadorSugerido || null
        : null;
      return {
        ...base,
        intent: "cert-nuevo",
        finca: fincaPrincipal,
        generador: generadorPrincipal,
        fincasDisponibles,
        coordinadores,
        coordinadorSugerido,
      };
    }

    case "editar-finca": {
      const finca = t.recordId ? await cargarFinca(t.recordId) : null;
      if (!finca) throw new Error("Finca no encontrada");
      // Cargar el generador padre para mostrar contexto en el header.
      let generadorContext: { id: string; nombre: string; tipopersona: string } | null = null;
      const fincaRec = await getRecord("FINCAS", finca.id);
      const genId = Array.isArray(fincaRec?.fields.generador)
        ? String((fincaRec!.fields.generador as string[])[0])
        : null;
      if (genId) {
        const gen = await cargarGenerador(genId);
        if (gen) {
          generadorContext = {
            id: gen.id,
            nombre: gen.nombre,
            tipopersona: gen.tipopersona,
          };
        }
      }
      return { ...base, intent: "editar-finca", finca, generador: generadorContext };
    }

    case "editar-generador": {
      const generador = t.recordId ? await cargarGenerador(t.recordId) : null;
      if (!generador) throw new Error("Generador no encontrado");
      const [coordinadores, coordinadorSugerido] = await Promise.all([
        getCoordinadoresActivos(),
        coordinadorSugeridoParaGenerador(generador.id),
      ]);
      return {
        ...base,
        intent: "editar-generador",
        generador,
        coordinadores,
        coordinadorSugerido,
      };
    }

    case "editar-perfil": {
      const generador = t.recordId ? await cargarGenerador(t.recordId) : null;
      if (!generador) throw new Error("Generador no encontrado");
      // Sacamos las fincas del contexto (poblado al crear el token con la
      // identidad del titular). Si no, fallback a las del campo FINCAS del
      // generador.
      let fincaIds: string[] = Array.isArray(t.contexto.fincas)
        ? (t.contexto.fincas as Array<{ id: string }>).map((f) => f.id)
        : [];
      if (fincaIds.length === 0) {
        const gen = await getRecord("GENERADORES", generador.id);
        fincaIds = Array.isArray(gen?.fields.FINCAS)
          ? (gen!.fields.FINCAS as string[]).map(String)
          : [];
      }
      const fincas: DatosFinca[] = [];
      for (const fid of fincaIds) {
        const f = await cargarFinca(fid);
        if (f) fincas.push(f);
      }
      // Detectar si alguno ya tiene cambios en revisión. Importante:
      // solo cuenta si el estado del record es pendiente_revision —
      // hay registros viejos con cambios_pendientes residual (de antes
      // del refactor de staging) cuyo estado quedó en aprobado.
      const genRaw = await getRecord("GENERADORES", generador.id);
      const genEstado = String(genRaw?.fields.estado || "");
      const empresaPendiente =
        genEstado === "pendiente_revision" &&
        Object.keys(diffPendientes(genRaw?.fields.cambios_pendientes)).length >
          0;
      let fincaPendiente = false;
      for (const fid of fincaIds) {
        const fr = await getRecord("FINCAS", fid);
        const fEstado = String(fr?.fields.estado || "");
        if (
          fEstado === "pendiente_revision" &&
          Object.keys(diffPendientes(fr?.fields.cambios_pendientes)).length > 0
        ) {
          fincaPendiente = true;
          break;
        }
      }
      const hayCambiosEnRevision = empresaPendiente || fincaPendiente;
      const [coordinadores, coordinadorSugerido] = await Promise.all([
        getCoordinadoresActivos(),
        coordinadorSugeridoParaGenerador(generador.id),
      ]);
      return {
        ...base,
        intent: "editar-perfil",
        generador,
        fincas,
        coordinadores,
        coordinadorSugerido,
        hayCambiosEnRevision,
      };
    }

    case "crear-finca": {
      const generador = t.recordId ? await cargarGenerador(t.recordId) : null;
      if (!generador) throw new Error("Generador padre no encontrado");
      return { ...base, intent: "crear-finca", generador };
    }

    case "registro-generador": {
      const coordinadores = await getCoordinadoresActivos();
      return {
        ...base,
        intent: "registro-generador",
        coordinadores,
      };
    }

    case "cert-coordinador": {
      // El coordinador genera certs para cualquier agricultor — la búsqueda
      // del generador la hace el form vía /api/m/[token]/buscar-generador.
      const ctx = t.contexto as {
        coordinador?: { id: string; nombre: string };
      };
      const coordinador = ctx.coordinador?.id
        ? ctx.coordinador
        : { id: t.recordId || "", nombre: "" };
      if (!coordinador.id) throw new Error("Token sin coordinador");
      return { ...base, intent: "cert-coordinador", coordinador };
    }

    case "aprobar-cert":
      // La página /m/aprobar-cert usa su propio GET token-scoped
      // (/api/m/[token]/aprobar-cert) porque necesita verificar el estado
      // vivo del certificado. No se sirve desde aquí.
      throw new Error("Intent aprobar-cert se sirve desde /api/m/[token]/aprobar-cert");
  }
}
