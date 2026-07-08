/**
 * GET /api/certificados/pendientes?tipo=cert|generadores|fincas
 *
 * Bandeja unificada para el coordinador.
 *  - Coordinador: ve solo lo asignado a él.
 *  - Admin/Supervisor: ve todo. Acepta ?coordinadorId= para filtrar.
 *
 * Devuelve los registros pendientes con datos suficientes para renderizar
 * la lista sin más llamadas.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { getCultivosMap } from "@/lib/cultivosCache";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

async function fetchAll(
  table: string,
  filterByFormula: string,
  fields: string[]
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams();
    p.set("filterByFormula", filterByFormula);
    p.set("pageSize", "100");
    for (const f of fields) p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) throw new Error(`${table}: ${r.status}`);
    const data = await r.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

function asStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0] || "");
  if (v == null) return "";
  return String(v);
}

function asArrStr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : [];
}

/**
 * Parsea cambios_pendientes JSON y devuelve el diff de cambios (los
 * campos que el agricultor propuso modificar). Vacío si no hay JSON
 * válido. Usado para "preview" en el listado de pendientes.
 */
function parseCambiosPendientes(raw: unknown): Record<string, unknown> {
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

const LABEL_CAMPO: Record<string, string> = {
  nombre: "Nombre",
  movil: "Móvil",
  email: "Email",
  tipo: "Tipo",
  direccion_sede: "Dirección",
  direccion: "Dirección",
  municipio: "Municipio",
  cultivos: "Cultivos",
};

/**
 * Convierte el diff crudo en pares legibles para mostrar al coord
 * (resuelve IDs de municipios y cultivos a nombres).
 */
async function legibleizarDiff(
  diff: Record<string, unknown>,
  municipiosMap: Map<string, string>,
  cultivosMap: Map<string, string>
): Promise<Array<{ label: string; valor: string }>> {
  const out: Array<{ label: string; valor: string }> = [];
  for (const [k, v] of Object.entries(diff)) {
    const label = LABEL_CAMPO[k] || k;
    let valor: string;
    if (k === "municipio" && Array.isArray(v)) {
      const id = String((v as unknown[])[0] || "");
      valor = municipiosMap.get(id) || id || "—";
    } else if (k === "cultivos" && Array.isArray(v)) {
      const ids = (v as unknown[]).map(String);
      const nombres = ids.map((id) => cultivosMap.get(id) || id);
      valor = nombres.join(", ");
    } else if (Array.isArray(v)) {
      valor = (v as unknown[]).join(", ");
    } else {
      valor = v == null || v === "" ? "(vacío)" : String(v);
    }
    out.push({ label, valor });
  }
  return out;
}

/**
 * Resuelve un set de IDs de municipios → mapa id→label en una request.
 * Vacío si no hay IDs.
 */
async function fetchMunicipiosMap(
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const orParts = ids.map((id) => `RECORD_ID()='${id}'`).join(",");
  const formula = `OR(${orParts})`;
  const p = new URLSearchParams();
  p.set("filterByFormula", formula);
  p.set("pageSize", "100");
  p.append("fields[]", "mundep");
  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/MUNICIPIOS?${p}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r.ok) return map;
  const d = (await r.json()) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  for (const rec of d.records || []) {
    map.set(rec.id, String(rec.fields.mundep || ""));
  }
  return map;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const url = new URL(request.url);
  const tipo = (url.searchParams.get("tipo") || "cert") as
    | "cert"
    | "generadores"
    | "fincas";
  const coordinadorFiltroAdmin = isAdmin
    ? url.searchParams.get("coordinadorId") || null
    : null;
  const coordinadorId = isAdmin
    ? coordinadorFiltroAdmin
    : session.user.coordinatorRecordId;

  try {
    // Helper: resolver nombre+cédula del generador y nombre de finca para
    // certs creados con el esquema nuevo (FINCAS+GENERADORES) cuyos lookups
    // viejos vienen vacíos. Solo se llama si hace falta.
    async function enriquecerVíaFincas(
      certs: Array<{
        nombregenerador?: string;
        generadorCedula?: string;
        generadorTipoPersona?: string;
        fincaNombre?: string;
        fincaId?: string;
        movilAgricultor?: string;
      }>
    ): Promise<void> {
      const fincaIds = Array.from(
        new Set(
          certs
            .filter(
              (c) =>
                c.fincaId &&
                (!c.nombregenerador || !c.fincaNombre || !c.movilAgricultor)
            )
            .map((c) => c.fincaId!)
        )
      );
      if (fincaIds.length === 0) return;
      const CHUNK = 30;
      const fincaById = new Map<
        string,
        { nombre: string; movil: string; generadorId: string | null }
      >();
      for (let i = 0; i < fincaIds.length; i += CHUNK) {
        const chunk = fincaIds.slice(i, i + CHUNK);
        const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
        const p = new URLSearchParams();
        p.set("filterByFormula", formula);
        for (const f of ["nombre", "generador", "movil"]) p.append("fields[]", f);
        p.set("pageSize", "100");
        const r = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/FINCAS?${p}`,
          { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
        );
        if (!r.ok) continue;
        const d = await r.json();
        for (const rec of d.records || []) {
          fincaById.set(rec.id, {
            nombre: String(rec.fields.nombre || ""),
            movil: String(rec.fields.movil || ""),
            generadorId: Array.isArray(rec.fields.generador)
              ? String(rec.fields.generador[0] || "")
              : null,
          });
        }
      }
      // Generadores necesarios
      const genIds = Array.from(
        new Set(
          [...fincaById.values()]
            .map((f) => f.generadorId)
            .filter((x): x is string => !!x)
        )
      );
      const genById = new Map<
        string,
        { nombre: string; nit: string; tipopersona: string; movil: string }
      >();
      for (let i = 0; i < genIds.length; i += CHUNK) {
        const chunk = genIds.slice(i, i + CHUNK);
        const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
        const p = new URLSearchParams();
        p.set("filterByFormula", formula);
        for (const f of ["nombre", "nit", "tipopersona", "movil"]) p.append("fields[]", f);
        p.set("pageSize", "100");
        const r = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/GENERADORES?${p}`,
          { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
        );
        if (!r.ok) continue;
        const d = await r.json();
        for (const rec of d.records || []) {
          genById.set(rec.id, {
            nombre: String(rec.fields.nombre || ""),
            nit: String(rec.fields.nit || ""),
            tipopersona: String(rec.fields.tipopersona || ""),
            movil: String(rec.fields.movil || ""),
          });
        }
      }
      for (const c of certs) {
        if (!c.fincaId) continue;
        const fincaInfo = fincaById.get(c.fincaId);
        if (!fincaInfo) continue;
        if (!c.fincaNombre) c.fincaNombre = fincaInfo.nombre;
        // Móvil del agricultor: finca primero, generador como fallback
        // (mismo orden que fincaGeneradorResolver).
        if (!c.movilAgricultor) c.movilAgricultor = fincaInfo.movil;
        if (fincaInfo.generadorId) {
          const gen = genById.get(fincaInfo.generadorId);
          if (gen) {
            if (!c.nombregenerador) c.nombregenerador = gen.nombre;
            if (!c.generadorCedula) c.generadorCedula = gen.nit;
            if (!c.generadorTipoPersona) c.generadorTipoPersona = gen.tipopersona;
            if (!c.movilAgricultor) c.movilAgricultor = gen.movil;
          }
        }
      }
    }

    if (tipo === "cert") {
      const filtros: string[] = [`{estado}='pendiente'`];
      if (coordinadorId) {
        filtros.push(
          `FIND('${coordinadorId}', ARRAYJOIN({id_coordinador})) > 0`
        );
      }
      const formula =
        filtros.length === 1 ? filtros[0] : `AND(${filtros.join(",")})`;
      const records = await fetchAll("Certificados", formula, [
        "consecutivo",
        "fecha_solicitud",
        "solicitud_origen",
        "fechadevolucion",
        "lugardevolucion",
        "rigidos",
        "flexibles",
        "metalicos",
        "embalaje",
        "total",
        "triplelavado",
        "observaciones",
        "id_coordinador",
        "nombrecoordinador",
        "nombregenerador",
        "cedulagenerador",
        "movilgenerador",
        "FINCAS",
        "municipiodevolucion",
        "cultivos_certificado",
      ]);
      const items = records.map((r) => {
        const f = r.fields;
        const fincaIds = asArrStr(f.FINCAS);
        return {
          id: r.id,
          consecutivo: Number(f.consecutivo) || 0,
          fechaSolicitud: asStr(f.fecha_solicitud),
          origen: asStr(f.solicitud_origen),
          fechadevolucion: asStr(f.fechadevolucion),
          lugardevolucion: asStr(f.lugardevolucion),
          rigidos: Number(f.rigidos) || 0,
          flexibles: Number(f.flexibles) || 0,
          metalicos: Number(f.metalicos) || 0,
          embalaje: Number(f.embalaje) || 0,
          total: Number(f.total) || 0,
          triplelavado: asStr(f.triplelavado),
          observaciones: asStr(f.observaciones),
          coordinadorId: asStr(f.id_coordinador),
          coordinadorNombre: asStr(f.nombrecoordinador),
          nombregenerador: asStr(f.nombregenerador),
          generadorCedula: asStr(f.cedulagenerador),
          generadorTipoPersona: "",
          generadorNombre: asStr(f.nombregenerador),
          movilAgricultor: asStr(f.movilgenerador),
          fincaId: fincaIds[0] || "",
          fincaNombre: "",
          municipioDevolucion: asStr(f.municipiodevolucion),
          createdTime: r.createdTime,
        };
      });
      // Enriquecer certs WhatsApp/nuevos cuyos lookups vienen vacíos.
      await enriquecerVíaFincas(items);
      // Asegurar coherencia entre nombregenerador (helper) y generadorNombre (UI).
      for (const it of items) {
        if (!it.generadorNombre && it.nombregenerador) {
          it.generadorNombre = it.nombregenerador;
        }
      }
      // Ordenar por fecha de solicitud desc.
      items.sort((a, b) => (b.fechaSolicitud > a.fechaSolicitud ? 1 : -1));
      return NextResponse.json({ tipo: "cert", items });
    }

    if (tipo === "generadores") {
      const filtros = [`OR({estado}='pendiente', {estado}='pendiente_revision')`];
      if (coordinadorId) {
        filtros.push(
          `FIND('${coordinadorId}', ARRAYJOIN({coordinador_solicitado})) > 0`
        );
      }
      const formula =
        filtros.length === 1 ? filtros[0] : `AND(${filtros.join(",")})`;
      const records = await fetchAll("GENERADORES", formula, [
        "nombre",
        "nit",
        "tipopersona",
        "tipo",
        "direccion_sede",
        "municipio",
        "movil",
        "email",
        "estado",
        "fecha_solicitud",
        "solicitud_origen",
        "coordinador_solicitado",
        "cambios_pendientes",
      ]);
      // Recolectar IDs de municipios y cultivos en los diffs para
      // resolver labels en una sola tanda.
      const munIds = new Set<string>();
      for (const r of records) {
        const diff = parseCambiosPendientes(r.fields.cambios_pendientes);
        if (Array.isArray(diff.municipio)) {
          (diff.municipio as unknown[]).forEach((id) => munIds.add(String(id)));
        }
      }
      const [cultivosMap, municipiosMap] = await Promise.all([
        getCultivosMap().catch(() => new Map<string, string>()),
        fetchMunicipiosMap(Array.from(munIds)),
      ]);
      const items = await Promise.all(
        records.map(async (r) => {
          const f = r.fields;
          const diff = parseCambiosPendientes(f.cambios_pendientes);
          const get = (key: string, fallback: string): string =>
            key in diff ? String(diff[key] ?? "") : fallback;
          const getArr = (key: string, fallback: string[]): string[] => {
            if (!(key in diff)) return fallback;
            const v = diff[key];
            return Array.isArray(v) ? (v as unknown[]).map(String) : fallback;
          };
          const diffLegible = await legibleizarDiff(
            diff,
            municipiosMap,
            cultivosMap
          );
          return {
            id: r.id,
            nombre: get("nombre", asStr(f.nombre)),
            nit: asStr(f.nit),
            tipopersona: asStr(f.tipopersona),
            tipo: get("tipo", asStr(f.tipo)),
            direccion: get("direccion_sede", asStr(f.direccion_sede)),
            municipioId:
              getArr("municipio", asArrStr(f.municipio))[0] || null,
            movil: get("movil", asStr(f.movil)),
            email: get("email", asStr(f.email)),
            estado: asStr(f.estado),
            fechaSolicitud: asStr(f.fecha_solicitud),
            origen: asStr(f.solicitud_origen),
            coordinadorSolicitadoId:
              asArrStr(f.coordinador_solicitado)[0] || null,
            tieneCambios: Object.keys(diff).length > 0,
            camposCambiados: Object.keys(diff),
            diffLegible,
            createdTime: r.createdTime,
          };
        })
      );
      items.sort((a, b) => (b.fechaSolicitud > a.fechaSolicitud ? 1 : -1));
      return NextResponse.json({ tipo: "generadores", items });
    }

    if (tipo === "fincas") {
      const filtros = [`OR({estado}='pendiente', {estado}='pendiente_revision')`];
      if (coordinadorId) {
        filtros.push(
          `FIND('${coordinadorId}', ARRAYJOIN({coordinador_id})) > 0`
        );
      }
      const formula =
        filtros.length === 1 ? filtros[0] : `AND(${filtros.join(",")})`;
      const records = await fetchAll("FINCAS", formula, [
        "nombre",
        "generador",
        "municipio",
        "movil",
        "email",
        "cultivos",
        "estado",
        "fecha_solicitud",
        "solicitud_origen",
        "cambios_pendientes",
        "coordinador_id",
      ]);
      const munIds = new Set<string>();
      for (const r of records) {
        const diff = parseCambiosPendientes(r.fields.cambios_pendientes);
        if (Array.isArray(diff.municipio)) {
          (diff.municipio as unknown[]).forEach((id) => munIds.add(String(id)));
        }
      }
      const [cultivosMap, municipiosMap] = await Promise.all([
        getCultivosMap().catch(() => new Map<string, string>()),
        fetchMunicipiosMap(Array.from(munIds)),
      ]);
      const items = await Promise.all(
        records.map(async (r) => {
          const f = r.fields;
          const diff = parseCambiosPendientes(f.cambios_pendientes);
          const get = (key: string, fallback: string): string =>
            key in diff ? String(diff[key] ?? "") : fallback;
          const getArr = (key: string, fallback: string[]): string[] => {
            if (!(key in diff)) return fallback;
            const v = diff[key];
            return Array.isArray(v) ? (v as unknown[]).map(String) : fallback;
          };
          const diffLegible = await legibleizarDiff(
            diff,
            municipiosMap,
            cultivosMap
          );
          return {
            id: r.id,
            nombre: get("nombre", asStr(f.nombre)),
            generadorId: asArrStr(f.generador)[0] || null,
            municipioId:
              getArr("municipio", asArrStr(f.municipio))[0] || null,
            movil: get("movil", asStr(f.movil)),
            email: get("email", asStr(f.email)),
            cultivosIds: getArr("cultivos", asArrStr(f.cultivos)),
            estado: asStr(f.estado),
            fechaSolicitud: asStr(f.fecha_solicitud),
            origen: asStr(f.solicitud_origen),
            cambiosPendientes: asStr(f.cambios_pendientes),
            coordinadorId: asArrStr(f.coordinador_id)[0] || null,
            tieneCambios: Object.keys(diff).length > 0,
            camposCambiados: Object.keys(diff),
            diffLegible,
            createdTime: r.createdTime,
          };
        })
      );
      items.sort((a, b) => (b.fechaSolicitud > a.fechaSolicitud ? 1 : -1));
      return NextResponse.json({ tipo: "fincas", items });
    }

    return NextResponse.json({ error: "tipo desconocido" }, { status: 400 });
  } catch (err) {
    console.error("[certificados/pendientes] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/certificados/pendientes/counts
 *  Devuelve solo los conteos por tipo (para el badge del sidebar).
 */
export const dynamic = "force-dynamic";
