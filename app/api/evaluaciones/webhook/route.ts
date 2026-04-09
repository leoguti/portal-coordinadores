import { NextRequest, NextResponse } from "next/server";
import {
  getPersonaEvaluadaByTelefono,
  findMunicipioByName,
  createPersonaEvaluada,
  createEvaluacion,
} from "@/lib/airtable";

export const maxDuration = 60;

/**
 * POST /api/evaluaciones/webhook
 *
 * Llamado por TextIt al finalizar el flujo de evaluación.
 *
 * Body esperado:
 * {
 *   actividadId: string,       // Record ID de la actividad en Airtable
 *   telefono: string,          // Número WhatsApp del participante
 *   nombre?: string,           // Solo si es persona nueva
 *   documento?: string,        // Solo si es persona nueva
 *   municipio?: string,        // Nombre del municipio (texto), solo si es nueva
 *   respuestaP1: "A"|"B"|"C"|"D",
 *   respuestaP2: "A"|"B"|"C"|"D",
 *   respuestaP3: "A"|"B"|"C"|"D",
 *   puntaje: number            // 0-3
 * }
 */
export async function POST(req: NextRequest) {
  let body: {
    actividadId?: string;
    telefono?: string;
    nombre?: string;
    documento?: string;
    municipio?: string;
    respuestaP1?: string;
    respuestaP2?: string;
    respuestaP3?: string;
    puntaje?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { actividadId, telefono, respuestaP1, respuestaP2, respuestaP3 } = body;
  const puntaje = Number(body.puntaje);

  if (!telefono || !respuestaP1 || !respuestaP2 || !respuestaP3 || isNaN(puntaje) || puntaje < 0) {
    return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
  }

  // Normalizar teléfono: quitar prefijo "whatsapp:" si viene de TextIt
  const telefonoNorm = telefono.replace(/^whatsapp:/, "");

  // 1. Buscar o crear Persona Evaluada
  let personaId: string | null = null;

  const personaExistente = await getPersonaEvaluadaByTelefono(telefonoNorm);
  if (personaExistente) {
    personaId = personaExistente.id;
  } else {
    // Persona nueva — crear con los datos disponibles (nombre/documento opcionales)
    const { nombre, documento, municipio } = body;

    // Resolver municipio: TextIt envía el record ID directamente desde el sub-flujo
    // Si empieza con "rec" ya es un ID de Airtable, usarlo directo.
    // Si no, intentar buscar por nombre (fallback).
    let municipioId: string | null = null;
    if (municipio) {
      if (municipio.startsWith("rec")) {
        municipioId = municipio;
      } else {
        municipioId = await findMunicipioByName(municipio);
      }
    }

    personaId = await createPersonaEvaluada({
      nombre: nombre || "",
      documento: documento || "",
      telefono: telefonoNorm,
      municipioId,
    });
    if (!personaId) {
      return NextResponse.json({ error: "Error creando persona evaluada" }, { status: 500 });
    }
  }

  // 2. Crear Evaluación
  const evaluacionId = await createEvaluacion({
    actividadId,
    personaId,
    respuestaP1,
    respuestaP2,
    respuestaP3,
    puntaje,
  });

  if (!evaluacionId) {
    return NextResponse.json({ error: "Error creando evaluación" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, evaluacionId, personaId });
}
