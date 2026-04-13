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
      const raw: Generador[] = data.generadores || [];

      function nitPrefix(cedula: string) {
        const d = cedula.replace(/\D/g, "");
        return d.length >= 5 ? d.slice(0, -1) : cedula;
      }

      const byPrefix = new Map<string, Generador[]>();
      for (const g of raw) {
        const key = g.cedula ? nitPrefix(g.cedula) : `__${g.id}`;
        if (!byPrefix.has(key)) byPrefix.set(key, []);
        byPrefix.get(key)!.push(g);
      }
      for (const members of byPrefix.values()) {
        members.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      }
      const grupos = [...byPrefix.values()].sort((a, b) =>
        a[0].nombre.localeCompare(b[0].nombre, "es")
      );
      setGeneradores(grupos.flat());
    } catch {
      setGeneradores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchGeneradores("");
  }, [status, fetchGeneradores]);

  useEffect(() => {
    const t = setTimeout(() => fetchGeneradores(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput, fetchGeneradores]);

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">Ordenadas por nombre A→Z, mismo NIT agrupado</p>
          </div>
          {!loading && (
            <span className="text-sm text-gray-400">
              {generadores.length} finca{generadores.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mb-5">
          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        ) : generadores.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-400 text-lg">
              {searchInput ? "Sin resultados" : "No hay fincas registradas"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cédula / NIT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dirección</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Certs</th>
                  <th className="w-16 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {generadores.map((g) => (
                  <tr
                    key={g.id}
                    className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/generadores/${g.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-green-700">{g.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{g.cedula || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px]">
                      <div className="truncate" title={g.direccion}>{g.direccion || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.municipio || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${g.conteo_certificados > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {g.conteo_certificados}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/generadores/${g.id}/editar`}
                        className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2 py-1 rounded transition-colors"
                      >
                        Editar
                      </Link>
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
