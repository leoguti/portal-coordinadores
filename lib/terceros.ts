/**
 * Reglas de validación y completitud de Terceros (proveedores/beneficiarios).
 *
 * Dos niveles de "listo":
 *  - listoCajaMenor      → datos básicos completos y válidos (basta para Caja Menor).
 *  - listoOrdenServicio  → datos básicos + documentos (requerido para Órdenes de Servicio).
 *
 * Las validaciones de formato (correo, móvil, dirección DIAN) son importantes
 * porque a futuro se enviarán notificaciones de pago a los terceros por correo
 * y por celular, y porque la DIAN exige direcciones normalizadas en exógena.
 */

import { validarNitJuridica } from "./nit";

export interface TerceroFields {
  RazonSocial?: string;
  NIT?: string;
  Direccion?: string;
  Movil?: number | string;
  "Correo Electrónico"?: string;
  Municipio?: string[]; // linked record IDs
  tipo_persona?: "Natural" | "Jurídica";
  cedula_pdf?: any[]; // attachments
  certificado_camara_pdf?: any[]; // attachments
  rut_pdf?: any[]; // attachments — obligatorio para todos
  certificacion_bancaria_pdf?: any[]; // attachments — obligatorio para pagos
}

export interface CompletitudResult {
  /** Legacy: equivale a `listoOrdenServicio` (el nivel más exigente). */
  completo: boolean;
  /** Legacy: todos los faltantes (datos + documentos). */
  faltantes: string[];
  nitInvalido: boolean;
  // Niveles nuevos:
  /** Datos básicos completos y con formato válido. Suficiente para Caja Menor. */
  listoCajaMenor: boolean;
  /** Datos básicos + documentos. Requerido para Órdenes de Servicio. */
  listoOrdenServicio: boolean;
  faltantesDatos: string[];
  faltantesDocumentos: string[];
  /**
   * Subconjunto de faltantesDocumentos que SÍ está subido pero espera
   * revisión del administrador (para decir "en revisión" y no "falta").
   */
  docsEnRevision: string[];
}

// ---------------------------------------------------------------------------
// Validadores de formato (reutilizables en cliente y servidor)
// ---------------------------------------------------------------------------

export interface Validacion {
  ok: boolean;
  motivo?: string;
}

