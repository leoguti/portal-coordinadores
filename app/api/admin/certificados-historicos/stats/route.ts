/**
 * Stats del histórico de certificados (Neon): fecha mínima/máxima y total.
 *
 * Devuelve el alcance GLOBAL del archivo (no filtra por coordinador), porque
 * el banner del histórico está comunicando el tamaño del archivo histórico
 * completo ("hay un periodo de tiempo muy largo"), no la rebanada del usuario.
 * La búsqueda sí respeta rol (eso vive en el endpoint principal).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = session.user?.rol;
  if (!rol || !["Administrador", "Supervisor", "Coordinador"].includes(rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    const res = await pg.query(
      `SELECT
         COUNT(*) AS total,
         MIN(fechadevolucion::date) FILTER (WHERE fechadevolucion IS NOT NULL AND fechadevolucion::text <> '')::text AS min_fecha,
         MAX(fechadevolucion::date) FILTER (WHERE fechadevolucion IS NOT NULL AND fechadevolucion::text <> '')::text AS max_fecha
       FROM certificados`
    );
    const r = res.rows[0] || {};
    return NextResponse.json({
      minFecha: r.min_fecha || null,
      maxFecha: r.max_fecha || null,
      total: Number(r.total) || 0,
    });
  } catch (e) {
    console.error("certificados-historicos/stats error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  } finally {
    await pg.end();
  }
}
