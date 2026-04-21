import type { Adapter } from "next-auth/adapters";
import { Client } from "pg";

/**
 * NextAuth adapter backed by Neon (Postgres).
 *
 * Only implements what the Email magic-link provider needs:
 *   - createVerificationToken → persist the token
 *   - useVerificationToken    → consume it atomically (DELETE ... RETURNING)
 *
 * User validation still happens in the `signIn` callback via Airtable,
 * so createUser / getUserByEmail remain stubs.
 *
 * This replaces the previous in-memory adapter that broke on serverless
 * because tokens were kept in a process-local array (one instance stored
 * the token, another served the callback and couldn't find it).
 */

async function withPg<T>(fn: (pg: Client) => Promise<T>): Promise<T> {
  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    return await fn(pg);
  } finally {
    await pg.end();
  }
}

export function NeonAdapter(): Adapter {
  return {
    async createVerificationToken(vt) {
      await withPg(async (pg) => {
        await pg.query(
          `INSERT INTO verification_tokens (identifier, token, expires)
           VALUES ($1, $2, $3)
           ON CONFLICT (identifier, token) DO UPDATE SET expires = EXCLUDED.expires`,
          [vt.identifier, vt.token, vt.expires]
        );
      });
      return vt;
    },

    async useVerificationToken({ identifier, token }) {
      return withPg(async (pg) => {
        const res = await pg.query(
          `DELETE FROM verification_tokens
           WHERE identifier = $1 AND token = $2
           RETURNING identifier, token, expires`,
          [identifier, token]
        );
        if (res.rowCount === 0) return null;
        const r = res.rows[0];
        return {
          identifier: r.identifier,
          token: r.token,
          expires: new Date(r.expires),
        };
      });
    },

    // User validation is done in the signIn callback against Airtable; these
    // are required for the Email provider flow but don't need real persistence.
    async getUserByEmail() {
      return null;
    },

    async createUser(user: { email: string }) {
      return {
        id: crypto.randomUUID(),
        email: user.email,
        emailVerified: new Date(),
      };
    },
  };
}
