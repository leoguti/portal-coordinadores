// Normalización para búsqueda insensible a mayúsculas y a tildes/acentos.
export const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Valor del campo GENERADORES.busqueda: nombre normalizado + NIT (para buscar por ambos).
export const busquedaValue = (nombre?: string, nit?: string) =>
  `${norm(nombre || "")} ${nit || ""}`.trim();
