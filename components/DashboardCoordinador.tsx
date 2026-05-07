"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// --- Types ---
interface Stats {
  mode?: "anual" | "mensual";
  monthLabel?: string;
  monthFrom?: number;
  monthTo?: number;
  kpis: {
    entradasKg: number;
    salidasKg: number;
    saldoKg: number;
  };
  metaRecoleccion: {
    meta: number;
    entradas: number;
    salidas: number;
    porcentaje: number;
    configurada: boolean;
  };
  metaSensibilizacion: {
    meta: number;
    actual: number;
    evaluadas: number;
    porcentaje: number;
    configurada: boolean;
  };
  metaEvaluaciones: {
    meta: number;
    whatsapp: number;
    reportadas: number;
    total: number;
    porcentaje: number;
    configurada: boolean;
  };
  salidasProceso: Array<{ proceso: string; kg: number }>;
  tendenciaMensual: Array<{ mes: string; entradas: number; salidas: number }>;
  alertas: {
    diasParaCierre: number;
    kardexPorPagar: number;
    ordenesSinFacturar: number;
  };
  notificaciones: Array<{
    tipo: "gasto" | "orden";
    id: string;
    numero: number;
    estado: string;
    observacion: string;
    fecha: string;
    concepto?: string;
  }>;
  year: number;
  lastUpdated: string;
}

// --- Helpers ---
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

function metaBarColor(pct: number): string {
  if (pct >= 70) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#dc2626";
}

const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function mesLabel(mesStr: string) {
  const parts = mesStr.split("-");
  const idx = parseInt(parts[1]) - 1;
  return `${MONTH_SHORT[idx]} ${parts[0].slice(2)}`;
}

const PROCESO_COLORS: Record<string, string> = {
  "Reciclaje": "#22c55e",
  "Celda de Seguridad": "#f59e0b",
  "Aprovechamiento Energético": "#ef4444",
  "Coprocesamiento": "#8b5cf6",
  "Incineracion": "#ef4444",
  "Otros": "#6b7280",
  "Sin proceso": "#d1d5db",
};

