/**
 * Utilidades para manejar kilos con decimales.
 *
 * Dos problemas reales reportados por coordinadores (2026-07):
 * 1. Artefactos de punto flotante: 437.9 + 332.2 = 770.0999999999999 en JS
 *    (y también en la fórmula `total` de Airtable vía API) — se imprimía
 *    crudo en el PDF del certificado.
 * 2. Coma decimal ("10,5"): Number("10,5") = NaN → el valor se volvía 0
 *    silenciosamente en navegadores que no normalizan el input.
 */

/**
 * Redondea a 3 decimales, eliminando artefactos de punto flotante.
 * 3 (no 2) porque las básculas registran gramos: 76.981 kg es un valor
 * legítimo que no se debe truncar (17.509999999999998 → 17.51 igual se limpia).
 */
export function roundKg(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Parsea un valor de kilos tolerando coma decimal. Inválido → 0. */
export function parseKg(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
