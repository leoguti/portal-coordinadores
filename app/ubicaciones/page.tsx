"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import Link from "next/link";

interface Ubicacion {
  id: string;
  nombre: string;
  cedula: string;
  direccion: string;
  municipio: string;
  mundep: string;
  cultivo: string;
  email: string;
  movil: string;
  tipo: string;
  conteo_certificados: number;
}

export default function UbicacionesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [inputQ, setInputQ] = useState("");
  const [sort, setSort] = useState<"conteo" | "nombre" | "municipio">("conteo");
  const [sinCertificado, setSinCertificado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchUbicaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort, pageSize: "100" });
      if (q.length >= 2) params.set("q", q);
      const res = await fetch(`/api/ubicaciones?${params}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setUbicaciones(data.ubicaciones ?? []);
    } catch {
      setError("No se pudo cargar la lista de generadores.");
    } finally {
      setLoading(false);
    }
  }, [q, sort]);

  useEffect(() => {
    if (status === "authenticated") fetchUbicaciones();
  }, [status, fetchUbicaciones]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(inputQ), 400);
    return () => clearTimeout(t);
  }, [inputQ]);

  if (status === "loading") return null;

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Generadores</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ubicaciones registradas ·{" "}
              {sinCertificado
                ? `${ubicaciones.filter((u) => u.conteo_certificados === 0).length} sin certificado`
                : `${ubicaciones.length} resultados`}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder="Buscar por nombre, cédula, municipio o cultivo..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
          >
            <option value="conteo">Ordenar: más certificados</option>
            <option value="nombre">Ordenar: nombre A-Z</option>
            <option value="municipio">Ordenar: municipio A-Z</option>
          </select>
          <button
            onClick={() => setSinCertificado((v) => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              sinCertificado
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Sin certificados
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : (() => {
          const visibles = sinCertificado
            ? ubicaciones.filter((u) => u.conteo_certificados === 0)
            : ubicaciones;
          return visibles.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {sinCertificado
                ? "Todas las ubicaciones tienen al menos un certificado."
                : q
                ? "Sin resultados para la búsqueda."
                : "No hay generadores registrados."}
            </div>
          ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Cédula</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Municipio</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Cultivo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Teléfono</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Certificados</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibles.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.nombre || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{u.cedula || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{u.mundep || u.municipio || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{u.cultivo || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{u.movil || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${
                            u.conteo_certificados >= 10
                              ? "bg-green-100 text-green-700"
                              : u.conteo_certificados >= 1
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {u.conteo_certificados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/ubicaciones/${u.id}/editar`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#042726] text-white text-xs rounded-lg hover:bg-[#064340] transition-colors"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}
      </div>
    </AuthenticatedLayout>
  );
}
