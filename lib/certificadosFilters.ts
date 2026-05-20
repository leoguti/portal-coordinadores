/**
 * Helpers para construir el filterByFormula de Airtable para la tabla Certificados.
 *
 * Los filtros se combinan con AND a nivel global y OR dentro de cada multi-select.
 */

export interface CertificadosFilterInput {
  ano?: number | string;
  departamentos?: string[];
  municipios?: string[];
  cultivoNombres?: string[];
  coordinadorIds?: string[];
  /** Nombres de fincas a filtrar (el caller resuelve generador→fincas si solo vino generador). */
  fincaNombres?: string[];
  /** Mes en formato YYYY-MM (filtra por mes calendario de fechadevolucion). */
  mes?: string;
  /** Filtro forzado por coordinador (no removible por el usuario, p.ej. usuario Coordinador). */
  forceCoordinadorId?: string;
  /** Número de consecutivo exacto a buscar (usado por coordinadores que conocen el número). */
  consecutivo?: number | string;
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

  if (input.ano !== undefined && input.ano !== null && `${input.ano}`.trim() !== "") {
    const n = Number(input.ano);
    if (Number.isFinite(n)) {
      clauses.push(`{ano} = ${n}`);
    }
  }

  if (
    input.consecutivo !== undefined &&
    input.consecutivo !== null &&
    `${input.consecutivo}`.trim() !== ""
  ) {
    const n = Number(input.consecutivo);
    if (Number.isFinite(n)) {
      clauses.push(`{consecutivo} = ${n}`);
    }
  }

  if (input.departamentos && input.departamentos.length > 0) {
    const parts = input.departamentos.map(
      (d) => `FIND(${quoted(d)}, ARRAYJOIN({Departamento}))`
    );
    clauses.push(orParts(parts));
  }

  if (input.municipios && input.municipios.length > 0) {
    const parts = input.municipios.map(
      (m) => `FIND(${quoted(m)}, ARRAYJOIN({municipiogenerador}))`
    );
    clauses.push(orParts(parts));
  }

  if (input.cultivoNombres && input.cultivoNombres.length > 0) {
    const parts = input.cultivoNombres.map(
      (c) => `FIND(${quoted(c)}, ARRAYJOIN({cultivos_certificado}))`
    );
    clauses.push(orParts(parts));
  }

  // Fincas: el linked field {FINCAS} en filterByFormula se renderiza como ARRAYJOIN
  // del primary field (nombre). Filtramos por nombre. El backend pasa los nombres ya resueltos.
  if (input.fincaNombres && input.fincaNombres.length > 0) {
    const parts = input.fincaNombres.map(
      (n) => `FIND(${quoted(n)}, ARRAYJOIN({FINCAS}))`
    );
    clauses.push(orParts(parts));
  }

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

  if (input.mes && /^\d{4}-\d{2}$/.test(input.mes)) {
    clauses.push(
      `DATETIME_FORMAT({fechadevolucion}, 'YYYY-MM') = ${quoted(input.mes)}`
    );
  }

  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  return `AND(${clauses.join(",")})`;
}
