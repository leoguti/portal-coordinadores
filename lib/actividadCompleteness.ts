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
  Fotografias?: AttachmentLike[];
  "Listado Asistencia"?: AttachmentLike[];
  Evaluaciones?: AttachmentLike[];
}

export interface CompletenessResult {
  incompleta: boolean;
  faltantes: string[]; // qué falta exactamente
}

export function evaluarCompletitudActividad(
  fields: ActividadFieldsLike | undefined | null
): CompletenessResult {
  const faltantes: string[] = [];
  if (!fields) return { incompleta: true, faltantes: ["sin datos"] };

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

/**
 * Decide si una actividad puede ser editada por el coordinador.
 * Combina la regla de período de gracia con la excepción de incompletitud:
 *  - Si está dentro del período → siempre OK
 *  - Si está fuera del período PERO está incompleta → OK (para que la completen)
 *  - Si está fuera del período Y completa → bloqueada
 */
export function puedeEditarActividad(
  fields: ActividadFieldsLike | undefined | null
): boolean {
  const fecha = fields?.Fecha;
  if (!fecha) return true; // sin fecha, no aplicamos restricción
  if (puedeModificarActividad(fecha)) return true;
  return actividadIncompleta(fields);
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
