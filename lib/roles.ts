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
