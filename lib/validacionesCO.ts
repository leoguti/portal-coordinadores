/**
 * Validaciones de documentos y móviles colombianos.
 * Funciones puras (usadas en cliente y servidor). Con tests en __tests__.
 *
 * Nota: el dígito de verificación (DV) del NIT NO se valida aquí — es un
 * tema aparte por decisión del proyecto. Aquí solo se valida el formato.
 */

export function soloDigitos(v: string): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Normaliza un móvil colombiano a 10 dígitos.
 * Acepta "+57 300 123 4567", "57 3001234567", "300 123 4567".
 */
export function normalizarMovilCO(v: string): string {
  let d = soloDigitos(v);
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return d;
}

/** Celular Colombia: 10 dígitos que empiezan por 3. */
export function esMovilCOValido(v: string): boolean {
  return /^3\d{9}$/.test(normalizarMovilCO(v));
}

/**
 * Valida el formato del documento según el tipo de persona:
 *  - Natural  → cédula: 6 a 10 dígitos.
 *  - Juridica → NIT: 9 a 11 dígitos (con o sin DV; el DV se revisa aparte).
 * Devuelve null si es válido, o un mensaje de error.
 */
export function validarDocumento(
  tipopersona: string,
  valor: string
): string | null {
  const d = soloDigitos(valor);
  if (tipopersona === "Natural") {
    return /^\d{6,10}$/.test(d)
      ? null
      : "La cédula debe tener entre 6 y 10 dígitos";
  }
  if (tipopersona === "Juridica") {
    return /^\d{9,11}$/.test(d)
      ? null
      : "El NIT debe tener entre 9 y 11 dígitos (el dígito de verificación se revisa aparte)";
  }
  return "Selecciona el tipo de persona";
}
