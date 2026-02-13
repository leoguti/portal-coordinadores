import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getMetasCoordinador,
  listKardexForCoordinator,
  listActividadesForCoordinator,
  getOrdenesCoordinador,
  getGastosCajaMenorCoordinador,
  countCertificadosCoordinador,
} from "@/lib/airtable";

/**
 * GET /api/dashboard/stats — Métricas consolidadas del dashboard del coordinador
 * Retorna: metas, KPIs, alertas y notificaciones en una sola llamada
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const coordinatorId = session.user.coordinatorRecordId;
    const añoActual = new Date().getFullYear();
    const añoStr = String(añoActual);

    // Ejecutar todas las consultas en paralelo
    const [metas, kardexAll, actividades, ordenes, gastos, certificadosCount] = await Promise.all([
      getMetasCoordinador(coordinatorId, añoActual),
      listKardexForCoordinator(coordinatorId),
      listActividadesForCoordinator(coordinatorId),
      getOrdenesCoordinador(coordinatorId),
      getGastosCajaMenorCoordinador(coordinatorId),
      countCertificadosCoordinador(coordinatorId, añoActual),
    ]);

    // --- METAS ---
    const kardexAño = kardexAll.filter((k) => k.fields.AÑO === añoStr);
    const kgEntradas = kardexAño
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const kgSalidas = Math.abs(
      kardexAño
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );

    const actividadesAño = actividades.filter((a) => a.fields.Año === añoStr);
    const participantesSensibilizacion = actividadesAño
      .filter((a) => a.fields.Tipo === "Sensibilización")
      .reduce((sum, a) => sum + (a.fields["Cantidad de Participantes"] || 0), 0);

    const metasData = {
      recoleccion: {
        meta: metas?.fields.MetaRecoleccion || 0,
        entradas: Math.round(kgEntradas * 100) / 100,
        salidas: Math.round(kgSalidas * 100) / 100,
      },
      sensibilizacion: {
        meta: metas?.fields.MetaSensibilizacion || 0,
        actual: participantesSensibilizacion,
      },
      configurada: metas !== null,
    };

    // --- KPIs del Año ---
    const movimientosKardex = kardexAño.length;
    const totalKgSalidas = kardexAño
      .filter((k) => k.fields.TipoMovimiento === "SALIDA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const eventosSensibilizacion = actividadesAño.filter(
      (a) => a.fields.Tipo === "Sensibilización"
    ).length;
    const personasCapacitadas = actividadesAño
      .filter((a) => a.fields.Tipo === "Sensibilización")
      .reduce((sum, a) => sum + (a.fields["Cantidad de Participantes"] || 0), 0);

    // --- ALERTAS ---
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasParaCierre = ultimoDiaMes.getDate() - hoy.getDate();

    const kardexPorPagar = kardexAño.filter(
      (k) => k.fields.EstadoPago === "Por Pagar"
    ).length;

    const ordenesSinFacturar = ordenes.filter(
      (o) => o.fields.Estado === "Enviada"
    ).length;

    const gastosPendientes = gastos.filter(
      (g) => g.fields.Estado === "Pendiente"
    ).length;

    // --- NOTIFICACIONES (gastos rechazados/con observaciones + órdenes rechazadas) ---
    const notificaciones: Array<{
      tipo: "gasto" | "orden";
      id: string;
      numero: number;
      estado: string;
      observacion: string;
      fecha: string;
      concepto?: string;
    }> = [];

    // Gastos con novedades (rechazados o con observaciones del admin)
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
          concepto: g.fields.Concepto || "",
        });
      });

    // Órdenes rechazadas o con observaciones
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

    // Ordenar por fecha más reciente y tomar máximo 5
    notificaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const notificacionesTop = notificaciones.slice(0, 5);

    return NextResponse.json({
      metas: metasData,
      kpis: {
        movimientosKardex,
        totalKgSalidas: Math.round(totalKgSalidas * 100) / 100,
        eventosSensibilizacion,
        personasCapacitadas,
        certificados: certificadosCount,
      },
      alertas: {
        diasParaCierre,
        kardexPorPagar,
        ordenesSinFacturar,
        gastosPendientes,
      },
      notificaciones: notificacionesTop,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
