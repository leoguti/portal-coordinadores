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

const BASICOS: Array<{ key: keyof TerceroFields; label: string; check: (v: any) => boolean }> = [
  { key: "RazonSocial", label: "Razón Social / Nombre", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "NIT", label: "NIT / Cédula", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "Direccion", label: "Dirección", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "Movil", label: "Teléfono / Móvil", check: (v) => v !== undefined && v !== null && String(v).trim().length > 0 },
  { key: "Correo Electrónico", label: "Correo electrónico", check: (v) => typeof v === "string" && v.includes("@") },
  { key: "Municipio", label: "Municipio", check: (v) => Array.isArray(v) && v.length > 0 },
  { key: "tipo_persona", label: "Tipo de persona (Natural/Jurídica)", check: (v) => v === "Natural" || v === "Jurídica" },
];

export function evaluarCompletitud(fields: TerceroFields): CompletitudResult {
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

  // 4) Documentos (solo requeridos para Órdenes de Servicio).
  const faltantesDocumentos: string[] = [];
  if (fields.tipo_persona === "Natural") {
    if ((fields.cedula_pdf || []).length === 0) faltantesDocumentos.push("Cédula escaneada");
  } else if (fields.tipo_persona === "Jurídica") {
    if ((fields.certificado_camara_pdf || []).length === 0) faltantesDocumentos.push("Certificado Cámara de Comercio");
  }
  if ((fields.rut_pdf || []).length === 0) faltantesDocumentos.push("RUT");
  if ((fields.certificacion_bancaria_pdf || []).length === 0) faltantesDocumentos.push("Certificación bancaria");

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
  };
}
