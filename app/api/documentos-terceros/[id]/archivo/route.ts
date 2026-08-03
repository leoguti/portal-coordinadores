import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { TABLA_DOCUMENTOS, leerArchivoR2 } from "@/lib/documentosTerceros";

export const maxDuration = 30;

/**
 * GET /api/documentos-terceros/[id]/archivo
 *
 * Sirve el archivo desde R2 SOLO con sesión válida. La URL del bucket nunca
 * se expone: este endpoint es la única puerta a los documentos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${TABLA_DOCUMENTOS}/${id}`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  const rec = await res.json();
  const key = rec.fields?.archivo_key;
  const nombre = rec.fields?.archivo_nombre || "documento";
  if (!key) {
    return NextResponse.json({ error: "Documento sin archivo" }, { status: 404 });
  }

  const archivo = await leerArchivoR2(key);
  if (!archivo) {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(archivo.body), {
    headers: {
      "Content-Type": archivo.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
