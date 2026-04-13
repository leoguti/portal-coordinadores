"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import type { Generador } from "@/app/api/generadores/route";

function nitPrefix(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return "";
  return digits.slice(0, -1);
}

interface Grupo {
  prefix: string;
  members: Generador[]; // sorted: most certs first
}

function agrupar(list: Generador[]): { grupos: Map<string, Grupo>; orden: string[] } {
  const grupos = new Map<string, Grupo>();
  const orden: string[] = [];

  for (const g of list) {
    const p = g.cedula ? nitPrefix(g.cedula) : "";
    const key = p || `__single_${g.id}`;
    if (!grupos.has(key)) {
      grupos.set(key, { prefix: p, members: [] });
      orden.push(key);
    }
    grupos.get(key)!.members.push(g);
  }

  // Sort members within each group: most certs first
  for (const g of grupos.values()) {
    g.members.sort((a, b) => b.conteo_certificados - a.conteo_certificados);
  }

  return { grupos, orden };
}

/** Default: all members except the first (most certs) are checked to be eliminated */
function defaultChecked(members: Generador[]): Set<string> {
  return new Set(members.slice(1).map((m) => m.id));
}

export default function GeneradoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [generadores, setGeneradores] = useState<Generador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  // Expanded groups
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Checked (to eliminate) per group: { [key]: Set<id> }
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});
  // Merge state
  const [fusionando, setFusionando] = useState<Record<string, "loading" | "done" | string>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGeneradores = useCallback(async (q: string) => {
    setLoading(true);
    setExpanded(new Set());
    setChecked({});
    setFusionando({});
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      const res = await fetch(`/api/generadores?${params}`);
      const data = await res.json();
      const lista: Generador[] = data.generadores || [];
      setGeneradores(lista);

      const { grupos, orden } = agrupar(lista);
      const newExpanded = new Set<string>();
      const newChecked: Record<string, Set<string>> = {};
      for (const key of orden) {
        const g = grupos.get(key)!;
        if (g.members.length >= 2) {
          newExpanded.add(key);
          newChecked[key] = defaultChecked(g.members);
        }
      }
      setExpanded(newExpanded);
      setChecked(newChecked);
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

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleCheck = (key: string, id: string, members: Generador[]) => {
    setChecked((prev) => {
      const current = new Set(prev[key] || []);
      // Can't uncheck if it would leave 0 unchecked (need at least 1 principal)
      const wouldUncheck = current.has(id);
      if (wouldUncheck && current.size === members.length - 1) return prev; // can't uncheck all
      if (wouldUncheck) current.delete(id);
      else current.add(id);
      return { ...prev, [key]: current };
    });
  };

  const fusionar = async (key: string, grupo: Grupo) => {
    const toDelete = [...(checked[key] || [])];
    if (!toDelete.length) return;

    // Principal = first unchecked member (most certs among unchecked)
    const principal = grupo.members.find((m) => !checked[key]?.has(m.id));
    if (!principal) return;

    setFusionando((prev) => ({ ...prev, [key]: "loading" }));
    try {
      for (const dupId of toDelete) {
        const res = await fetch(`/api/generadores/${dupId}/fusionar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ principalId: principal.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      }
      setFusionando((prev) => ({ ...prev, [key]: "done" }));
      const eliminados = new Set(toDelete);
      setGeneradores((prev) => prev.filter((g) => !eliminados.has(g.id)));
    } catch (e) {
      setFusionando((prev) => ({
        ...prev,
        [key]: "error: " + (e instanceof Error ? e.message : e),
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

  const true = session.user?.rol === "Administrador" || session.user?.rol === "Supervisor";
  const { grupos, orden } = agrupar(generadores);
  const totalDuplicados = orden.filter((k) => (grupos.get(k)?.members.length ?? 0) >= 2).length;

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">
              {true ? "Todas las fincas registradas" : "Fincas vinculadas a tus certificados"}
            </p>
          </div>
          {!loading && (
            <span className="text-sm text-gray-400">
              {generadores.length} finca{generadores.length !== 1 ? "s" : ""}
              {totalDuplicados > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {totalDuplicados} grupo{totalDuplicados !== 1 ? "s" : ""} duplicado{totalDuplicados !== 1 ? "s" : ""}
                </span>
              )}
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
                  {true && <th className="w-24 px-3 py-3 text-xs text-gray-400 font-medium text-center">Eliminar</th>}
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cédula / NIT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cultivo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Certs</th>
                </tr>
              </thead>
              <tbody>
                {orden.map((key) => {
                  const grupo = grupos.get(key)!;
                  const isDuplicate = grupo.members.length >= 2;

                  if (!isDuplicate) {
                    const g = grupo.members[0];
                    return (
                      <tr
                        key={key}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/generadores/${g.id}`)}
                      >
                        {true && <td className="px-3" />}
                        <td className="px-4 py-3 font-medium text-green-700">{g.nombre}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{g.cedula || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{g.municipio || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{g.cultivo || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${g.conteo_certificados > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {g.conteo_certificados}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // ── GRUPO DUPLICADO ──
                  const isOpen = expanded.has(key);
                  const estado = fusionando[key];
                  const groupChecked = checked[key] || new Set<string>();
                  const totalCerts = grupo.members.reduce((s, m) => s + m.conteo_certificados, 0);
                  const checkedCount = groupChecked.size;

                  return [
                    // Fila encabezado desplegable
                    <tr
                      key={`${key}_header`}
                      className="border-t border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors select-none"
                      onClick={() => toggleExpand(key)}
                    >
                      {true && (
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {estado === "done" ? (
                            <span className="text-green-600 text-xs">✓</span>
                          ) : estado === "loading" ? (
                            <span className="text-blue-500 text-xs animate-spin inline-block">⟳</span>
                          ) : isOpen && checkedCount > 0 ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); fusionar(key, grupo); }}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-2 py-1 rounded transition-colors whitespace-nowrap"
                            >
                              Fusionar {checkedCount}
                            </button>
                          ) : null}
                        </td>
                      )}
                      <td className="px-4 py-2.5" colSpan={4}>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600 text-xs font-bold">{isOpen ? "▼" : "▶"}</span>
                          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                            Posible duplicado
                          </span>
                          <span className="text-xs text-amber-700">
                            NIT {grupo.prefix}* · {grupo.members.length} registros
                          </span>
                          {isOpen && true && (
                            <span className="text-xs text-gray-500 ml-2">
                              — Marca con ☑ los que quieres eliminar, luego pulsa Fusionar
                            </span>
                          )}
                          {estado?.startsWith("error") && (
                            <span className="text-xs text-red-600 ml-2">{estado}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs text-amber-700 font-semibold">{totalCerts}</span>
                      </td>
                    </tr>,

                    // Filas de miembros
                    ...(isOpen
                      ? grupo.members.map((m) => {
                          const isChecked = groupChecked.has(m.id);
                          const isPrincipal = !isChecked;
                          return (
                            <tr
                              key={m.id}
                              className={`border-t border-amber-100 transition-colors ${isChecked ? "bg-red-50" : "bg-green-50"}`}
                            >
                              {true && (
                                <td className="px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleCheck(key, m.id, grupo.members)}
                                    className="accent-red-500 w-4 h-4 cursor-pointer"
                                    title={isChecked ? "Se eliminará al fusionar" : "Es el principal (queda)"}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 pl-4">
                                  <Link
                                    href={`/generadores/${m.id}`}
                                    className="font-medium text-green-700 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {m.nombre}
                                  </Link>
                                  {true && isPrincipal && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">queda</span>
                                  )}
                                  {true && isChecked && (
                                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">se elimina</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{m.cedula || "—"}</td>
                              <td className="px-4 py-2.5 text-gray-600">{m.municipio || "—"}</td>
                              <td className="px-4 py-2.5 text-gray-600">{m.cultivo || "—"}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${m.conteo_certificados > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                  {m.conteo_certificados}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
