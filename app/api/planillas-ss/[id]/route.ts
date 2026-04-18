import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// DELETE /api/planillas-ss/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/PlanillasSS/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[planillas/delete]", err);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
