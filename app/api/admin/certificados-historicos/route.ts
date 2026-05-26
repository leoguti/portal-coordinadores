import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

// Normaliza tildes y caracteres especiales del español
function norm(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar diacríticos
    .toLowerCase();
}

// Expresión SQL que normaliza una columna igual que norm() en JS
// Cubre tildes del español + ñ/Ñ
const NORM_SQL = (col: string) =>
  `LOWER(TRANSLATE(${col},
    'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑ',
    'aaaaaaaaaaeeeeeeeeiiiiiiiiooooooooooUUUUUUUUnn'))`;

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
  const q = norm(searchParams.get("q")?.trim() || "");
  const ano = searchParams.get("ano")?.trim() || "";
  const municipio = norm(searchParams.get("municipio")?.trim() || "");
  const coordinador = norm(searchParams.get("coordinador")?.trim() || "");
  // Rango de fechas (YYYY-MM-DD). Se valida el formato antes de usarlo para
  // evitar errores de cast en el SQL.
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const desdeRaw = searchParams.get("desde")?.trim() || "";
  const hastaRaw = searchParams.get("hasta")?.trim() || "";
  const desde = isDate(desdeRaw) ? desdeRaw : "";
  const hasta = isDate(hastaRaw) ? hastaRaw : "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;

    // En el histórico TODOS los roles ven todos los certificados (sin filtro
    // por coordinador). La restricción por rol solo aplica al listado actual.

    if (q) {
      // Busca insensible a mayúsculas Y tildes
      conditions.push(
        `(${NORM_SQL("nombregenerador")} ILIKE $${p}` +
        ` OR ${NORM_SQL("cedulagenerador")} ILIKE $${p + 1}` +
        ` OR CAST(consecutivo AS TEXT) = $${p + 2})`
      );
      params.push(`%${q}%`, `%${q}%`, q);
      p += 3;
    }
    if (ano) {
      conditions.push(`ano = $${p}`);
      params.push(parseInt(ano));
      p++;
    }
    if (desde) {
      conditions.push(`fechadevolucion::date >= $${p}::date`);
      params.push(desde);
      p++;
    }
    if (hasta) {
      conditions.push(`fechadevolucion::date <= $${p}::date`);
      params.push(hasta);
      p++;
    }
    if (municipio) {
      conditions.push(`${NORM_SQL("municipiodevolucion")} ILIKE $${p}`);
      params.push(`%${municipio}%`);
      p++;
    }
    // Solo admin puede filtrar por coordinador
    if (isAdmin && coordinador) {
      conditions.push(`${NORM_SQL("nombrecoordinador")} ILIKE $${p}`);
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
  } catch (e) {
    console.error("certificados-historicos error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  } finally {
    await pg.end();
  }
}
