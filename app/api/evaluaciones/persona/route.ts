import { NextRequest, NextResponse } from "next/server";
import { getPersonaEvaluadaByTelefono } from "@/lib/airtable";

// GET /api/evaluaciones/persona?telefono=+573001234567
export async function GET(req: NextRequest) {
  const telefono = req.nextUrl.searchParams.get("telefono");
  if (!telefono) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const persona = await getPersonaEvaluadaByTelefono(telefono);
  if (!persona) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ found: true, persona });
}
