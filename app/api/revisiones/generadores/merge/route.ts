import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// POST /api/revisiones/generadores/merge
// { survivorGeneradorId, deleteGeneradorId }
// Reasigna todas las FINCAS del generador duplicado → generador sobreviviente
// Luego elimina el generador duplicado
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { survivorGeneradorId, deleteGeneradorId } = await req.json();
  if (!survivorGeneradorId || !deleteGeneradorId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }
  if (survivorGeneradorId === deleteGeneradorId) {
    return NextResponse.json({ error: "No puedes fusionar un generador consigo mismo" }, { status: 400 });
  }

  // 1. Buscar FINCAS que apuntan al generador a eliminar
  const formula = `FIND('${deleteGeneradorId}', ARRAYJOIN({generador}, ','))`;
  const url = `https://api.airtable.com/v0/${BASE}/FINCAS?filterByFormula=${encodeURIComponent(formula)}&fields[]=generador&pageSize=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) {
    console.error("[gen-merge] error buscando fincas:", data.error);
    return NextResponse.json({ error: "Error buscando fincas" }, { status: 500 });
  }

  const fincasAfectadas: string[] = data.records.map((r: any) => r.id);

  // 2. Reasignar cada finca al generador sobreviviente (batches de 10)
  const BATCH = 10;
  for (let i = 0; i < fincasAfectadas.length; i += BATCH) {
    const chunk = fincasAfectadas.slice(i, i + BATCH);
    const patchBody = {
      records: chunk.map((id) => ({
        id,
        fields: { generador: [survivorGeneradorId] },
      })),
    };
    const patchRes = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("[gen-merge] error actualizando fincas:", err);
      return NextResponse.json({ error: "Error reasignando fincas" }, { status: 500 });
    }
    if (i + BATCH < fincasAfectadas.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // 3. Eliminar el generador duplicado
  const delRes = await fetch(`https://api.airtable.com/v0/${BASE}/GENERADORES/${deleteGeneradorId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!delRes.ok) {
    const err = await delRes.text();
    console.error("[gen-merge] error eliminando generador:", err);
    return NextResponse.json({ error: "Error eliminando generador duplicado" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fincasReasignadas: fincasAfectadas.length,
  });
}
