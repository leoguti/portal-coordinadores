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

type SerieMeta = { meses: Celda[]; realAnual: number; metaAnual: number };
interface MisData {
  year: number;
  currentYear: number;
  currentMonth: number;
  zona: string | null;
  metas: {
    recoleccion: SerieMeta;
    sensibilizacion: SerieMeta;
    evaluaciones: SerieMeta;
  };
  enRevision?: {
    sensibilizacion: number;
    evaluaciones: number;
  };
  lastUpdated: string;
}

export default function MisMetas({ year }: { year: number }) {
  const [data, setData] = useState<MisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/mis-metas?year=${year}`);
        if (res.ok && !cancel) setData(await res.json());
      } catch (e) {
        console.error("Error mis-metas:", e);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d084]" />
      </div>
    );
  }
  if (!data) return null;

  const filas = [
    { label: "Recolección (kg)", serie: data.metas.recoleccion },
    { label: "Sensibilización (personas)", serie: data.metas.sensibilizacion },
    { label: "Evaluaciones", serie: data.metas.evaluaciones },
  ];
  const vigente = vigenteIdx(data.year, data.currentYear, data.currentMonth);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Mis Metas por Mes {year}
          {data.zona && (
            <span className="ml-2 normal-case text-gray-400 font-normal">· Zona {data.zona}</span>
          )}
        </h2>
      </div>

      <LeyendaMetas />
      <NotaMetasIniciales year={year} />
      {((data.enRevision?.sensibilizacion ?? 0) > 0 || (data.enRevision?.evaluaciones ?? 0) > 0) && (
        <p className="text-xs text-amber-600 mb-2">
          En revisión del administrador (aún no suman):{" "}
          {(data.enRevision?.sensibilizacion ?? 0) > 0 && (
            <>{data.enRevision!.sensibilizacion.toLocaleString("es-CO")} sensibilizados</>
          )}
          {(data.enRevision?.sensibilizacion ?? 0) > 0 && (data.enRevision?.evaluaciones ?? 0) > 0 && " · "}
          {(data.enRevision?.evaluaciones ?? 0) > 0 && (
            <>{data.enRevision!.evaluaciones.toLocaleString("es-CO")} evaluaciones</>
          )}
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[960px]">
          <table className="w-full table-fixed border-collapse">
            <MetasColgroup />
            <thead>
              <HeaderRow
                firstLabel="Meta"
                year={data.year}
                currentYear={data.currentYear}
                currentMonth={data.currentMonth}
              />
            </thead>
            <tbody>
              {filas.map((f) => {
                const acum = acumuladoPct(f.serie.meses, f.serie.metaAnual);
                const plan = acumuladoVsPlan(f.serie.meses);
                return (
                  <tr key={f.label} className="border-t-2 border-gray-300">
                    <RowHeader name={f.label} bg="bg-white" />
                    {f.serie.meses.map((celda, i) => (
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
                    <CeldaAnual real={f.serie.realAnual} meta={f.serie.metaAnual} />
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  );
}
