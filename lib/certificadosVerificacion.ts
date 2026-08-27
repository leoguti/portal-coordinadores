/**
 * Verificación pública de certificados — consultas a Neon y reglas.
 *
 * Cada certificado tiene un `verificacion_token` aleatorio (128 bits, hex)
 * en Neon. El QR del PDF apunta a portal.campolimpio.org/v/<token>; la
 * página muestra los datos oficiales del registro para cotejar contra el
 * papel. NUNCA exponer el consecutivo en la URL (permitiría enumerar el
 * histórico completo): el consecutivo se muestra dentro de la página.
 *
 * Privacidad (Ley 1581/2012): la página es pública, así que solo se
 * devuelven los datos necesarios para el cotejo — cédula ENMASCARADA,
 * sin dirección, teléfono ni email del generador.
 */

import { Client as PgClient } from "pg";
import crypto from "crypto";

export const VERIFICACION_BASE_URL = "https://portal.campolimpio.org/v/";

export function generarTokenVerificacion(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** `1023456789` → `***456789` no: mostramos solo los últimos 3-4 dígitos. */
export function enmascararCedula(cedula: string): string {
  const d = String(cedula || "").replace(/\D/g, "");
  if (d.length <= 4) return d ? "***" : "";
  return "*".repeat(d.length - 4) + d.slice(-4);
}

/**
 * Estilo Nequi (pedido de Ángela 2026-08-27): solo las primeras 3 letras de
 * cada palabra — suficiente para cotejar contra el papel sin revelar el
 * nombre completo a quien solo tiene el enlace.
 * "LEONARDO GUTIERREZ" → "LEO*** GUT***"
 */
export function enmascararNombre(nombre: string): string {
  return String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p.length <= 3 ? p + "***" : p.slice(0, 3) + "***"))
    .join(" ");
}

/** "leogiga@gmail.com" → "leo***@g***.com" */
export function enmascararEmail(email: string): string {
  const e = String(email || "").trim();
  const at = e.indexOf("@");
  if (at <= 0) return e ? "***" : "";
  const local = e.slice(0, at);
  const dominio = e.slice(at + 1);
  const punto = dominio.lastIndexOf(".");
  const tld = punto > 0 ? dominio.slice(punto) : "";
  return `${local.slice(0, 3)}***@${dominio.slice(0, 1)}***${tld}`;
}

/** "3101234567" → "***4567" */
export function enmascararMovil(movil: string): string {
  const d = String(movil || "").replace(/\D/g, "");
  if (d.length <= 4) return d ? "***" : "";
  return "***" + d.slice(-4);
}

export interface CertVerificado {
  consecutivo: number;
  nombregenerador: string;
  cedulaEnmascarada: string;
  municipiogenerador: string;
  cultivogenerador: string;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  total: number;
  triplelavado: string;
  lugardevolucion: string;
  municipiodevolucion: string;
  fechadevolucion: string;
  nombrecoordinador: string;
  ano: number | null;
  anulado: boolean;
  anuladoEn: string | null;
  /** Contacto REGISTRADO, ya enmascarado — para el botón de reenvío del PDF.
   *  El dato completo nunca sale al cliente: el envío lo hace el servidor. */
  emailEnmascarado: string;
  movilEnmascarado: string;
}

const COLUMNAS = `consecutivo, nombregenerador, cedulagenerador, municipiogenerador,
  cultivogenerador, rigidos, flexibles, metalicos, embalaje, total, triplelavado,
  lugardevolucion, municipiodevolucion, fechadevolucion, nombrecoordinador, ano,
  anulado, anulado_en, emailgenerador, movilgenerador`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): CertVerificado {
  return {
    consecutivo: Number(r.consecutivo),
    nombregenerador: enmascararNombre(r.nombregenerador || ""),
    cedulaEnmascarada: enmascararCedula(r.cedulagenerador || ""),
    municipiogenerador: r.municipiogenerador || "",
    cultivogenerador: r.cultivogenerador || "",
    rigidos: Number(r.rigidos) || 0,
    flexibles: Number(r.flexibles) || 0,
    metalicos: Number(r.metalicos) || 0,
    embalaje: Number(r.embalaje) || 0,
    total: Number(r.total) || 0,
    triplelavado: r.triplelavado || "",
    lugardevolucion: r.lugardevolucion || "",
    municipiodevolucion: r.municipiodevolucion || "",
    fechadevolucion: r.fechadevolucion || "",
    nombrecoordinador: r.nombrecoordinador || "",
    ano: r.ano !== null ? Number(r.ano) : null,
    anulado: Boolean(r.anulado),
    anuladoEn: r.anulado_en ? new Date(r.anulado_en).toISOString().slice(0, 10) : null,
    emailEnmascarado: enmascararEmail(r.emailgenerador || ""),
    movilEnmascarado: enmascararMovil(r.movilgenerador || ""),
  };
}

