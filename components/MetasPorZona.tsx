"use client";

import { useEffect, useState } from "react";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

// Año en que se concertaron las metas y la fecha del acuerdo. La nota
// explicativa de los primeros meses solo aplica a este año.
const ACUERDO_METAS_YEAR = 2026;
const ACUERDO_METAS_FECHA = "13 de marzo de 2026";

type Celda = { real: number; meta: number };
type Fila = { zona: string; meses: Celda[]; realAnual: number; metaAnual: number };
type Tabla = {
  filas: Fila[];
  total: { meses: Celda[]; realAnual: number; metaAnual: number };
};
interface Data {
  year: number;
  currentYear: number;
  currentMonth: number;
  zonas: string[];
  metas: { recoleccion: Tabla; sensibilizacion: Tabla; evaluaciones: Tabla };
  lastUpdated: string;
}

type Estado = "pasado" | "actual" | "futuro";

function estadoMes(
  year: number,
  mesIdx: number,
  currentYear: number,
  currentMonth: number
): Estado {
  if (year < currentYear) return "pasado";
  if (year > currentYear) return "futuro";
  const mes = mesIdx + 1;
  if (mes < currentMonth) return "pasado";
  if (mes === currentMonth) return "actual";
  return "futuro";
}

function pct(real: number, meta: number): number {
  if (meta > 0) return Math.round((real / meta) * 100);
  return real > 0 ? 100 : 0;
}

function pctColor(p: number): { bg: string; text: string } {
  if (p >= 70) return { bg: "bg-green-100", text: "text-green-700" };
  if (p >= 40) return { bg: "bg-yellow-100", text: "text-yellow-700" };
  return { bg: "bg-red-100", text: "text-red-700" };
}

// --- Celda mensual ---
function CeldaMes({ celda, estado }: { celda: Celda; estado: Estado }) {
  if (estado === "pasado") {
    return (
      <td className="px-1.5 py-1 text-center border-l border-gray-100 bg-green-50">
        <div className="text-[10px] text-gray-600 leading-tight font-mono">
          {fmt(celda.real)}/{fmt(celda.meta)}
        </div>
        <div className="text-[10px] font-semibold text-green-600">✓</div>
      </td>
    );
  }
  if (estado === "futuro") {
    return (
      <td className="px-1.5 py-1 text-center border-l border-gray-100 bg-gray-50">
        <div className="text-[10px] text-gray-400 leading-tight font-mono">
          {fmt(celda.real)}/{fmt(celda.meta)}
        </div>
        <div className="text-[10px] text-gray-300">·</div>
      </td>
    );
  }
  // actual
  const p = pct(celda.real, celda.meta);
  const c = pctColor(p);
  return (
    <td className={`px-1.5 py-1 text-center border-l border-gray-100 ${c.bg}`}>
      <div className="text-[10px] text-gray-700 leading-tight font-mono">
        {fmt(celda.real)}/{fmt(celda.meta)}
      </div>
      <div className={`text-[10px] font-bold ${c.text}`}>{p}%</div>
    </td>
  );
}

// --- Celda anual (avance verdadero del año) ---
function CeldaAnual({ real, meta }: { real: number; meta: number }) {
  const p = pct(real, meta);
  const c = pctColor(p);
  return (
    <td className={`px-2 py-1 text-center border-l-2 border-gray-300 ${c.bg}`}>
      <div className="text-[11px] text-gray-800 leading-tight font-mono font-medium">
        {fmt(real)}/{fmt(meta)}
      </div>
      <div className={`text-xs font-bold ${c.text}`}>{p}%</div>
    </td>
  );
}

