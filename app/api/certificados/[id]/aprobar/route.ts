/**
 * POST /api/certificados/[id]/aprobar
 *
 * Aprueba un certificado pendiente:
 *  1. Verifica ownership (coordinador del cert o admin).
 *  2. Aplica edits si el coord cambió kilos / triple lavado / lugar antes de aprobar.
 *  3. Genera el PDF, lo adjunta a Airtable, programa R2/Neon/email en background.
 *  4. Marca estado="aprobado", fecha_aprobacion, aprobado_por.
 *  5. (Sprint 6) notificará al agricultor por WhatsApp.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  construirPdfProps,
  generarYAdjuntarPDF,
} from "@/lib/certificadosCore";
import { resolveGeneradorDataFromFinca } from "@/lib/fincaGeneradorResolver";
import { notificarCertAprobado } from "@/lib/textitNotify";

export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

async function atFetch(path: string, init: RequestInit = {}) {
  return fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

interface EditableBody {
  rigidos?: number;
  flexibles?: number;
  metalicos?: number;
  embalaje?: number;
  triplelavado?: string;
  lugardevolucion?: string;
  observaciones?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordId = session.user.coordinatorRecordId;

  try {
    // 1. Leer cert
    const r1 = await atFetch(`/Certificados/${id}`);
    if (!r1.ok) {
      return NextResponse.json(
        { error: "Certificado no encontrado" },
        { status: 404 }
      );
    }
    const rec = await r1.json();
    const f = rec.fields as Record<string, unknown>;

    if (String(f.estado || "") !== "pendiente") {
      return NextResponse.json(
        { error: `El certificado no está pendiente (estado=${f.estado})` },
        { status: 409 }
      );
    }

    // 2. Ownership
    const certCoordIds = Array.isArray(f.id_coordinador)
      ? (f.id_coordinador as string[])
      : [];
    if (!isAdmin && !certCoordIds.includes(coordId)) {
      return NextResponse.json(
        { error: "Este certificado no está asignado a ti" },
        { status: 403 }
      );
    }

    // 3. Edits opcionales antes de aprobar
    let body: EditableBody = {};
    try {
      body = (await request.json()) as EditableBody;
    } catch {
      body = {};
    }
    const edits: Record<string, unknown> = {};
    for (const k of ["rigidos", "flexibles", "metalicos", "embalaje"] as const) {
      if (typeof body[k] === "number" && body[k]! >= 0) edits[k] = body[k];
    }
    for (const k of ["triplelavado", "lugardevolucion", "observaciones"] as const) {
      if (typeof body[k] === "string") edits[k] = body[k];
    }
    if (Object.keys(edits).length > 0) {
      const r2 = await atFetch(`/Certificados/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: edits, typecast: true }),
      });
      if (!r2.ok) {
        return NextResponse.json(
          { error: "Error guardando edits: " + (await r2.text()) },
          { status: 500 }
        );
      }
      // Recargar para usar valores nuevos.
      const r3 = await atFetch(`/Certificados/${id}`);
      const updated = await r3.json();
      Object.assign(f, updated.fields);
    }

    // 4. Construir pdfProps a partir del cert + finca vinculada.
    const fincaIds = Array.isArray(f.FINCAS) ? (f.FINCAS as string[]) : [];
    const resolved = fincaIds[0]
      ? await resolveGeneradorDataFromFinca(
          AIRTABLE_API_KEY,
          AIRTABLE_BASE_ID,
          fincaIds[0]
        )
      : null;
    // La fecha de aprobación es AHORA: el PDF se genera antes del PATCH que
    // marca el estado, así que se pasa explícita (no existe aún en el record).
    const fechaAprobacionIso = new Date().toISOString();
    const pdfProps = construirPdfProps(f, resolved, {
      generacion: String(f.fecha_solicitud || "") || rec.createdTime,
      aprobacion: fechaAprobacionIso,
    });
    if (!pdfProps.consecutivo) {
      return NextResponse.json(
        { error: "El certificado no tiene consecutivo asignado" },
        { status: 500 }
      );
    }

    // 5. Generar PDF + Blob + PATCH attach.
    const municipioDevId = Array.isArray(f.idmunicipiodevolucion)
      ? String((f.idmunicipiodevolucion as string[])[0] || "")
      : "";
    const pdfResult = await generarYAdjuntarPDF(
      {
        recordId: id,
        pdfProps,
        coordinadorId: certCoordIds[0] || coordId,
        municipioDevolucionId: municipioDevId,
        airtableCreatedTime: rec.createdTime,
        after,
      },
      "whatsapp"
    );

    // 6. Marcar estado=aprobado.
    const r4 = await atFetch(`/Certificados/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          estado: "aprobado",
          fecha_aprobacion: fechaAprobacionIso,
          aprobado_por: [coordId],
        },
        typecast: true,
      }),
    });
    if (!r4.ok) {
      return NextResponse.json(
        { error: "PDF generado pero error marcando aprobado: " + (await r4.text()) },
        { status: 500 }
      );
    }

    console.log(
      `[certificados/${id}/aprobar] aprobado por ${coordId} consecutivo=${pdfProps.consecutivo}`
    );

    // Notificar al agricultor por WhatsApp (background — no bloquea respuesta).
    // Preferimos el R2 URL (permanente) sobre el Blob URL (60s). Si por
    // algún motivo R2 falló, caemos al Blob URL como fallback (TextIt suele
    // descargar el archivo a su CDN antes de que expire).
    after(async () => {
      try {
        const telefono = pdfProps.movilgenerador;
        if (telefono) {
          const pdfUrlFinal = pdfResult.r2Url || pdfResult.pdfUrl;
          const res = await notificarCertAprobado({
            telefono,
            consecutivo: pdfProps.consecutivo,
            pdfUrl: pdfUrlFinal,
            nombreCoordinador: pdfProps.nombrecoordinador || "Coordinador",
          });
          console.log(`[cert/${id}/aprobar wa] ${res.ok ? "OK" : "FAIL"}: ${res.message} (pdf=${pdfResult.r2Url ? "R2" : "Blob"})`);
        } else {
          console.warn(`[cert/${id}/aprobar wa] sin móvil del agricultor — skip`);
        }
      } catch (err) {
        console.error(`[cert/${id}/aprobar wa] Error:`, err);
      }
    });

    return NextResponse.json({
      ok: true,
      consecutivo: pdfProps.consecutivo,
      estado: "aprobado",
    });
  } catch (err) {
    console.error(`[certificados/${id}/aprobar] Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
