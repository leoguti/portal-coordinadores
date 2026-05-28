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
        fincaNombre?: string;
        fincaId?: string;
      }>
    ): Promise<void> {
      const fincaIds = Array.from(
        new Set(
          certs
            .filter((c) => c.fincaId && (!c.nombregenerador || !c.fincaNombre))
            .map((c) => c.fincaId!)
        )
      );
      if (fincaIds.length === 0) return;
      const CHUNK = 30;
      const fincaById = new Map<
        string,
        { nombre: string; generadorId: string | null }
      >();
      for (let i = 0; i < fincaIds.length; i += CHUNK) {
        const chunk = fincaIds.slice(i, i + CHUNK);
        const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
        const p = new URLSearchParams();
        p.set("filterByFormula", formula);
        for (const f of ["nombre", "generador"]) p.append("fields[]", f);
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
      const genById = new Map<string, { nombre: string; nit: string }>();
      for (let i = 0; i < genIds.length; i += CHUNK) {
        const chunk = genIds.slice(i, i + CHUNK);
        const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
        const p = new URLSearchParams();
        p.set("filterByFormula", formula);
        for (const f of ["nombre", "nit"]) p.append("fields[]", f);
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
          });
        }
      }
      for (const c of certs) {
        if (!c.fincaId) continue;
        const fincaInfo = fincaById.get(c.fincaId);
        if (!fincaInfo) continue;
        if (!c.fincaNombre) c.fincaNombre = fincaInfo.nombre;
        if (!c.nombregenerador && fincaInfo.generadorId) {
          const gen = genById.get(fincaInfo.generadorId);
          if (gen) {
            c.nombregenerador = gen.nombre;
            if (!c.generadorCedula) c.generadorCedula = gen.nit;
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
          generadorNombre: asStr(f.nombregenerador),
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
      const filtros = [`{estado}='pendiente'`];
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
        "fecha_solicitud",
        "solicitud_origen",
        "coordinador_solicitado",
      ]);
      const items = records.map((r) => {
        const f = r.fields;
        return {
          id: r.id,
          nombre: asStr(f.nombre),
          nit: asStr(f.nit),
          tipopersona: asStr(f.tipopersona),
          tipo: asStr(f.tipo),
          direccion: asStr(f.direccion_sede),
          municipioId: asArrStr(f.municipio)[0] || null,
          movil: asStr(f.movil),
          email: asStr(f.email),
          fechaSolicitud: asStr(f.fecha_solicitud),
          origen: asStr(f.solicitud_origen),
          coordinadorSolicitadoId: asArrStr(f.coordinador_solicitado)[0] || null,
          createdTime: r.createdTime,
        };
      });
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
      const items = records.map((r) => {
        const f = r.fields;
        return {
          id: r.id,
          nombre: asStr(f.nombre),
          generadorId: asArrStr(f.generador)[0] || null,
          municipioId: asArrStr(f.municipio)[0] || null,
          movil: asStr(f.movil),
          email: asStr(f.email),
          cultivosIds: asArrStr(f.cultivos),
          estado: asStr(f.estado),
          fechaSolicitud: asStr(f.fecha_solicitud),
          origen: asStr(f.solicitud_origen),
          cambiosPendientes: asStr(f.cambios_pendientes),
          coordinadorId: asArrStr(f.coordinador_id)[0] || null,
          createdTime: r.createdTime,
        };
      });
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
