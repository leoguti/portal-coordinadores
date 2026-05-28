/**
 * Sprint 1 T5 — crea la tabla edicion_tokens en Neon (idempotente).
 *
 * Uso:
 *   node scripts/sprint1-init-neon.js
 *
 * Requiere NEON_DATABASE_URL en el entorno.
 */
require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error("ERROR: NEON_DATABASE_URL no está definido en .env.local");
    process.exit(1);
  }
  const pg = new Client({ connectionString: url });
  await pg.connect();
  try {
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
    const res = await pg.query(
      `SELECT COUNT(*) AS n FROM edicion_tokens`
    );
    console.log(`OK — tabla edicion_tokens lista (${res.rows[0].n} filas).`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
