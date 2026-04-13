"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import type { Generador } from "@/app/api/generadores/route";

/** Strips non-digits and removes last digit → grouping key */
function nitPrefix(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return "";
  return digits.slice(0, -1);
}

interface Grupo {
  prefix: string;
  members: Generador[];
}

function agrupar(list: Generador[]): { grupos: Grupo[]; singles: Generador[] } {
  const byPrefix = new Map<string, Generador[]>();
  const sinNit: Generador[] = [];

  for (const g of list) {
    if (!g.cedula) { sinNit.push(g); continue; }
    const p = nitPrefix(g.cedula);
    if (!p) { sinNit.push(g); continue; }
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p)!.push(g);
  }

  const grupos: Grupo[] = [];
  const singles: Generador[] = [...sinNit];

  for (const [prefix, members] of byPrefix.entries()) {
    if (members.length >= 2) {
      // sort: más certificados primero (ése será el principal por defecto)
      grupos.push({ prefix, members: [...members].sort((a, b) => b.conteo_certificados - a.conteo_certificados) });
    } else {
      singles.push(...members);
    }
  }

  // singles por nombre
  singles.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { grupos, singles };
}

export default function GeneradoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [generadores, setGeneradores] = useState<Generador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  // Merge state: principalId por grupo, estado de fusión
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [fusionando, setFusionando] = useState<Record<string, "loading" | "done" | string>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGeneradores = useCallback(async (q: string) => {
    setLoading(true);
    setSeleccion({});
    setFusionando({});
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      const res = await fetch(`/api/generadores?${params}`);
      const data = await res.json();
      const lista: Generador[] = data.generadores || [];
      setGeneradores(lista);
      // preseleccionar principal por defecto (más certs)
      const { grupos } = agrupar(lista);
      const sel: Record<string, string> = {};
      for (const g of grupos) sel[g.prefix] = g.members[0].id;
      setSeleccion(sel);
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

  const fusionar = async (grupo: Grupo) => {
    const principalId = seleccion[grupo.prefix];
    if (!principalId) return;
    const duplicados = grupo.members.filter((m) => m.id !== principalId);
    if (!duplicados.length) return;

    setFusionando((prev) => ({ ...prev, [grupo.prefix]: "loading" }));
    try {
      for (const dup of duplicados) {
        const res = await fetch(`/api/generadores/${dup.id}/fusionar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ principalId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      }
      setFusionando((prev) => ({ ...prev, [grupo.prefix]: "done" }));
      // Quitar las duplicadas de la lista
      const eliminados = new Set(duplicados.map((d) => d.id));
      setGeneradores((prev) => prev.filter((g) => !eliminados.has(g.id)));
    } catch (e) {
      setFusionando((prev) => ({
        ...prev,
        [grupo.prefix]: "error: " + (e instanceof Error ? e.message : e),
      }));
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  const esAdmin = session.user?.rol === "Administrador" || session.user?.rol === "Supervisor";
  const { grupos, singles } = agrupar(generadores);

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">
              {esAdmin ? "Todas las fincas registradas" : "Fincas vinculadas a tus certificados"}
            </p>
          </div>
          {!loading && (
            <span className="text-sm text-gray-400">
              {generadores.length} finca{generadores.length !== 1 ? "s" : ""}
              {grupos.length > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {grupos.length} grupo{grupos.length !== 1 ? "s" : ""} duplicado{grupos.length !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Búsqueda */}
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
              {searchInput ? "Sin resultados para tu búsqueda" : "No hay fincas registradas"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ── GRUPOS DUPLICADOS ── */}
            {grupos.map((grupo) => {
              const estado = fusionando[grupo.prefix];
              const principalId = seleccion[grupo.prefix];
              const isDone = estado === "done";

              return (
                <div
                  key={grupo.prefix}
                  className={`rounded-xl border p-4 ${
                    isDone
                      ? "border-green-200 bg-green-50 opacity-70"
                      : estado?.startsWith("error")
                      ? "border-red-300 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  {/* Cabecera del grupo */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                      NIT/Cédula similar · {grupo.members.length} registros
                    </span>
                    {esAdmin && (
                      isDone ? (
                        <span className="text-xs text-green-600 font-medium">✓ Fusionado</span>
                      ) : estado === "loading" ? (
                        <span className="text-xs text-blue-600 animate-pulse">Fusionando...</span>
                      ) : estado?.startsWith("error") ? (
                        <span className="text-xs text-red-600">{estado}</span>
                      ) : (
                        <button
                          onClick={() => fusionar(grupo)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Fusionar → mantener seleccionada
                        </button>
                      )
                    )}
                  </div>

                  {/* Miembros */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {grupo.members.map((m) => {
                      const isPrincipal = principalId === m.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-3 p-3 rounded-lg border bg-white ${
                            isPrincipal ? "border-green-400" : "border-gray-200"
                          }`}
                        >
                          {esAdmin && (
                            <input
                              type="radio"
                              name={`principal-${grupo.prefix}`}
                              value={m.id}
                              checked={isPrincipal}
                              onChange={() =>
                                setSeleccion((prev) => ({ ...prev, [grupo.prefix]: m.id }))
                              }
                              className="mt-1 accent-green-600 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/generadores/${m.id}`}
                              className="font-medium text-sm text-green-700 hover:underline truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {m.nombre}
                            </Link>
                            <div className="text-xs text-gray-500 mt-0.5 font-mono">{m.cedula}</div>
                            <div className="text-xs text-gray-400">{m.municipio}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                isPrincipal ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                              }`}>
                                {m.conteo_certificados} certs
                              </span>
                              {esAdmin && isPrincipal && (
                                <span className="text-xs text-green-600 font-medium">QUEDA</span>
                              )}
                              {esAdmin && !isPrincipal && (
                                <span className="text-xs text-red-400">se elimina</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── SINGULARES (tabla normal) ── */}
            {singles.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {grupos.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Sin duplicados
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cédula / NIT</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cultivo</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Certs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {singles.map((g) => (
                      <tr
                        key={g.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/generadores/${g.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-green-700 hover:underline">
                          {g.nombre}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{g.cedula || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{g.municipio || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{g.cultivo || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            g.conteo_certificados > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}>
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
        )}
      </div>
    </AuthenticatedLayout>
  );
}
