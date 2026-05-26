/**
 * GET /api/dashboard/certificados-stats
 *
 * Estadísticas de certificados desde Neon. Devuelve KPIs, tendencia mensual,
 * top cultivos/municipios/departamentos/coordinadores, composición de
 * materiales, heatmap cultivo×departamento y top generadores.
 *
 * Roles:
 *   - Coordinador: SOLO sus propios certificados (forzado).
 *   - Admin/Supervisor: todos; puede filtrar por ?coordinador=recXXX.
 *
 * Query params:
 *   year         (default año actual)
 *   monthFrom    1..12 (default 1)
 *   monthTo      1..12 (default 12)
 *   coordinador  (solo admin) recordId de coordinador para filtrar
 *   cultivo      coma-separado (ej. "Café,Aguacate")
 *   departamento coma-separado
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Client } from "pg";

const ALL_KEY = "__all__";

function parseList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = session.user?.rol;
  const isAdmin = rol === "Administrador" || rol === "Supervisor";
  const isCoordinador = rol === "Coordinador";
  if (!isAdmin && !isCoordinador) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year = Math.max(2018, parseInt(sp.get("year") || String(now.getFullYear())));
  const monthFrom = Math.min(12, Math.max(1, parseInt(sp.get("monthFrom") || "1")));
  const monthTo = Math.min(12, Math.max(monthFrom, parseInt(sp.get("monthTo") || "12")));
  const cultivos = parseList(sp.get("cultivo"));
  const departamentos = parseList(sp.get("departamento"));

  // Coordinador filter: coordinador autenticado SI no es admin; opcionalmente
  // un coordinador específico si admin pasó el parámetro.
  const coordParam = sp.get("coordinador") || "";
  const coordinadorFilter = isCoordinador
    ? session.user.coordinatorRecordId!
    : coordParam || "";

  // Construcción de WHERE compartido (excluye coordinador para ciertos subqueries
  // donde queremos ranking GLOBAL incluso si hay filtro de coord; pero por
  // simplicidad v1: el filtro de coord aplica a TODO).
  const whereCommon = (alias = "c") => {
    const w: string[] = [];
    const params: (string | number | string[])[] = [];
    let p = 1;
    // Rango de fechas por year + monthFrom..monthTo
    const desde = `${year}-${String(monthFrom).padStart(2, "0")}-01`;
    // El último día del mes monthTo: usar primer día del mes siguiente y restar 1
    const nextMonth = monthTo === 12 ? `${year + 1}-01-01` : `${year}-${String(monthTo + 1).padStart(2, "0")}-01`;
    w.push(`${alias}.fechadevolucion IS NOT NULL AND ${alias}.fechadevolucion::text <> ''`);
    w.push(`${alias}.fechadevolucion::date >= $${p}::date`);
    params.push(desde);
    p++;
    w.push(`${alias}.fechadevolucion::date < $${p}::date`);
    params.push(nextMonth);
    p++;
    if (coordinadorFilter) {
      w.push(`${alias}.coordinador_airtable_id = $${p}`);
      params.push(coordinadorFilter);
      p++;
    }
    if (cultivos.length) {
      w.push(`${alias}.cultivogenerador = ANY($${p}::text[])`);
      params.push(cultivos);
      p++;
    }
    if (departamentos.length) {
      w.push(`${alias}.departamento = ANY($${p}::text[])`);
      params.push(departamentos);
      p++;
    }
    return { sql: w.join(" AND "), params };
  };

  // Ventana del año anterior (mismos meses)
  const whereAnoAnterior = () => {
    const desde = `${year - 1}-${String(monthFrom).padStart(2, "0")}-01`;
    const nextMonth = monthTo === 12 ? `${year}-01-01` : `${year - 1}-${String(monthTo + 1).padStart(2, "0")}-01`;
    const w: string[] = [];
    const params: (string | number | string[])[] = [];
    let p = 1;
    w.push(`fechadevolucion IS NOT NULL AND fechadevolucion::text <> ''`);
    w.push(`fechadevolucion::date >= $${p}::date`);
    params.push(desde); p++;
    w.push(`fechadevolucion::date < $${p}::date`);
    params.push(nextMonth); p++;
    if (coordinadorFilter) { w.push(`coordinador_airtable_id = $${p}`); params.push(coordinadorFilter); p++; }
    if (cultivos.length) { w.push(`cultivogenerador = ANY($${p}::text[])`); params.push(cultivos); p++; }
    if (departamentos.length) { w.push(`departamento = ANY($${p}::text[])`); params.push(departamentos); p++; }
    return { sql: w.join(" AND "), params };
  };

  const pg = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await pg.connect();
  try {
    const { sql: W, params: P } = whereCommon();
    const { sql: Wp, params: Pp } = whereAnoAnterior();

    // 1. KPIs período actual
    const kpiCur = await pg.query(
      `SELECT
         COUNT(*) certs,
         COALESCE(SUM(total),0) kg,
         COALESCE(SUM(rigidos),0) rigidos,
         COALESCE(SUM(flexibles),0) flexibles,
         COALESCE(SUM(metalicos),0) metalicos,
         COALESCE(SUM(embalaje),0) embalaje,
         COUNT(*) FILTER (WHERE LOWER(triplelavado) IN ('si','sí')) triplesi,
         COUNT(*) FILTER (WHERE triplelavado IS NOT NULL AND triplelavado <> '') con_triple
       FROM certificados c WHERE ${W}`,
      P
    );

    // 2. KPIs período año anterior
    const kpiPrev = await pg.query(
      `SELECT COUNT(*) certs, COALESCE(SUM(total),0) kg FROM certificados WHERE ${Wp}`,
      Pp
    );

    // 3. Tendencia mensual (año actual + año anterior)
    const tendCur = await pg.query(
      `SELECT to_char(c.fechadevolucion::date,'YYYY-MM') ym,
              COUNT(*) certs, COALESCE(SUM(total),0) kg
       FROM certificados c WHERE ${W}
       GROUP BY ym ORDER BY ym`,
      P
    );
    const tendPrev = await pg.query(
      `SELECT to_char(fechadevolucion::date,'YYYY-MM') ym,
              COUNT(*) certs, COALESCE(SUM(total),0) kg
       FROM certificados WHERE ${Wp}
       GROUP BY ym ORDER BY ym`,
      Pp
    );

    // 4. Top cultivos
    const porCultivo = await pg.query(
      `SELECT COALESCE(NULLIF(c.cultivogenerador,''),'(sin)') cultivo,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c WHERE ${W}
       GROUP BY cultivo ORDER BY kg DESC LIMIT 15`,
      P
    );

    // 5. Por departamento (top 15)
    const porDepto = await pg.query(
      `SELECT COALESCE(NULLIF(c.departamento,''),'(sin)') depto,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c WHERE ${W}
       GROUP BY depto ORDER BY kg DESC LIMIT 15`,
      P
    );

    // 6. Top municipios (top 15)
    const porMun = await pg.query(
      `SELECT COALESCE(NULLIF(c.municipiodevolucion,''),'(sin)') mun,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c WHERE ${W}
       GROUP BY mun ORDER BY kg DESC LIMIT 15`,
      P
    );

    // 7. Por coordinador
    const porCoord = await pg.query(
      `SELECT c.coordinador_airtable_id id,
              COALESCE(NULLIF(c.nombrecoordinador,''),'(sin)') nombre,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c WHERE ${W}
       GROUP BY id, nombre ORDER BY kg DESC`,
      P
    );

    // 8. Top generadores
    const topGen = await pg.query(
      `SELECT COALESCE(NULLIF(c.nombregenerador,''),'(sin)') nombre,
              c.cedulagenerador cedula,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c WHERE ${W}
       GROUP BY nombre, cedula ORDER BY kg DESC LIMIT 20`,
      P
    );

    // 9. Heatmap cultivo × depto (top 8 x top 8)
    const cdHeat = await pg.query(
      `WITH topc AS (
         SELECT cultivogenerador c FROM certificados c2
         WHERE ${W.replace(/c\./g, "c2.")}
           AND c2.cultivogenerador IS NOT NULL AND c2.cultivogenerador <> ''
         GROUP BY c ORDER BY SUM(total) DESC NULLS LAST LIMIT 8
       ),
       topd AS (
         SELECT departamento d FROM certificados c3
         WHERE ${W.replace(/c\./g, "c3.")}
           AND c3.departamento IS NOT NULL AND c3.departamento <> ''
         GROUP BY d ORDER BY SUM(total) DESC NULLS LAST LIMIT 8
       )
       SELECT c.cultivogenerador cultivo, c.departamento depto,
              COUNT(*) certs, COALESCE(SUM(total),0)::numeric kg
       FROM certificados c
       WHERE ${W}
         AND c.cultivogenerador IN (SELECT c FROM topc)
         AND c.departamento IN (SELECT d FROM topd)
       GROUP BY cultivo, depto`,
      P
    );

    // 10. Filtros disponibles (para los selects del UI)
    const yearsList = await pg.query(
      `SELECT DISTINCT ano FROM certificados WHERE ano IS NOT NULL ORDER BY ano DESC`
    );
    const cultivosList = await pg.query(
      `SELECT cultivogenerador c, COUNT(*) n FROM certificados
       WHERE cultivogenerador IS NOT NULL AND cultivogenerador <> ''
       GROUP BY c ORDER BY n DESC LIMIT 40`
    );
    const deptosList = await pg.query(
      `SELECT departamento d, COUNT(*) n FROM certificados
       WHERE departamento IS NOT NULL AND departamento <> ''
       GROUP BY d ORDER BY n DESC`
    );

    const cur = kpiCur.rows[0];
    const prev = kpiPrev.rows[0];
    const curKg = Number(cur.kg) || 0;
    const curCerts = Number(cur.certs) || 0;
    const prevKg = Number(prev.kg) || 0;
    const prevCerts = Number(prev.certs) || 0;
    const conTriple = Number(cur.con_triple) || 0;
    const triplesi = Number(cur.triplesi) || 0;

    return NextResponse.json({
      meta: {
        year, monthFrom, monthTo,
        coordinador: coordinadorFilter || null,
        coordinadorForzado: isCoordinador,
      },
      kpis: {
        certs: curCerts,
        kg: curKg,
        kgPorCert: curCerts > 0 ? curKg / curCerts : 0,
        pctTripleLavado: conTriple > 0 ? (triplesi / conTriple) * 100 : 0,
        certsPrev: prevCerts,
        kgPrev: prevKg,
        deltaCertsPct: prevCerts > 0 ? ((curCerts - prevCerts) / prevCerts) * 100 : null,
        deltaKgPct: prevKg > 0 ? ((curKg - prevKg) / prevKg) * 100 : null,
      },
      materiales: {
        rigidos: Number(cur.rigidos) || 0,
        flexibles: Number(cur.flexibles) || 0,
        metalicos: Number(cur.metalicos) || 0,
        embalaje: Number(cur.embalaje) || 0,
      },
      tendencia: {
        actual: tendCur.rows.map((r) => ({ ym: r.ym, certs: Number(r.certs), kg: Number(r.kg) })),
        anterior: tendPrev.rows.map((r) => ({ ym: r.ym, certs: Number(r.certs), kg: Number(r.kg) })),
      },
      porCultivo: porCultivo.rows.map((r) => ({ cultivo: r.cultivo, certs: Number(r.certs), kg: Number(r.kg) })),
      porDepto: porDepto.rows.map((r) => ({ depto: r.depto, certs: Number(r.certs), kg: Number(r.kg) })),
      porMunicipio: porMun.rows.map((r) => ({ mun: r.mun, certs: Number(r.certs), kg: Number(r.kg) })),
      porCoordinador: porCoord.rows.map((r) => ({ id: r.id, nombre: r.nombre, certs: Number(r.certs), kg: Number(r.kg) })),
      topGeneradores: topGen.rows.map((r) => ({ nombre: r.nombre, cedula: r.cedula, certs: Number(r.certs), kg: Number(r.kg) })),
      heatmap: cdHeat.rows.map((r) => ({ cultivo: r.cultivo, depto: r.depto, certs: Number(r.certs), kg: Number(r.kg) })),
      filtros: {
        years: yearsList.rows.map((r) => Number(r.ano)),
        cultivos: cultivosList.rows.map((r) => r.c),
        departamentos: deptosList.rows.map((r) => r.d),
      },
    });
  } catch (e) {
    console.error("certificados-stats error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  } finally {
    await pg.end();
  }
}
