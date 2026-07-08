/**
 * Decisión de certificados pendientes (aprobar / rechazar).
 *
 * Lógica COMPARTIDA entre las dos vías de decisión:
 *   - Bandeja del portal:  POST /api/certificados/[id]/aprobar|rechazar (sesión)
 *   - Enlace mágico email: POST /api/m/[token]/aprobar-cert|rechazar-cert (token)
 *
 * Cada vía valida su propia autorización (sesión+ownership vs token) y luego
 * delega aquí, para que aprobar/rechazar hagan EXACTAMENTE lo mismo:
 * PDF + avisos en la aprobación, motivo + aviso en el rechazo, y la
 * instrumentación decision_via / decision_dispositivo en ambos casos.
 */

import {
  construirPdfProps,
  generarYAdjuntarPDF,
} from "@/lib/certificadosCore";
import { resolveGeneradorDataFromFinca } from "@/lib/fincaGeneradorResolver";
import {
  notificarCertAprobado,
  notificarCertRechazado,
} from "@/lib/textitNotify";
import { normalizarMovilCO } from "@/lib/validacionesCO";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface CertRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

/** Instrumentación: desde qué vía y dispositivo se tomó la decisión. */
export interface DecisionMeta {
  via: "link" | "bandeja";
  dispositivo?: "movil" | "desktop" | null;
}

/** Edits opcionales que el coordinador puede aplicar antes de aprobar. */
export interface EditsAprobacion {
  rigidos?: number;
  flexibles?: number;
  metalicos?: number;
  embalaje?: number;
  triplelavado?: string;
  lugardevolucion?: string;
  observaciones?: string;
}

/** Error con status HTTP sugerido para que cada route lo traduzca. */
export class DecisionCertError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type AfterFn = (cb: () => Promise<void>) => void;

// ─── Helpers Airtable ──────────────────────────────────────────────────────

async function atFetch(path: string, init: RequestInit = {}) {
  return fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

/** Normaliza a "movil"/"desktop" o null si viene basura del cliente. */
export function normalizarDispositivo(
  v: unknown
): "movil" | "desktop" | null {
  return v === "movil" || v === "desktop" ? v : null;
}

/**
 * Lee el certificado y verifica que siga pendiente. Lanza DecisionCertError
 * 404 si no existe, 409 si ya fue decidido (estado != pendiente).
 */
export async function cargarCertPendiente(id: string): Promise<CertRecord> {
  const r = await atFetch(`/Certificados/${id}`);
  if (!r.ok) {
    throw new DecisionCertError("Certificado no encontrado", 404);
  }
  const rec = (await r.json()) as CertRecord;
  if (String(rec.fields.estado || "") !== "pendiente") {
    throw new DecisionCertError(
      `El certificado no está pendiente (estado=${rec.fields.estado})`,
      409
    );
  }
  return rec;
}

/** IDs de coordinador asignados al cert (lookup id_coordinador). */
export function coordIdsDelCert(rec: CertRecord): string[] {
  return Array.isArray(rec.fields.id_coordinador)
    ? (rec.fields.id_coordinador as string[]).map(String)
    : [];
}

// ─── Aprobar ───────────────────────────────────────────────────────────────

export interface AprobarCertInput {
  /** Record ya leído y verificado pendiente (cargarCertPendiente). */
  rec: CertRecord;
  /** Coordinador que aprueba — queda en aprobado_por. */
  coordId: string;
  /** Edits opcionales antes de aprobar (kilos / triple lavado / lugar…). */
  edits?: EditsAprobacion;
  meta: DecisionMeta;
  after: AfterFn;
}

/**
 * Aprueba un cert pendiente: edits opcionales → PDF (con avisos en
 * background: R2/Neon/email) → estado=aprobado + instrumentación → aviso
 * WhatsApp al agricultor.
 */
export async function aprobarCertificado(
  input: AprobarCertInput
): Promise<{ consecutivo: number }> {
  const { rec, coordId, meta, after } = input;
  const id = rec.id;
  const f = rec.fields;

  // 1. Edits opcionales antes de aprobar.
  const edits: Record<string, unknown> = {};
  const e = input.edits || {};
  for (const k of ["rigidos", "flexibles", "metalicos", "embalaje"] as const) {
    if (typeof e[k] === "number" && e[k]! >= 0) edits[k] = e[k];
  }
  for (const k of ["triplelavado", "lugardevolucion", "observaciones"] as const) {
    if (typeof e[k] === "string") edits[k] = e[k];
  }
  if (Object.keys(edits).length > 0) {
    const r2 = await atFetch(`/Certificados/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: edits, typecast: true }),
    });
    if (!r2.ok) {
      throw new DecisionCertError(
        "Error guardando edits: " + (await r2.text()),
        500
      );
    }
    // Recargar para usar valores nuevos (incl. fórmula total).
    const r3 = await atFetch(`/Certificados/${id}`);
    const updated = await r3.json();
    Object.assign(f, updated.fields);
  }

  // 2. Construir pdfProps a partir del cert + finca vinculada.
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
    throw new DecisionCertError(
      "El certificado no tiene consecutivo asignado",
      500
    );
  }

  // 3. Generar PDF + Blob + PATCH attach.
  const certCoordIds = coordIdsDelCert(rec);
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

  // 4. Marcar estado=aprobado + instrumentación de la decisión.
  const fieldsAprobado: Record<string, unknown> = {
    estado: "aprobado",
    fecha_aprobacion: fechaAprobacionIso,
    aprobado_por: [coordId],
    decision_via: meta.via,
  };
  if (meta.dispositivo) fieldsAprobado.decision_dispositivo = meta.dispositivo;
  const r4 = await atFetch(`/Certificados/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: fieldsAprobado, typecast: true }),
  });
  if (!r4.ok) {
    throw new DecisionCertError(
      "PDF generado pero error marcando aprobado: " + (await r4.text()),
      500
    );
  }

  console.log(
    `[certificados/${id}/aprobar] aprobado por ${coordId} consecutivo=${pdfProps.consecutivo} via=${meta.via} dispositivo=${meta.dispositivo || "?"}`
  );

  // 5. Notificar al agricultor por WhatsApp (background — no bloquea).
  // Preferimos el R2 URL (permanente) sobre el Blob URL (60s).
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
        console.log(
          `[cert/${id}/aprobar wa] ${res.ok ? "OK" : "FAIL"}: ${res.message} (pdf=${pdfResult.r2Url ? "R2" : "Blob"})`
        );
      } else {
        console.warn(`[cert/${id}/aprobar wa] sin móvil del agricultor — skip`);
      }
    } catch (err) {
      console.error(`[cert/${id}/aprobar wa] Error:`, err);
    }
  });

  return { consecutivo: pdfProps.consecutivo };
}

