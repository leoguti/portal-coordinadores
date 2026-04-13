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

  // Selección para fusionar
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Confirmación de fusión
  const [confirmando, setConfirmando] = useState(false);
  const [fusionando, setFusionando] = useState(false);
  const [fusionResult, setFusionResult] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGeneradores = useCallback(async (q: string) => {
    setLoading(true);
    setSelected(new Set());
    setConfirmando(false);
    setFusionResult(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      // Ordenar por cédula para que los del mismo NIT queden juntos
      params.set("sort", "cedula");
      const res = await fetch(`/api/generadores?${params}`);
      const data = await res.json();
      // Sort client-side by cedula so same NIT appears together
      const lista: Generador[] = (data.generadores || []).sort((a: Generador, b: Generador) =>
        (a.cedula || "").localeCompare(b.cedula || "")
      );
      setGeneradores(lista);
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConfirmando(false);
    setFusionResult(null);
  };

  const selectedList = generadores.filter((g) => selected.has(g.id));
  // El principal es el que tiene más certificados
  const principal = [...selectedList].sort((a, b) => b.conteo_certificados - a.conteo_certificados)[0];
  const aEliminar = selectedList.filter((g) => g.id !== principal?.id);

  const ejecutarFusion = async () => {
    if (!principal || aEliminar.length === 0) return;
    setFusionando(true);
    setFusionResult(null);
    try {
      for (const dup of aEliminar) {
        const res = await fetch(`/api/generadores/${dup.id}/fusionar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ principalId: principal.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      }
      setFusionResult(`✓ Fusionado. ${aEliminar.length} registro${aEliminar.length > 1 ? "s eliminados" : " eliminado"}.`);
      const eliminados = new Set(aEliminar.map((d) => d.id));
      setGeneradores((prev) => prev.filter((g) => !eliminados.has(g.id)));
      setSelected(new Set());
      setConfirmando(false);
    } catch (e) {
      setFusionResult("Error: " + (e instanceof Error ? e.message : e));
    } finally {
      setFusionando(false);
    }
  };

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
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">Ordenadas por NIT/cédula</p>
          </div>
          {!loading && (
            <span className="text-sm text-gray-400">
              {generadores.length} finca{generadores.length !== 1 ? "s" : ""}
            </span>
          )}
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

        {/* Barra de fusión */}
        {selected.size >= 2 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            {!confirmando ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-800">
                  <span className="font-semibold">{selected.size} fincas</span> seleccionadas
                </span>
                <button
                  onClick={() => setConfirmando(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Fusionar seleccionadas
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-800">Confirmar fusión:</p>
                <div className="text-sm text-gray-700">
                  <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium mr-1">QUEDA</span>
                  {principal.nombre}
                  <span className="text-gray-400 ml-2 text-xs font-mono">{principal.cedula}</span>
                  <span className="text-gray-400 ml-2 text-xs">({principal.conteo_certificados} certs)</span>
                </div>
                {aEliminar.map((g) => (
                  <div key={g.id} className="text-sm text-gray-700">
                    <span className="inline-block bg-red-100 text-red-600 px-2 py-0.5 rounded font-medium mr-1">SE ELIMINA</span>
                    {g.nombre}
                    <span className="text-gray-400 ml-2 text-xs font-mono">{g.cedula}</span>
                    <span className="text-gray-400 ml-2 text-xs">({g.conteo_certificados} certs → pasan a la principal)</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={ejecutarFusion}
                    disabled={fusionando}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {fusionando ? "Fusionando..." : "Confirmar y fusionar"}
                  </button>
                  <button
                    onClick={() => setConfirmando(false)}
                    className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado fusión */}
        {fusionResult && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${fusionResult.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {fusionResult}
          </div>
        )}

        {/* Tabla */}
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
                  <th className="w-10 px-3 py-3" />
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cédula / NIT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dirección</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Certs</th>
                </tr>
              </thead>
              <tbody>
                {generadores.map((g) => {
                  const isSelected = selected.has(g.id);
                  return (
                    <tr
                      key={g.id}
                      className={`border-t border-gray-100 transition-colors ${isSelected ? "bg-amber-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(g.id)}
                          className="w-4 h-4 accent-amber-600 cursor-pointer"
                        />
                      </td>
                      <td
                        className="px-4 py-3 font-medium text-green-700 cursor-pointer hover:underline"
                        onClick={() => router.push(`/generadores/${g.id}`)}
                      >
                        {g.nombre}
                      </td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
