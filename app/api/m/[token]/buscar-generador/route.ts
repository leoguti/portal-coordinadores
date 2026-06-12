/**
 * GET /api/m/[token]/buscar-generador
 *
 * Búsqueda de generadores/fincas para el form de certificado del COORDINADOR
 * (magic-link, intent "cert-coordinador"). El token es la auth — no requiere
 * sesión. Solo lectura y solo mientras el token esté vigente.
 *
 *   ?q=<texto>          → generadores por nombre o cédula/NIT (máx 15)
 *   ?generador=<recId>  → fincas de ese generador (con cultivos y estado)
 */

import { NextResponse } from "next/server";
import { leerToken, estaConsumido, estaExpirado } from "@/lib/edicionTokens";

export const maxDuration = 30;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function at(path: string): Promise<Response> {
  return fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const t = token && token.length >= 16 ? await leerToken(token) : null;
  if (!t || estaConsumido(t) || estaExpirado(t)) {
    return NextResponse.json({ error: "Link no válido" }, { status: 410 });
  }
  if (t.intent !== "cert-coordinador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const generadorId = (searchParams.get("generador") || "").trim();

  try {
    // ── Fincas de un generador ────────────────────────────────────────────
    if (generadorId) {
      const genRes = await at(`/GENERADORES/${generadorId}`);
      if (!genRes.ok) return NextResponse.json({ fincas: [] });
      const gen = (await genRes.json()) as {
        fields: Record<string, unknown>;
      };
      const fincaIds: string[] = Array.isArray(gen.fields?.FINCAS)
        ? (gen.fields.FINCAS as string[])
        : [];
      if (fincaIds.length === 0) return NextResponse.json({ fincas: [] });

      const formula = `OR(${fincaIds
        .slice(0, 50)
        .map((id) => `RECORD_ID()='${escape(id)}'`)
        .join(",")})`;
      const p = new URLSearchParams();
      p.set("filterByFormula", formula);
      p.set("pageSize", "50");
      for (const f of ["nombre", "estado", "cultivos"]) p.append("fields[]", f);
      const r = await at(`/FINCAS?${p}`);
      if (!r.ok) return NextResponse.json({ fincas: [] });
      const d = (await r.json()) as {
        records: Array<{ id: string; fields: Record<string, unknown> }>;
      };

      // Resolver nombres de cultivos (pocas fincas → pocas lecturas).
      const cultivoIds = new Set<string>();
      for (const rec of d.records) {
        for (const c of (rec.fields.cultivos as string[]) || []) {
          cultivoIds.add(c);
        }
      }
      const nombresCultivo = new Map<string, string>();
      for (const cid of Array.from(cultivoIds).slice(0, 30)) {
        const cr = await at(`/CULTIVOS/${cid}`);
        if (cr.ok) {
          const cd = (await cr.json()) as { fields: Record<string, unknown> };
          nombresCultivo.set(cid, String(cd.fields?.nombre || ""));
        }
      }

      const fincas = d.records.map((rec) => ({
        id: rec.id,
        nombre: String(rec.fields.nombre || ""),
        estado: String(rec.fields.estado || ""),
        cultivos: ((rec.fields.cultivos as string[]) || [])
          .map((cid) => nombresCultivo.get(cid) || "")
          .filter(Boolean),
      }));
      fincas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return NextResponse.json({ fincas });
    }

    // ── Búsqueda de generadores por nombre o cédula/NIT ───────────────────
    if (q.length < 2) return NextResponse.json({ results: [] });
    const qLower = escape(q.toLowerCase());
    const formula = `OR(FIND('${qLower}', LOWER({nombre})), FIND('${qLower}', LOWER({nit} & '')))`;
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    p.set("pageSize", "15");
    p.set("maxRecords", "15");
    for (const f of ["nombre", "nit", "tipopersona", "FINCAS"]) {
      p.append("fields[]", f);
    }
    const r = await at(`/GENERADORES?${p}`);
    if (!r.ok) {
      console.error(`[m/buscar-generador] Airtable ${r.status}`);
      return NextResponse.json({ error: "Error consultando" }, { status: 500 });
    }
    const d = (await r.json()) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    const results = d.records.map((rec) => ({
      id: rec.id,
      nombre: String(rec.fields.nombre || ""),
      nit: String(rec.fields.nit || ""),
      tipopersona: String(rec.fields.tipopersona || ""),
      numFincas: Array.isArray(rec.fields.FINCAS)
        ? (rec.fields.FINCAS as string[]).length
        : 0,
    }));
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[m/buscar-generador] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
