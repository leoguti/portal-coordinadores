import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = session.user?.rol;
  const isAdmin = rol === "Administrador" || rol === "Supervisor";
  const isCoordinador = rol === "Coordinador";

  if (!isAdmin && !isCoordinador) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || "";
  const ano = searchParams.get("ano")?.trim() || "";
  const municipio = searchParams.get("municipio")?.trim() || "";
  const coordinador = searchParams.get("coordinador")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;

    // Coordinadores solo ven sus propios certificados
    if (isCoordinador) {
      conditions.push(`coordinador_airtable_id = $${p}`);
      params.push(session.user.coordinatorRecordId!);
      p++;
    }

    if (q) {
      conditions.push(`(nombregenerador ILIKE $${p} OR cedulagenerador ILIKE $${p + 1} OR CAST(consecutivo AS TEXT) = $${p + 2})`);
      params.push(`%${q}%`, `%${q}%`, q);
      p += 3;
    }
    if (ano) {
      conditions.push(`ano = $${p}`);
      params.push(parseInt(ano));
      p++;
    }
    if (municipio) {
      conditions.push(`municipiodevolucion ILIKE $${p}`);
      params.push(`%${municipio}%`);
      p++;
    }
    // Solo admin puede filtrar por coordinador
    if (isAdmin && coordinador) {
      conditions.push(`nombrecoordinador ILIKE $${p}`);
      params.push(`%${coordinador}%`);
      p++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await pg.query(
      `SELECT COUNT(*) FROM certificados ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pg.query(
      `SELECT
        id, consecutivo, nombregenerador, cedulagenerador,
        municipiodevolucion, fechadevolucion, ano,
        nombrecoordinador, total, rigidos, flexibles, metalicos, embalaje,
        triplelavado, fuente,
        certificadopdf_r2_url, certificadopdf_filename
       FROM certificados
       ${where}
       ORDER BY consecutivo DESC NULLS LAST
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      results: dataRes.rows,
    });
  } finally {
    await pg.end();
  }
}
