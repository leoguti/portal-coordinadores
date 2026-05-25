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

function pctColor(p: number): { bg: string; text: string } {
  if (p >= 70) return { bg: "bg-green-100", text: "text-green-700" };
  if (p >= 40) return { bg: "bg-yellow-100", text: "text-yellow-700" };
  return { bg: "bg-red-100", text: "text-red-700" };
}

// % acumulado del año hasta cada mes = (real acumulado) / (meta anual)
function acumuladoPct(meses: Celda[], metaAnual: number): number[] {
  let acc = 0;
  return meses.map((c) => {
    acc += c.real;
    return metaAnual > 0 ? Math.round((acc / metaAnual) * 100) : 0;
  });
}

// índice (0-11) del mes vigente si el año seleccionado es el actual; si no, -1
function mesVigenteIdx(data: Data): number {
  return data.year === data.currentYear ? data.currentMonth - 1 : -1;
}

// --- Celda mensual: recolección · meta · % acumulado ---
function CeldaMes({
  celda,
  acum,
  estado,
  borde,
}: {
  celda: Celda;
  acum: number;
  estado: Estado;
  borde: boolean; // borde derecho = línea del mes vigente (Gantt)
}) {
  let bg = "bg-gray-50";
  let pctText = "text-gray-300";
  if (estado === "pasado") {
    bg = "bg-emerald-50";
    pctText = "text-emerald-700";
  } else if (estado === "actual") {
    const c = pctColor(acum);
    bg = c.bg;
    pctText = c.text;
  }
  const futuro = estado === "futuro";
  const bordeCls = borde
    ? "border-r-2 border-indigo-500"
    : "border-r border-gray-100";

  return (
    <td className={`${bg} ${bordeCls} p-0 align-top`}>
      <div className="px-1 py-0.5 text-center">
        <div
          className={`text-[10px] font-mono leading-tight ${
            futuro ? "text-gray-300" : "text-gray-800"
          }`}
          title="Recolección del mes"
        >
          {fmt(celda.real)}
        </div>
        <div
          className={`text-[9px] font-mono leading-tight border-t border-gray-200/70 ${
            futuro ? "text-gray-300" : "text-gray-400"
          }`}
          title="Meta del mes"
        >
          {fmt(celda.meta)}
        </div>
        {futuro ? (
          <div className="text-[10px] text-gray-300 border-t border-gray-200/70">·</div>
        ) : (
          <div
            className={`text-[11px] font-bold leading-tight border-t border-gray-200/70 ${pctText}`}
            title="% acumulado del año"
          >
            {estado === "pasado" ? "✓ " : ""}
            {acum}%
          </div>
        )}
      </div>
    </td>
  );
}

// --- Celda anual (avance verdadero del año) ---
function CeldaAnual({ real, meta }: { real: number; meta: number }) {
  const p = meta > 0 ? Math.round((real / meta) * 100) : real > 0 ? 100 : 0;
  const c = pctColor(p);
  return (
    <td className={`${c.bg} border-l-2 border-gray-300 p-0 align-top`}>
      <div className="px-1.5 py-0.5 text-center">
        <div className="text-[11px] font-mono leading-tight text-gray-900 font-medium" title="Recolección acumulada del año">
          {fmt(real)}
        </div>
        <div className="text-[9px] font-mono leading-tight border-t border-gray-200/70 text-gray-500" title="Meta del año">
          {fmt(meta)}
        </div>
        <div className={`text-xs font-bold leading-tight border-t border-gray-200/70 ${c.text}`}>
          {p}%
        </div>
      </div>
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
  const vigente = mesVigenteIdx(data);
  const acumTotal = acumuladoPct(tabla.total.meses, tabla.total.metaAnual);

  return (
    <div className="mb-7">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        {titulo} <span className="text-gray-400 normal-case">({unidad})</span>
      </h2>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: 132 }} />
          {MESES.map((_, i) => (
            <col key={i} style={{ width: 62 }} />
          ))}
          <col style={{ width: 90 }} />
        </colgroup>
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-semibold text-gray-600 text-xs">
              Zona
            </th>
            {MESES.map((m, i) => {
              const est = estadoMes(data.year, i, data.currentYear, data.currentMonth);
              const esVigente = i === vigente;
              return (
                <th
                  key={m}
                  className={`px-1 py-1.5 text-center text-[11px] font-semibold ${
                    esVigente
                      ? "border-r-2 border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-r border-gray-100"
                  } ${
                    est === "futuro" && !esVigente ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {esVigente && (
                    <div className="text-[8px] font-bold text-indigo-500 leading-none mb-0.5">
                      HOY ▾
                    </div>
                  )}
                  {m}
                </th>
              );
            })}
            <th className="px-1.5 py-1.5 text-center text-[11px] font-bold text-gray-700 border-l-2 border-gray-300">
              AÑO
            </th>
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f) => {
            const acum = acumuladoPct(f.meses, f.metaAnual);
            return (
              <tr key={f.zona} className="border-t border-gray-100 hover:bg-gray-50/40">
                <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-gray-800 text-[11px] whitespace-nowrap">
                  {f.zona}
                </td>
                {f.meses.map((celda, i) => (
                  <CeldaMes
                    key={i}
                    celda={celda}
                    acum={acum[i]}
                    estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                    borde={i === vigente}
                  />
                ))}
                <CeldaAnual real={f.realAnual} meta={f.metaAnual} />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
            <td className="sticky left-0 z-10 bg-gray-100 px-2 py-1 text-gray-900 text-[11px]">
              TOTAL
            </td>
            {tabla.total.meses.map((celda, i) => (
              <CeldaMes
                key={i}
                celda={celda}
                acum={acumTotal[i]}
                estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                borde={i === vigente}
              />
            ))}
            <CeldaAnual real={tabla.total.realAnual} meta={tabla.total.metaAnual} />
          </tr>
        </tfoot>
      </table>
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
            Cada celda: recolección · meta · <strong>% acumulado del año</strong>
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
        <span className="font-medium text-gray-700">Cada celda:</span>
        <span>recolección <span className="text-gray-400">/ meta</span> / <strong>% acumulado</strong></span>
        <span className="text-gray-300">|</span>
        <span><span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200 mr-1 align-middle" />Mes cerrado (✓)</span>
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200 mr-1 align-middle" />≥70%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-200 mr-1 align-middle" />40–69%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200 mr-1 align-middle" />&lt;40%</span>
        <span><span className="inline-block w-3 h-3 rounded bg-gray-50 border border-gray-200 mr-1 align-middle" />Futuro</span>
        <span><span className="inline-block w-0.5 h-3 bg-indigo-500 mr-1 align-middle" />Mes vigente (pasado | futuro)</span>
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          {/* Un solo contenedor de scroll para que los meses queden alineados
              en las 3 tablas y la línea del mes vigente sea continua */}
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              <TablaMeta titulo="Recolección" unidad="kg" tabla={data.metas.recoleccion} data={data} />
              <TablaMeta titulo="Sensibilización" unidad="personas" tabla={data.metas.sensibilizacion} data={data} />
              <TablaMeta titulo="Evaluaciones" unidad="evaluaciones" tabla={data.metas.evaluaciones} data={data} />
            </div>
          </div>
          <p className="text-xs text-gray-400 text-right mt-2">
            Actualizado:{" "}
            {new Date(data.lastUpdated).toLocaleString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
