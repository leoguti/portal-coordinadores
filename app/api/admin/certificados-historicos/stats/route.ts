/**
 * Stats del histórico de certificados (Neon): fecha mínima/máxima y total.
 * Respeta el rol: el coordinador ve solo sus propios certificados.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = session.user?.rol;
  const isAdmin = rol === "Administrador" || rol === "Supervisor";
  const isCoordinador = rol === "Coordinador";
  if (!isAdmin && !isCoordinador) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    const params: string[] = [];
    let where = "";
    if (isCoordinador) {
      where = "WHERE coordinador_airtable_id = $1";
      params.push(session.user.coordinatorRecordId!);
    }
    const res = await pg.query(
      `SELECT MIN(fechadevolucion::date)::text AS min_fecha,
              MAX(fechadevolucion::date)::text AS max_fecha,
              COUNT(*) AS total
       FROM certificados
       ${where}
       ${where ? "AND" : "WHERE"} fechadevolucion IS NOT NULL AND fechadevolucion::text <> ''`,
      params
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
