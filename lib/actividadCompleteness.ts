/**
 * Reglas de completitud para actividades.
 *
 * Una actividad está INCOMPLETA cuando le faltan archivos requeridos según el
 * tipo de actividad. Las actividades incompletas pueden editarse fuera del
 * período de gracia normal (5 días post-mes) hasta que se completen.
 *
 * Reglas (definidas con cliente abril 2026):
 *  - Fotografías ≥ 1 → toda actividad
 *  - Listado de Asistencia ≥ 1 → cuando Tipo === "Sensibilización"
 *  - Evaluaciones (PDFs/fotos) ≥ 1 → cuando Tipo === "Sensibilización" Y "Personas Evaluadas" > 0
 */

import { puedeModificarActividad } from "./dateValidations";

interface AttachmentLike {
  id?: string;
  url?: string;
}

interface ActividadFieldsLike {
  Tipo?: string;
  Fecha?: string;
  "Personas Evaluadas"?: number;
  CantidadEvaluaciones?: number;
  Fotografias?: AttachmentLike[];
  "Listado Asistencia"?: AttachmentLike[];
  Evaluaciones?: AttachmentLike[];
  AprobacionSensibilizacion?: string;
  AprobacionEvaluaciones?: string;
  MotivoRechazoSensibilizacion?: string;
  MotivoRechazoEvaluaciones?: string;
}

export interface CompletenessResult {
  incompleta: boolean;
  faltantes: string[]; // qué falta exactamente
}

/**
 * La exigencia de completitud rige desde 2026-01-01 (decisión cliente
 * 2026-07-14): antes el proceso no estaba bien implementado, así que lo
 * anterior (o sin fecha = histórico) se considera completo.
 */
export const INICIO_EXIGENCIA_COMPLETITUD = "2026-01-01";

export function evaluarCompletitudActividad(
  fields: ActividadFieldsLike | undefined | null
): CompletenessResult {
  const faltantes: string[] = [];
  if (!fields) return { incompleta: true, faltantes: ["sin datos"] };
  if (!fields.Fecha || fields.Fecha < INICIO_EXIGENCIA_COMPLETITUD) {
    return { incompleta: false, faltantes: [] };
  }

  const fotos = fields.Fotografias || [];
  if (fotos.length === 0) faltantes.push("Fotografías");

  const isSens = fields.Tipo === "Sensibilización";
  if (isSens) {
    const listado = fields["Listado Asistencia"] || [];
    if (listado.length === 0) faltantes.push("Listado de Asistencia");

    const evaluadas = fields["Personas Evaluadas"] || 0;
    if (evaluadas > 0) {
      const evals = fields.Evaluaciones || [];
      if (evals.length === 0) faltantes.push("Soporte de Evaluaciones");
    }
  }

  return { incompleta: faltantes.length > 0, faltantes };
}

/**
 * Atajo: ¿está incompleta?
 */
export function actividadIncompleta(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return evaluarCompletitudActividad(fields).incompleta;
}

// ─── Aprobación admin (modelo "solo aprobadas cuentan") ──────────────────────
// Cambio 2026-07-10 (pedido cliente): SOLO el componente con estado "Aprobada"
// aporta a cifras/informes. Pendiente ya NO cuenta (antes sí: modelo
// aprobado-por-defecto). El histórico anterior a la fecha de corte se aprueba
// en bloque con scripts/aprobar-actividades-retroactivo.js ANTES de desplegar
// este código — de lo contrario los dashboards caen a cero.

/** ¿El componente de sensibilización fue rechazado por el admin? */
export function sensibilizacionRechazada(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return fields?.AprobacionSensibilizacion === "Rechazada";
}

/** ¿El componente de evaluaciones fue rechazado por el admin? */
export function evaluacionesRechazadas(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return fields?.AprobacionEvaluaciones === "Rechazada";
}

/** ¿Tiene algún componente rechazado? (habilita edición fuera de periodo) */
export function tieneRechazo(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return sensibilizacionRechazada(fields) || evaluacionesRechazadas(fields);
}

/** ¿La sensibilización fue aprobada explícitamente por el admin? */
export function sensibilizacionAprobada(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return fields?.AprobacionSensibilizacion === "Aprobada";
}

/** ¿Las evaluaciones fueron aprobadas explícitamente por el admin? */
export function evaluacionesAprobadas(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  return fields?.AprobacionEvaluaciones === "Aprobada";
}

// Valores "efectivos" para cifras/metas/informes: SOLO el componente Aprobada
// aporta; Pendiente y Rechazada aportan 0.

/** Participantes que cuentan (solo si la sensibilización está Aprobada). */
export function participantesAprobados(
  fields: (ActividadFieldsLike & { "Cantidad de Participantes"?: number }) | undefined | null
): number {
  if (!fields || !sensibilizacionAprobada(fields)) return 0;
  return fields["Cantidad de Participantes"] || 0;
}

/** Personas evaluadas (presenciales) que cuentan (solo si evaluaciones Aprobadas). */
export function evaluadasAprobadas(
  fields: ActividadFieldsLike | undefined | null
): number {
  if (!fields || !evaluacionesAprobadas(fields)) return 0;
  return fields["Personas Evaluadas"] || 0;
}

