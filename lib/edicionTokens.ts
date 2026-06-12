/**
 * Magic-link tokens — almacenamiento en Neon Postgres.
 *
 * Cada token apunta a un "intent" (qué quiere hacer el agricultor) y al record
 * relevante (FINCA, GENERADOR, o ninguno para registro nuevo). Validado por
 * teléfono (anti-spoof).
 *
 * Ciclo de vida:
 *   1. /api/whatsapp/intent  → crearToken()
 *   2. GET  /api/m/<token>   → leerToken() (sin consumir)
 *   3. POST /api/m/<token>/enviar → consumirToken() (atómico)
 *
 * Tabla: edicion_tokens (ver SQL al final de este archivo).
 */

import { Client } from "pg";
import { randomBytes } from "crypto";

export type Intent =
  | "cert-nuevo"
  | "cert-coordinador"
  | "editar-finca"
  | "editar-generador"
  | "editar-perfil"
  | "crear-finca"
  | "registro-generador";

export interface EdicionToken {
  token: string;
  intent: Intent;
  recordId: string | null;
  telefonoValidado: string;
  contexto: Record<string, unknown>;
  expira: Date;
  consumidoEn: Date | null;
  creadoEn: Date;
}

const TTL_MIN_DEFAULT = Number(process.env.EDICION_TOKEN_TTL_MIN || 30);

async function withPg<T>(fn: (pg: Client) => Promise<T>): Promise<T> {
  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    return await fn(pg);
  } finally {
    await pg.end();
  }
}

function generarTokenSeguro(): string {
  // 32 bytes → 43 chars base64url. Suficiente entropía para URL.
  return randomBytes(32).toString("base64url");
}

export interface CrearTokenInput {
  intent: Intent;
  recordId?: string | null;
  telefonoValidado: string;
  contexto?: Record<string, unknown>;
  ttlMinutes?: number;
}

export async function crearToken(input: CrearTokenInput): Promise<EdicionToken> {
  const token = generarTokenSeguro();
  const ttl = input.ttlMinutes ?? TTL_MIN_DEFAULT;
  const expira = new Date(Date.now() + ttl * 60 * 1000);

  return withPg(async (pg) => {
    const res = await pg.query(
      `INSERT INTO edicion_tokens (token, intent, record_id, telefono_validado, contexto, expira)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING token, intent, record_id, telefono_validado, contexto, expira, consumido_en, creado_en`,
      [
        token,
        input.intent,
        input.recordId ?? null,
        input.telefonoValidado,
        JSON.stringify(input.contexto ?? {}),
        expira,
      ]
    );
    return rowToToken(res.rows[0]);
  });
}

/** Lee un token sin consumirlo. Devuelve null si no existe. */
export async function leerToken(token: string): Promise<EdicionToken | null> {
  return withPg(async (pg) => {
    const res = await pg.query(
      `SELECT token, intent, record_id, telefono_validado, contexto, expira, consumido_en, creado_en
       FROM edicion_tokens WHERE token = $1`,
      [token]
    );
    if (res.rowCount === 0) return null;
    return rowToToken(res.rows[0]);
  });
}

/**
 * Consume un token atómicamente. Devuelve el token consumido, o null si:
 *   - no existe
 *   - ya estaba consumido
 *   - expiró
 *
 * El llamante NO debe re-llamar consumirToken con el mismo valor: cada token
 * es de un solo uso.
 */
export async function consumirToken(
  token: string
): Promise<EdicionToken | null> {
  return withPg(async (pg) => {
    const res = await pg.query(
      `UPDATE edicion_tokens
         SET consumido_en = now()
       WHERE token = $1
         AND consumido_en IS NULL
         AND expira > now()
       RETURNING token, intent, record_id, telefono_validado, contexto, expira, consumido_en, creado_en`,
      [token]
    );
    if (res.rowCount === 0) return null;
    return rowToToken(res.rows[0]);
  });
}

export function estaExpirado(t: EdicionToken): boolean {
  return t.expira.getTime() < Date.now();
}

export function estaConsumido(t: EdicionToken): boolean {
  return t.consumidoEn !== null;
}

function rowToToken(row: Record<string, unknown>): EdicionToken {
  return {
    token: String(row.token),
    intent: row.intent as Intent,
    recordId: row.record_id == null ? null : String(row.record_id),
    telefonoValidado: String(row.telefono_validado),
    contexto:
      typeof row.contexto === "string"
        ? JSON.parse(row.contexto)
        : (row.contexto as Record<string, unknown>) ?? {},
    expira: new Date(row.expira as string),
    consumidoEn: row.consumido_en ? new Date(row.consumido_en as string) : null,
    creadoEn: new Date(row.creado_en as string),
  };
}

/**
 * Crea la tabla si no existe. Llamar una sola vez al desplegar (idempotente).
 * Se puede ejecutar desde un script o desde un endpoint de admin.
 *
 * SQL equivalente para correr manualmente en Neon:
 *
 *   CREATE TABLE IF NOT EXISTS edicion_tokens (
 *     token              TEXT PRIMARY KEY,
 *     intent             TEXT NOT NULL,
 *     record_id          TEXT,
 *     telefono_validado  TEXT NOT NULL,
 *     contexto           JSONB NOT NULL DEFAULT '{}'::jsonb,
 *     expira             TIMESTAMPTZ NOT NULL,
 *     consumido_en       TIMESTAMPTZ,
 *     creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_edicion_tokens_telefono ON edicion_tokens (telefono_validado);
 *   CREATE INDEX IF NOT EXISTS idx_edicion_tokens_expira   ON edicion_tokens (expira);
 */
export async function asegurarTabla(): Promise<void> {
  await withPg(async (pg) => {
    await pg.query(`
      CREATE TABLE IF NOT EXISTS edicion_tokens (
        token              TEXT PRIMARY KEY,
        intent             TEXT NOT NULL,
        record_id          TEXT,
        telefono_validado  TEXT NOT NULL,
        contexto           JSONB NOT NULL DEFAULT '{}'::jsonb,
        expira             TIMESTAMPTZ NOT NULL,
        consumido_en       TIMESTAMPTZ,
        creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pg.query(
      `CREATE INDEX IF NOT EXISTS idx_edicion_tokens_telefono ON edicion_tokens (telefono_validado)`
    );
    await pg.query(
      `CREATE INDEX IF NOT EXISTS idx_edicion_tokens_expira ON edicion_tokens (expira)`
    );
  });
}
