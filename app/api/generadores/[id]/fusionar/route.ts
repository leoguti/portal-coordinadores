/**
 * POST /api/generadores/[id]/fusionar
 * Merges the given ubicacion INTO principalId:
 *   1. Reads Certificados linked to [id]
 *   2. Re-links each certificate to principalId
 *   3. Deletes [id] from Airtable
 *
 * Admin/Supervisor only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function airtableFetch(path: string, options?: RequestInit) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  return res;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isAdminOrSupervisor(session.user?.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id: duplicadoId } = await params;
  const body = await req.json();
  const { principalId } = body as { principalId: string };

  if (!principalId || principalId === duplicadoId) {
    return NextResponse.json({ error: "principalId inválido" }, { status: 400 });
  }

  // 1. Get the duplicate ubicacion to read its Certificados
  const dupRes = await airtableFetch(`ubicaciones/${duplicadoId}`);
  if (!dupRes.ok) {
    return NextResponse.json({ error: "Ubicación duplicada no encontrada" }, { status: 404 });
  }
  const dupData = await dupRes.json();
  const certificados: string[] = dupData.fields?.Certificados || [];

  // 2. Re-link each certificate to the principal
  let reasignados = 0;
  for (const certId of certificados) {
    await delay(220);
    const patchRes = await airtableFetch(`Certificados/${certId}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { link_ubicacion: [principalId] } }),
    });
    if (patchRes.ok) {
      reasignados++;
    } else {
      const err = await patchRes.text();
      console.error(`[fusionar] Error reasignando cert ${certId}:`, err);
    }
  }

  // 3. Delete the duplicate ubicacion
  await delay(300);
  const delRes = await airtableFetch(`ubicaciones/${duplicadoId}`, { method: "DELETE" });
  if (!delRes.ok) {
    const err = await delRes.text();
    console.error("[fusionar] Error eliminando duplicado:", err);
    return NextResponse.json(
      { error: "Certificados reasignados pero no se pudo eliminar la duplicada", reasignados },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, reasignados, eliminado: duplicadoId });
}
