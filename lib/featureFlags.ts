/**
 * Feature flags del portal.
 *
 * Mantener flags simples (constantes booleanas) para poder activar/desactivar
 * comportamiento con un cambio de una línea + push a Vercel.
 */

/**
 * Requisito de planilla de Seguridad Social del mes para crear Órdenes de
 * Servicio a personas naturales.
 *
 * DESACTIVADO temporalmente a pedido de la clienta (2026-06-19).
 * Poner en `true` para volver a exigir la planilla del mes.
 */
export const REQUISITO_PLANILLA_SS = false;