const MES_NOMBRES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// --- Main Component ---
export default function DashboardCoordinador() {
  const { data: session } = useSession();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [mode, setMode] = useState<"anual" | "mensual">("anual");
  const [year, setYear] = useState(currentYear);
  const [monthFrom, setMonthFrom] = useState(currentMonth);
  const [monthTo, setMonthTo] = useState(currentMonth);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfoProceso, setShowInfoProceso] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const url =
          mode === "anual"
            ? `/api/dashboard/coordinador-stats?year=${year}`
            : `/api/dashboard/coordinador-stats-mensual?year=${year}&monthFrom=${monthFrom}&monthTo=${monthTo}`;
        const res = await fetch(url);
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error("Error loading coordinador stats:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mode, year, monthFrom, monthTo]);

  const yearOptions = Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => 2024 + i
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
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

  const totalAlertas = stats.alertas.kardexPorPagar + stats.alertas.ordenesSinFacturar;
  const totalProceso = stats.salidasProceso.reduce((s, p) => s + p.kg, 0);
  const maxProceso = Math.max(...stats.salidasProceso.map((p) => p.kg), 1);

  const estadoColors: Record<string, string> = {
    Rechazado: "bg-red-100 text-red-800 border-red-300",
    Rechazada: "bg-red-100 text-red-800 border-red-300",
    Aprobado: "bg-green-100 text-green-800 border-green-300",
    Enviada: "bg-blue-100 text-blue-800 border-blue-300",
    Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            ¡Bienvenido, {session?.user?.name || "Coordinador"}!
            {mode === "mensual" && stats.monthLabel && (
              <span className="text-gray-500 font-medium"> · {stats.monthLabel} {year}</span>
            )}
            {mode === "anual" && (
              <span className="text-gray-500 font-medium"> · {year}</span>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            Actualizado:{" "}
            {new Date(stats.lastUpdated).toLocaleString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Anual / Mensual */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setMode("anual")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                mode === "anual"
                  ? "bg-[#00d084] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Anual
            </button>
            <button
              onClick={() => setMode("mensual")}
              className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                mode === "mensual"
                  ? "bg-[#00d084] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Mensual
            </button>
          </div>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084] focus:border-[#00d084]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {mode === "mensual" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Desde</span>
              <select
                value={monthFrom}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMonthFrom(v);
                  if (v > monthTo) setMonthTo(v);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084] focus:border-[#00d084]"
              >
                {MES_NOMBRES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1}>{nombre}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">Hasta</span>
              <select
                value={monthTo}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMonthTo(v);
                  if (v < monthFrom) setMonthFrom(v);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084] focus:border-[#00d084]"
              >
                {MES_NOMBRES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1}>{nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Alertas */}
      {totalAlertas > 0 && (
        <div className="mb-6 bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-3">
            Pendientes
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <span>⏰</span>
              <span>
                Faltan <strong>{stats.alertas.diasParaCierre} días</strong> para el cierre de{" "}
                {new Date().toLocaleDateString("es-CO", { month: "long" })}
              </span>
            </div>
            {stats.alertas.kardexPorPagar > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <span>📦</span>
                  <span>
                    <strong>{stats.alertas.kardexPorPagar}</strong> kardex &quot;Por Pagar&quot; sin orden de servicio
                  </span>
                </div>
                <Link href="/kardex?estadoPago=Por+Pagar" className="text-xs text-[#00d084] font-medium hover:text-[#00b872]">
                  Ver →
                </Link>
              </div>
            )}
            {stats.alertas.ordenesSinFacturar > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <span>📑</span>
                  <span>
                    <strong>{stats.alertas.ordenesSinFacturar}</strong> órdenes pendientes por facturar
                  </span>
                </div>
                <Link href="/ordenes-servicio?estado=Enviada" className="text-xs text-[#00d084] font-medium hover:text-[#00b872]">
                  Ver →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: Metas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Meta Recolección */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Meta Recolección {mode === "mensual" && stats.monthLabel ? `${stats.monthLabel} ${year}` : year}
            </h2>
            {stats.metaRecoleccion.configurada ? (
              <span
                className="text-3xl font-bold"
                style={{ color: metaBarColor(stats.metaRecoleccion.porcentaje) }}
              >
                {stats.metaRecoleccion.porcentaje}%
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">Sin configurar</span>
            )}
          </div>
          {stats.metaRecoleccion.configurada ? (
            <>
              <div className="w-full bg-gray-100 rounded-full h-4 mb-3">
                <div
                  className="h-4 rounded-full transition-all"
                  style={{
                    width: `${Math.min(stats.metaRecoleccion.porcentaje, 100)}%`,
                    backgroundColor: metaBarColor(stats.metaRecoleccion.porcentaje),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  Entradas: <strong className="text-gray-900">{fmt(stats.metaRecoleccion.entradas)} kg</strong>
                </span>
                <span>
                  Meta: <strong className="text-gray-900">{fmt(stats.metaRecoleccion.meta)} kg</strong>
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Salidas: <strong className="text-gray-900">{fmt(stats.metaRecoleccion.salidas)} kg</strong>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Contacta al administrador para configurar tu meta.</p>
          )}
        </div>

        {/* Meta Sensibilización */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Meta Sensibilización {mode === "mensual" && stats.monthLabel ? `${stats.monthLabel} ${year}` : year}
            </h2>
            {stats.metaSensibilizacion.configurada ? (
              <span
                className="text-3xl font-bold"
                style={{ color: metaBarColor(stats.metaSensibilizacion.porcentaje) }}
              >
                {stats.metaSensibilizacion.porcentaje}%
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">Sin configurar</span>
            )}
          </div>
          {stats.metaSensibilizacion.configurada ? (
            <>
              <div className="w-full bg-gray-100 rounded-full h-4 mb-3">
                <div
                  className="h-4 rounded-full transition-all"
                  style={{
                    width: `${Math.min(stats.metaSensibilizacion.porcentaje, 100)}%`,
                    backgroundColor: metaBarColor(stats.metaSensibilizacion.porcentaje),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  Sensibilizados: <strong className="text-gray-900">{fmt(stats.metaSensibilizacion.actual)}</strong>
                </span>
                <span>
                  Meta: <strong className="text-gray-900">{fmt(stats.metaSensibilizacion.meta)}</strong>
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Contacta al administrador para configurar tu meta.</p>
          )}
        </div>

        {/* Meta Evaluaciones */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Meta Evaluaciones {mode === "mensual" && stats.monthLabel ? `${stats.monthLabel} ${year}` : year}
            </h2>
            {stats.metaEvaluaciones.configurada ? (
              <span
                className="text-3xl font-bold"
                style={{ color: metaBarColor(stats.metaEvaluaciones.porcentaje) }}
              >
                {stats.metaEvaluaciones.porcentaje}%
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">Sin configurar</span>
            )}
          </div>
          {stats.metaEvaluaciones.configurada ? (
            <>
              <div className="w-full bg-gray-100 rounded-full h-4 mb-3 overflow-hidden flex">
                <div
                  className="h-4 transition-all"
                  style={{
                    width: `${Math.min((stats.metaEvaluaciones.whatsapp / stats.metaEvaluaciones.meta) * 100, 100)}%`,
                    backgroundColor: "#00d084",
                  }}
                />
                <div
                  className="h-4 transition-all"
                  style={{
                    width: `${Math.min((stats.metaEvaluaciones.reportadas / stats.metaEvaluaciones.meta) * 100, 100 - (stats.metaEvaluaciones.whatsapp / stats.metaEvaluaciones.meta) * 100)}%`,
                    backgroundColor: "#3b82f6",
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-[#00d084] mr-1" />
                  WhatsApp: <strong className="text-gray-900">{fmt(stats.metaEvaluaciones.whatsapp)}</strong>
                </span>
                <span>
                  Meta: <strong className="text-gray-900">{fmt(stats.metaEvaluaciones.meta)}</strong>
                </span>
              </div>
              <div className="text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />
                Presenciales: <strong className="text-gray-900">{fmt(stats.metaEvaluaciones.reportadas)}</strong>
                <span className="ml-3 text-gray-400">Total: <strong className="text-gray-900">{fmt(stats.metaEvaluaciones.total)}</strong></span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Contacta al administrador para configurar tu meta.</p>
          )}
        </div>
      </div>

      {/* SECTION 3: KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Entradas</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats.kpis.entradasKg)}</p>
          <p className="text-xs text-gray-500">kg</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Salidas</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats.kpis.salidasKg)}</p>
          <p className="text-xs text-gray-500">kg</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Saldo</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats.kpis.saldoKg)}</p>
          <p className="text-xs text-gray-500">kg neto</p>
        </div>
      </div>

      {/* SECTION 4: Tendencia mensual */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Tendencia Mensual (últimos 12 meses)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={stats.tendenciaMensual.map((d) => ({ ...d, label: mesLabel(d.mes) }))}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtK(v)} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                fmt(Number(value)) + " kg",
                name === "entradas" ? "Entradas" : "Salidas",
              ]}
            />
            <Legend formatter={(v) => (v === "entradas" ? "Entradas" : "Salidas")} />
            <Bar dataKey="entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="salidas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SECTION 5: Salidas por Proceso */}
      {stats.salidasProceso.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Salidas por Proceso
            </h2>
            <button
              onClick={() => setShowInfoProceso(!showInfoProceso)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Ver explicación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {showInfoProceso && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              Suma de kilogramos de tus salidas del año agrupadas por el tipo de proceso del gestor.
            </div>
          )}
          <div className="space-y-3">
            {stats.salidasProceso.map((p) => {
              const color = PROCESO_COLORS[p.proceso] || "#94a3b8";
              const pct = totalProceso > 0 ? Math.round((p.kg / totalProceso) * 100) : 0;
              return (
                <div key={p.proceso}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{p.proceso}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold text-gray-900">{fmt(p.kg)} kg</span>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${(p.kg / maxProceso) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">TOTAL</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-gray-900">{fmt(totalProceso)} kg</span>
                  <span className="text-xs text-gray-500 w-10 text-right">100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: Notificaciones */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Notificaciones
          </h2>
          {stats.notificaciones.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {stats.notificaciones.length}
            </span>
          )}
        </div>
        {stats.notificaciones.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No hay notificaciones recientes
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.notificaciones.map((notif) => {
              const esGasto = notif.tipo === "gasto";
              return (
                <div key={`${notif.tipo}-${notif.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#00d084]">
                          {esGasto ? `Gasto #${notif.numero}` : `Orden #${notif.numero}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded border ${
                            estadoColors[notif.estado] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {notif.estado}
                        </span>
                      </div>
                      {notif.concepto && (
                        <p className="text-sm text-gray-700 mb-1">{notif.concepto}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {notif.fecha
                          ? new Date(notif.fecha + "T00:00:00").toLocaleDateString("es-CO")
                          : ""}
                      </p>
                      {notif.observacion && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                          <span className="font-bold text-amber-700">Observación:</span>
                          <p className="text-amber-800 mt-1">{notif.observacion}</p>
                        </div>
                      )}
                    </div>
                    <Link
                      href={esGasto ? `/caja-menor/${notif.id}` : `/ordenes-servicio`}
                      className="px-3 py-1.5 bg-[#00d084] text-white text-sm font-medium rounded hover:bg-[#00b872] transition-colors"
                    >
                      Ver
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
