import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllKardex,
  listAllActividades,
  getAllMetasMensuales,
  getAllCoordinadoresActivos,
  getCentrosAcopio,
} from "@/lib/airtable";

const MATERIALES = [
  "Reciclaje",
  "Incineracion",
  "Flexibles",
  "PlasticoContaminado",
  "Lonas",
  "Carton",
  "Metal",
] as const;

const MATERIAL_LABELS: Record<string, string> = {
  Reciclaje: "Reciclaje",
  Incineracion: "Incineración",
  Flexibles: "Flexibles",
  PlasticoContaminado: "Plást. Contaminado",
  Lonas: "Lonas",
  Carton: "Cartón",
  Metal: "Metal",
};

const MES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * GET /api/dashboard/ejecutivo-stats-mensual?year=YYYY&month=M
 * Estadísticas mensuales con cálculo correcto de saldos acumulados.
 *
 * Cuidado:
 * - saldoFinMes (acumulado) = SaldoInicialTotal + entradas hasta fin_mes
 *                              - salidas hasta fin_mes (por centro)
 * - saldoInicialMes = saldo a fin del mes anterior
 * - Movimientos del mes (entradas/salidas/movimientos KPI) = sólo kardex del mes
 * - Deltas: vs MISMO mes año anterior (no mes anterior)
 * - Metas: leídas directamente de MetasMensuales (NO se prorratean — cada mes
 *   tiene su propia meta cargada)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!isAdminOrSupervisor(session.user.rol)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    // Acepta monthFrom/monthTo (rango) o month (mono-mes, compat).
    const singleMonth = searchParams.get("month");
    let monthFrom = parseInt(
      searchParams.get("monthFrom") || singleMonth || String(now.getMonth() + 1)
    );
    let monthTo = parseInt(
      searchParams.get("monthTo") || singleMonth || String(now.getMonth() + 1)
    );
    if (
      !Number.isInteger(monthFrom) || monthFrom < 1 || monthFrom > 12 ||
      !Number.isInteger(monthTo) || monthTo < 1 || monthTo > 12
    ) {
      return NextResponse.json({ error: "monthFrom/monthTo inválidos" }, { status: 400 });
    }
    if (monthFrom > monthTo) {
      // Auto-corrección defensiva
      [monthFrom, monthTo] = [monthTo, monthFrom];
    }
    const periodoFrom = `${year}-${String(monthFrom).padStart(2, "0")}`;
    const periodoTo = `${year}-${String(monthTo).padStart(2, "0")}`;

    // Fechas para cálculos de saldo acumulado
    const finMes = lastDayStr(year, monthTo); // último día del periodo
    const finMesAnterior = lastDayPrevMonthStr(year, monthFrom); // día antes del periodo

    const [
      allKardex,
      allActividades,
      metasMensualesAll,
      coordinadoresActivos,
      centrosAcopio,
    ] = await Promise.all([
      getAllKardex(),
      listAllActividades(),
      // Traer metas de los meses en el rango → concatenar
      Promise.all(
        Array.from({ length: monthTo - monthFrom + 1 }, (_, i) =>
          getAllMetasMensuales(year, monthFrom + i)
        )
      ).then((arr) => arr.flat()),
      getAllCoordinadoresActivos(),
      getCentrosAcopio(),
    ]);
    const metasMensuales = metasMensualesAll;

    // Helpers para filtros por rango (kardex.MES y actividad.Mes son YYYY-MM)
    const inRange = (mes: string | undefined): boolean =>
      typeof mes === "string" && mes >= periodoFrom && mes <= periodoTo;
    const inRangePrevYear = (mes: string | undefined): boolean => {
      if (typeof mes !== "string") return false;
      // mismo rango de meses, año anterior
      return (
        mes >= `${year - 1}-${String(monthFrom).padStart(2, "0")}` &&
        mes <= `${year - 1}-${String(monthTo).padStart(2, "0")}`
      );
    };

    const kardexMes = allKardex.filter((k) => inRange(k.fields.MES));
    const kardexMesPrev = allKardex.filter((k) => inRangePrevYear(k.fields.MES));
    const actividadesMes = allActividades.filter((a) => inRange(a.fields.Mes));

    const coordMap = new Map(coordinadoresActivos.map((c) => [c.id, c.name]));

    // --- KPIs del mes ---
    const entradasKg = kardexMes
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((s, k) => s + (k.fields.Total || 0), 0);
    const salidasKg = Math.abs(
      kardexMes
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((s, k) => s + (k.fields.Total || 0), 0)
    );
    const movimientos = kardexMes.length;

    // --- Saldos acumulados (por centro, igual que /saldos-centros) ---
    let saldoFinMes = 0;
    let saldoInicialMes = 0;
    for (const centro of centrosAcopio) {
      const centroId = centro.id;
      const saldoIni = centro.fields.SaldoInicialTotal || 0;

      const kardexCentroHastaFin = allKardex.filter((k) => {
        if (!k.fields.CentrodeAcopio?.includes(centroId)) return false;
        const f = k.fields.fechakardex;
        return typeof f === "string" && f <= finMes;
      });
      const eFin = kardexCentroHastaFin
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((s, k) => s + Math.abs(k.fields.Total || 0), 0);
      const sFin = kardexCentroHastaFin
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((s, k) => s + Math.abs(k.fields.Total || 0), 0);
      saldoFinMes += saldoIni + eFin - sFin;

      const kardexCentroHastaIni = allKardex.filter((k) => {
        if (!k.fields.CentrodeAcopio?.includes(centroId)) return false;
        const f = k.fields.fechakardex;
        return typeof f === "string" && f <= finMesAnterior;
      });
      const eIni = kardexCentroHastaIni
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((s, k) => s + Math.abs(k.fields.Total || 0), 0);
      const sIni = kardexCentroHastaIni
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((s, k) => s + Math.abs(k.fields.Total || 0), 0);
      saldoInicialMes += saldoIni + eIni - sIni;
    }

    // --- Deltas vs mismo mes año anterior ---
    const prevEntradas = kardexMesPrev
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((s, k) => s + (k.fields.Total || 0), 0);
    const prevSalidas = Math.abs(
      kardexMesPrev
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((s, k) => s + (k.fields.Total || 0), 0)
    );
    const prevMovimientos = kardexMesPrev.length;

    function delta(actual: number, prev: number): number | null {
      if (prev === 0) return null;
      return Math.round(((actual - prev) / prev) * 100);
    }

    // --- Metas mensuales por coordinador (1 record por coord en MetasMensuales) ---
    const metaMap = new Map<
      string,
      { rec: number; sen: number; eva: number }
    >();
    for (const m of metasMensuales) {
      const cid = m.fields.Coordinador?.[0];
      if (!cid) continue;
      metaMap.set(cid, {
        rec: m.fields.MetaRecoleccion || 0,
        sen: m.fields.MetaSensibilizacion || 0,
        eva: m.fields.MetaEvaluaciones || 0,
      });
    }

    // --- Recolección por coordinador (kardex del mes) ---
    const entradaPorCoord = new Map<string, number>();
    const salidaPorCoord = new Map<string, number>();
    for (const k of kardexMes) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId) continue;
      const total = k.fields.Total || 0;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entradaPorCoord.set(coordId, (entradaPorCoord.get(coordId) || 0) + total);
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        salidaPorCoord.set(
          coordId,
          (salidaPorCoord.get(coordId) || 0) + Math.abs(total)
        );
      }
    }

    function semaforo(p: number): string {
      if (p >= 70) return "verde";
      if (p >= 40) return "amarillo";
      return "rojo";
    }

    // Lista base = todos los coordinadores activos con rol Coordinador (única fuente de verdad)
    const coordinadores = coordinadoresActivos.filter((c) => c.rol === "Coordinador");

    const metasRecoleccionPorCoord = coordinadores.map((c) => {
      const m = metaMap.get(c.id) || { rec: 0, sen: 0, eva: 0 };
      const entradas = Math.round((entradaPorCoord.get(c.id) || 0) * 100) / 100;
      const salidas = Math.round((salidaPorCoord.get(c.id) || 0) * 100) / 100;
      const porcentaje = m.rec > 0 ? Math.round((entradas / m.rec) * 100) : 0;
      return {
        id: c.id,
        nombre: c.name,
        meta: m.rec,
        entradas,
        salidas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    // --- Sensibilización del mes ---
    const actSensibilizacion = actividadesMes.filter(
      (a) => a.fields.Tipo === "Sensibilización"
    );
    const personasPorCoord = new Map<string, number>();
    const evaluadasPorCoord = new Map<string, number>();
    const evaluacionesPorCoord = new Map<string, number>();
    for (const a of actSensibilizacion) {
      const coordId = a.fields.Coordinador?.[0];
      if (!coordId) continue;
      personasPorCoord.set(
        coordId,
        (personasPorCoord.get(coordId) || 0) +
          (a.fields["Cantidad de Participantes"] || 0)
      );
      evaluadasPorCoord.set(
        coordId,
        (evaluadasPorCoord.get(coordId) || 0) +
          (a.fields["Personas Evaluadas"] || 0)
      );
      evaluacionesPorCoord.set(
        coordId,
        (evaluacionesPorCoord.get(coordId) || 0) +
          (a.fields["CantidadEvaluaciones"] || 0)
      );
    }
    const personasCapacitadas = actSensibilizacion.reduce(
      (s, a) => s + (a.fields["Cantidad de Participantes"] || 0),
      0
    );
    const personasEvaluadas = actSensibilizacion.reduce(
      (s, a) => s + (a.fields["Personas Evaluadas"] || 0),
      0
    );
    const totalEvaluacionesWa = actSensibilizacion.reduce(
      (s, a) => s + (a.fields["CantidadEvaluaciones"] || 0),
      0
    );
    const totalEvalCombinado = totalEvaluacionesWa + personasEvaluadas;

    const metasSensibilizacionPorCoord = coordinadores.map((c) => {
      const m = metaMap.get(c.id) || { rec: 0, sen: 0, eva: 0 };
      const actual = personasPorCoord.get(c.id) || 0;
      const evaluadas = evaluadasPorCoord.get(c.id) || 0;
      const porcentaje = m.sen > 0 ? Math.round((actual / m.sen) * 100) : 0;
      return {
        id: c.id,
        nombre: c.name,
        meta: m.sen,
        actual,
        evaluadas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    const metasEvaluacionesPorCoord = coordinadores.map((c) => {
      const m = metaMap.get(c.id) || { rec: 0, sen: 0, eva: 0 };
      const whatsapp = evaluacionesPorCoord.get(c.id) || 0;
      const reportadas = evaluadasPorCoord.get(c.id) || 0;
      const total = whatsapp + reportadas;
      const porcentaje = m.eva > 0 ? Math.round((total / m.eva) * 100) : 0;
      return {
        id: c.id,
        nombre: c.name,
        meta: m.eva,
        whatsapp,
        reportadas,
        total,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    const metaGlobalRec = metasRecoleccionPorCoord.reduce((s, c) => s + c.meta, 0);
    const metaGlobalSen = metasSensibilizacionPorCoord.reduce(
      (s, c) => s + c.meta,
      0
    );
    const metaGlobalEva = metasEvaluacionesPorCoord.reduce(
      (s, c) => s + c.meta,
      0
    );

    // --- Material por tipo (del mes) ---
    const materialesGlobal = MATERIALES.map((mat) => {
      const ent = kardexMes
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((s, k) => s + Math.abs(k.fields[mat] || 0), 0);
      const sal = kardexMes
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((s, k) => s + Math.abs(k.fields[mat] || 0), 0);
      return {
        material: MATERIAL_LABELS[mat],
        key: mat,
        entradas: Math.round(ent * 100) / 100,
        salidas: Math.round(sal * 100) / 100,
        saldo: Math.round((ent - sal) * 100) / 100,
      };
    });

    const materialesPorCoord: Record<string, typeof materialesGlobal> = {};
    for (const coord of coordinadores) {
      const ck = kardexMes.filter(
        (k) =>
          (k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0]) === coord.id
      );
      materialesPorCoord[coord.id] = MATERIALES.map((mat) => {
        const ent = ck
          .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
          .reduce((s, k) => s + Math.abs(k.fields[mat] || 0), 0);
        const sal = ck
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((s, k) => s + Math.abs(k.fields[mat] || 0), 0);
        return {
          material: MATERIAL_LABELS[mat],
          key: mat,
          entradas: Math.round(ent * 100) / 100,
          salidas: Math.round(sal * 100) / 100,
          saldo: Math.round((ent - sal) * 100) / 100,
        };
      });
    }

    // --- Salidas por proceso (del mes) ---
    const salidasPorProceso = new Map<string, number>();
    for (const k of kardexMes) {
      if (k.fields.TipoMovimiento !== "SALIDA") continue;
      const proceso = k.fields.proceso?.[0] || "Sin proceso";
      salidasPorProceso.set(
        proceso,
        (salidasPorProceso.get(proceso) || 0) + Math.abs(k.fields.Total || 0)
      );
    }
    const salidasProceso = Array.from(salidasPorProceso.entries())
      .map(([proceso, kg]) => ({ proceso, kg: Math.round(kg) }))
      .sort((a, b) => b.kg - a.kg);

    // --- Tendencia 12 meses (igual que en anual) ---
    const hoy = new Date();
    const tendenciaMensual = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const km = allKardex.filter((k) => k.fields.MES === mesStr);
      const e = km
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((s, k) => s + (k.fields.Total || 0), 0);
      const s = Math.abs(
        km
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
      );
      return { mes: mesStr, entradas: Math.round(e), salidas: Math.round(s) };
    }).reverse();

    const monthLabel =
      monthFrom === monthTo
        ? MES_LABEL[monthFrom - 1]
        : `${MES_LABEL[monthFrom - 1]} - ${MES_LABEL[monthTo - 1]}`;

    return NextResponse.json({
      mode: "mensual",
      year,
      month: monthFrom === monthTo ? monthFrom : undefined, // legacy si single
      monthFrom,
      monthTo,
      monthLabel,
      kpis: {
        entradasKg: Math.round(entradasKg),
        salidasKg: Math.round(salidasKg),
        saldoKg: Math.round(saldoFinMes),
        saldoInicialKg: Math.round(saldoInicialMes),
        movimientos,
        deltaEntradas: delta(entradasKg, prevEntradas),
        deltaSalidas: delta(salidasKg, prevSalidas),
        deltaMovimientos: delta(movimientos, prevMovimientos),
      },
      metasRecoleccion: {
        global: {
          meta: metaGlobalRec,
          entradas: Math.round(entradasKg * 100) / 100,
          salidas: Math.round(salidasKg * 100) / 100,
          porcentaje:
            metaGlobalRec > 0 ? Math.round((entradasKg / metaGlobalRec) * 100) : 0,
        },
        porCoordinador: metasRecoleccionPorCoord,
      },
      metasSensibilizacion: {
        global: {
          meta: metaGlobalSen,
          actual: personasCapacitadas,
          evaluadas: personasEvaluadas,
          porcentaje:
            metaGlobalSen > 0
              ? Math.round((personasCapacitadas / metaGlobalSen) * 100)
              : 0,
        },
        porCoordinador: metasSensibilizacionPorCoord,
      },
      metasEvaluaciones: {
        global: {
          meta: metaGlobalEva,
          whatsapp: totalEvaluacionesWa,
          reportadas: personasEvaluadas,
          total: totalEvalCombinado,
          porcentaje:
            metaGlobalEva > 0
              ? Math.round((totalEvalCombinado / metaGlobalEva) * 100)
              : 0,
        },
        porCoordinador: metasEvaluacionesPorCoord,
      },
      materiales: materialesGlobal,
      materialesPorCoord,
      salidasProceso,
      tendenciaMensual,
      coordinadoresList: coordinadores.map((c) => ({ id: c.id, name: c.name })),
      lastUpdated: new Date().toISOString(),
      _coordMapKeys: Array.from(coordMap.keys()).length,
    });
  } catch (error) {
    console.error("Error fetching ejecutivo-stats-mensual:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// --- helpers de fechas ---
function lastDayStr(year: number, month1to12: number): string {
  // último día del mes en formato YYYY-MM-DD
  const d = new Date(year, month1to12, 0); // day 0 = último del mes anterior; mes 1-based
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function lastDayPrevMonthStr(year: number, month1to12: number): string {
  // último día del mes anterior
  if (month1to12 === 1) return `${year - 1}-12-31`;
  return lastDayStr(year, month1to12 - 1);
}