/** Correo electrónico con formato razonable (para notificaciones de pago). */
export function validarEmail(correoRaw: unknown): boolean {
  const correo = String(correoRaw ?? "").trim();
  if (!correo) return false;
  // Suficiente para descartar basura sin caer en regex RFC imposible de leer.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

/**
 * Teléfono colombiano: acepta fijo (7-8 dígitos) o celular (10 dígitos). Las
 * empresas suelen tener fijo; a futuro, las notificaciones de pago por
 * SMS/WhatsApp irán solo a los que sean celular (ver `esCelular`), y al resto
 * por correo.
 */
export function validarTelefono(telRaw: unknown): Validacion {
  const d = String(telRaw ?? "").replace(/\D/g, "");
  if (!d) return { ok: false, motivo: "Falta el teléfono" };
  if (d.length < 7 || d.length > 10) {
    return {
      ok: false,
      motivo: "Debe ser un teléfono válido: fijo (7-8 dígitos) o celular (10 dígitos)",
    };
  }
  return { ok: true };
}

/** True si el teléfono es un celular colombiano (10 dígitos, empieza por 3). */
export function esCelular(telRaw: unknown): boolean {
  const d = String(telRaw ?? "").replace(/\D/g, "");
  return d.length === 10 && d.startsWith("3");
}

// Palabras "localizadoras": tipos de via DIAN + terminos comunes de direcciones
// reales (barrios, manzanas, conjuntos, rural). Normalizados, sin acentos.
const LOCALIZADORES = [
  // Vias urbanas formales
  "CL", "CALLE", "CR", "CRA", "KR", "CARRERA", "AV", "AVENIDA", "AVDA",
  "AC", "AK", "DG", "DIAGONAL", "TV", "TRANSV", "TRANSVERSAL",
  "AUT", "AUTOPISTA", "CIRCULAR", "CIRCUNVALAR", "CQ", "VIA",
  // Direcciones populares / urbanizaciones
  "BARRIO", "BRR", "BR", "MANZANA", "MZ", "MZN", "MNZ", "CASA", "CS",
  "CONJUNTO", "CONJ", "URBANIZACION", "URB", "ETAPA", "LOTE", "LT", "LOT",
  "BLOQUE", "BL", "TORRE", "TO", "TORR", "EDIFICIO", "ED", "EDIF",
  "APARTAMENTO", "APTO", "APT", "AP", "INTERIOR", "INT", "SUPERMANZANA", "SMZ",
  // Rural
  "VRD", "VDA", "VEREDA", "CGTO", "CORREGIMIENTO", "FCA", "FINCA",
  "KM", "KMS", "KILOMETRO", "PD", "PREDIO", "SECTOR", "PARCELA", "PARCELACION",
];

function normalizarDireccion(dir: string): string {
  return dir
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Valida minimamente una direccion para frenar entradas obviamente falsas
 * ("vereda", "casa", una sola palabra), sin rechazar direcciones reales como
 * "Barrio Villa Claudia Mz H Casa 18" o "VRD El Roble Km 4".
 *
 * Regla permisiva: al menos 2 palabras Y (un numero O una palabra localizadora
 * reconocida). NO valida el formato DIAN perfecto - para eso esta el generador
 * oficial MUISCA de la DIAN.
 */
export function validarDireccionDian(dirRaw: unknown): Validacion {
  const dir = String(dirRaw ?? "").trim();
  if (!dir) return { ok: false, motivo: "Falta la dirección" };

  const norm = normalizarDireccion(dir);
  const tokens = norm.split(/[\s.,#\u00b0\u00ba-]+/).filter(Boolean);
  if (tokens.length < 2) {
    return {
      ok: false,
      motivo: "Muy corta: indica la direccion completa (ej. CL 13 65 95 o Barrio X Mz H Casa 18)",
    };
  }

  const tieneLocalizador = tokens.some((t) => LOCALIZADORES.includes(t));
  const tieneNumero = /\d/.test(norm);

  if (!tieneLocalizador && !tieneNumero) {
    return {
      ok: false,
      motivo: "Agrega el tipo de via y el numero (ej. CL 13 65 95, o Vereda El Roble Km 4)",
    };
  }

  return { ok: true };
}

/**
 * Valida los campos que se están escribiendo (create/edit). Solo valida lo que
 * viene con valor — permite guardar parcial (p.ej. crear con datos básicos y
 * completar documentos después). Devuelve la lista de errores de formato.
 */
export function validarCamposEscritura(input: {
  direccion?: unknown;
  correo?: unknown;
  movil?: unknown;
}): Array<{ campo: string; motivo: string }> {
  const errores: Array<{ campo: string; motivo: string }> = [];
  if (input.direccion !== undefined && String(input.direccion).trim()) {
    const v = validarDireccionDian(input.direccion);
    if (!v.ok) errores.push({ campo: "direccion", motivo: v.motivo! });
  }
  if (input.correo !== undefined && String(input.correo).trim()) {
    if (!validarEmail(input.correo)) {
      errores.push({ campo: "correo", motivo: "El correo no tiene un formato válido" });
    }
  }
  if (input.movil !== undefined && String(input.movil).trim()) {
    const v = validarTelefono(input.movil);
    if (!v.ok) errores.push({ campo: "movil", motivo: v.motivo! });
  }
  return errores;
}

// ---------------------------------------------------------------------------
// Completitud
// ---------------------------------------------------------------------------

// El correo NO es obligatorio (decisión 2026-08-03): se valida el formato si
// viene, pero su ausencia no cuenta como faltante ni bloquea ningún flujo.
const BASICOS: Array<{ key: keyof TerceroFields; label: string; check: (v: any) => boolean }> = [
  { key: "RazonSocial", label: "Razón Social / Nombre", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "NIT", label: "NIT / Cédula", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "Direccion", label: "Dirección", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "Movil", label: "Teléfono / Móvil", check: (v) => v !== undefined && v !== null && String(v).trim().length > 0 },
  { key: "Municipio", label: "Municipio", check: (v) => Array.isArray(v) && v.length > 0 },
  { key: "tipo_persona", label: "Tipo de persona (Natural/Jurídica)", check: (v) => v === "Natural" || v === "Jurídica" },
];

export interface DocsEstado {
  /** Tipos con documento vigente APROBADO — los únicos que cuentan para OS. */
  aprobados: Set<string>;
  /** Tipos con documento vigente pendiente de revisión administrativa. */
  enRevision: Set<string>;
  /** Tipos con cualquier registro en el repositorio nuevo (vetan el legacy). */
  registrados: Set<string>;
}

/**
 * Política de documentos (endurecida 2026-08-03): para Órdenes de Servicio
 * solo cuenta el documento vigente APROBADO por un administrador. Un
 * documento pendiente o con problema bloquea la OS; los pendientes se
 * reportan también en `docsEnRevision` para mensajería precisa. El adjunto
 * legacy solo cuenta si el tipo no tiene ningún registro en el repositorio
 * nuevo (todo lo legacy fue migrado, así que en la práctica ya no aplica).
 */
export function evaluarCompletitud(
  fields: TerceroFields,
  docsEstado?: DocsEstado
): CompletitudResult {
  const faltantesDatos: string[] = [];

  // 1) Presencia de campos básicos.
  for (const campo of BASICOS) {
    if (!campo.check(fields[campo.key])) faltantesDatos.push(campo.label);
  }

  // 2) Formato de los campos que SÍ vienen con algo (correo y móvil son clave
  //    para las notificaciones de pago; dirección para exógena DIAN).
  const correo = fields["Correo Electrónico"];
  if (typeof correo === "string" && correo.trim() && !validarEmail(correo)) {
    faltantesDatos.push("Correo con formato inválido");
  }
  const movil = fields.Movil;
  if (movil !== undefined && movil !== null && String(movil).trim() && !validarTelefono(movil).ok) {
    faltantesDatos.push("Teléfono inválido");
  }
  const dir = fields.Direccion;
  if (typeof dir === "string" && dir.trim() && !validarDireccionDian(dir).ok) {
    faltantesDatos.push("Dirección no cumple formato DIAN");
  }

  // 3) Dígito de verificación del NIT (solo jurídicas).
  let nitInvalido = false;
  if (fields.tipo_persona === "Jurídica" && fields.NIT && !validarNitJuridica(fields.NIT)) {
    nitInvalido = true;
    faltantesDatos.push("NIT con dígito verificador inválido");
  }

  // 4) Documentos (solo requeridos para Órdenes de Servicio). Solo cuenta el
  //    aprobado; el legacy únicamente si el tipo no tiene registro nuevo.
  const aprobados = docsEstado?.aprobados || new Set<string>();
  const enRevision = docsEstado?.enRevision || new Set<string>();
  const registrados = docsEstado?.registrados || new Set<string>();
  const docCargado = (tipo: string, legacy: unknown[] | undefined) =>
    aprobados.has(tipo) || (!registrados.has(tipo) && (legacy || []).length > 0);

  const faltantesDocumentos: string[] = [];
  const docsEnRevision: string[] = [];
  const evaluarDoc = (tipo: string, label: string, legacy: unknown[] | undefined) => {
    if (docCargado(tipo, legacy)) return;
    faltantesDocumentos.push(label);
    if (enRevision.has(tipo)) docsEnRevision.push(label);
  };

  if (fields.tipo_persona === "Natural") {
    evaluarDoc("Cédula", "Cédula escaneada", fields.cedula_pdf);
  } else if (fields.tipo_persona === "Jurídica") {
    evaluarDoc("Cámara de Comercio", "Certificado Cámara de Comercio", fields.certificado_camara_pdf);
  }
  evaluarDoc("RUT", "RUT", fields.rut_pdf);
  evaluarDoc("Certificación bancaria", "Certificación bancaria", fields.certificacion_bancaria_pdf);

  const listoCajaMenor = faltantesDatos.length === 0;
  const listoOrdenServicio = listoCajaMenor && faltantesDocumentos.length === 0;

  return {
    completo: listoOrdenServicio,
    faltantes: [...faltantesDatos, ...faltantesDocumentos],
    nitInvalido,
    listoCajaMenor,
    listoOrdenServicio,
    faltantesDatos,
    faltantesDocumentos,
    docsEnRevision,
  };
}
