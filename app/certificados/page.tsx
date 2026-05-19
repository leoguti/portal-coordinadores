"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";
import HistoricoCertificados from "@/components/HistoricoCertificados";

type Vista = "actual" | "historico";

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
  municipios: string[];
  meses: string[];
  anos: number[];
}

interface GeneradorOption {
  id: string;
  nombre: string;
  nit: string;
  tipo: string;
  tipopersona: string;
  fincaIds: string[];
}

interface FincaOption {
  id: string;
  nombre: string;
}

const PAGE_SIZE = 50;

const formatNumber = (n: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);

const formatMes = (yyyymm: string): string => {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyymm;
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const idx = parseInt(m[2], 10) - 1;
  return `${meses[idx] || m[2]} ${m[1]}`;
};

export default function ListarCertificadosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab actual: "actual" = listado de Airtable; "historico" = snapshots (Postgres+R2).
  // Acepta ?tab=historico en la URL para deep links desde los redirects.
  const [vista, setVista] = useState<Vista>(() =>
    searchParams.get("tab") === "historico" ? "historico" : "actual"
  );

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const sessionCoordinatorId = session?.user?.coordinatorRecordId;

  const [filtrosData, setFiltrosData] = useState<FiltrosData>({
    cultivos: [],
    coordinadores: [],
    departamentos: [],
    municipios: [],
    meses: [],
    anos: [],
  });
  const [filtrosLoading, setFiltrosLoading] = useState(true);

  // Filtros activos
  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [selDepartamentos, setSelDepartamentos] = useState<string[]>([]);
  const [selMunicipios, setSelMunicipios] = useState<string[]>([]);
  const [selCultivos, setSelCultivos] = useState<string[]>([]); // record IDs
  const [selCoordinadores, setSelCoordinadores] = useState<string[]>([]); // record IDs
  const [generador, setGenerador] = useState<GeneradorOption | null>(null);
  const [finca, setFinca] = useState<FincaOption | null>(null);

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
      if (ano) params.set("ano", ano);
      if (mes) params.set("mes", mes);
      if (generador) params.set("generador", generador.id);
      if (finca) params.set("finca", finca.id);
      for (const d of selDepartamentos) params.append("departamento", d);
      for (const m of selMunicipios) params.append("municipio", m);
      for (const cid of selCultivos) {
        const nombre = cultivoNombreById.get(cid);
        if (nombre) params.append("cultivo", nombre);
      }
      if (canViewAll) {
        for (const c of selCoordinadores) params.append("coordinador", c);
      }
      return params.toString();
    },
    [
      ano,
      mes,
      generador,
      finca,
      selDepartamentos,
      selMunicipios,
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

  const depKeyDepartamentos = selDepartamentos.join(",");
  const depKeyMunicipios = selMunicipios.join(",");
  const depKeyCultivos = selCultivos.join(",");
  const depKeyCoordinadores = selCoordinadores.join(",");
  const userId = session?.user?.coordinatorRecordId;
  useEffect(() => {
    if (!session?.user) return;
    fetchPage("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    ano,
    mes,
    generador?.id,
    finca?.id,
    depKeyDepartamentos,
    depKeyMunicipios,
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
    setAno("");
    setMes("");
    setSelDepartamentos([]);
    setSelMunicipios([]);
    setSelCultivos([]);
    setSelCoordinadores([]);
    setGenerador(null);
    setFinca(null);
  };

  const hasActiveFilters =
    ano !== "" ||
    mes !== "" ||
    generador !== null ||
    finca !== null ||
    selDepartamentos.length > 0 ||
    selMunicipios.length > 0 ||
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
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Certificados</h1>
            <p className="text-sm text-gray-500">
              {loading
                ? "Cargando..."
                : `${records.length} certificado(s) cargado(s)${hasMore ? " — hay más" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Limpiar filtros
              </button>
            )}
            <Link
              href="/certificados/generar"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm"
            >
              <span className="text-lg leading-none">＋</span>
              Generar nuevo certificado
            </Link>
          </div>
        </div>

        {/* Tabs: actual (Airtable) vs histórico (snapshots Postgres+R2) */}
        <div className="border-b border-gray-200 mb-4 flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setVista("actual")}
            className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
              vista === "actual"
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 Listado actual
          </button>
          <button
            type="button"
            onClick={() => setVista("historico")}
            className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
              vista === "historico"
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🗂️ Histórico (años anteriores)
          </button>
        </div>

        {vista === "actual" && (
        <>

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
          {/* Búsqueda: Generador y Finca dependiente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GeneradorAutocomplete
              value={generador}
              onChange={(g) => {
                setGenerador(g);
                setFinca(null);
              }}
            />
            <FincaAutocomplete
              value={finca}
              onChange={setFinca}
              generadorId={generador?.id}
              disabled={false}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                Mes
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {filtrosData.meses.map((m) => (
                  <option key={m} value={m}>
                    {m} — {formatMes(m)}
                  </option>
                ))}
              </select>
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
              searchable
            />
            <MultiSelectChips
              label="Municipio"
              options={filtrosData.municipios.map((m) => ({ id: m, label: m }))}
              selected={selMunicipios}
              onToggle={(v) => toggleInArray(selMunicipios, v, setSelMunicipios)}
              loading={filtrosLoading}
              searchable
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
        </>
        )}

        {vista === "historico" && <HistoricoCertificados />}
      </div>
    </AuthenticatedLayout>
  );
}

/* -------------------- Autocomplete Generador -------------------- */

function GeneradorAutocomplete({
  value,
  onChange,
}: {
  value: GeneradorOption | null;
  onChange: (g: GeneradorOption | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeneradorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/generadores/buscar?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Generador
      </label>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-green-50">
          <span className="text-sm text-gray-800 flex-1">
            <span className="font-medium">{value.nombre}</span>
            {value.nit && <span className="text-xs text-gray-500"> · NIT {value.nit}</span>}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-gray-500 hover:text-red-600 text-sm"
            aria-label="Quitar generador"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por nombre o NIT (mín 2 caracteres)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {open && q.length >= 2 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-xs text-gray-400">Buscando...</div>
              ) : results.length === 0 ? (
                <div className="p-2 text-xs text-gray-400">Sin resultados</div>
              ) : (
                results.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onChange(g);
                      setQ("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-800">
                      {g.nombre}
                    </div>
                    <div className="text-xs text-gray-500">
                      {g.nit && `NIT ${g.nit}`}
                      {g.tipo && ` · ${g.tipo}`}
                      {g.fincaIds.length > 0 && ` · ${g.fincaIds.length} finca(s)`}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------- Autocomplete Finca -------------------- */

function FincaAutocomplete({
  value,
  onChange,
  generadorId,
  disabled,
}: {
  value: FincaOption | null;
  onChange: (f: FincaOption | null) => void;
  generadorId?: string;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FincaOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si hay generador seleccionado, cargamos sus fincas al inicio (sin q)
    if (generadorId && !value) {
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/fincas/buscar?generador=${encodeURIComponent(generadorId)}`
          );
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
          }
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [generadorId, value]);

  useEffect(() => {
    if (!generadorId && q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = generadorId
          ? `/api/fincas/buscar?generador=${encodeURIComponent(generadorId)}&q=${encodeURIComponent(q)}`
          : `/api/fincas/buscar?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, generadorId]);

  const placeholder = generadorId
    ? "Selecciona o filtra fincas..."
    : "Buscar finca por nombre (mín 2 caracteres)";

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Finca
      </label>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-green-50">
          <span className="text-sm text-gray-800 flex-1 font-medium">
            {value.nombre}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-gray-500 hover:text-red-600 text-sm"
            aria-label="Quitar finca"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
          {open && (generadorId || q.length >= 2) && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-xs text-gray-400">Buscando...</div>
              ) : results.length === 0 ? (
                <div className="p-2 text-xs text-gray-400">Sin resultados</div>
              ) : (
                results.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onChange({ id: f.id, nombre: f.nombre });
                      setQ("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-800">
                      {f.nombre}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------- MultiSelectChips -------------------- */

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
