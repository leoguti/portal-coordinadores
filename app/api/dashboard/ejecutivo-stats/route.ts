import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllKardex,
  listAllActividades,
  getAllMetas,
  getAllCoordinadoresActivos,
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

/**
 * GET /api/dashboard/ejecutivo-stats
 * Focused metrics for executive dashboard
 * Query: ?year=2026 (default: current year)
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
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const yearStr = String(year);
    const prevYearStr = String(year - 1);

    // Fetch only what we need
    const [allKardex, allActividades, allMetas, coordinadoresActivos] =
      await Promise.all([
        getAllKardex(),
        listAllActividades(),
        getAllMetas(year),
        getAllCoordinadoresActivos(),
      ]);

    const kardexYear = allKardex.filter((k) => k.fields.AÑO === yearStr);
    const kardexPrevYear = allKardex.filter(
      (k) => k.fields.AÑO === prevYearStr
    );
    const actividadesYear = allActividades.filter(
      (a) => a.fields.Año === yearStr
    );

    const coordMap = new Map(
      coordinadoresActivos.map((c) => [c.id, c.name])
    );

    // --- KPIs ---
    const entradasKg = kardexYear
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const salidasKg = Math.abs(
      kardexYear
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );
    const movimientos = kardexYear.length;

    // Previous year for deltas (same period: up to current month)
    const currentMonth = new Date().getMonth() + 1;
    const prevYearSamePeriod = kardexPrevYear.filter((k) => {
      const mes = k.fields.MES;
      if (!mes) return false;
      const m = parseInt(mes.split("-")[1]);
      return m <= currentMonth;
    });
    const prevEntradas = prevYearSamePeriod
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const prevSalidas = Math.abs(
      prevYearSamePeriod
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );
    const prevMovimientos = prevYearSamePeriod.length;

    function delta(actual: number, prev: number): number | null {
      if (prev === 0) return null;
      return Math.round(((actual - prev) / prev) * 100);
    }

    // --- Metas Recolección ---
    const entradaPorCoord = new Map<string, number>();
    const salidaPorCoord = new Map<string, number>();
    for (const k of kardexYear) {
      const coordId =
        k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId) continue;
      const total = k.fields.Total || 0;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entradaPorCoord.set(
          coordId,
          (entradaPorCoord.get(coordId) || 0) + total
        );
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        salidaPorCoord.set(
          coordId,
          (salidaPorCoord.get(coordId) || 0) + Math.abs(total)
        );
      }
    }

    const metaGlobalRecoleccion = allMetas.reduce(
      (sum, m) => sum + (m.fields.MetaRecoleccion || 0),
      0
    );
    const metaGlobalSensibilizacion = allMetas.reduce(
      (sum, m) => sum + (m.fields.MetaSensibilizacion || 0),
      0
    );

    function semaforo(porcentaje: number): string {
      if (porcentaje >= 70) return "verde";
      if (porcentaje >= 40) return "amarillo";
      return "rojo";
    }

    const metasRecoleccionPorCoord = allMetas.map((m) => {
      const coordId =
        m.fields.id_coordinador?.[0] || m.fields.Coordinador?.[0] || "";
      const meta = m.fields.MetaRecoleccion || 0;
      const entradas =
        Math.round((entradaPorCoord.get(coordId) || 0) * 100) / 100;
      const salidas =
        Math.round((salidaPorCoord.get(coordId) || 0) * 100) / 100;
      const porcentaje = meta > 0 ? Math.round((entradas / meta) * 100) : 0;
      return {
        id: coordId,
        nombre: coordMap.get(coordId) || "Sin nombre",
        meta,
        entradas,
        salidas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    // --- Metas Sensibilización ---
    const actSensibilizacion = actividadesYear.filter(
      (a) => a.fields.Tipo === "Sensibilización"
    );
    const personasPorCoord = new Map<string, number>();
    const evaluadasPorCoord = new Map<string, number>();
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
    }

    const personasCapacitadas = actSensibilizacion.reduce(
      (sum, a) => sum + (a.fields["Cantidad de Participantes"] || 0),
      0
    );
    const personasEvaluadas = actSensibilizacion.reduce(
      (sum, a) => sum + (a.fields["Personas Evaluadas"] || 0),
      0
    );

    const metasSensibilizacionPorCoord = allMetas.map((m) => {
      const coordId =
        m.fields.id_coordinador?.[0] || m.fields.Coordinador?.[0] || "";
      const meta = m.fields.MetaSensibilizacion || 0;
      const actual = personasPorCoord.get(coordId) || 0;
      const evaluadas = evaluadasPorCoord.get(coordId) || 0;
      const porcentaje = meta > 0 ? Math.round((actual / meta) * 100) : 0;
      return {
        id: coordId,
        nombre: coordMap.get(coordId) || "Sin nombre",
        meta,
        actual,
        evaluadas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    // --- Material por tipo (entradas y salidas separadas) ---
    // Global
    const materialesGlobal = MATERIALES.map((mat) => {
      const entMat = kardexYear
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((sum, k) => sum + Math.abs(k.fields[mat] || 0), 0);
      const salMat = kardexYear
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + Math.abs(k.fields[mat] || 0), 0);
      return {
        material: MATERIAL_LABELS[mat],
        key: mat,
        entradas: Math.round(entMat * 100) / 100,
        salidas: Math.round(salMat * 100) / 100,
        saldo: Math.round((entMat - salMat) * 100) / 100,
      };
    });

    // Per coordinator
    const materialesPorCoord: Record<
      string,
      Array<{
        material: string;
        key: string;
        entradas: number;
        salidas: number;
        saldo: number;
      }>
    > = {};
    for (const coord of coordinadoresActivos) {
      if (coord.rol !== "Coordinador") continue;
      const coordKardex = kardexYear.filter(
        (k) =>
          (k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0]) ===
          coord.id
      );
      materialesPorCoord[coord.id] = MATERIALES.map((mat) => {
        const entMat = coordKardex
          .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
          .reduce((sum, k) => sum + Math.abs(k.fields[mat] || 0), 0);
        const salMat = coordKardex
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + Math.abs(k.fields[mat] || 0), 0);
        return {
          material: MATERIAL_LABELS[mat],
          key: mat,
          entradas: Math.round(entMat * 100) / 100,
          salidas: Math.round(salMat * 100) / 100,
          saldo: Math.round((entMat - salMat) * 100) / 100,
        };
      });
    }

    // --- Salidas por Proceso (lookup directo del kardex) ---
    const salidasPorProceso = new Map<string, number>();
    for (const k of kardexYear) {
      if (k.fields.TipoMovimiento !== "SALIDA") continue;
      const proceso = k.fields.proceso?.[0] || "Sin proceso";
      salidasPorProceso.set(
        proceso,
        (salidasPorProceso.get(proceso) || 0) + Math.abs(k.fields.Total || 0)
      );
    }

    const salidasProceso = Array.from(salidasPorProceso.entries())
      .map(([proceso, kg]) => ({
        proceso,
        kg: Math.round(kg),
      }))
      .sort((a, b) => b.kg - a.kg);

    // --- Tendencia mensual (últimos 12 meses desde hoy, más nuevo primero) ---
    const hoy = new Date();
    const tendenciaMensual = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const kardexMes = allKardex.filter((k) => k.fields.MES === mesStr);
      const entradas = kardexMes
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
      const salidas = Math.abs(
        kardexMes
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
      );
      return {
        mes: mesStr,
        entradas: Math.round(entradas),
        salidas: Math.round(salidas),
      };
    }).reverse(); // oldest first for chart display

    return NextResponse.json({
      kpis: {
        entradasKg: Math.round(entradasKg),
        salidasKg: Math.round(salidasKg),
        saldoKg: Math.round(entradasKg - salidasKg),
        movimientos,
        deltaEntradas: delta(entradasKg, prevEntradas),
        deltaSalidas: delta(salidasKg, prevSalidas),
        deltaMovimientos: delta(movimientos, prevMovimientos),
      },
      metasRecoleccion: {
        global: {
          meta: metaGlobalRecoleccion,
          entradas: Math.round(entradasKg * 100) / 100,
          salidas: Math.round(salidasKg * 100) / 100,
          porcentaje:
            metaGlobalRecoleccion > 0
              ? Math.round((entradasKg / metaGlobalRecoleccion) * 100)
              : 0,
        },
        porCoordinador: metasRecoleccionPorCoord,
      },
      metasSensibilizacion: {
        global: {
          meta: metaGlobalSensibilizacion,
          actual: personasCapacitadas,
          evaluadas: personasEvaluadas,
          porcentaje:
            metaGlobalSensibilizacion > 0
              ? Math.round(
                  (personasCapacitadas / metaGlobalSensibilizacion) * 100
                )
              : 0,
        },
        porCoordinador: metasSensibilizacionPorCoord,
      },
      materiales: materialesGlobal,
      materialesPorCoord,
      salidasProceso,
      tendenciaMensual,
      coordinadoresList: coordinadoresActivos
        .filter((c) => c.rol === "Coordinador")
        .map((c) => ({ id: c.id, name: c.name })),
      year,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching ejecutivo stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