/** Evaluaciones por WhatsApp que cuentan (solo si evaluaciones Aprobadas). */
export function evaluacionesWAAprobadas(
  fields: ActividadFieldsLike | undefined | null
): number {
  if (!fields || !evaluacionesAprobadas(fields)) return 0;
  return fields.CantidadEvaluaciones || 0;
}

// Valores "en revisión" para el indicador "+N por revisar" de los dashboards:
// lo Pendiente (ni Aprobada ni Rechazada) que dejará de verse hasta que el
// admin lo apruebe.

/** Participantes de sensibilizaciones aún pendientes de revisión. */
export function participantesPendientes(
  fields: (ActividadFieldsLike & { "Cantidad de Participantes"?: number }) | undefined | null
): number {
  if (!fields || sensibilizacionAprobada(fields) || sensibilizacionRechazada(fields)) return 0;
  return fields["Cantidad de Participantes"] || 0;
}

/** Personas evaluadas (presenciales) aún pendientes de revisión. */
export function evaluadasPendientes(
  fields: ActividadFieldsLike | undefined | null
): number {
  if (!fields || evaluacionesAprobadas(fields) || evaluacionesRechazadas(fields)) return 0;
  return fields["Personas Evaluadas"] || 0;
}

/** Evaluaciones por WhatsApp aún pendientes de revisión. */
export function evaluacionesWAPendientes(
  fields: ActividadFieldsLike | undefined | null
): number {
  if (!fields || evaluacionesAprobadas(fields) || evaluacionesRechazadas(fields)) return 0;
  return fields.CantidadEvaluaciones || 0;
}

/**
 * ¿Necesita acción del admin para contar en cifras? (cola de revisión)
 * Solo aplica a Sensibilización: sensibilización sin decidir, o evaluaciones
 * sin decidir cuando la actividad tiene evaluaciones.
 */
export function pendienteDeRevision(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  if (!fields || fields.Tipo !== "Sensibilización") return false;
  const sensPend =
    fields.AprobacionSensibilizacion !== "Aprobada" &&
    fields.AprobacionSensibilizacion !== "Rechazada";
  const tieneEvals =
    (fields["Personas Evaluadas"] || 0) > 0 || (fields.CantidadEvaluaciones || 0) > 0;
  const evalPend =
    tieneEvals &&
    fields.AprobacionEvaluaciones !== "Aprobada" &&
    fields.AprobacionEvaluaciones !== "Rechazada";
  return sensPend || evalPend;
}

/**
 * Estado de aprobación consolidado para la interfaz (columna y filtro).
 * Distinto del estado de realización (En curso/Abierta/Cerrada): este dice
 * si las cifras cuentan para el informe. Solo aplica a Sensibilización.
 * Precedencia: Rechazada > Corregida > Pendiente > Aprobada.
 */
export type EstadoAprobacion = "Aprobada" | "Pendiente" | "Rechazada" | "Corregida";

export function estadoAprobacion(
  fields: ActividadFieldsLike | undefined | null
): EstadoAprobacion | null {
  if (!fields || fields.Tipo !== "Sensibilización") return null;
  if (tieneRechazo(fields)) return "Rechazada";
  if (corregidaTrasRechazo(fields)) return "Corregida";
  if (pendienteDeRevision(fields)) return "Pendiente";
  return "Aprobada";
}

/**
 * ¿Fue corregida tras un rechazo? (volvió a Pendiente pero conserva el motivo
 * del rechazo → marcador para la cola de re-revisión del admin)
 */
export function corregidaTrasRechazo(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  if (!fields) return false;
  const sensCorregida =
    fields.AprobacionSensibilizacion === "Pendiente" && !!fields.MotivoRechazoSensibilizacion?.trim();
  const evalCorregida =
    fields.AprobacionEvaluaciones === "Pendiente" && !!fields.MotivoRechazoEvaluaciones?.trim();
  return sensCorregida || evalCorregida;
}

/**
 * Decide si una actividad puede ser editada por el coordinador.
 * Combina la regla de período de gracia con las excepciones:
 *  - Si está dentro del período → siempre OK
 *  - Si está fuera del período PERO está incompleta → OK (para que la completen)
 *  - Si está fuera del período PERO tiene un rechazo del admin → OK (para corregirla)
 *  - Si está fuera del período, completa y sin rechazos → bloqueada
 */
export function puedeEditarActividad(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  const fecha = fields?.Fecha;
  if (!fecha) return true; // sin fecha, no aplicamos restricción
  if (puedeModificarActividad(fecha)) return true;
  return actividadIncompleta(fields) || tieneRechazo(fields);
}

/**
 * Mensaje descriptivo para mostrar cuando una actividad incompleta está fuera
 * del período pero igual se permite editar.
 */
export function getMensajeIncompleta(
  fields: ActividadFieldsLike | undefined | null
): string {
  const { faltantes } = evaluarCompletitudActividad(fields);
  if (faltantes.length === 0) return "";
  return `Esta actividad está incompleta. Falta: ${faltantes.join(", ")}.`;
}
