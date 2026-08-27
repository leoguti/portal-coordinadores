import { NextRequest, NextResponse } from "next/server";
import { Client as PgClient } from "pg";

/**
 * POST /api/certificados/verificar — verificación manual PÚBLICA.
 *
 * Para certificados sin QR (históricos): exige número de certificado +
 * cédula completa del generador (dos factores: el número solo no permite
 * enumerar datos ajenos). Si coinciden devuelve el token de verificación
 * y el cliente navega a /v/<token> (una sola página de resultado).
 *
 * Rate limiting best-effort en memoria por IP (cada instancia serverless
 * tiene su contador; suficiente contra enumeración casual).
 */

const intentos = new Map<string, { n: number; desde: number }>();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 30;

function rateLimitOk(ip: string): boolean {
  const ahora = Date.now();
  const e = intentos.get(ip);
  if (!e || ahora - e.desde > VENTANA_MS) {
    intentos.set(ip, { n: 1, desde: ahora });
    return true;
  }
  e.n++;
  return e.n <= MAX_INTENTOS;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espere unos minutos e intente de nuevo." },
      { status: 429 }
    );
  }

  let body: { consecutivo?: unknown; cedula?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const consecutivo = parseInt(String(body.consecutivo || ""), 10);
  const cedula = String(body.cedula || "").replace(/\D/g, "");
  if (!consecutivo || consecutivo <= 0 || cedula.length < 4) {
    return NextResponse.json(
      { error: "Ingrese el número del certificado y la cédula completa del generador" },
      { status: 400 }
    );
  }

  const pg = new PgClient({ connectionString: process.env.NEON_DATABASE_URL });
  try {
    await pg.connect();
    const res = await pg.query(
      `SELECT verificacion_token FROM certificados
       WHERE consecutivo = $1 AND REGEXP_REPLACE(COALESCE(cedulagenerador,''), '[^0-9]', '', 'g') = $2
       LIMIT 1`,
      [consecutivo, cedula]
    );
    const token = res.rows[0]?.verificacion_token as string | undefined;
    if (!token) {
      return NextResponse.json({
        encontrado: false,
        mensaje:
          "No existe ningún certificado de CampoLimpio con ese número y esa cédula. Verifique los datos; si está seguro de que son correctos, el documento puede ser falso — repórtelo a certificados@campolimpio.org.",
      });
    }
    return NextResponse.json({ encontrado: true, token });
  } catch (err) {
    console.error("[verificar] error:", err);
    return NextResponse.json({ error: "Error temporal. Intente de nuevo." }, { status: 500 });
  } finally {
    await pg.end().catch(() => {});
  }
}
