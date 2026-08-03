/**
 * Repositorio versionado de documentos de terceros.
 *
 * Modelo: tabla Airtable `DOCUMENTOS_TERCEROS` (metadatos, estado, versiones)
 * + archivos en R2 bajo el prefijo docs-terceros/ (servidos SOLO vía endpoint
 * autenticado del portal — la key incluye un componente aleatorio y nunca se
 * expone la URL pública del bucket).
 *
 * Reglas:
 *  - Nunca se borra un documento: subir de nuevo crea la versión n+1 y
 *    desmarca `vigente` en la anterior.
 *  - Todo documento nace en estado `pendiente`; la aprobación es de los
 *    administradores (Sprint B). La IA, si algún día se activa, solo escribe
 *    en `verificacion_ia` — NADA del flujo depende de esa columna.
 */

import { createHash, randomBytes } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID!;

export const TABLA_DOCUMENTOS = "DOCUMENTOS_TERCEROS";

export const TIPOS_DOCUMENTO = [
  "RUT",
  "Cédula",
  "Certificación bancaria",
  "Cámara de Comercio",
  "Planilla SS",
  "Otro",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Vigencia en meses por tipo (null = no vence). Configurable en un solo lugar. */
export const VIGENCIA_MESES: Record<TipoDocumento, number | null> = {
  RUT: 12,
  "Cámara de Comercio": 12,
  "Certificación bancaria": 12,
  "Planilla SS": 1,
  Cédula: null,
  Otro: null,
};

export interface DocumentoTercero {
  id: string;
  terceroId: string | null;
  tipo: TipoDocumento;
  version: number;
  vigente: boolean;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
  archivoNombre: string;
  archivoHash: string;
  archivoSize: number | null;
  subidoPorId: string | null;
  fechaSubida: string | null;
  fechaExpedicion: string | null;
  venceEl: string | null;
  origen: string | null;
  /** Nota de verificación automática (ej. PDF con clave). Informativa. */
  verificacionIa: string | null;
}

export function calcularVencimiento(
  tipo: TipoDocumento,
  fechaExpedicion: string | null | undefined
): string | null {
  const meses = VIGENCIA_MESES[tipo];
  if (!meses || !fechaExpedicion) return null;
  const d = new Date(`${fechaExpedicion.slice(0, 10)}T12:00:00-05:00`);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

// ─── R2 (archivos) ──────────────────────────────────────────────────────────

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function bucketDocs(): string {
  // Parametrizado: cuando exista un bucket privado dedicado, basta con
  // definir R2_BUCKET_DOCS en Vercel y migrar los objetos.
  return process.env.R2_BUCKET_DOCS || process.env.R2_BUCKET_NAME!;
}

/** Key R2: prefijo + tercero + tipo + versión + 16 bytes aleatorios (no adivinable). */
export function construirKeyR2(
  terceroId: string,
  tipo: TipoDocumento,
  version: number,
  filename: string
): string {
  const ext = (filename.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const slug = tipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]+/g, "-")
    .toLowerCase();
  const rand = randomBytes(16).toString("hex");
  return `docs-terceros/${terceroId}/${slug}/v${version}-${rand}.${ext}`;
}

export async function subirArchivoR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucketDocs(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function leerArchivoR2(
  key: string
): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await r2Client().send(
      new GetObjectCommand({ Bucket: bucketDocs(), Key: key })
    );
    const body = await res.Body!.transformToByteArray();
    return { body, contentType: res.ContentType || "application/octet-stream" };
  } catch {
    return null;
  }
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── Airtable (metadatos) ───────────────────────────────────────────────────

function mapRecord(r: any): DocumentoTercero {
  const f = r.fields || {};
  return {
    id: r.id,
    terceroId: Array.isArray(f.tercero) ? f.tercero[0] || null : null,
    tipo: f.tipo || "Otro",
    version: Number(f.version) || 1,
    vigente: Boolean(f.vigente),
    estado: f.estado || "pendiente",
    motivoRechazo: f.motivo_rechazo || null,
    archivoNombre: f.archivo_nombre || "",
    archivoHash: f.archivo_hash || "",
    archivoSize: f.archivo_size ?? null,
    subidoPorId: Array.isArray(f.subido_por) ? f.subido_por[0] || null : null,
    fechaSubida: f.fecha_subida || null,
    fechaExpedicion: f.fecha_expedicion || null,
    venceEl: f.vence_el || null,
    origen: f.origen || null,
    verificacionIa: f.verificacion_ia || null,
  };
}

/**
 * Trae TODOS los registros de la tabla (paginado) y filtra en código.
 * Lección aprendida: FIND+ARRAYJOIN sobre linked records NO filtra por record
 * ID — el mismo patrón que usa /api/planillas-ss.
 */
export async function listarTodosDocumentos(): Promise<
  Array<DocumentoTercero & { archivoKey: string }>
> {
  const out: Array<DocumentoTercero & { archivoKey: string }> = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLA_DOCUMENTOS}?pageSize=100${
      offset ? "&offset=" + offset : ""
    }`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.error) throw new Error(`Airtable: ${JSON.stringify(data.error)}`);
    for (const r of data.records || []) {
      out.push({ ...mapRecord(r), archivoKey: r.fields?.archivo_key || "" });
    }
    offset = data.offset || "";
  } while (offset);
  return out;
}

export async function listarDocumentosTercero(
  terceroId: string
): Promise<Array<DocumentoTercero & { archivoKey: string }>> {
  const todos = await listarTodosDocumentos();
  return todos
    .filter((d) => d.terceroId === terceroId)
    .sort((a, b) => (a.tipo === b.tipo ? b.version - a.version : a.tipo.localeCompare(b.tipo)));
}

export interface DocsResumen {
  /** Tipos cuyo documento vigente está sano (cuenta como cargado). */
  tipos: Set<string>;
  /**
   * Tipos cuyo documento vigente tiene problema: rechazado (espera versión
   * corregida) o con alerta de verificación (ej. PDF con clave) sin aprobar.
   * Estos tipos NO cuentan como cargados — ni siquiera con adjunto legacy,
   * porque el legacy es el mismo archivo problemático migrado.
   */
  tiposProblema: Set<string>;
  problemas: number;
}

function esProblematico(d: DocumentoTercero): boolean {
  return d.estado === "rechazado" || (!!d.verificacionIa && d.estado !== "aprobado");
}

/** Resume los documentos de UN tercero: por tipo, mira su versión vigente. */
export function resumirDocs(docs: DocumentoTercero[]): DocsResumen {
  const porTipo = new Map<string, DocumentoTercero[]>();
  for (const d of docs) {
    if (!porTipo.has(d.tipo)) porTipo.set(d.tipo, []);
    porTipo.get(d.tipo)!.push(d);
  }
  const r: DocsResumen = { tipos: new Set(), tiposProblema: new Set(), problemas: 0 };
  for (const [tipo, lista] of porTipo) {
    const vigente =
      lista.find((d) => d.vigente) ||
      lista.slice().sort((a, b) => b.version - a.version)[0];
    if (vigente && esProblematico(vigente)) {
      r.tiposProblema.add(tipo);
      r.problemas++;
    } else {
      r.tipos.add(tipo);
    }
  }
  return r;
}

/**
 * Mapa terceroId → resumen de documentos. `tipos` alimenta la completitud en
 * paridad con el modelo viejo de adjuntos ("cargado" = hay archivo sano; el
 * endurecimiento a aprobado+vigente llegará al procesar el backlog);
 * `tiposProblema` veta también el fallback legacy y alimenta la alerta ⚠.
 */
export async function mapaDocsPorTercero(): Promise<Map<string, DocsResumen>> {
  const todos = await listarTodosDocumentos();
  const porTercero = new Map<string, DocumentoTercero[]>();
  for (const d of todos) {
    if (!d.terceroId) continue;
    if (!porTercero.has(d.terceroId)) porTercero.set(d.terceroId, []);
    porTercero.get(d.terceroId)!.push(d);
  }
  const mapa = new Map<string, DocsResumen>();
  for (const [terceroId, docs] of porTercero) {
    mapa.set(terceroId, resumirDocs(docs));
  }
  return mapa;
}

export interface CrearDocumentoParams {
  terceroId: string;
  terceroNombre: string;
  tipo: TipoDocumento;
  version: number;
  archivoKey: string;
  archivoNombre: string;
  archivoHash: string;
  archivoSize: number;
  subidoPorId?: string | null;
  fechaExpedicion?: string | null;
  origen: "portal" | "migracion";
  /** IDs de versiones anteriores del mismo tipo a desmarcar como vigentes. */
  desmarcarVigentes?: string[];
  fechaSubida?: string;
  /**
   * "aprobado" SOLO cuando quien sube es un administrador que aprueba en el
   * acto (sube él mismo el documento correcto). Default: "pendiente".
   */
  estadoInicial?: "pendiente" | "aprobado";
  aprobadoPorId?: string | null;
}

export async function crearRegistroDocumento(
  p: CrearDocumentoParams
): Promise<string> {
  // 1) Desmarcar vigente en versiones anteriores (nunca se borran).
  for (const id of p.desmarcarVigentes || []) {
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLA_DOCUMENTOS}/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { vigente: false } }),
      }
    );
  }

  // 2) Crear la versión nueva.
  const fields: Record<string, unknown> = {
    nombre: `${p.tipo} v${p.version} · ${p.terceroNombre}`.slice(0, 250),
    tercero: [p.terceroId],
    tipo: p.tipo,
    version: p.version,
    vigente: true,
    estado: p.estadoInicial || "pendiente",
    archivo_key: p.archivoKey,
    archivo_nombre: p.archivoNombre,
    archivo_hash: p.archivoHash,
    archivo_size: p.archivoSize,
    fecha_subida: p.fechaSubida || new Date().toISOString(),
    origen: p.origen,
  };
  if (p.subidoPorId) fields.subido_por = [p.subidoPorId];
  if (p.estadoInicial === "aprobado" && p.aprobadoPorId) {
    fields.aprobado_por = [p.aprobadoPorId];
    fields.fecha_decision = new Date().toISOString();
  }
  if (p.fechaExpedicion) {
    fields.fecha_expedicion = p.fechaExpedicion;
    const vence = calcularVencimiento(p.tipo, p.fechaExpedicion);
    if (vence) fields.vence_el = vence;
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLA_DOCUMENTOS}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Error creando registro de documento: ${JSON.stringify(data.error || data)}`);
  }
  return data.id;
}