async function conNeon<T>(fn: (pg: PgClient) => Promise<T>): Promise<T> {
  const pg = new PgClient({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    return await fn(pg);
  } finally {
    await pg.end();
  }
}

/** Busca por token del QR. Token con formato inválido → null sin tocar la DB. */
export async function buscarCertPorToken(token: string): Promise<CertVerificado | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  return conNeon(async (pg) => {
    const res = await pg.query(
      `SELECT ${COLUMNAS} FROM certificados WHERE verificacion_token = $1 LIMIT 1`,
      [token]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  });
}

/**
 * Verificación manual para certificados sin QR (históricos): exige DOS
 * factores — número de certificado + cédula completa del generador — para
 * que el número solo no permita enumerar datos ajenos.
 */
export async function buscarCertPorNumeroYCedula(
  consecutivo: number,
  cedula: string
): Promise<CertVerificado | null> {
  const ced = String(cedula || "").replace(/\D/g, "");
  if (!consecutivo || consecutivo <= 0 || ced.length < 4) return null;
  return conNeon(async (pg) => {
    const res = await pg.query(
      `SELECT ${COLUMNAS} FROM certificados
       WHERE consecutivo = $1 AND REGEXP_REPLACE(COALESCE(cedulagenerador,''), '[^0-9]', '', 'g') = $2
       LIMIT 1`,
      [consecutivo, ced]
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  });
}

/**
 * Token existente para un cert (por airtable_id), o uno nuevo si la fila
 * aún no existe. Evita que una regeneración de PDF (p. ej. /aprobar) imprima
 * un QR distinto al token ya guardado.
 */
export async function obtenerOCrearToken(airtableId: string): Promise<string> {
  try {
    const existente = await conNeon(async (pg) => {
      const res = await pg.query(
        "SELECT verificacion_token FROM certificados WHERE airtable_id = $1",
        [airtableId]
      );
      return (res.rows[0]?.verificacion_token as string) || null;
    });
    if (existente) return existente;
  } catch (err) {
    console.error("[verificacion] error leyendo token existente:", err);
  }
  return generarTokenVerificacion();
}

/**
 * Datos COMPLETOS para el reenvío del PDF al contacto registrado.
 * SOLO para uso server-side (el endpoint de reenvío) — nunca exponer al
 * cliente: el visitante de /v/<token> solo ve las versiones enmascaradas.
 */
export async function datosParaReenvio(token: string): Promise<{
  consecutivo: number;
  email: string;
  r2Url: string | null;
  anulado: boolean;
} | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  return conNeon(async (pg) => {
    const res = await pg.query(
      `SELECT consecutivo, emailgenerador, certificadopdf_r2_url, anulado
       FROM certificados WHERE verificacion_token = $1 LIMIT 1`,
      [token]
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      consecutivo: Number(r.consecutivo),
      email: String(r.emailgenerador || "").trim(),
      r2Url: r.certificadopdf_r2_url || null,
      anulado: Boolean(r.anulado),
    };
  });
}

/** Marca anulado en Neon (espejo del estado de Airtable). Best-effort. */
export async function marcarAnuladoEnNeon(
  airtableId: string,
  motivo: string
): Promise<boolean> {
  try {
    return await conNeon(async (pg) => {
      const res = await pg.query(
        "UPDATE certificados SET anulado = TRUE, anulado_motivo = $1, anulado_en = NOW() WHERE airtable_id = $2",
        [motivo || null, airtableId]
      );
      return (res.rowCount || 0) > 0;
    });
  } catch (err) {
    console.error("[verificacion] error marcando anulado en Neon:", err);
    return false;
  }
}
