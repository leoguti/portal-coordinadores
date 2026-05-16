/**
 * Validación de NIT según algoritmo oficial DIAN (Colombia).
 *
 * El dígito de verificación se calcula con pesos fijos.
 * Solo aplica a Personas Jurídicas — cédulas de naturales no tienen DV.
 *
 * Algoritmo VERIFICADO contra fuentes oficiales (tiendana.com, verificador
 * DIAN, RUTs reales). Especificación completa, ejemplos y casos de prueba:
 *   docs/ALGORITMO_DIGITO_VERIFICACION.md
 *
 * Esta implementación (reverse + pesos ascendentes) es matemáticamente
 * equivalente a la del doc (padding a 15 dígitos + pesos descendentes):
 * comprobado idéntico en 100.000 números aleatorios. NO modificar los pesos
 * ni la regla final sin revalidar contra el documento.
 */

const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function calcularDigitoVerificador(base: string): number {
  const digitos = base.replace(/\D/g, "").split("").reverse();
  let suma = 0;
  for (let i = 0; i < digitos.length && i < PESOS.length; i++) {
    suma += parseInt(digitos[i], 10) * PESOS[i];
  }
  const resto = suma % 11;
  return resto < 2 ? resto : 11 - resto;
}

/**
 * Valida un NIT de Persona Jurídica en Colombia.
 * Acepta formatos: "900123456-7", "900123456 7", "9001234567"
 * Retorna true si el dígito verificador es correcto.
 */
export function validarNitJuridica(nit: string): boolean {
  if (!nit) return false;
  const limpio = nit.replace(/[^\d-]/g, "");
  if (!limpio) return false;

  let base: string;
  let dv: number;

  if (limpio.includes("-")) {
    const [b, d] = limpio.split("-");
    if (!b || d === undefined || d === "") return false;
    base = b;
    dv = parseInt(d, 10);
  } else {
    // Sin guión: asumimos último dígito como DV
    if (limpio.length < 9) return false; // NIT mínimo 9 dígitos incluyendo DV
    base = limpio.slice(0, -1);
    dv = parseInt(limpio.slice(-1), 10);
  }

  if (isNaN(dv)) return false;
  if (base.length < 8 || base.length > 15) return false;

  return calcularDigitoVerificador(base) === dv;
}

/**
 * Obtiene solo los dígitos base (sin DV) para comparar NITs.
 */
export function nitBase(nit: string): string {
  if (!nit) return "";
  const limpio = nit.replace(/[^\d-]/g, "");
  if (limpio.includes("-")) return limpio.split("-")[0];
  return limpio.length >= 9 ? limpio.slice(0, -1) : limpio;
}
