"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Certificado {
  id: string;
  consecutivo: number | null;
  nombregenerador: string | null;
  cedulagenerador: string | null;
  municipiodevolucion: string | null;
  fechadevolucion: string | null;
  ano: number | null;
  nombrecoordinador: string | null;
  total: number | null;
  rigidos: number | null;
  flexibles: number | null;
  metalicos: number | null;
  embalaje: number | null;
  triplelavado: string | null;
  fuente: string | null;
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

export default function CertificadosHistoricosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [ano, setAno] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [coordinador, setCoordinador] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const buscar = useCallback(
    async (p = 1) => {
      setLoading(true);
      setSearched(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (ano) params.set("ano", ano);
      if (municipio) params.set("municipio", municipio);
      if (coordinador) params.set("coordinador", coordinador);
      params.set("page", String(p));

      try {
        const res = await fetch(`/api/admin/certificados-historicos?${params}`);
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
    [q, ano, municipio, coordinador]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    buscar(1);
  };

  if (status === "loading") return null;
  const rol = session?.user?.rol;
  if (rol !== "Administrador" && rol !== "Supervisor") {
    return (
      <AuthenticatedLayout>
        <div className="p-8 text-red-600 font-medium">Sin permisos para esta sección.</div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Certificados Históricos
        </h1>

        {/* Filtros */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nombre o cédula del generador / consecutivo
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
            <select
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {AÑOS.map((a) => (
                <option key={a} value={a}>
                  {a || "Todos los años"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Municipio de devolución
            </label>
            <input
              type="text"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              placeholder="Municipio..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Coordinador</label>
            <input
              type="text"
              value={coordinador}
              onChange={(e) => setCoordinador(e.target.value)}
              placeholder="Nombre del coordinador..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#042726] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#032120] disabled:opacity-50 transition-colors"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        {/* Resultados */}
        {!searched && (
          <p className="text-gray-500 text-sm text-center py-12">
            Ingresa criterios de búsqueda para consultar el histórico.
          </p>
        )}

        {searched && data && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{data.total.toLocaleString()}</span> certificados encontrados
                {data.pages > 1 && ` — página ${data.page} de ${data.pages}`}
              </p>
            </div>

            {data.results.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                No se encontraron certificados con esos criterios.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600 w-16">#</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Generador</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Cédula</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Municipio</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-center">Año</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Coordinador</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-center">PDF</th>
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
                        <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                          <div className="truncate" title={c.municipiodevolucion ?? ""}>
                            {c.municipiodevolucion || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {c.fechadevolucion
                            ? new Date(c.fechadevolucion).toLocaleDateString("es-CO", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
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
                        <td className="px-4 py-3 text-right font-mono text-gray-900">
                          {c.total ?? 0}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                          <div className="truncate" title={c.nombrecoordinador ?? ""}>
                            {c.nombrecoordinador || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.certificadopdf_r2_url ? (
                            <a
                              href={c.certificadopdf_r2_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium"
                              title={c.certificadopdf_filename ?? "Ver PDF"}
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

            {/* Paginación */}
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
      </div>
    </AuthenticatedLayout>
  );
}
