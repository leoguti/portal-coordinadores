"use client";

import { useEffect, useState, Fragment } from "react";
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
interface MaterialRow {
  material: string;
  key: string;
  entradas: number;
  salidas: number;
  saldo: number;
}

interface CoordMeta {
  id: string;
  nombre: string;
  meta: number;
  entradas: number;
  salidas: number;
  porcentaje: number;
  semaforo: string;
}

interface CoordSensMeta {
  id: string;
  nombre: string;
  meta: number;
  actual: number;
  evaluadas: number;
  porcentaje: number;
  semaforo: string;
}

interface Stats {
  kpis: {
    entradasKg: number;
    salidasKg: number;
    saldoKg: number;
    movimientos: number;
    deltaEntradas: number | null;
    deltaSalidas: number | null;
    deltaMovimientos: number | null;
  };
  metasRecoleccion: {
    global: { meta: number; entradas: number; salidas: number; porcentaje: number };
    porCoordinador: CoordMeta[];
  };
  metasSensibilizacion: {
    global: { meta: number; actual: number; evaluadas: number; porcentaje: number };
    porCoordinador: CoordSensMeta[];
  };
  materiales: MaterialRow[];
  materialesPorCoord: Record<string, MaterialRow[]>;
  tendenciaMensual: Array<{ mes: string; entradas: number; salidas: number }>;
  coordinadoresList: Array<{ id: string; name: string }>;
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

const semaforoColor: Record<string, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
};

