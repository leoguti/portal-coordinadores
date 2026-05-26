"use client";

/**
 * Dashboard de certificados con cruces de kilos × cultivos × municipios ×
 * departamentos × coordinador, materiales y top generadores. Se nutre de
 * /api/dashboard/certificados-stats (Neon).
 *
 * Roles: el endpoint fuerza filtro por coordinador si el usuario lo es;
 * admins pueden filtrar por coordinador específico o ver todo.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface Row { certs: number; kg: number; }
interface CultivoRow extends Row { cultivo: string; }
interface DeptoRow extends Row { depto: string; }
interface MunRow extends Row { mun: string; }
interface CoordRow extends Row { id: string; nombre: string; }
interface GenRow extends Row { nombre: string; cedula: string | null; }
interface HeatRow extends Row { cultivo: string; depto: string; }
interface TendPoint { ym: string; certs: number; kg: number; }

interface Stats {
  meta: { year: number; monthFrom: number; monthTo: number; coordinador: string | null; coordinadorForzado: boolean; };
  kpis: { certs: number; kg: number; certsPrev: number; kgPrev: number; deltaCertsPct: number | null; deltaKgPct: number | null; tripleLavado: { si: number; no: number; noAplica: number; sinRespuesta: number; }; };
  materiales: { rigidos: number; flexibles: number; metalicos: number; embalaje: number; };
  tendencia: { actual: TendPoint[]; anterior: TendPoint[]; };
  porCultivo: CultivoRow[];
  porDepto: DeptoRow[];
  porMunicipio: MunRow[];
  porCoordinador: CoordRow[];
  topGeneradores: GenRow[];
  heatmap: HeatRow[];
  filtros: { years: number[]; cultivos: string[]; departamentos: string[]; };
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmtKg(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}
function fmtInt(n: number): string {
  return Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}
function fmtPct(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  /** Si true, fuerza el filtro al coordinador autenticado y oculta selector de coordinador. */
  scope?: "all" | "mine";
  /** Lista de coordinadores para el selector (solo admin). */
  coordinadores?: { id: string; name: string }[];
}

