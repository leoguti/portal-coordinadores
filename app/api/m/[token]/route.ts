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
    cultivos: { id: string; nombre: string }[];
  }[];
}

interface PayloadEditarFinca extends PayloadBase {
  intent: "editar-finca";
  finca: DatosFinca;
  generador: { id: string; nombre: string; tipopersona: string } | null;
}

interface PayloadEditarGenerador extends PayloadBase {
  intent: "editar-generador";
  generador: DatosGenerador;
}

interface PayloadCrearFinca extends PayloadBase {
  intent: "crear-finca";
  generador: DatosGenerador;
}

interface PayloadRegistroGenerador extends PayloadBase {
  intent: "registro-generador";
}

type Payload =
  | PayloadCertNuevo
  | PayloadEditarFinca
  | PayloadEditarGenerador
  | PayloadCrearFinca
  | PayloadRegistroGenerador;

// ─── Fetchers ──────────────────────────────────────────────────────────────

async function cargarFinca(id: string): Promise<DatosFinca | null> {
  const f = await getRecord("FINCAS", id);
  if (!f) return null;
  const ff = f.fields;
  let municipioLabel: string | null = null;
  const municipioId = Array.isArray(ff.municipio) ? String(ff.municipio[0]) : null;
  if (municipioId) {
    const m = await getRecord("MUNICIPIOS", municipioId);
    municipioLabel = m ? String(m.fields?.mundep || "") : null;
  }
  const cultivoIds = Array.isArray(ff.cultivos) ? (ff.cultivos as string[]) : [];
  const cultivos: { id: string; nombre: string }[] = [];
  for (const cid of cultivoIds) {
    const c = await getRecord("CULTIVOS", cid);
    if (c) cultivos.push({ id: cid, nombre: String(c.fields?.nombre || "") });
  }
  return {
    id: f.id,
    nombre: String(ff.nombre || ""),
    municipioId,
    municipioLabel,
    cultivos,
    movil: String(ff.movil || ""),
    email: String(ff.email || ""),
  };
}

async function cargarGenerador(id: string): Promise<DatosGenerador | null> {
  const g = await getRecord("GENERADORES", id);
  if (!g) return null;
  const gf = g.fields;
  let municipioLabel: string | null = null;
  const municipioId = Array.isArray(gf.municipio) ? String(gf.municipio[0]) : null;
  if (municipioId) {
    const m = await getRecord("MUNICIPIOS", municipioId);
    municipioLabel = m ? String(m.fields?.mundep || "") : null;
  }
  return {
    id: g.id,
    nombre: String(gf.nombre || ""),
    nit: String(gf.nit || ""),
    tipopersona: String(gf.tipopersona || ""),
    tipo: String(gf.tipo || ""),
    direccion: String(gf.direccion_sede || ""),
    municipioId,
    municipioLabel,
    movil: String(gf.movil || ""),
    email: String(gf.email || ""),
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
      const fincaIds: string[] = Array.isArray(t.contexto.fincas)
        ? (t.contexto.fincas as Array<{ id: string }>).map((f) => f.id)
        : t.recordId
          ? [t.recordId]
          : [];
      const fincasDisponibles: {
        id: string;
        nombre: string;
        generadorId: string;
        cultivos: { id: string; nombre: string }[];
      }[] = [];
      let fincaPrincipal: DatosFinca | null = null;
      let generadorPrincipal: DatosGenerador | null = null;
      for (const fid of fincaIds) {
        const f = await cargarFinca(fid);
        if (!f) continue;
        if (!fincaPrincipal && (fid === t.recordId || fincaIds.length === 1)) {
          fincaPrincipal = f;
        }
        // Para mostrar generador en el header.
        if (!generadorPrincipal) {
          const fincaRec = await getRecord("FINCAS", fid);
          const genId = Array.isArray(fincaRec?.fields.generador)
            ? String((fincaRec!.fields.generador as string[])[0])
            : null;
          if (genId) {
            generadorPrincipal = await cargarGenerador(genId);
            fincasDisponibles.push({
              id: f.id,
              nombre: f.nombre,
              generadorId: genId,
              cultivos: f.cultivos,
            });
          }
        } else {
          fincasDisponibles.push({
            id: f.id,
            nombre: f.nombre,
            generadorId: generadorPrincipal.id,
            cultivos: f.cultivos,
          });
        }
      }
      const coordinadores = await getCoordinadoresActivos();
      return {
        ...base,
        intent: "cert-nuevo",
        finca: fincaPrincipal,
        generador: generadorPrincipal,
        fincasDisponibles,
        coordinadores,
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
      return { ...base, intent: "editar-generador", generador };
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
  }
}
