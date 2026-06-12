/**
 * Política de fechas para certificados — ÚNICO lugar donde se cambia.
 *
 * Si la política de antigüedad máxima cambia (p. ej. de 5 a 3 meses),
 * basta con editar CERT_DIAS_MAX_ATRAS y hacer deploy. La regla aplica
 * automáticamente a las tres vías:
 *   - Portal coordinador  (/certificados/generar + /api/certificados/portal)
 *   - WhatsApp agricultor (/m/cert + /api/m/[token]/enviar)
 *   - TextIt/Telegram     (/api/certificados/generar vía certificadosCore)
 *
 * Este archivo debe permanecer puro (sin imports de servidor) para que
 * puedan importarlo tanto client components como API routes.
 */

/** Antigüedad máxima permitida de la fecha de devolución/recolección. */
export const CERT_DIAS_MAX_ATRAS = 150; // 5 meses

/** Límites para inputs <input type="date">: { min, max } en YYYY-MM-DD. */
export function rangoFechaDevolucion(): { min: string; max: string } {
  const max = new Date().toISOString().slice(0, 10);
  const min = new Date(Date.now() - CERT_DIAS_MAX_ATRAS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { min, max };
}

/**
 * Valida la fecha de devolución contra la política.
 * Devuelve un mensaje de error legible, o null si es válida.
 *
 * - La presencia (campo obligatorio) la valida cada endpoint por su cuenta.
 * - Solo valida rango cuando el formato es ISO (YYYY-MM-DD): los flows
 *   viejos de TextIt pueden mandar texto libre y no queremos romperlos.
 */
export function validarFechaDevolucion(fecha: string): string | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha.trim());
  if (!m) return null;

  const f = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (isNaN(f.getTime())) return "Fecha de devolución inválida";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (f > hoy) return "La fecha de devolución no puede ser futura";

  const limite = new Date(hoy);
  limite.setDate(limite.getDate() - CERT_DIAS_MAX_ATRAS);
  if (f < limite) {
    const meses = Math.round(CERT_DIAS_MAX_ATRAS / 30);
    return `La fecha de devolución no puede tener más de ${CERT_DIAS_MAX_ATRAS} días (~${meses} meses) de antigüedad`;
  }
  return null;
}
