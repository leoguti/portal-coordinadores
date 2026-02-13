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
