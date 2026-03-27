"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import KpiCard from "@/components/KpiCard";
import ProgressBar, { DualProgressBar } from "@/components/ProgressBar";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import MaterialDistributionChart from "@/components/charts/MaterialDistributionChart";
import OrderStatusChart from "@/components/charts/OrderStatusChart";
import CoordinatorCollectionChart from "@/components/charts/CoordinatorCollectionChart";

const MapaColombia = dynamic(() => import("@/components/MapaColombia"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
      Cargando mapa...
    </div>
  ),
});

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

// --- Types ---
interface AdminDashboardStats {
  kpis: {
    entradasKg: number;
    salidasKg: number;
    certificados: number;
    eventosSensibilizacion: number;
    personasCapacitadas: number;
    personasEvaluadas: number;
    ordenesTotal: { monto: number; count: number };
  };
  metasRecoleccion: {
    global: { meta: number; entradas: number; salidas: number };
    porCoordinador: Array<{
      id: string;
      nombre: string;
      saldoAnterior: number;
      meta: number;
      entradas: number;
      salidas: number;
      porcentaje: number;
      semaforo: string;
    }>;
  };
  metasSensibilizacion: {
    global: { meta: number; actual: number; evaluadas: number };
    porCoordinador: Array<{
      id: string;
      nombre: string;
      meta: number;
      actual: number;
      evaluadas: number;
      porcentaje: number;
      semaforo: string;
    }>;
  };
  charts: {
    tendenciaMensual: Array<{ mes: string; entradas: number; salidas: number }>;
    distribucionMateriales: Record<string, number>;
    ordenesPorEstado: Array<{ estado: string; count: number; total: number }>;
    recoleccionPorCoordinador: Array<{ nombre: string; kg: number }>;
  };
  financiero: {
    totalEnviadas: number;
    totalFacturadas: number;
    totalPagadas: number;
    cajaMenorGastado: number;
    porCoordinador: Array<{
      nombre: string;
      ordenes: number;
      totalOrdenes: number;
      cajaMenor: number;
      estadoPredominante: string;
    }>;
    porEstado: Array<{ estado: string; count: number; total: number }>;
  };
  extras: {
    kgPorCentro: Array<{
      nombre: string;
      entradas: number;
      salidas: number;
      saldo: number;
    }>;
    tasaRechazoGastos: number;
    tasaRechazoOrdenes: number;
    saldoCajaMenor: Array<{ nombre: string; saldoDisponible: number }>;
    coberturaGeografica: number;
  };
  alertas: {
    kardexSinOrden: number;
    ordenesPendientes: number;
    gastosPendientes: number;
    diasParaCierre: number;
  };
  year: number;
  coordinadoresList: Array<{ id: string; name: string }>;
}

interface AdminDashboardProps {
  userName?: string;
}

const semaforoColor: Record<string, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
};

