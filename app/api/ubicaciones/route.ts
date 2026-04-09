import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/ubicaciones?q=&sort=conteo&page=1&pageSize=50
 *
 * Lista ubicaciones (generadores) con búsqueda y ordenamiento.
 * Requiere sesión NextAuth.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "conteo"; // conteo | nombre | municipio
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const apiKey = process.env.AIRTABLE_API_KEY!;
  const baseId = process.env.AIRTABLE_BASE_ID!;

  // Build filter formula
  let filter = "";
  if (q.length >= 2) {
    const escaped = q.replace(/"/g, '\\"');
    filter = `OR(
      FIND(LOWER("${escaped}"), LOWER({nombregenerador})),
      FIND(LOWER("${escaped}"), LOWER({cedulagenerador})),
      FIND(LOWER("${escaped}"), LOWER({municipiogenerador})),
      FIND(LOWER("${escaped}"), LOWER({cultivogenerador}))
    )`;
  }

  // Sort field mapping
  const sortField =
    sort === "nombre" ? "nombregenerador" :
    sort === "municipio" ? "municipiogenerador" :
    "conteo_certificados";
  const sortDir = sort === "conteo" ? "desc" : "asc";

  const params = new URLSearchParams({
    "sort[0][field]": sortField,
    "sort[0][direction]": sortDir,
    pageSize: String(pageSize),
  });
  if (filter) params.set("filterByFormula", filter);

  // Airtable doesn't support offset-based pagination, we use offset token.
  // For simplicity we fetch up to pageSize records (first page only for now).
  // A full paginated implementation would need to chain offset tokens.
  const url = `https://api.airtable.com/v0/${baseId}/ubicaciones?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error consultando Airtable" }, { status: 500 });
    }

    const data = await res.json();
    const records = data.records ?? [];

    const ubicaciones = records.map((r: any) => ({
      id: r.id,
      nombre: r.fields.nombregenerador || "",
      cedula: r.fields.cedulagenerador || "",
      direccion: r.fields.direcciongenerador || "",
      municipio: r.fields.municipiogenerador || "",
      mundep: r.fields.mundep?.[0] || r.fields.municipiogenerador || "",
      cultivo: r.fields.cultivogenerador || "",
      email: r.fields.emailgenerador || "",
      movil: r.fields.movilgenerador || "",
      tipo: r.fields.tipogenerador || "",
      conteo_certificados: r.fields.conteo_certificados ?? 0,
      tienecertificado: r.fields.tienecertificado ?? false,
      codigomunId: r.fields.CODIGOMUN?.[0] || null,
    }));

    return NextResponse.json({
      ubicaciones,
      total: ubicaciones.length,
      offset: data.offset ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
