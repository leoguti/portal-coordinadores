/**
 * Reglas puras del repositorio de documentos de terceros — sin dependencias
 * de servidor (crypto/S3), para poder usarse igual en API routes y en
 * componentes cliente. La fuente de verdad de la política de subida es el
 * servidor; el cliente solo la refleja en la UI.
 */

export const TIPOS_DOCUMENTO = [
  "RUT",
  "Cédula",
  "Certificación bancaria",
  "Cámara de Comercio",
  "Planilla SS",
  "Otro",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Vigencia en meses por tipo (null = no vence). Configurable en un solo lugar. */
export const VIGENCIA_MESES: Record<TipoDocumento, number | null> = {
  RUT: 12,
  "Cámara de Comercio": 12,
  "Certificación bancaria": 12,
  "Planilla SS": 1,
  Cédula: null,
  Otro: null,
};

/** Días antes del vencimiento en que se abre la ventana de renovación. */
export const DIAS_VENTANA_RENOVACION = 30;

export function calcularVencimiento(
  tipo: TipoDocumento,
  fechaExpedicion: string | null | undefined
): string | null {
  const meses = VIGENCIA_MESES[tipo];
  if (!meses || !fechaExpedicion) return null;
  const d = new Date(`${fechaExpedicion.slice(0, 10)}T12:00:00-05:00`);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export interface DocParaRegla {
  estado: string;
  vigente: boolean;
  venceEl: string | null;
}

export interface ReglaSubida {
  permitido: boolean;
  /** Motivo del bloqueo, para mostrar al usuario. */
  motivo?: string;
  /** Fecha desde la cual se abrirá la ventana de renovación (YYYY-MM-DD). */
  desde?: string;
}

/**
 * Política de subida de versiones nuevas de un tipo de documento:
 *  - Sin documento, o vigente pendiente/rechazado → se puede subir.
 *  - Vigente APROBADO → candado: no se piden ni se aceptan versiones nuevas,
 *    hasta la ventana de renovación (30 días antes de `vence_el`) o el
 *    vencimiento. Si el aprobado no tiene fecha de vencimiento registrada,
 *    no se bloquea (no podemos saber si está por vencer).
 *  - "Otro" nunca se bloquea (bucket de documentos adicionales).
 *  - Los administradores no pasan por esta regla (pueden corregir siempre).
 */
export function puedeSubirVersion(
  docsDelTipo: DocParaRegla[],
  tipo: TipoDocumento,
  hoy: Date = new Date()
): ReglaSubida {
  if (tipo === "Otro") return { permitido: true };

  const vigente =
    docsDelTipo.find((d) => d.vigente) || docsDelTipo[0] || null;
  if (!vigente || vigente.estado !== "aprobado") return { permitido: true };

  // Aprobado sin vencimiento conocido: tipos sin vigencia quedan cerrados
  // (cédula no se "renueva"); tipos con vigencia pero sin fecha registrada
  // quedan abiertos (no podemos calcular la ventana).
  if (!vigente.venceEl) {
    if (VIGENCIA_MESES[tipo] === null) {
      return {
        permitido: false,
        motivo: "Este documento ya fue aprobado. Si necesitas reemplazarlo, pídelo a un administrador.",
      };
    }
    return { permitido: true };
  }

  const vence = new Date(`${vigente.venceEl.slice(0, 10)}T12:00:00-05:00`);
  const apertura = new Date(vence);
  apertura.setDate(apertura.getDate() - DIAS_VENTANA_RENOVACION);

  if (hoy >= apertura) return { permitido: true };

  return {
    permitido: false,
    motivo: `Documento aprobado y vigente hasta ${vigente.venceEl.slice(0, 10)}. Podrás subir la renovación desde ${apertura.toISOString().slice(0, 10)}.`,
    desde: apertura.toISOString().slice(0, 10),
  };
}
