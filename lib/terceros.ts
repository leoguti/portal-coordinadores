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
 * Celular colombiano: 10 dígitos que empiezan por 3. Es el formato necesario
 * para enviar SMS/WhatsApp de notificación de pago.
 */
export function validarMovilCelular(movilRaw: unknown): Validacion {
  const d = String(movilRaw ?? "").replace(/\D/g, "");
  if (!d) return { ok: false, motivo: "Falta el móvil" };
  if (d.length !== 10 || !d.startsWith("3")) {
    return {
      ok: false,
      motivo: "Debe ser un celular de 10 dígitos que empieza por 3 (ej. 3001234567)",
    };
  }
  return { ok: true };
}

// Tipos de vía aceptados por la nomenclatura DIAN (normalizados, sin acentos).
const VIA_URBANO = [
  "CL", "CALLE",
  "CR", "CRA", "KR", "CARRERA",
  "AV", "AVENIDA", "AVDA",
  "AC", // avenida calle
  "AK", // avenida carrera
  "DG", "DIAGONAL",
  "TV", "TRANSV", "TRANSVERSAL",
  "AUT", "AUTOPISTA",
  "CIRCULAR", "CIRCUNVALAR", "CQ",
  "MZ", "MANZANA",
];
const VIA_RURAL = [
  "VRD", "VDA", "VEREDA",
  "CGTO", "CORREGIMIENTO",
  "FCA", "FINCA",
  "KM", "KILOMETRO",
  "PD", "PREDIO",
  "SECTOR",
];

function normalizarDireccion(dir: string): string {
  return dir
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Valida que una dirección cumpla mínimamente el estándar DIAN: debe tener un
 * tipo de vía reconocido y (en zona urbana) números. Rechaza lo obviamente
 * falso ("vereda", "el centro", una sola palabra). NO valida el formato
 * perfecto — para eso existe el generador oficial MUISCA de la DIAN.
 */
export function validarDireccionDian(dirRaw: unknown): Validacion {
  const dir = String(dirRaw ?? "").trim();
  if (!dir) return { ok: false, motivo: "Falta la dirección" };

  const norm = normalizarDireccion(dir);
  const tokens = norm.split(/[\s.,-]+/).filter(Boolean);
  if (tokens.length < 2) {
    return {
      ok: false,
      motivo: "Muy corta: usa tipo de vía + números (ej. CL 13 65 95)",
    };
  }

  const hasUrbano = tokens.some((t) => VIA_URBANO.includes(t));
  const hasRural = tokens.some((t) => VIA_RURAL.includes(t));
  const numeros = (norm.match(/\d+/g) || []).length;

  if (!hasUrbano && !hasRural) {
    return {
      ok: false,
      motivo:
        "Falta el tipo de vía (Calle, Carrera, Avenida, Vereda, Km, ...). Ej. CL 13 65 95",
    };
  }

  // Urbana: exige números (Calle 13 # 65-95 → al menos 2 grupos numéricos).
  if (hasUrbano && !hasRural && numeros < 2) {
    return {
      ok: false,
      motivo: "Una dirección urbana debe llevar números. Ej. CL 13 65 95",
    };
  }

  // Rural: basta con tipo de vía + nombre/kilómetro (ya garantizado por
  // tokens.length >= 2). Rechazamos solo el tipo de vía solo, ya cubierto arriba.
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
    const v = validarMovilCelular(input.movil);
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
  if (movil !== undefined && movil !== null && String(movil).trim() && !validarMovilCelular(movil).ok) {
    faltantesDatos.push("Móvil inválido (celular de 10 dígitos)");
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
