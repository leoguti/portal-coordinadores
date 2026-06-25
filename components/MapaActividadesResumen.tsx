"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MapaColombia = dynamic(() => import("@/components/MapaColombia"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
      Cargando mapa...
    </div>
  ),
});

interface MunicipioAgg {
  codigo: string;
  municipio: string;
  departamento: string;
  total: number;
  porTipo: Record<string, number>;
}

interface ApiResp {
  municipios: MunicipioAgg[];
  tipos: string[];
  totals: { municipios: number; actividades: number; departamentos: number };
}

const fmt = (n: number) => n.toLocaleString("es-CO");

export default function MapaActividadesResumen({
  year,
  mode,
  monthFrom,
  monthTo,
}: {
  year: number;
  mode: "anual" | "mensual";
  monthFrom: number;
  monthTo: number;
}) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipoSel, setTipoSel] = useState("");

  const mf = mode === "anual" ? 1 : monthFrom;
  const mt = mode === "anual" ? 12 : monthTo;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/dashboard/actividades-por-municipio?year=${year}&monthFrom=${mf}&monthTo=${mt}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setData(d);
        setTipoSel("");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, mf, mt]);

  const { actividadesPorMunicipio, kpis } = useMemo(() => {
    if (!data) {
      return {
        actividadesPorMunicipio: [],
        kpis: { municipios: 0, actividades: 0, departamentos: 0 },
      };
    }
    const rows = data.municipios
      .map((m) => ({
        codigo: m.codigo,
        municipio: m.municipio,
        departamento: m.departamento,
        cantidad: tipoSel ? m.porTipo[tipoSel] || 0 : m.total,
        porTipo: m.porTipo,
      }))
      .filter((m) => m.cantidad > 0);
    const departamentos = new Set(rows.map((r) => r.departamento).filter(Boolean));
    return {
      actividadesPorMunicipio: rows,
      kpis: {
        municipios: rows.length,
        actividades: rows.reduce((s, r) => s + r.cantidad, 0),
        departamentos: departamentos.size,
      },
    };
  }, [data, tipoSel]);

  const tipos = data?.tipos || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Cobertura de actividades por municipio
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Tipo</span>
          <select
            value={tipoSel}
            onChange={(e) => setTipoSel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:ring-2 focus:ring-[#00d084]"
          >
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Kpi label="Municipios con presencia" value={kpis.municipios} />
        <Kpi
          label={tipoSel ? `Actividades · ${tipoSel}` : "Total actividades"}
          value={kpis.actividades}
        />
        <Kpi label="Departamentos cubiertos" value={kpis.departamentos} />
      </div>

      {loading ? (
        <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
          Cargando…
        </div>
      ) : actividadesPorMunicipio.length === 0 ? (
        <div className="w-full h-[200px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          Sin actividades para el periodo / tipo seleccionado.
        </div>
      ) : (
        <MapaColombia
          actividadesPorMunicipio={actividadesPorMunicipio}
          leyendaTitulo={tipoSel || "Actividades"}
          focusColombia
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 text-center">
      <p className="text-2xl font-bold text-gray-900">{fmt(value)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
