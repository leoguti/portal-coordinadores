/**
 * Reglas de validación y completitud de Terceros (proveedores/beneficiarios).
 *
 * Un tercero se considera "completo" si tiene todos los campos obligatorios +
 * el documento apropiado según su tipo_persona.
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
  completo: boolean;
  faltantes: string[];
  nitInvalido: boolean;
}

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
  const faltantes: string[] = [];

  for (const campo of BASICOS) {
    if (!campo.check(fields[campo.key])) faltantes.push(campo.label);
  }

  // Validación de documento según tipo_persona
  if (fields.tipo_persona === "Natural") {
    const cedula = fields.cedula_pdf || [];
    if (cedula.length === 0) faltantes.push("Cédula escaneada");
  } else if (fields.tipo_persona === "Jurídica") {
    const camara = fields.certificado_camara_pdf || [];
    if (camara.length === 0) faltantes.push("Certificado Cámara de Comercio");
  }

  // Documentos obligatorios para todos los terceros
  if ((fields.rut_pdf || []).length === 0) {
    faltantes.push("RUT");
  }
  if ((fields.certificacion_bancaria_pdf || []).length === 0) {
    faltantes.push("Certificación bancaria");
  }

  // Validación dígito verificador del NIT (solo jurídicas)
  let nitInvalido = false;
  if (fields.tipo_persona === "Jurídica" && fields.NIT && !validarNitJuridica(fields.NIT)) {
    nitInvalido = true;
    faltantes.push("NIT con dígito verificador inválido");
  }

  return {
    completo: faltantes.length === 0,
    faltantes,
    nitInvalido,
  };
}
