import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// POST /api/revisiones/fincas/merge
// { survivorFincaId: string, deleteFincaId: string }
// Migra todas las ubicaciones que apuntan a deleteFincaId → survivorFincaId
// Luego elimina deleteFincaId de FINCAS
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { survivorFincaId, deleteFincaId } = body;
  if (!survivorFincaId || !deleteFincaId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }
  if (survivorFincaId === deleteFincaId) {
    return NextResponse.json({ error: "No puedes fusionar una finca consigo misma" }, { status: 400 });
  }

  // 1. Buscar ubicaciones que apuntan a la finca a eliminar
  const formula = `FIND('${deleteFincaId}', ARRAYJOIN({finca}, ','))`;
  const url = `https://api.airtable.com/v0/${BASE}/ubicaciones?filterByFormula=${encodeURIComponent(formula)}&fields[]=finca&pageSize=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) {
    console.error("[merge] error buscando ubicaciones:", data.error);
    return NextResponse.json({ error: "Error buscando ubicaciones" }, { status: 500 });
  }

  const ubicacionesAfectadas: string[] = data.records.map((r: any) => r.id);

  // 2. Actualizar cada ubicacion para apuntar al survivor (en batches de 10)
  const BATCH = 10;
  for (let i = 0; i < ubicacionesAfectadas.length; i += BATCH) {
    const chunk = ubicacionesAfectadas.slice(i, i + BATCH);
    const patchBody = {
      records: chunk.map((id) => ({
        id,
        fields: { finca: [survivorFincaId] },
      })),
    };
    const patchRes = await fetch(`https://api.airtable.com/v0/${BASE}/ubicaciones`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("[merge] error actualizando ubicaciones:", err);
      return NextResponse.json({ error: "Error actualizando ubicaciones" }, { status: 500 });
    }
    // Respetar rate limit de Airtable
    if (i + BATCH < ubicacionesAfectadas.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // 3. Eliminar la finca duplicada
  const delRes = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS/${deleteFincaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!delRes.ok) {
    const err = await delRes.text();
    console.error("[merge] error eliminando finca:", err);
    return NextResponse.json({ error: "Error eliminando finca duplicada" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ubicacionesMigradas: ubicacionesAfectadas.length,
  });
}
