import { NextResponse } from "next/server";
import { participantesAprobados, evaluadasAprobadas, evaluacionesWAAprobadas } from "@/lib/actividadCompleteness";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getMetasMensualesByCoordinadorYAño,
  getAllKardex,
  listActividadesForCoordinator,
  getOrdenesCoordinador,
  getGastosCajaMenorCoordinador,
  getRubros,
} from "@/lib/airtable";

const MES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * GET /api/dashboard/coordinador-stats-mensual?year=YYYY&monthFrom=N&monthTo=N
 *
 * Stats del rango de meses para el coordinador autenticado.
 * Si monthFrom = monthTo → mes individual (compat con vista mes único).
 *
 * Diferencias con la versión anual:
 * - kardex/actividades filtrados por MES en el rango
 * - Metas: suma de las metas mensuales del coordinador en el rango
 * - Tendencia 12 meses: igual (siempre últimos 12 meses)
 */
// Paginado pesado de Airtable (kardex/actividades/ordenes completos): sin
// maxDuration la función moría por timeout → 500 (bug 2026-07-08).
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const coordinatorId = session.user.coordinatorRecordId;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    let monthFrom = parseInt(
      searchParams.get("monthFrom") || String(now.getMonth() + 1)
    );
    let monthTo = parseInt(
      searchParams.get("monthTo") || String(now.getMonth() + 1)
    );
    if (
      !Number.isInteger(monthFrom) || monthFrom < 1 || monthFrom > 12 ||
      !Number.isInteger(monthTo) || monthTo < 1 || monthTo > 12
    ) {
      return NextResponse.json({ error: "monthFrom/monthTo inválidos" }, { status: 400 });
    }
    if (monthFrom > monthTo) {
      [monthFrom, monthTo] = [monthTo, monthFrom];
    }
    const periodoFrom = `${year}-${String(monthFrom).padStart(2, "0")}`;
    const periodoTo = `${year}-${String(monthTo).padStart(2, "0")}`;

    // Helpers para filtros por rango (formato YYYY-MM funciona lex)
    const inRange = (mes: string | undefined): boolean =>
      typeof mes === "string" && mes >= periodoFrom && mes <= periodoTo;

    const [
      metas12,
      allKardex,
      actividades,
      ordenes,
      gastos,
      rubros,
    ] = await Promise.all([
      getMetasMensualesByCoordinadorYAño(coordinatorId, year),
      getAllKardex(),
      listActividadesForCoordinator(coordinatorId),
      getOrdenesCoordinador(coordinatorId),
      getGastosCajaMenorCoordinador(coordinatorId),
      getRubros(),
    ]);

    // Filtrar al coordinador y al rango
    const kardexAll = allKardex.filter(
      (k) => (k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0]) === coordinatorId
    );
    const kardexRango = kardexAll.filter((k) => inRange(k.fields.MES));
    const actividadesRango = actividades.filter((a) => inRange(a.fields.Mes));

    const rubroNameMap = new Map(rubros.map((r) => [r.id, r.fields.Nombre || "Rubro"]));

    // KPIs del rango
    const entradasKg = kardexRango
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const salidasKg = Math.abs(
      kardexRango
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );

    // Metas: sumar las del rango. metas12 son los registros del coord en el año.
    let metaRecol = 0;
    let metaSens = 0;
    let metaEval = 0;
    let configurada = false;
    for (const m of metas12) {
      if (typeof m.mes !== "number") continue;
      if (m.mes < monthFrom || m.mes > monthTo) continue;
      metaRecol += m.metaRecoleccion || 0;
      metaSens += m.metaSensibilizacion || 0;
      metaEval += m.metaEvaluaciones || 0;
      configurada = true;
    }

    // Sensibilización del rango
    const actSens = actividadesRango.filter((a) => a.fields.Tipo === "Sensibilización");
    const personasSensibilizadas = actSens.reduce(
      (sum, a) => sum + (participantesAprobados(a.fields)),
      0
    );
    const personasEvaluadas = actSens.reduce(
      (sum, a) => sum + (evaluadasAprobadas(a.fields)),
      0
    );
    const totalEvaluacionesWA = actSens.reduce(
      (sum, a) => sum + (evaluacionesWAAprobadas(a.fields)),
      0
    );
    const totalEvalCombinado = totalEvaluacionesWA + personasEvaluadas;

    const pctRecol = metaRecol > 0 ? Math.round((entradasKg / metaRecol) * 100) : 0;
    const pctSens = metaSens > 0 ? Math.round((personasSensibilizadas / metaSens) * 100) : 0;
    const pctEval = metaEval > 0 ? Math.round((totalEvalCombinado / metaEval) * 100) : 0;

    // Salidas por proceso (del rango)
    const salidasPorProceso = new Map<string, number>();
    for (const k of kardexRango) {
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

    // Tendencia mensual (últimos 12 meses, igual que en anual)
    const hoy = new Date();
    const tendenciaMensual = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const kardexMes = kardexAll.filter((k) => k.fields.MES === mesStr);
      const entradas = kardexMes
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
      const salidas = Math.abs(
        kardexMes
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
      );
      return { mes: mesStr, entradas: Math.round(entradas), salidas: Math.round(salidas) };
    }).reverse();

    // Alertas
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasParaCierre = ultimoDiaMes.getDate() - hoy.getDate();
    const kardexPorPagar = kardexAll
      .filter((k) => k.fields.AÑO === String(year))
      .filter((k) => k.fields.EstadoPago === "Por Pagar").length;
    const ordenesSinFacturar = ordenes.filter((o) => o.fields.Estado === "Enviada").length;

    // Notificaciones (igual que en anual)
    const notificaciones: Array<{
      tipo: "gasto" | "orden";
      id: string;
      numero: number;
      estado: string;
      observacion: string;
      fecha: string;
      concepto?: string;
    }> = [];

    gastos
      .filter((g) => {
        const tieneObs = g.fields.ObservacionesAdmin && g.fields.ObservacionesAdmin.trim() !== "";
        const rechazado = g.fields.Estado === "Rechazado";
        return tieneObs || rechazado;
      })
      .forEach((g) => {
        notificaciones.push({
          tipo: "gasto",
          id: g.id,
          numero: g.fields.NumeroGasto || 0,
          estado: g.fields.Estado || "Pendiente",
          observacion: g.fields.ObservacionesAdmin || "",
          fecha: g.fields.Fecha || "",
          concepto: g.fields.Rubro?.[0] ? rubroNameMap.get(g.fields.Rubro[0]) || "" : "",
        });
      });

    ordenes
      .filter((o) => {
        const rechazada = o.fields.Estado === "Rechazada";
        const tieneObs = o.fields.Observaciones && o.fields.Observaciones.trim() !== "";
        return rechazada || (tieneObs && o.fields.Estado !== "Pagada");
      })
      .forEach((o) => {
        notificaciones.push({
          tipo: "orden",
          id: o.id,
          numero: o.fields.NumeroOrden || 0,
          estado: o.fields.Estado || "",
          observacion: o.fields.Observaciones || "",
          fecha: o.fields["Fecha de pedido"] || "",
        });
      });

    notificaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const monthLabel =
      monthFrom === monthTo
        ? MES_LABEL[monthFrom - 1]
        : `${MES_LABEL[monthFrom - 1]} - ${MES_LABEL[monthTo - 1]}`;

    return NextResponse.json({
      mode: "mensual",
      year,
      monthFrom,
      monthTo,
      monthLabel,
      kpis: {
        entradasKg: Math.round(entradasKg),
        salidasKg: Math.round(salidasKg),
        saldoKg: Math.round(entradasKg - salidasKg),
      },
      metaRecoleccion: {
        meta: metaRecol,
        entradas: Math.round(entradasKg),
        salidas: Math.round(salidasKg),
        porcentaje: pctRecol,
        configurada: metaRecol > 0,
      },
      metaSensibilizacion: {
        meta: metaSens,
        actual: personasSensibilizadas,
        evaluadas: personasEvaluadas,
        porcentaje: pctSens,
        configurada: metaSens > 0,
      },
      metaEvaluaciones: {
        meta: metaEval,
        whatsapp: totalEvaluacionesWA,
        reportadas: personasEvaluadas,
        total: totalEvalCombinado,
        porcentaje: pctEval,
        configurada: metaEval > 0,
      },
      salidasProceso,
      tendenciaMensual,
      alertas: {
        diasParaCierre,
        kardexPorPagar,
        ordenesSinFacturar,
      },
      notificaciones: notificaciones.slice(0, 5),
      lastUpdated: new Date().toISOString(),
      _configurada: configurada,
    });
  } catch (error) {
    console.error("Error fetching coordinador stats-mensual:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
