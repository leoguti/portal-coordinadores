import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getMetasCoordinador,
  getAllKardex,
  listActividadesForCoordinator,
  getOrdenesCoordinador,
  getGastosCajaMenorCoordinador,
  getRubros,
} from "@/lib/airtable";

/**
 * GET /api/dashboard/coordinador-stats
 * Dashboard metrics for a coordinator (their own data only)
 * Query: ?year=2026 (default: current year)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const coordinatorId = session.user.coordinatorRecordId;
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const yearStr = String(year);

    const [metas, allKardex, actividades, ordenes, gastos, rubros] = await Promise.all([
      getMetasCoordinador(coordinatorId, year),
      getAllKardex(),
      listActividadesForCoordinator(coordinatorId),
      getOrdenesCoordinador(coordinatorId),
      getGastosCajaMenorCoordinador(coordinatorId),
      getRubros(),
    ]);

    // Filter kardex by coordinator (paginated, all records)
    const kardexAll = allKardex.filter(
      (k) =>
        (k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0]) === coordinatorId
    );

    const rubroNameMap = new Map(rubros.map((r) => [r.id, r.fields.Nombre || "Rubro"]));
    const kardexYear = kardexAll.filter((k) => k.fields.AÑO === yearStr);

    // --- KPIs ---
    const entradasKg = kardexYear
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const salidasKg = Math.abs(
      kardexYear
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );

    // --- Metas ---
    const actividadesYear = actividades.filter((a) => a.fields.Año === yearStr);
    const actSens = actividadesYear.filter((a) => a.fields.Tipo === "Sensibilización");
    const personasSensibilizadas = actSens.reduce(
      (sum, a) => sum + (a.fields["Cantidad de Participantes"] || 0),
      0
    );
    const personasEvaluadas = actSens.reduce(
      (sum, a) => sum + (a.fields["Personas Evaluadas"] || 0),
      0
    );
    const totalEvaluaciones = actSens.reduce(
      (sum, a) => sum + (a.fields["CantidadEvaluaciones"] || 0),
      0
    );

    const metaRecol = metas?.fields.MetaRecoleccion || 0;
    const metaSens = metas?.fields.MetaSensibilizacion || 0;
    const metaEval = metas?.fields.MetaEvaluaciones || 0;
    const pctRecol = metaRecol > 0 ? Math.round((entradasKg / metaRecol) * 100) : 0;
    const pctSens = metaSens > 0 ? Math.round((personasSensibilizadas / metaSens) * 100) : 0;
    const totalEvalCombinado = totalEvaluaciones + personasEvaluadas;
    const pctEval = metaEval > 0 ? Math.round((totalEvalCombinado / metaEval) * 100) : 0;

    // --- Salidas por Proceso ---
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
      .map(([proceso, kg]) => ({ proceso, kg: Math.round(kg) }))
      .sort((a, b) => b.kg - a.kg);

    // --- Tendencia mensual (últimos 12 meses) ---
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

    // --- Alertas ---
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasParaCierre = ultimoDiaMes.getDate() - hoy.getDate();
    const kardexPorPagar = kardexYear.filter((k) => k.fields.EstadoPago === "Por Pagar").length;
    const ordenesSinFacturar = ordenes.filter((o) => o.fields.Estado === "Enviada").length;

    // --- Notificaciones ---
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

    return NextResponse.json({
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
        configurada: metas !== null,
      },
      metaSensibilizacion: {
        meta: metaSens,
        actual: personasSensibilizadas,
        evaluadas: personasEvaluadas,
        porcentaje: pctSens,
        configurada: metas !== null,
      },
      metaEvaluaciones: {
        meta: metaEval,
        whatsapp: totalEvaluaciones,
        reportadas: personasEvaluadas,
        total: totalEvalCombinado,
        porcentaje: pctEval,
        configurada: metas !== null && metaEval > 0,
      },
      salidasProceso,
      tendenciaMensual,
      alertas: {
        diasParaCierre,
        kardexPorPagar,
        ordenesSinFacturar,
      },
      notificaciones: notificaciones.slice(0, 5),
      year,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching coordinador stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
