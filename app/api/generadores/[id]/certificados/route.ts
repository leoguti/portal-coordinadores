/**
 * GET /api/generadores/[id]/certificados
 * Fetches the ubicacion from Airtable to get its Certificados[] IDs,
 * then queries Neon for those records.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // 1. Get Certificados IDs from Airtable ubicacion
  const atRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!atRes.ok) {
    return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });
  }
  const atData = await atRes.json();
  const certIds: string[] = atData.fields?.Certificados || [];

  if (certIds.length === 0) {
    return NextResponse.json({ certificados: [], total: 0 });
  }

  // 2. Query Neon for those IDs
  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    const placeholders = certIds.map((_, i) => `$${i + 1}`).join(",");
    const res = await pg.query(
      `SELECT consecutivo, fechadevolucion, ano, municipiodevolucion,
              total, rigidos, flexibles, metalicos, embalaje,
              triplelavado, nombrecoordinador, certificadopdf_r2_url
       FROM certificados
       WHERE airtable_id IN (${placeholders})
       ORDER BY consecutivo DESC`,
      certIds
    );
    return NextResponse.json({ certificados: res.rows, total: res.rowCount });
  } finally {
    await pg.end();
  }
}
