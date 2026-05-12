"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

interface CertificadoItem {
  id: string;
  consecutivo: string | number;
  fechadevolucion: string;
  nombregenerador: string;
  cedulagenerador: string;
  municipiogenerador: string;
  departamento: string;
  cultivos: string[];
  coordinador: string;
  total: number;
  pdfUrl: string | null;
}

interface CultivoOption {
  id: string;
  nombre: string;
}

interface CoordinadorOption {
  id: string;
  nombre: string;
  rol: string;
}

interface FiltrosData {
  cultivos: CultivoOption[];
  coordinadores: CoordinadorOption[];
  departamentos: string[];
  tiposGenerador: string[];
  anos: number[];
}

const PAGE_SIZE = 50;

const formatNumber = (n: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);

export default function ListarCertificadosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const sessionCoordinatorId = session?.user?.coordinatorRecordId;

  const [filtrosData, setFiltrosData] = useState<FiltrosData>({
    cultivos: [],
    coordinadores: [],
    departamentos: [],
    tiposGenerador: [],
    anos: [],
  });
  const [filtrosLoading, setFiltrosLoading] = useState(true);

  // Filtros activos
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [ano, setAno] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [selDepartamentos, setSelDepartamentos] = useState<string[]>([]);
  const [selTipos, setSelTipos] = useState<string[]>([]);
  const [selCultivos, setSelCultivos] = useState<string[]>([]); // record IDs
  const [selCoordinadores, setSelCoordinadores] = useState<string[]>([]); // record IDs

  // Datos
  const [records, setRecords] = useState<CertificadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Cargar opciones de filtros
  useEffect(() => {
    if (!session?.user) return;
    let cancel = false;
    (async () => {
      try {
        setFiltrosLoading(true);
        const res = await fetch("/api/certificados/filtros");
        if (!res.ok) throw new Error("Error cargando filtros");
        const data = (await res.json()) as FiltrosData;
        if (!cancel) setFiltrosData(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancel) setFiltrosLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [session]);

  // Mapa idCultivo -> nombre (para enviar nombres al backend)
  const cultivoNombreById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of filtrosData.cultivos) m.set(c.id, c.nombre);
    return m;
  }, [filtrosData.cultivos]);

  const buildQuery = useCallback(
    (offset?: string | null) => {
      const params = new URLSearchParams();
      params.set("pageSize", String(PAGE_SIZE));
      if (offset) params.set("offset", offset);
      if (q.trim()) params.set("q", q.trim());
      if (ano) params.set("ano", ano);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      for (const d of selDepartamentos) params.append("departamento", d);
      for (const t of selTipos) params.append("tipo", t);
      for (const cid of selCultivos) {
        const nombre = cultivoNombreById.get(cid);
        if (nombre) params.append("cultivo", nombre);
      }
      // Si es coordinador (no admin/supervisor), el backend fuerza su id; aún así
      // permitimos pasar selección para admins.
      if (canViewAll) {
        for (const c of selCoordinadores) params.append("coordinador", c);
      }
      return params.toString();
    },
    [
      q,
      ano,
      fechaDesde,
      fechaHasta,
      selDepartamentos,
      selTipos,
      selCultivos,
      selCoordinadores,
      cultivoNombreById,
      canViewAll,
    ]
  );

  const fetchPage = useCallback(
    async (mode: "reset" | "append") => {
      if (!session?.user) return;
      const seq = ++requestSeqRef.current;
      try {
        setLoading(true);
        setError(null);
        const queryString = buildQuery(mode === "append" ? nextOffset : null);
        const res = await fetch(`/api/certificados/listar?${queryString}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}`);
        }
        const data = await res.json();
        if (requestSeqRef.current !== seq) return;
        setNextOffset(data.nextOffset || null);
        setHasMore(Boolean(data.hasMore));
        setRecords((prev) =>
          mode === "append" ? [...prev, ...data.records] : data.records
        );
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    },
    [session, buildQuery, nextOffset]
  );

  // Recargar cuando cambian filtros
  const depKeyDepartamentos = selDepartamentos.join(",");
  const depKeyTipos = selTipos.join(",");
  const depKeyCultivos = selCultivos.join(",");
  const depKeyCoordinadores = selCoordinadores.join(",");
  const userId = session?.user?.coordinatorRecordId;
  useEffect(() => {
    if (!session?.user) return;
    fetchPage("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    q,
    ano,
    fechaDesde,
    fechaHasta,
    depKeyDepartamentos,
    depKeyTipos,
    depKeyCultivos,
    depKeyCoordinadores,
  ]);

  const toggleInArray = (
    arr: string[],
    value: string,
    setter: (next: string[]) => void
  ) => {
    if (arr.includes(value)) setter(arr.filter((x) => x !== value));
    else setter([...arr, value]);
  };

  const clearAllFilters = () => {
    setQ("");
    setQInput("");
    setAno("");
    setFechaDesde("");
    setFechaHasta("");
    setSelDepartamentos([]);
    setSelTipos([]);
    setSelCultivos([]);
    setSelCoordinadores([]);
  };

  const hasActiveFilters =
    q !== "" ||
    ano !== "" ||
    fechaDesde !== "" ||
    fechaHasta !== "" ||
    selDepartamentos.length > 0 ||
    selTipos.length > 0 ||
    selCultivos.length > 0 ||
    selCoordinadores.length > 0;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Listar Certificados</h1>
            <p className="text-sm text-gray-500">
              {loading
                ? "Cargando..."
                : `${records.length} certificado(s) cargado(s)${hasMore ? " — hay más" : ""}`}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Chips de coordinadores (atajo tipo Kardex) */}
        {canViewAll && filtrosData.coordinadores.length > 0 && (
          <div className="bg-white rounded-lg shadow p-3 mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">
              Atajo: filtrar por coordinador
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelCoordinadores([])}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  selCoordinadores.length === 0
                    ? "bg-[#00d084] text-white border-[#00d084]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Todos
              </button>
              {filtrosData.coordinadores.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    setSelCoordinadores(
                      selCoordinadores.includes(c.id) && selCoordinadores.length === 1
                        ? []
                        : [c.id]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    selCoordinadores.includes(c.id)
                      ? "bg-[#00d084] text-white border-[#00d084]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  title={c.rol}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {!canViewAll && sessionCoordinatorId && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 mb-4 text-sm">
            Estás viendo solo tus certificados.
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar (cédula, nombre, consecutivo)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setQ(qInput);
                  }}
                  placeholder="Ej: 12345, Pérez, 1234"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  onClick={() => setQ(qInput)}
                  className="px-3 py-2 bg-[#00d084] hover:bg-[#00b070] text-white text-sm rounded-md"
                >
                  Buscar
                </button>
                {q && (
                  <button
                    onClick={() => {
                      setQ("");
                      setQInput("");
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Año
              </label>
              <select
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {filtrosData.anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rango de fechas (devolución)
              </label>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                />
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectChips
              label="Departamento"
              options={filtrosData.departamentos.map((d) => ({ id: d, label: d }))}
              selected={selDepartamentos}
              onToggle={(v) =>
                toggleInArray(selDepartamentos, v, setSelDepartamentos)
              }
              loading={filtrosLoading}
            />
            <MultiSelectChips
              label="Tipo de generador"
              options={filtrosData.tiposGenerador.map((t) => ({ id: t, label: t }))}
              selected={selTipos}
              onToggle={(v) => toggleInArray(selTipos, v, setSelTipos)}
              loading={filtrosLoading}
            />
            <MultiSelectChips
              label="Cultivos"
              options={filtrosData.cultivos.map((c) => ({
                id: c.id,
                label: c.nombre,
              }))}
              selected={selCultivos}
              onToggle={(v) => toggleInArray(selCultivos, v, setSelCultivos)}
              loading={filtrosLoading}
              searchable
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {error && (
            <div className="bg-red-50 border-b border-red-200 text-red-700 p-3 text-sm">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Consecutivo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Generador</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Municipio</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cultivos</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coordinador</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (kg)</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">PDF</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 font-mono">
                      {r.consecutivo}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                      {r.fechadevolucion}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">
                        {r.nombregenerador}
                      </div>
                      <div className="text-xs text-gray-500">
                        {r.cedulagenerador}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <div>{r.municipiogenerador}</div>
                      <div className="text-xs text-gray-500">{r.departamento}</div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {r.cultivos.length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          r.cultivos.map((c, i) => (
                            <span
                              key={`${r.id}-cul-${i}`}
                              className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs"
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {r.coordinador}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900 font-medium">
                      {formatNumber(r.total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.pdfUrl ? (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Descargar
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                      No hay certificados para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {loading
                ? "Cargando..."
                : `${records.length} resultado(s)${hasMore ? " (hay más)" : ""}`}
            </span>
            <button
              onClick={() => fetchPage("append")}
              disabled={!hasMore || loading}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                !hasMore || loading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-[#00d084] hover:bg-[#00b070] text-white"
              }`}
            >
              {loading ? "Cargando..." : hasMore ? "Cargar más" : "No hay más"}
            </button>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

interface MultiSelectChipsProps {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  searchable?: boolean;
}

function MultiSelectChips({
  label,
  options,
  selected,
  onToggle,
  loading,
  searchable,
}: MultiSelectChipsProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return options;
    const f = filter.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(f));
  }, [filter, options]);

  return (
    <div className="border border-gray-200 rounded-md p-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-blue-600 hover:underline"
          type="button"
        >
          {open ? "Cerrar" : `${selected.length > 0 ? `${selected.length} sel` : "Ver"}`}
        </button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-[#00d084] text-white text-xs px-2 py-0.5 rounded-full"
              >
                {opt?.label || id}
                <button
                  onClick={() => onToggle(id)}
                  type="button"
                  className="hover:text-gray-200"
                  aria-label={`Quitar ${opt?.label || id}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="border-t border-gray-100 pt-2">
          {searchable && (
            <input
              type="text"
              placeholder="Filtrar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-2"
            />
          )}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400">Sin opciones</p>
            ) : (
              filtered.map((opt) => {
                const isSel = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 text-sm px-1 py-0.5 rounded cursor-pointer ${
                      isSel ? "bg-green-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggle(opt.id)}
                    />
                    <span className="text-gray-700">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