function TablaMeta({
  titulo,
  unidad,
  tabla,
  data,
}: {
  titulo: string;
  unidad: string;
  tabla: Tabla;
  data: Data;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {titulo} <span className="text-gray-400 normal-case">({unidad})</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-2 py-2 text-left font-semibold text-gray-600 min-w-[140px]">
                Zona
              </th>
              {MESES.map((m, i) => {
                const est = estadoMes(data.year, i, data.currentYear, data.currentMonth);
                return (
                  <th
                    key={m}
                    className={`px-1.5 py-2 text-center font-semibold border-l border-gray-100 min-w-[64px] ${
                      est === "actual"
                        ? "text-gray-900 bg-blue-50"
                        : est === "futuro"
                        ? "text-gray-400"
                        : "text-gray-500"
                    }`}
                  >
                    {m}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center font-bold text-gray-700 border-l-2 border-gray-300 min-w-[80px]">
                AÑO
              </th>
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f) => (
              <tr key={f.zona} className="border-t border-gray-100 hover:bg-gray-50/40">
                <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-gray-800 whitespace-nowrap">
                  {f.zona}
                </td>
                {f.meses.map((celda, i) => (
                  <CeldaMes
                    key={i}
                    celda={celda}
                    estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                  />
                ))}
                <CeldaAnual real={f.realAnual} meta={f.metaAnual} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
              <td className="sticky left-0 z-10 bg-gray-100 px-2 py-1 text-gray-900">
                TOTAL
              </td>
              {tabla.total.meses.map((celda, i) => (
                <CeldaMes
                  key={i}
                  celda={celda}
                  estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                />
              ))}
              <CeldaAnual real={tabla.total.realAnual} meta={tabla.total.metaAnual} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function MetasPorZona() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/metas-zonas?year=${year}`);
        if (res.ok && !cancel) setData(await res.json());
      } catch (e) {
        console.error("Error metas-zonas:", e);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [year]);

  const yearOptions = Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => 2024 + i
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Metas por Zona <span className="text-gray-500 font-medium">· {year}</span>
          </h1>
          <p className="text-sm text-gray-500">
            Real / meta por mes · ✓ = mes cumplido · seguimiento real desde el mes en curso
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

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs text-gray-600">
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200 mr-1 align-middle" />Cumplido (mes pasado)</span>
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200 mr-1 align-middle" />≥70%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-200 mr-1 align-middle" />40–69%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200 mr-1 align-middle" />&lt;40%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-gray-50 border border-gray-200 mr-1 align-middle" />Pendiente (futuro)</span>
      </div>

      {/* Nota: por qué los primeros meses coinciden exactamente con lo ejecutado */}
      {year === ACUERDO_METAS_YEAR && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <div className="flex gap-2.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0 text-amber-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="leading-relaxed">
              <p className="font-semibold mb-0.5 text-amber-800">
                Sobre las metas de los primeros meses
              </p>
              <p>
                Las metas de {year} se concertaron el{" "}
                <strong>{ACUERDO_METAS_FECHA}</strong>. Para los meses anteriores a
                ese acuerdo —cuando todavía no existía una meta pactada contra la
                cual comparar— se decidió, de común acuerdo, registrar como meta el
                valor realmente ejecutado en cada zona. Por eso esos meses aparecen
                marcados como cumplidos (✓) y sus cifras de meta y ejecución
                coinciden exactamente. No se trata de un ajuste de cifras: refleja
                que la planeación formal de metas inició en esa fecha, y el
                seguimiento de ejecución frente a meta aplica de ahí en adelante.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
            <p className="mt-4 text-gray-600">Cargando metas por zona...</p>
          </div>
        </div>
      ) : !data ? (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
          Error al cargar las metas por zona. Intenta recargar.
        </div>
      ) : (
        <>
          <TablaMeta titulo="Recolección" unidad="kg" tabla={data.metas.recoleccion} data={data} />
          <TablaMeta titulo="Sensibilización" unidad="personas" tabla={data.metas.sensibilizacion} data={data} />
          <TablaMeta titulo="Evaluaciones" unidad="evaluaciones" tabla={data.metas.evaluaciones} data={data} />
          <p className="text-xs text-gray-400 text-right">
            Actualizado:{" "}
            {new Date(data.lastUpdated).toLocaleString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </>
      )}
    </div>
  );
}