export default function AdminDashboard({ userName }: AdminDashboardProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRecoleccion, setExpandedRecoleccion] = useState(false);
  const [expandedSensibilizacion, setExpandedSensibilizacion] = useState(false);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/admin-stats?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Error loading admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [year]);

  const yearOptions = Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => 2024 + i
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando panel de control...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
          Error al cargar las estadísticas. Intenta recargar la página.
        </div>
      </div>
    );
  }

  const totalAlertas =
    stats.alertas.kardexSinOrden +
    stats.alertas.ordenesPendientes +
    stats.alertas.gastosPendientes;

  return (
    <div className="max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            Panel de Control
          </h1>
          <p className="text-gray-600">
            {userName ? `Hola, ${userName}` : "Dashboard administrativo"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-medium text-gray-600">
            Año:
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084] focus:border-[#00d084]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard
          title="Entradas"
          value={stats.kpis.entradasKg.toLocaleString("es-CO")}
          description="kg recolectados"
          icon="📥"
          color="green"
        />
        <KpiCard
          title="Salidas"
          value={stats.kpis.salidasKg.toLocaleString("es-CO")}
          description="kg despachados"
          icon="📤"
          color="blue"
        />
        <KpiCard
          title="Certificados"
          value={stats.kpis.certificados}
          description={`entrega en ${year}`}
          icon="📜"
          color="purple"
        />
        <KpiCard
          title="Sensibilización"
          value={stats.kpis.eventosSensibilizacion}
          description="eventos realizados"
          icon="🎤"
          color="campolimpio"
        />
        <KpiCard
          title="Sensibilizados"
          value={stats.kpis.personasCapacitadas.toLocaleString("es-CO")}
          description="personas"
          icon="👥"
          color="amber"
        />
        <KpiCard
          title="Evaluados"
          value={stats.kpis.personasEvaluadas.toLocaleString("es-CO")}
          description="personas evaluadas"
          icon="📝"
          color="blue"
        />
        <KpiCard
          title="Órdenes"
          value={stats.kpis.ordenesTotal.count}
          description={COP.format(stats.kpis.ordenesTotal.monto)}
          icon="🔧"
          color="red"
        />
      </div>

      {/* 3. Metas Recolección */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Meta Recolección {year}
          </h2>
          <button
            onClick={() => setExpandedRecoleccion(!expandedRecoleccion)}
            className="text-sm text-[#00d084] hover:text-[#00b872] font-medium"
          >
            {expandedRecoleccion ? "Ocultar detalle" : "Ver por coordinador"}
          </button>
        </div>
        <DualProgressBar
          label={`Meta Global de Recolección ${year}`}
          entradas={stats.metasRecoleccion.global.entradas}
          salidas={stats.metasRecoleccion.global.salidas}
          meta={stats.metasRecoleccion.global.meta}
          unit="kg"
        />
        {expandedRecoleccion && (
          <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Coordinador</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Saldo Cierre ({year - 1})</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Meta (kg)</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Entradas</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Salidas</th>
                  <th className="text-right p-3 font-semibold text-gray-700">%</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.metasRecoleccion.porCoordinador.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-right text-amber-700 font-semibold">{c.saldoAnterior.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right">{c.meta.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right text-green-700">{c.entradas.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right text-blue-700">{c.salidas.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right font-bold">{c.porcentaje}%</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block w-3 h-3 rounded-full ${semaforoColor[c.semaforo]}`} title={c.semaforo}></span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-right text-amber-700">
                    {stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.saldoAnterior, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right">
                    {stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.meta, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right text-green-700">
                    {stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.entradas, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right text-blue-700">
                    {stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.salidas, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right">
                    {(() => {
                      const totalMeta = stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.meta, 0);
                      const totalEntradas = stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.entradas, 0);
                      return totalMeta > 0 ? Math.round((totalEntradas / totalMeta) * 100) : 0;
                    })()}%
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 4. Metas Sensibilización */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Meta Sensibilización {year}
          </h2>
          <button
            onClick={() => setExpandedSensibilizacion(!expandedSensibilizacion)}
            className="text-sm text-[#00d084] hover:text-[#00b872] font-medium"
          >
            {expandedSensibilizacion ? "Ocultar detalle" : "Ver por coordinador"}
          </button>
        </div>
        <ProgressBar
          label={`Meta Global de Sensibilización ${year}`}
          actual={stats.metasSensibilizacion.global.actual}
          meta={stats.metasSensibilizacion.global.meta}
          unit="personas"
          color="#3B82F6"
        />
        <div className="mt-2 flex gap-6 text-sm text-gray-600">
          <span>Sensibilizadas: <strong>{stats.metasSensibilizacion.global.actual.toLocaleString("es-CO")}</strong></span>
        </div>
        {expandedSensibilizacion && (
          <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Coordinador</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Meta</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Actual</th>
                  <th className="text-right p-3 font-semibold text-gray-700">%</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.metasSensibilizacion.porCoordinador.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-right">{c.meta.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right">{c.actual.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right font-bold">{c.porcentaje}%</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block w-3 h-3 rounded-full ${semaforoColor[c.semaforo]}`} title={c.semaforo}></span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-right">
                    {stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.meta, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right">
                    {stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.actual, 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right">
                    {(() => {
                      const totalMeta = stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.meta, 0);
                      const totalActual = stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.actual, 0);
                      return totalMeta > 0 ? Math.round((totalActual / totalMeta) * 100) : 0;
                    })()}%
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5. Gráficas */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Gráficas {year}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MonthlyTrendChart data={stats.charts.tendenciaMensual} />
          <MaterialDistributionChart data={stats.charts.distribucionMateriales} />
          <OrderStatusChart data={stats.charts.ordenesPorEstado} />
          <CoordinatorCollectionChart data={stats.charts.recoleccionPorCoordinador} />
        </div>
      </div>

      {/* 6. Resumen Financiero */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Resumen Financiero
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">Enviadas</p>
            <p className="text-lg font-bold text-blue-800">{COP.format(stats.financiero.totalEnviadas)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
            <p className="text-xs text-amber-600 font-medium mb-1">Facturadas</p>
            <p className="text-lg font-bold text-amber-800">{COP.format(stats.financiero.totalFacturadas)}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <p className="text-xs text-green-600 font-medium mb-1">Pagadas</p>
            <p className="text-lg font-bold text-green-800">{COP.format(stats.financiero.totalPagadas)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
            <p className="text-xs text-purple-600 font-medium mb-1">Caja Menor</p>
            <p className="text-lg font-bold text-purple-800">{COP.format(stats.financiero.cajaMenorGastado)}</p>
          </div>
        </div>

        {/* Financial table by coordinator */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-semibold text-gray-700">Coordinador</th>
                <th className="text-right p-3 font-semibold text-gray-700">Órdenes</th>
                <th className="text-right p-3 font-semibold text-gray-700">Total Órdenes</th>
                <th className="text-right p-3 font-semibold text-gray-700">Caja Menor</th>
                <th className="text-center p-3 font-semibold text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stats.financiero.porCoordinador.map((c) => (
                <tr key={c.nombre} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.nombre}</td>
                  <td className="p-3 text-right">{c.ordenes}</td>
                  <td className="p-3 text-right">{COP.format(c.totalOrdenes)}</td>
                  <td className="p-3 text-right">{COP.format(c.cajaMenor)}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-gray-100 text-gray-700">
                      {c.estadoPredominante}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Métricas Extra */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Métricas Adicionales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">Cobertura Geográfica</p>
            <p className="text-2xl font-bold text-gray-900">{stats.extras.coberturaGeografica}</p>
            <p className="text-xs text-gray-500">municipios con actividad</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">Tasa Rechazo Gastos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.extras.tasaRechazoGastos}%</p>
            <p className="text-xs text-gray-500">del total de gastos</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">Tasa Rechazo Órdenes</p>
            <p className="text-2xl font-bold text-gray-900">{stats.extras.tasaRechazoOrdenes}%</p>
            <p className="text-xs text-gray-500">del total de órdenes</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium mb-1">Centros de Acopio</p>
            <p className="text-2xl font-bold text-gray-900">{stats.extras.kgPorCentro.length}</p>
            <p className="text-xs text-gray-500">centros activos</p>
          </div>
        </div>

        {/* Kg per centro table */}
        {stats.extras.kgPorCentro.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto mb-4">
            <h3 className="text-sm font-semibold text-gray-700 p-3 border-b bg-gray-50">
              Kilogramos por Centro de Acopio
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700">Centro</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Entradas</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Salidas</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {stats.extras.kgPorCentro.map((c) => (
                  <tr key={c.nombre} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-right text-green-700">{c.entradas.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right text-blue-700">{c.salidas.toLocaleString("es-CO")}</td>
                    <td className="p-3 text-right font-bold">{c.saldo.toLocaleString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Saldo caja menor */}
        {stats.extras.saldoCajaMenor.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-700 p-3 border-b bg-gray-50">
              Saldo Caja Menor por Coordinador
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700">Coordinador</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Saldo Disponible</th>
                </tr>
              </thead>
              <tbody>
                {stats.extras.saldoCajaMenor.map((c) => (
                  <tr key={c.nombre} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className={`p-3 text-right font-bold ${c.saldoDisponible < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {COP.format(c.saldoDisponible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Mapa */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Cobertura Geográfica
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="mb-2 text-xs text-gray-400 italic">
            Filtros de mapa próximamente
          </div>
          <MapaColombia actividadesPorMunicipio={[]} />
        </div>
      </div>

      {/* 9. Alertas */}
      {totalAlertas > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Alertas y Pendientes
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
            <div className="flex items-center gap-3 p-4">
              <span className="text-xl">&#9200;</span>
              <span className="text-sm text-gray-700">
                Faltan <strong>{stats.alertas.diasParaCierre} días</strong> para
                el cierre de{" "}
                {new Date().toLocaleDateString("es-CO", { month: "long" })}
              </span>
            </div>
            {stats.alertas.kardexSinOrden > 0 && (
              <div className="flex items-center gap-3 p-4">
                <span className="text-xl">&#128230;</span>
                <span className="text-sm text-gray-700">
                  <strong>{stats.alertas.kardexSinOrden}</strong> kardex
                  &quot;Por Pagar&quot; sin orden de servicio
                </span>
              </div>
            )}
            {stats.alertas.ordenesPendientes > 0 && (
              <div className="flex items-center gap-3 p-4">
                <span className="text-xl">&#128209;</span>
                <span className="text-sm text-gray-700">
                  <strong>{stats.alertas.ordenesPendientes}</strong> órdenes
                  enviadas pendientes de factura
                </span>
              </div>
            )}
            {stats.alertas.gastosPendientes > 0 && (
              <div className="flex items-center gap-3 p-4">
                <span className="text-xl">&#128176;</span>
                <span className="text-sm text-gray-700">
                  <strong>{stats.alertas.gastosPendientes}</strong> gastos de
                  caja menor pendientes de aprobación
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
