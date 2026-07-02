/**
 * Conversión del código DIVIPOLA guardado como decimal en Airtable
 * (CODIGOMUN, ej. 25.43) al código de 5 dígitos del GeoJSON (ej. "25430").
 *
 * ⚠️ NO usar String(v).replace(".", ""): los códigos de municipio que terminan
 * en 0 pierden el cero al guardarse como número (25430 → 25.43 → "02543" ❌).
 * La conversión correcta es aritmética: DEPTO (2 dígitos) + MUNICIPIO (3 dígitos).
 * Bug encontrado 2026-07-02: Madrid - Cundinamarca (25430) no se localizaba.
 */
export function divipolaFromDecimal(raw: number | string | undefined | null): string | null {
  if (raw == null) return null;
  const v = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(v) || v <= 0) return null;
  const depto = Math.floor(v);
  const mun = Math.round((v - depto) * 1000);
  return String(depto).padStart(2, "0") + String(mun).padStart(3, "0");
}