// ─── Rechazar ──────────────────────────────────────────────────────────────

export interface RechazarCertInput {
  /** Record ya leído y verificado pendiente (cargarCertPendiente). */
  rec: CertRecord;
  /** Coordinador que rechaza — queda en rechazado_por. */
  coordId: string;
  /** Motivo del rechazo (el caller valida el mínimo de caracteres). */
  motivo: string;
  meta: DecisionMeta;
  after: AfterFn;
}

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0] || "");
  if (v == null) return "";
  return String(v);
}

/**
 * Rechaza un cert pendiente: estado=rechazado + motivo + instrumentación →
 * aviso WhatsApp al agricultor con el motivo.
 */
export async function rechazarCertificado(
  input: RechazarCertInput
): Promise<void> {
  const { rec, coordId, motivo, meta, after } = input;
  const id = rec.id;

  const fieldsRechazado: Record<string, unknown> = {
    estado: "rechazado",
    motivo_rechazo: motivo,
    fecha_rechazo: new Date().toISOString(),
    rechazado_por: [coordId],
    decision_via: meta.via,
  };
  if (meta.dispositivo) fieldsRechazado.decision_dispositivo = meta.dispositivo;
  const r = await atFetch(`/Certificados/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: fieldsRechazado, typecast: true }),
  });
  if (!r.ok) {
    throw new DecisionCertError(
      "Error rechazando: " + (await r.text()),
      500
    );
  }
  console.log(
    `[certificados/${id}/rechazar] motivo="${motivo.slice(0, 60)}…" via=${meta.via} dispositivo=${meta.dispositivo || "?"}`
  );

  // Notificar al agricultor por WhatsApp (background — no bloquea).
  after(async () => {
    try {
      // En el modelo nuevo el cert no trae movilgenerador: el teléfono vive
      // en la FINCA (o su generador). Mismo fallback que usa la aprobación.
      let tel = firstStr(rec.fields.movilgenerador);
      if (!tel) {
        const fincaIds = Array.isArray(rec.fields.FINCAS)
          ? (rec.fields.FINCAS as string[])
          : [];
        if (fincaIds[0]) {
          const resolved = await resolveGeneradorDataFromFinca(
            AIRTABLE_API_KEY,
            AIRTABLE_BASE_ID,
            fincaIds[0]
          ).catch(() => null);
          tel = resolved?.movilgenerador || "";
        }
      }
      if (!tel) {
        console.warn(`[cert/${id}/rechazar wa] sin teléfono — aviso omitido`);
        return;
      }
      {
        const consecutivo = Number(rec.fields.consecutivo) || undefined;
        const nombreCoord =
          firstStr(rec.fields.nombrecoordinador) || "Coordinador";
        const coordTel10 = normalizarMovilCO(
          firstStr(rec.fields.movilcoordinador)
        );
        const res = await notificarCertRechazado({
          telefono: tel,
          consecutivo,
          motivo,
          nombreCoordinador: nombreCoord,
          coordContactoWaUrl: coordTel10 ? `wa.me/57${coordTel10}` : undefined,
        });
        console.log(
          `[cert/${id}/rechazar wa] ${res.ok ? "OK" : "FAIL"}: ${res.message}`
        );
      }
    } catch (err) {
      console.error(`[cert/${id}/rechazar wa] Error:`, err);
    }
  });
}
