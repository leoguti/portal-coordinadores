"use client";

import { useEffect, useState } from "react";
import {
  MESES,
  type Celda,
  estadoMes,
  acumuladoPct,
  acumuladoVsPlan,
  vigenteIdx,
  MetasColgroup,
  HeaderRow,
  RowHeader,
  CeldaMes,
  CeldaAnual,
  LeyendaMetas,
  NotaMetasIniciales,
} from "@/components/metas/metasShared";

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
  const vigente = vigenteIdx(data.year, data.currentYear, data.currentMonth);
  const acumTotal = acumuladoPct(tabla.total.meses, tabla.total.metaAnual);
  const planTotal = acumuladoVsPlan(tabla.total.meses);

  return (
    <div className="mb-7">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        {titulo} <span className="text-gray-400 normal-case">({unidad})</span>
      </h2>
      <table className="w-full table-fixed border-collapse">
        <MetasColgroup />
        <thead>
          <HeaderRow
            firstLabel="Zona"
            year={data.year}
            currentYear={data.currentYear}
            currentMonth={data.currentMonth}
          />
        </thead>
        <tbody>
          {tabla.filas.map((f) => {
            const acum = acumuladoPct(f.meses, f.metaAnual);
            const plan = acumuladoVsPlan(f.meses);
            return (
              <tr key={f.zona} className="border-t-2 border-gray-300">
                <RowHeader name={f.zona} bg="bg-white" />
                {f.meses.map((celda, i) => (
                  <CeldaMes
                    key={i}
                    celda={celda}
                    acum={acum[i]}
                    plan={plan[i]}
                    estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                    borde={i === vigente}
                    mes={MESES[i]}
                  />
                ))}
                <CeldaAnual real={f.realAnual} meta={f.metaAnual} />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-100">
            <RowHeader name="TOTAL" bg="bg-gray-100" />
            {tabla.total.meses.map((celda, i) => (
              <CeldaMes
                key={i}
                celda={celda}
                acum={acumTotal[i]}
                plan={planTotal[i]}
                estado={estadoMes(data.year, i, data.currentYear, data.currentMonth)}
                borde={i === vigente}
                mes={MESES[i]}
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
            Cada celda: recolección · <strong>meta (negrita)</strong> · % del mes · % acumulado frente al plan
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

      <LeyendaMetas />
      <NotaMetasIniciales year={year} />

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
          {/* Un solo contenedor de scroll → meses alineados en las 3 tablas */}
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
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