function metaBarColor(porcentaje: number): string {
  if (porcentaje >= 70) return "#22c55e";
  if (porcentaje >= 40) return "#f59e0b";
  return "#dc2626";
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  const isUp = value >= 0;
  return (
    <span className={`text-xs font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
      {isUp ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

// --- Month label helper ---
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function mesLabel(mesStr: string) {
  const parts = mesStr.split("-");
  const idx = parseInt(parts[1]) - 1;
  return `${MONTH_SHORT[idx]} ${parts[0].slice(2)}`;
}

// --- Main Component ---
export default function DashboardEjecutivo({ userName }: { userName?: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandRecol, setExpandRecol] = useState(false);
  const [expandSens, setExpandSens] = useState(false);
  const [materialCoord, setMaterialCoord] = useState<string>("global");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/ejecutivo-stats?year=${year}`);
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error("Error loading ejecutivo stats:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year]);

  const yearOptions = Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => 2024 + i
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
          <p className="mt-4 text-gray-600">Cargando dashboard ejecutivo...</p>
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

  const materiales =
    materialCoord === "global"
      ? stats.materiales
      : stats.materialesPorCoord[materialCoord] || [];

  const maxMaterialEntrada = Math.max(...materiales.map((m) => m.entradas), 1);
  const maxMaterialSalida = Math.max(...materiales.map((m) => m.salidas), 1);

  const totalMatEntradas = materiales.reduce((s, m) => s + m.entradas, 0);
  const totalMatSalidas = materiales.reduce((s, m) => s + m.salidas, 0);
  const totalMatSaldo = materiales.reduce((s, m) => s + m.saldo, 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard Ejecutivo
          </h1>
          <p className="text-sm text-gray-500">
            {userName ? `Hola, ${userName}` : "Panel ejecutivo"} · Actualizado:{" "}
            {new Date(stats.lastUpdated).toLocaleString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
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
      </div>

      {/* SECTION 1: Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Meta Recolección */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Meta Recolección {year}
            </h2>
            <span
              className="text-3xl font-bold"
              style={{ color: metaBarColor(stats.metasRecoleccion.global.porcentaje) }}
            >
              {stats.metasRecoleccion.global.porcentaje}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 mb-3">
            <div
              className="h-4 rounded-full transition-all"
              style={{
                width: `${Math.min(stats.metasRecoleccion.global.porcentaje, 100)}%`,
                backgroundColor: metaBarColor(stats.metasRecoleccion.global.porcentaje),
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              Entradas:{" "}
              <strong className="text-gray-900">{fmt(stats.metasRecoleccion.global.entradas)} kg</strong>
            </span>
            <span>
              Meta: <strong className="text-gray-900">{fmt(stats.metasRecoleccion.global.meta)} kg</strong>
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Salidas:{" "}
            <strong className="text-gray-900">{fmt(stats.metasRecoleccion.global.salidas)} kg</strong>
          </div>
          <button
            onClick={() => setExpandRecol(!expandRecol)}
            className="mt-3 text-xs text-[#00d084] hover:text-[#00b872] font-medium"
          >
            {expandRecol ? "▾ Ocultar detalle" : "▸ Ver por coordinador"}
          </button>
          {expandRecol && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-semibold text-gray-600">Coordinador</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Meta</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Entradas</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Salidas</th>
                    <th className="text-right p-2 font-semibold text-gray-600">%</th>
                    <th className="text-center p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.metasRecoleccion.porCoordinador.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-2 font-medium">{c.nombre}</td>
                      <td className="p-2 text-right">{fmt(c.meta)}</td>
                      <td className="p-2 text-right text-green-700">{fmt(c.entradas)}</td>
                      <td className="p-2 text-right text-blue-700">{fmt(c.salidas)}</td>
                      <td className="p-2 text-right font-bold">{c.porcentaje}%</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${semaforoColor[c.semaforo]}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2 text-right">
                      {fmt(stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.meta, 0))}
                    </td>
                    <td className="p-2 text-right text-green-700">
                      {fmt(stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.entradas, 0))}
                    </td>
                    <td className="p-2 text-right text-blue-700">
                      {fmt(stats.metasRecoleccion.porCoordinador.reduce((s, c) => s + c.salidas, 0))}
                    </td>
                    <td className="p-2 text-right">
                      {stats.metasRecoleccion.global.porcentaje}%
                    </td>
                    <td className="p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Meta Sensibilización */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Meta Sensibilización {year}
            </h2>
            <span
              className="text-3xl font-bold"
              style={{ color: metaBarColor(stats.metasSensibilizacion.global.porcentaje) }}
            >
              {stats.metasSensibilizacion.global.porcentaje}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4 mb-3">
            <div
              className="h-4 rounded-full transition-all"
              style={{
                width: `${Math.min(stats.metasSensibilizacion.global.porcentaje, 100)}%`,
                backgroundColor: metaBarColor(stats.metasSensibilizacion.global.porcentaje),
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              Sensibilizados:{" "}
              <strong className="text-gray-900">
                {fmt(stats.metasSensibilizacion.global.actual)}
              </strong>
            </span>
            <span>
              Meta:{" "}
              <strong className="text-gray-900">
                {fmt(stats.metasSensibilizacion.global.meta)}
              </strong>
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Evaluados:{" "}
            <strong className="text-gray-900">
              {fmt(stats.metasSensibilizacion.global.evaluadas)}
            </strong>
          </div>
          <button
            onClick={() => setExpandSens(!expandSens)}
            className="mt-3 text-xs text-[#00d084] hover:text-[#00b872] font-medium"
          >
            {expandSens ? "▾ Ocultar detalle" : "▸ Ver por coordinador"}
          </button>
          {expandSens && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-semibold text-gray-600">Coordinador</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Meta</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Actual</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Evaluadas</th>
                    <th className="text-right p-2 font-semibold text-gray-600">%</th>
                    <th className="text-center p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.metasSensibilizacion.porCoordinador.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-2 font-medium">{c.nombre}</td>
                      <td className="p-2 text-right">{fmt(c.meta)}</td>
                      <td className="p-2 text-right">{fmt(c.actual)}</td>
                      <td className="p-2 text-right">{fmt(c.evaluadas)}</td>
                      <td className="p-2 text-right font-bold">{c.porcentaje}%</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${semaforoColor[c.semaforo]}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2 text-right">
                      {fmt(stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.meta, 0))}
                    </td>
                    <td className="p-2 text-right">
                      {fmt(stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.actual, 0))}
                    </td>
                    <td className="p-2 text-right">
                      {fmt(stats.metasSensibilizacion.porCoordinador.reduce((s, c) => s + c.evaluadas, 0))}
                    </td>
                    <td className="p-2 text-right">
                      {stats.metasSensibilizacion.global.porcentaje}%
                    </td>
                    <td className="p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Entradas</p>
          <p className="text-2xl font-bold text-gray-900">{fmtK(stats.kpis.entradasKg)}</p>
          <p className="text-xs text-gray-500">kg</p>
          <DeltaBadge value={stats.kpis.deltaEntradas} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Salidas</p>
          <p className="text-2xl font-bold text-gray-900">{fmtK(stats.kpis.salidasKg)}</p>
          <p className="text-xs text-gray-500">kg</p>
          <DeltaBadge value={stats.kpis.deltaSalidas} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Saldo</p>
          <p className="text-2xl font-bold text-gray-900">{fmtK(stats.kpis.saldoKg)}</p>
          <p className="text-xs text-gray-500">kg neto</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Movimientos</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(stats.kpis.movimientos)}</p>
          <p className="text-xs text-gray-500">registros kardex</p>
          <DeltaBadge value={stats.kpis.deltaMovimientos} />
        </div>
      </div>

      {/* SECTION 3: Material por tipo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Material por Tipo
          </h2>
          <select
            value={materialCoord}
            onChange={(e) => setMaterialCoord(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084]"
          >
            <option value="global">Global (todos)</option>
            {stats.coordinadoresList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2.5 font-semibold text-gray-600 w-40">Material</th>
                <th className="text-right p-2.5 font-semibold text-green-700 w-28">Entradas (kg)</th>
                <th className="p-2.5 w-32"></th>
                <th className="text-right p-2.5 font-semibold text-blue-700 w-28">Salidas (kg)</th>
                <th className="p-2.5 w-32"></th>
                <th className="text-right p-2.5 font-semibold text-gray-600 w-28">Saldo (kg)</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.key} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-2.5 font-medium text-gray-900">{m.material}</td>
                  <td className="p-2.5 text-right text-green-700 font-mono text-xs">
                    {fmt(m.entradas)}
                  </td>
                  <td className="p-2.5">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(m.entradas / maxMaterialEntrada) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-2.5 text-right text-blue-700 font-mono text-xs">
                    {fmt(m.salidas)}
                  </td>
                  <td className="p-2.5">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(m.salidas / maxMaterialSalida) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-2.5 text-right font-mono text-xs font-bold text-gray-900">
                    {fmt(m.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="p-2.5">TOTAL</td>
                <td className="p-2.5 text-right text-green-700 font-mono text-xs">
                  {fmt(totalMatEntradas)}
                </td>
                <td className="p-2.5"></td>
                <td className="p-2.5 text-right text-blue-700 font-mono text-xs">
                  {fmt(totalMatSalidas)}
                </td>
                <td className="p-2.5"></td>
                <td className="p-2.5 text-right font-mono text-xs">
                  {fmt(totalMatSaldo)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 4: Tendencia mensual */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Tendencia Mensual (últimos 12 meses)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={stats.tendenciaMensual.map((d) => ({
              ...d,
              label: mesLabel(d.mes),
            }))}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmtK(v)}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                fmt(value) + " kg",
                name === "entradas" ? "Entradas" : "Salidas",
              ]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend
              formatter={(value) =>
                value === "entradas" ? "Entradas" : "Salidas"
              }
            />
            <Bar dataKey="entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="salidas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