export default function DashboardCertificados({ scope = "all", coordinadores = [] }: Props) {
  const { data: session } = useSession();
  const role = session?.user?.rol;
  const isAdmin = role === "Administrador" || role === "Supervisor";
  const showCoordSelect = scope === "all" && isAdmin && coordinadores.length > 0;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);
  const [coordSel, setCoordSel] = useState<string>("");
  const [cultivoSel, setCultivoSel] = useState<string>("");
  const [deptoSel, setDeptoSel] = useState<string>("");

  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("monthFrom", String(monthFrom));
    p.set("monthTo", String(monthTo));
    if (showCoordSelect && coordSel) p.set("coordinador", coordSel);
    if (cultivoSel) p.set("cultivo", cultivoSel);
    if (deptoSel) p.set("departamento", deptoSel);
    try {
      const r = await fetch(`/api/dashboard/certificados-stats?${p.toString()}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error || `Error ${r.status}`); setData(null); }
      else setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error de conexión");
      setData(null);
    } finally { setLoading(false); }
  }, [year, monthFrom, monthTo, coordSel, cultivoSel, deptoSel, showCoordSelect]);

  useEffect(() => { load(); }, [load]);

  const tendenciaUnida = useMemo(() => {
    if (!data) return [];
    const map: Record<string, { mes: string; actual: number; anterior: number; actualKg: number; anteriorKg: number; }> = {};
    for (let m = monthFrom; m <= monthTo; m++) {
      const ymCur = `${year}-${String(m).padStart(2, "0")}`;
      const ymPrev = `${year - 1}-${String(m).padStart(2, "0")}`;
      const cur = data.tendencia.actual.find((x) => x.ym === ymCur);
      const prev = data.tendencia.anterior.find((x) => x.ym === ymPrev);
      map[String(m)] = {
        mes: MESES[m - 1],
        actual: cur?.certs || 0,
        anterior: prev?.certs || 0,
        actualKg: cur?.kg || 0,
        anteriorKg: prev?.kg || 0,
      };
    }
    return Object.values(map);
  }, [data, year, monthFrom, monthTo]);

  const matPie = useMemo(() => {
    if (!data) return [];
    const m = data.materiales;
    return [
      { name: "Rígidos", value: m.rigidos, fill: "#16a34a" },
      { name: "Flexibles", value: m.flexibles, fill: "#0ea5e9" },
      { name: "Metálicos", value: m.metalicos, fill: "#f59e0b" },
      { name: "Embalaje", value: m.embalaje, fill: "#a855f7" },
    ].filter((x) => x.value > 0);
  }, [data]);

  // Heatmap: orden top → menos top
  const heatGrid = useMemo(() => {
    if (!data) return { cultivos: [] as string[], deptos: [] as string[], cells: new Map<string, { kg: number; certs: number }>(), max: 0 };
    const cs = new Map<string, number>();
    const ds = new Map<string, number>();
    for (const r of data.heatmap) {
      cs.set(r.cultivo, (cs.get(r.cultivo) || 0) + r.kg);
      ds.set(r.depto, (ds.get(r.depto) || 0) + r.kg);
    }
    const cultivos = [...cs.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const deptos = [...ds.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const cells = new Map<string, { kg: number; certs: number }>();
    let max = 0;
    for (const r of data.heatmap) {
      cells.set(`${r.cultivo}|${r.depto}`, { kg: r.kg, certs: r.certs });
      if (r.kg > max) max = r.kg;
    }
    return { cultivos, deptos, cells, max };
  }, [data]);

  const yearsList = data?.filtros.years.length ? data.filtros.years : [year];
  const cultivosOpts = data?.filtros.cultivos || [];
  const deptosOpts = data?.filtros.departamentos || [];

  // ────────── Render ──────────
  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            {yearsList.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde mes</label>
          <select value={monthFrom} onChange={(e) => setMonthFrom(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta mes</label>
          <select value={monthTo} onChange={(e) => setMonthTo(Math.max(parseInt(e.target.value), monthFrom))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        {showCoordSelect && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Coordinador</label>
            <select value={coordSel} onChange={(e) => setCoordSel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-[220px]">
              <option value="">Todos</option>
              {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cultivo</label>
          <select value={cultivoSel} onChange={(e) => setCultivoSel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-[200px] focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Todos</option>
            {cultivosOpts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
          <select value={deptoSel} onChange={(e) => setDeptoSel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-[200px] focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Todos</option>
            {deptosOpts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {(cultivoSel || deptoSel || coordSel) && (
          <button onClick={() => { setCultivoSel(""); setDeptoSel(""); setCoordSel(""); }}
            className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">Limpiar</button>
        )}
      </div>

      {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{err}</div>}
      {loading && !data && <p className="text-center text-gray-400 py-8 text-sm">Cargando…</p>}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard label="Certificados" value={fmtInt(data.kpis.certs)} delta={data.kpis.deltaCertsPct} />
            <KpiCard label="Kilos totales" value={`${fmtInt(data.kpis.kg)} kg`} delta={data.kpis.deltaKgPct} />
            <TripleLavadoCard tl={data.kpis.tripleLavado} />
          </div>

          {/* Tendencia */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Tendencia mensual de certificados ({year} vs {year - 1})</h3>
              <button onClick={() => downloadCSV(`tendencia-${year}.csv`, tendenciaUnida)} className="text-xs text-gray-500 hover:text-gray-800">↓ CSV</button>
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={tendenciaUnida}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name={`${year}`} stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="anterior" name={`${year - 1}`} stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top cultivos + Top depto */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopBarBlock title="Top cultivos por kilos" rows={data.porCultivo.map((r) => ({ name: r.cultivo, kg: r.kg, certs: r.certs }))} csvName={`cultivos-${year}.csv`} />
            <TopBarBlock title="Top departamentos por kilos" rows={data.porDepto.map((r) => ({ name: r.depto, kg: r.kg, certs: r.certs }))} csvName={`departamentos-${year}.csv`} color="#0ea5e9" />
          </div>

          {/* Top municipios + Materiales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopBarBlock title="Top municipios de devolución" rows={data.porMunicipio.map((r) => ({ name: r.mun, kg: r.kg, certs: r.certs }))} csvName={`municipios-${year}.csv`} color="#a855f7" />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Composición de materiales (kg)</h3>
                <button onClick={() => downloadCSV(`materiales-${year}.csv`, matPie.map((x) => ({ material: x.name, kg: x.value })))} className="text-xs text-gray-500 hover:text-gray-800">↓ CSV</button>
              </div>
              {matPie.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">Sin datos</p>
              ) : (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={matPie} dataKey="value" nameKey="name" outerRadius={90} label={(p: { name?: string; percent?: number }) => `${p.name || ""}: ${((p.percent || 0) * 100).toFixed(0)}%`}>
                        {matPie.map((m, i) => <Cell key={i} fill={m.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${fmtInt(Number(v) || 0)} kg`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap cultivo × depto */}
          {heatGrid.cultivos.length > 0 && heatGrid.deptos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Cultivo × Departamento (kilos)</h3>
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-200 px-2 py-1.5 text-left bg-gray-50 sticky left-0">Cultivo \ Depto</th>
                    {heatGrid.deptos.map((d) => (
                      <th key={d} className="border border-gray-200 px-2 py-1.5 text-left bg-gray-50 max-w-[110px]">
                        <div className="truncate" title={d}>{d}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatGrid.cultivos.map((c) => (
                    <tr key={c}>
                      <td className="border border-gray-200 px-2 py-1.5 font-medium bg-gray-50 sticky left-0 max-w-[180px]">
                        <div className="truncate" title={c}>{c}</div>
                      </td>
                      {heatGrid.deptos.map((d) => {
                        const cell = heatGrid.cells.get(`${c}|${d}`);
                        const intensity = cell && heatGrid.max > 0 ? cell.kg / heatGrid.max : 0;
                        const bg = intensity > 0
                          ? `rgba(22, 163, 74, ${Math.max(0.08, intensity)})`
                          : "transparent";
                        return (
                          <td key={d} className="border border-gray-200 px-2 py-1.5 text-right tabular-nums" style={{ background: bg }}>
                            {cell ? fmtKg(cell.kg) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Por coordinador */}
          {data.porCoordinador.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Por coordinador</h3>
                <button onClick={() => downloadCSV(`coordinadores-${year}.csv`, data.porCoordinador as unknown as Record<string, unknown>[])} className="text-xs text-gray-500 hover:text-gray-800">↓ CSV</button>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left py-2">Coordinador</th>
                    <th className="text-right py-2">Certificados</th>
                    <th className="text-right py-2">Kilos</th>
                    <th className="text-right py-2">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.porCoordinador.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 text-gray-800">{c.nombre}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(c.certs)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtInt(c.kg)}</td>
                      <td className="py-2 text-right text-gray-500">{data.kpis.kg ? ((c.kg / data.kpis.kg) * 100).toFixed(1) + "%" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top generadores */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Top 20 generadores por kilos</h3>
              <button onClick={() => downloadCSV(`generadores-${year}.csv`, data.topGeneradores as unknown as Record<string, unknown>[])} className="text-xs text-gray-500 hover:text-gray-800">↓ CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 w-8">#</th>
                  <th className="text-left py-2">Generador</th>
                  <th className="text-left py-2">Cédula/NIT</th>
                  <th className="text-right py-2">Certificados</th>
                  <th className="text-right py-2">Kilos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topGeneradores.map((g, i) => (
                  <tr key={g.cedula + "-" + i}>
                    <td className="py-1.5 text-gray-400">{i + 1}</td>
                    <td className="py-1.5 text-gray-800">{g.nombre}</td>
                    <td className="py-1.5 text-gray-500 font-mono text-xs">{g.cedula || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtInt(g.certs)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{fmtInt(g.kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────── Subcomponentes ────────────────

function TripleLavadoCard({ tl }: { tl: { si: number; no: number; noAplica: number; sinRespuesta: number; } }) {
  const total = tl.si + tl.no + tl.noAplica + tl.sinRespuesta;
  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(0) + "%" : "0%");
  const rows: { label: string; n: number; color: string }[] = [
    { label: "Sí", n: tl.si, color: "bg-green-500" },
    { label: "No", n: tl.no, color: "bg-red-500" },
    { label: "No aplica", n: tl.noAplica, color: "bg-amber-400" },
  ];
  if (tl.sinRespuesta > 0) rows.push({ label: "Sin respuesta", n: tl.sinRespuesta, color: "bg-gray-300" });
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-2">Triple lavado</p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${r.color}`} />
            <span className="text-xs text-gray-600 w-20">{r.label}</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmtInt(r.n)}</span>
            <span className="text-xs text-gray-400 ml-auto">{pct(r.n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtitle, delta }: { label: string; value: string; subtitle?: string; delta?: number | null; }) {
  const deltaColor = delta == null ? "text-gray-400" : delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-500";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {delta !== undefined && delta !== null && (
        <p className={`text-xs mt-1 ${deltaColor}`}>{fmtPct(delta)} vs período anterior</p>
      )}
    </div>
  );
}

function TopBarBlock({ title, rows, csvName, color = "#16a34a" }: { title: string; rows: { name: string; kg: number; certs: number }[]; csvName: string; color?: string; }) {
  const data = rows.slice(0, 10);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <button onClick={() => downloadCSV(csvName, rows)} className="text-xs text-gray-500 hover:text-gray-800">↓ CSV</button>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Sin datos</p>
      ) : (
        <div style={{ width: "100%", height: 36 + data.length * 28 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtKg(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip formatter={(v) => `${fmtInt(Number(v) || 0)} kg`} />
              <Bar dataKey="kg" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
