/**
 * Helpers para construir el filterByFormula de Airtable para la tabla Certificados.
 *
 * Los filtros se combinan con AND a nivel global y OR dentro de cada multi-select.
 *
 * Notas importantes:
 * - `cultivos_certificado` es un multipleRecordLinks. En filterByFormula su representación
 *   es el primary field (nombre del cultivo), por lo que el filtro recibe NOMBRES.
 * - `tipogenerador` viene sucio (AGRICOLA/Agricola/agricola). Se normaliza con UPPER().
 * - Búsqueda libre (`q`) cruza cedulagenerador, nombregenerador y consecutivo.
 */

export interface CertificadosFilterInput {
  q?: string;
  ano?: number | string;
  departamentos?: string[];
  tiposGenerador?: string[];
  cultivoNombres?: string[];
  coordinadorIds?: string[];
  fechaDesde?: string; // ISO YYYY-MM-DD
  fechaHasta?: string; // ISO YYYY-MM-DD
  /** Filtro forzado por coordinador (no removible por el usuario, p.ej. usuario Coordinador). */
  forceCoordinadorId?: string;
}

/** Escapa comillas simples y dobles para uso en filterByFormula. */
export function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function quoted(value: string): string {
  return `'${escapeFormulaString(value)}'`;
}

function orParts(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `OR(${parts.join(",")})`;
}

/**
 * Construye el filterByFormula para la tabla Certificados.
 * Devuelve "" cuando no hay filtros aplicables.
 */
export function buildCertificadosFilterFormula(
  input: CertificadosFilterInput
): string {
  const clauses: string[] = [];

  // Búsqueda libre (q): nombre, cédula, consecutivo
  if (input.q && input.q.trim().length > 0) {
    const q = input.q.trim();
    const qLower = q.toLowerCase();
    const qParts = [
      `FIND(${quoted(qLower)}, LOWER(ARRAYJOIN({nombregenerador})))`,
      `FIND(${quoted(qLower)}, LOWER(ARRAYJOIN({cedulagenerador})))`,
      `FIND(${quoted(qLower)}, LOWER({consecutivo} & ""))`,
    ];
    clauses.push(orParts(qParts));
  }

  // Año
  if (input.ano !== undefined && input.ano !== null && `${input.ano}`.trim() !== "") {
    const n = Number(input.ano);
    if (Number.isFinite(n)) {
      clauses.push(`{ano} = ${n}`);
    }
  }

  // Departamento (multi)
  if (input.departamentos && input.departamentos.length > 0) {
    const parts = input.departamentos.map(
      (d) => `FIND(${quoted(d)}, ARRAYJOIN({Departamento}))`
    );
    clauses.push(orParts(parts));
  }

  // Tipo generador (multi, normalizado a mayúsculas)
  if (input.tiposGenerador && input.tiposGenerador.length > 0) {
    const parts = input.tiposGenerador.map(
      (t) =>
        `FIND(${quoted(t.toUpperCase())}, UPPER(ARRAYJOIN({tipogenerador})))`
    );
    clauses.push(orParts(parts));
  }

  // Cultivos (multi, por nombre del cultivo)
  if (input.cultivoNombres && input.cultivoNombres.length > 0) {
    const parts = input.cultivoNombres.map(
      (c) => `FIND(${quoted(c)}, ARRAYJOIN({cultivos_certificado}))`
    );
    clauses.push(orParts(parts));
  }

  // Coordinador (multi, por record ID en id_coordinador)
  const coordIds: string[] = [];
  if (input.forceCoordinadorId) {
    coordIds.push(input.forceCoordinadorId);
  } else if (input.coordinadorIds && input.coordinadorIds.length > 0) {
    coordIds.push(...input.coordinadorIds);
  }
  if (coordIds.length > 0) {
    const parts = coordIds.map(
      (id) => `FIND(${quoted(id)}, ARRAYJOIN({id_coordinador}))`
    );
    clauses.push(orParts(parts));
  }

  // Rango de fechas (fechadevolucion)
  if (input.fechaDesde) {
    clauses.push(`IS_AFTER({fechadevolucion}, DATEADD(${quoted(input.fechaDesde)}, -1, 'days'))`);
  }
  if (input.fechaHasta) {
    clauses.push(`IS_BEFORE({fechadevolucion}, DATEADD(${quoted(input.fechaHasta)}, 1, 'days'))`);
  }

  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  return `AND(${clauses.join(",")})`;
}

/** Normaliza un string de tipoGenerador a su forma canónica (mayúsculas, trim). */
export function normalizeTipoGenerador(raw: string): string {
  return (raw || "").trim().toUpperCase();
}
