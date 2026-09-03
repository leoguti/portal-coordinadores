/**
 * Role helper functions
 *
 * isAdminOrSupervisor — can VIEW all data (read access)
 * isAdmin            — can WRITE / modify data (write access)
 */

export function isAdminOrSupervisor(rol?: string): boolean {
  return rol === "Administrador" || rol === "Supervisor";
}

export function isAdmin(rol?: string): boolean {
  return rol === "Administrador";
}

// Rol "Junta": solo accede al board de Junta Directiva.
// Tolerante a variantes ("junta", "Junta ", "Junta Directiva").
export function isJunta(rol?: string): boolean {
  return (rol || "").trim().toLowerCase().startsWith("junta");
}

// Puede ver el board de Junta Directiva: Admin, Supervisor o Junta.
export function canViewJunta(rol?: string): boolean {
  return isAdminOrSupervisor(rol) || isJunta(rol);
}

// ── Flag temporal (reunión Junta Directiva, sep-2026) ───────────────────────
// Permite que el rol "Junta" VEA (solo lectura) Kardex y Órdenes de Servicio.
// VENTANA de fecha: ON hasta el 2026-09-05 (reunión 2026-09-04), luego se apaga
// SOLO (fail-safe, sin revert que olvidar). Override manual con la variable
// NEXT_PUBLIC_JUNTA_VE_KARDEX_ORDENES = "true" (forzar ON) o "false" (forzar OFF).
const _juntaEnv = process.env.NEXT_PUBLIC_JUNTA_VE_KARDEX_ORDENES;
export const JUNTA_VE_KARDEX_ORDENES =
  _juntaEnv === "true"
    ? true
    : _juntaEnv === "false"
    ? false
    : new Date() < new Date("2026-09-05T23:59:59-05:00");

// Quién puede VER Kardex/Órdenes: Admin/Supervisor siempre; Junta solo con el flag.
export function puedeVerKardexOrdenes(rol?: string): boolean {
  return isAdminOrSupervisor(rol) || (JUNTA_VE_KARDEX_ORDENES && isJunta(rol));
}
