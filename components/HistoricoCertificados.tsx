"use client";

/**
 * Vista de histórico de certificados (snapshots desde Postgres + R2).
 * Consolidada en /certificados como tab "Histórico". El endpoint
 * /api/admin/certificados-historicos diferencia por rol: el coordinador
 * solo ve los suyos, admin/supervisor ven todos.
 */

import { useCallback, useEffect, useState } from "react";

interface Stats {
  minFecha: string | null;
  maxFecha: string | null;
  total: number;
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function fmtMesAno(iso: string | null): string {
  if (!iso) return "";
  // iso = "YYYY-MM-DD" (sin zona horaria; no usar Date para evitar shifts)
  const [y, m] = iso.split("-");
  const mi = parseInt(m || "0", 10) - 1;
  if (mi < 0 || mi > 11 || !y) return "";
  return `${MESES_ES[mi]} de ${y}`;
}

// El total viene de Postgres como numeric → node-pg lo serializa como string
// ("485.000"). Lo mostramos como kilos enteros con el mismo formato que el PDF
// ("485 kg"), igual que la columna "Total (kg)" del listado actual.
function fmtKilos(total: number | string | null): string {
  if (total == null) return "—";
  const n = Number(total);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)} kg`;
}

interface Certificado {
  id: string;
  consecutivo: number | null;
  nombregenerador: string | null;
  cedulagenerador: string | null;
  municipiodevolucion: string | null;
  fechadevolucion: string | null;
  ano: number | null;
  total: number | string | null;
  triplelavado: string | null;
  certificadopdf_r2_url: string | null;
  certificadopdf_filename: string | null;
}

interface ApiResponse {
  total: number;
  page: number;
  pages: number;
  results: Certificado[];
}

const AÑOS = ["", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];

export default function HistoricoCertificados() {
  const [q, setQ] = useState("");
  const [ano, setAno] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/certificados-historicos/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStats(j))
      .catch(() => {});
  }, []);

  const buscar = useCallback(
    async (p = 1) => {
      setLoading(true);
      setSearched(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (ano) params.set("ano", ano);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      params.set("page", String(p));

      try {
        const res = await fetch(
          `/api/admin/certificados-historicos?${params}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || `Error ${res.status}`);
          setData(null);
        } else {
          setError(null);
          setData(json);
        }
        setPage(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de conexión");
        setData(null);
      }
      setLoading(false);
    },
    [q, ano, desde, hasta]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    buscar(1);
  };

  return (
    <>
      {/* Banner explicativo */}
      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">💡</div>
          <div className="text-sm">
            <p className="font-semibold text-amber-900 mb-1">
              Histórico de certificados (snapshots)
            </p>
            <p className="text-amber-900/90 mb-2">
              Aquí están los certificados de <strong>años anteriores</strong> que ya no aparecen en el listado actual.
              {stats && stats.minFecha && stats.maxFecha && (
                <>
                  {" "}Cubre <strong>{stats.total.toLocaleString("es-CO")}</strong> certificados desde{" "}
                  <strong>{fmtMesAno(stats.minFecha)}</strong> hasta{" "}
                  <strong>{fmtMesAno(stats.maxFecha)}</strong>.
                </>
              )}
            </p>
            <p className="text-amber-900/80 mb-2">
              Cada registro es un <strong>snapshot</strong>: una copia
              completa del certificado guardada en nuestro respaldo, con su
              PDF original. Los certificados nuevos también se respaldan
              automáticamente al generarse.
            </p>
            <p className="text-amber-900/80">
              <strong>¿Para qué sirve?</strong> Para descargar el PDF o
              consultar datos de un certificado antiguo que ya no aparece
              en el listado de arriba.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex flex-wrap gap-4 items-end"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Nombre, cédula o consecutivo
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Año
          </label>
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {AÑOS.map((a) => (
              <option key={a} value={a}>
                {a || "Todos"}
              </option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Desde (fecha)
          </label>
          <input
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Hasta (fecha)
          </label>
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#042726] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#032120] disabled:opacity-50 transition-colors"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {!searched && (
        <p className="text-gray-500 text-sm text-center py-12">
          Busca por nombre, cédula, consecutivo o año para consultar el
          histórico.
        </p>
      )}

      {searched && data && (
        <>
          <div className="mb-3">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">
                {data.total.toLocaleString()}
              </span>{" "}
              certificados
              {data.pages > 1 && ` — página ${data.page} de ${data.pages}`}
            </p>
          </div>

          {data.results.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
              No se encontraron certificados.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600 w-16">
                      #
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Generador
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Cédula
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Municipio
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Fecha
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">
                      Año
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">
                      Total (kg)
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">
                      PDF
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.results.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {c.consecutivo ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px]">
                        <div className="truncate" title={c.nombregenerador ?? ""}>
                          {c.nombregenerador || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {c.cedulagenerador || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px]">
                        <div className="truncate" title={c.municipiodevolucion ?? ""}>
                          {c.municipiodevolucion || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {c.fechadevolucion
                          ? new Date(c.fechadevolucion).toLocaleDateString(
                              "es-CO",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.ano ? (
                          <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-mono">
                            {c.ano}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 whitespace-nowrap">
                        {fmtKilos(c.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.certificadopdf_r2_url ? (
                          <a
                            href={c.certificadopdf_r2_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-700 hover:text-green-900 font-medium"
                          >
                            PDF
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => buscar(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-600">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => buscar(page + 1)}
                disabled={page === data.pages || loading}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
