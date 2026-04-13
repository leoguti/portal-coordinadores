/**
 * GET /api/generadores/duplicados
 * Fetches ALL ubicaciones, groups by NIT/cédula prefix (all digits except last),
 * returns groups of 2+ as potential duplicates.
 *
 * Admin/Supervisor only.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

interface UbicacionRaw {
  id: string;
  nombre: string;
  cedula: string;
  municipio: string;
  cultivo: string;
  conteo: number;
}

/** Strips non-digits and removes the last digit → grouping key */
function nitPrefix(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return ""; // too short to be meaningful
  return digits.slice(0, -1);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isAdminOrSupervisor(session.user?.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const fields = [
    "nombregenerador",
    "cedulagenerador",
    "municipiogenerador",
    "cultivogenerador",
    "conteo_certificados",
  ];
  const fieldParams = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");

  const all: UbicacionRaw[] = [];
  let offset: string | undefined;

  do {
    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones` +
      `?${fieldParams}&pageSize=100` +
      (offset ? `&offset=${offset}` : "");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[duplicados] Airtable:", err);
      return NextResponse.json({ error: "Error consultando Airtable" }, { status: 500 });
    }

    const data = (await res.json()) as {
      records: {
        id: string;
        fields: {
          nombregenerador?: string;
          cedulagenerador?: string;
          municipiogenerador?: string;
          cultivogenerador?: string;
          conteo_certificados?: number;
        };
      }[];
      offset?: string;
    };

    for (const r of data.records) {
      all.push({
        id: r.id,
        nombre: r.fields.nombregenerador || "Sin nombre",
        cedula: r.fields.cedulagenerador || "",
        municipio: r.fields.municipiogenerador || "",
        cultivo: r.fields.cultivogenerador || "",
        conteo: r.fields.conteo_certificados || 0,
      });
    }

    offset = data.offset;
  } while (offset);

  // Group by NIT prefix
  const byPrefix = new Map<string, UbicacionRaw[]>();
  for (const u of all) {
    if (!u.cedula) continue;
    const prefix = nitPrefix(u.cedula);
    if (!prefix) continue;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix)!.push(u);
  }

  // Only groups with 2+ members, sorted by count desc inside each group
  const grupos = Array.from(byPrefix.entries())
    .filter(([, members]) => members.length >= 2)
    .map(([prefix, members]) => ({
      prefix,
      members: members.sort((a, b) => b.conteo - a.conteo),
      totalCerts: members.reduce((s, m) => s + m.conteo, 0),
    }))
    .sort((a, b) => b.totalCerts - a.totalCerts);

  return NextResponse.json({ grupos, total: all.length, grupos_count: grupos.length });
}
