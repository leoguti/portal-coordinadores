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

interface MunicipioShare {
  codigo: string;
  municipio: string;
  departamento: string;
  sharePct: number;
}

interface DepartamentoShare {
  codigo: string;
  nombre: string;
  sharePct: number;
  municipios: number;
}

interface RecoleccionResp {
  municipios: MunicipioShare[];
  porDepartamento: DepartamentoShare[];
  totals: { municipios: number; departamentos: number; top10Pct: number };
}

const fmt = (n: number) => n.toLocaleString("es-CO");

export default function MapaActividadesResumen({
  year = new Date().getFullYear(),
  mode = "anual",
  monthFrom = 1,
  monthTo = 12,
}: {
  year?: number;
  mode?: "anual" | "mensual";
  monthFrom?: number;
  monthTo?: number;
} = {}) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [recol, setRecol] = useState<RecoleccionResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipoSel, setTipoSel] = useState("");
  // Qué dato pinta el mapa: actividades (binario) o recolección (% del total)
  const [dataset, setDataset] = useState<"actividades" | "recoleccion">("actividades");
  // Municipio/departamento enfocado desde el Top (código DIVIPOLA)
  const [focoCodigo, setFocoCodigo] = useState<string | null>(null);
  // Nivel del mapa de recolección: por municipio o por departamento
  const [nivel, setNivel] = useState<"municipio" | "departamento">("municipio");

  const mf = mode === "anual" ? 1 : monthFrom;
  const mt = mode === "anual" ? 12 : monthTo;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = `year=${year}&monthFrom=${mf}&monthTo=${mt}`;
    Promise.all([
      fetch(`/api/dashboard/actividades-por-municipio?${qs}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/dashboard/recoleccion-por-municipio?${qs}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([act, rec]) => {
        if (!active) return;
        setData(act);
        setRecol(rec);
        setTipoSel("");
        setFocoCodigo(null);
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

  // Filas para el modo recolección: cantidad = % del total nacional
  const recoleccionPorMunicipio = useMemo(() => {
    if (!recol) return [];
    return recol.municipios
      .filter((m) => m.sharePct > 0)
      .map((m) => ({
        codigo: m.codigo,
        municipio: m.municipio,
        departamento: m.departamento,
        cantidad: m.sharePct,
      }));
  }, [recol]);

  const tipos = data?.tipos || [];
  const esRecoleccion = dataset === "recoleccion";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {esRecoleccion
            ? "Recolección por municipio (% del total)"
            : "Cobertura de actividades por municipio"}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Actividades / Recolección */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => { setDataset("actividades"); setFocoCodigo(null); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                !esRecoleccion ? "bg-[#00d084] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Actividades
            </button>
            <button
              onClick={() => { setDataset("recoleccion"); setFocoCodigo(null); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                esRecoleccion ? "bg-[#00d084] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Recolección
            </button>
          </div>
          {!esRecoleccion && (
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
          )}
        </div>
      </div>

      {/* KPIs ejecutivos */}
      {esRecoleccion ? (
        <>
          {/* Los KPIs de municipios/departamentos son el switch de nivel del mapa */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <KpiBoton
              label="Municipios con recolección"
              value={recol?.totals.municipios || 0}
              activo={nivel === "municipio"}
              hint="Ver mapa por municipio"
              onClick={() => { setNivel("municipio"); setFocoCodigo(null); }}
            />
            <Kpi
              label={nivel === "departamento" ? "Top 5 departamentos concentran" : "Top 10 municipios concentran"}
              value={
                nivel === "departamento"
                  ? Math.round((recol?.porDepartamento || []).slice(0, 5).reduce((s, d) => s + d.sharePct, 0) * 10) / 10
                  : recol?.totals.top10Pct || 0
              }
              sufijo="%"
            />
            <KpiBoton
              label="Departamentos con recolección"
              value={recol?.totals.departamentos || 0}
              activo={nivel === "departamento"}
              hint="Ver mapa por departamento"
              onClick={() => { setNivel("departamento"); setFocoCodigo(null); }}
            />
          </div>

          {/* Top N — click para volar al municipio/departamento en el mapa */}
          {nivel === "municipio" && (recol?.municipios.length || 0) > 0 && (
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">
                Top 10 municipios · click para verlo en el mapa
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {recol!.municipios.slice(0, 10).map((m, i) => (
                  <TopChip
                    key={m.codigo}
                    pos={i + 1}
                    titulo={m.municipio}
                    subtitulo={m.departamento}
                    pct={m.sharePct}
                    activo={focoCodigo === m.codigo}
                    onClick={() => setFocoCodigo(focoCodigo === m.codigo ? null : m.codigo)}
                  />
                ))}
              </div>
            </div>
          )}
          {nivel === "departamento" && (recol?.porDepartamento.length || 0) > 0 && (
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">
                Top 5 departamentos · click para verlo en el mapa
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {recol!.porDepartamento.slice(0, 5).map((d, i) => (
                  <TopChip
                    key={d.codigo}
                    pos={i + 1}
                    titulo={d.nombre}
                    subtitulo={`${d.municipios} ${d.municipios === 1 ? "municipio" : "municipios"}`}
                    pct={d.sharePct}
                    activo={focoCodigo === d.codigo}
                    onClick={() => setFocoCodigo(focoCodigo === d.codigo ? null : d.codigo)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Kpi label="Municipios con presencia" value={kpis.municipios} />
          <Kpi
            label={tipoSel ? `Actividades · ${tipoSel}` : "Total actividades"}
            value={kpis.actividades}
          />
          <Kpi label="Departamentos cubiertos" value={kpis.departamentos} />
        </div>
      )}

      {loading ? (
        <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
          Cargando…
        </div>
      ) : esRecoleccion ? (
        recoleccionPorMunicipio.length === 0 ? (
          <div className="w-full h-[200px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">
            Sin recolección para el periodo seleccionado.
          </div>
        ) : (
          <MapaColombia
            key={`recol-${nivel}`}
            actividadesPorMunicipio={recoleccionPorMunicipio}
            leyendaTitulo="Recolección (% del total)"
            focusColombia
            esPorcentaje
            municipioFoco={focoCodigo}
            nivelDepartamento={nivel === "departamento"}
            departamentos={recol?.porDepartamento || []}
          />
        )
      ) : actividadesPorMunicipio.length === 0 ? (
        <div className="w-full h-[200px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          Sin actividades para el periodo / tipo seleccionado.
        </div>
      ) : (
        <MapaColombia
          actividadesPorMunicipio={actividadesPorMunicipio}
          leyendaTitulo={tipoSel || "Actividades"}
          focusColombia
          binario
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sufijo }: { label: string; value: number; sufijo?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 text-center">
      <p className="text-2xl font-bold text-gray-900">{fmt(value)}{sufijo || ""}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/** KPI clickeable que actúa como switch de nivel del mapa. */
function KpiBoton({
  label,
  value,
  activo,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  activo: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-center transition-colors ${
        activo
          ? "border-[#00d084] bg-[#00d084]/10 ring-1 ring-[#00d084]"
          : "border-gray-100 bg-gray-50 hover:border-[#00d084] hover:bg-white"
      }`}
    >
      <p className="text-2xl font-bold text-gray-900">{fmt(value)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      <p className={`text-[10px] mt-1 font-medium ${activo ? "text-[#00a868]" : "text-gray-400"}`}>
        {activo ? "● Mostrando en el mapa" : `▸ ${hint}`}
      </p>
    </button>
  );
}

/** Chip de ranking (Top N) clickeable para enfocar en el mapa. */
function TopChip({
  pos,
  titulo,
  subtitulo,
  pct,
  activo,
  onClick,
}: {
  pos: number;
  titulo: string;
  subtitulo: string;
  pct: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
        activo
          ? "border-[#00d084] bg-[#00d084]/10 ring-1 ring-[#00d084]"
          : "border-gray-200 bg-white hover:border-[#00d084] hover:bg-gray-50"
      }`}
    >
      <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
        activo ? "bg-[#00d084] text-white" : "bg-gray-100 text-gray-600"
      }`}>
        {pos}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 truncate">{titulo}</span>
        <span className="block text-xs text-gray-500 truncate">{subtitulo}</span>
      </span>
      <span className="ml-auto text-sm font-bold text-green-700 whitespace-nowrap">
        {pct.toLocaleString("es-CO")}%
      </span>
    </button>
  );
}
