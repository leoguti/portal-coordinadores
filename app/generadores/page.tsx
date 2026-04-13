"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import type { Generador } from "@/app/api/generadores/route";

export default function GeneradoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [generadores, setGeneradores] = useState<Generador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGeneradores = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      const res = await fetch(`/api/generadores?${params}`);
      const data = await res.json();
      setGeneradores(data.generadores || []);
    } catch {
      setGeneradores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (status === "authenticated") fetchGeneradores("");
  }, [status, fetchGeneradores]);

  // Buscar con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      fetchGeneradores(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, fetchGeneradores]);

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  const esAdmin =
    session.user?.rol === "Administrador" || session.user?.rol === "Supervisor";

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Generadores</h1>
            <p className="text-sm text-gray-500 mt-1">
              {esAdmin
                ? "Todos los generadores registrados"
                : "Generadores vinculados a tus certificados"}
            </p>
          </div>
          <div className="text-sm text-gray-400">
            {!loading && (
              <span>
                {generadores.length} resultado{generadores.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        ) : generadores.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-400 text-lg">
              {search ? "Sin resultados para tu búsqueda" : "No tienes generadores registrados"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cédula / NIT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cultivo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Certificados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {generadores.map((g) => (
                  <tr
                    key={g.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/generadores/${g.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-green-700 hover:underline">
                      {g.nombre}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.cedula || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.municipio || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.cultivo || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          g.conteo_certificados > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {g.conteo_certificados}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
