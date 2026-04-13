"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Miembro {
  id: string;
  nombre: string;
  cedula: string;
  municipio: string;
  cultivo: string;
  conteo: number;
}

interface Grupo {
  prefix: string;
  members: Miembro[];
  totalCerts: number;
}

export default function DuplicadosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [totalUbicaciones, setTotalUbicaciones] = useState(0);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // principalId seleccionado por grupo: { [prefix]: id }
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  // fusionando: { [prefix]: "loading" | "done" | "error" }
  const [fusionando, setFusionando] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const buscarDuplicados = async () => {
    setLoading(true);
    setBuscado(true);
    setError(null);
    setGrupos([]);
    setSeleccion({});
    setFusionando({});

    try {
      const res = await fetch("/api/generadores/duplicados");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`);
      } else {
        setGrupos(json.grupos);
        setTotalUbicaciones(json.total);
        // Preseleccionar el de más certificados como principal
        const sel: Record<string, string> = {};
        for (const g of json.grupos) {
          sel[g.prefix] = g.members[0].id; // ya viene ordenado desc por conteo
        }
        setSeleccion(sel);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    }
    setLoading(false);
  };

  const fusionar = async (grupo: Grupo) => {
    const principalId = seleccion[grupo.prefix];
    if (!principalId) return;

    const duplicados = grupo.members.filter((m) => m.id !== principalId);
    if (duplicados.length === 0) return;

    setFusionando((prev) => ({ ...prev, [grupo.prefix]: "loading" }));

    try {
      // Fusionar uno a uno si hay más de un duplicado
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
      // Quitar el grupo de la lista
      setGrupos((prev) => prev.filter((g) => g.prefix !== grupo.prefix));
    } catch (e) {
      setFusionando((prev) => ({ ...prev, [grupo.prefix]: "error: " + (e instanceof Error ? e.message : e) }));
    }
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
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Posibles Duplicados</h1>
            <p className="text-sm text-gray-500 mt-1">
              Fincas agrupadas por NIT/cédula similar (ignorando el último dígito).
            </p>
          </div>
          <button
            onClick={buscarDuplicados}
            disabled={loading}
            className="bg-[#042726] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#032120] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⟳</span>
                Analizando...
              </>
            ) : (
              "Buscar duplicados"
            )}
          </button>
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4 text-sm text-blue-700">
            Leyendo todas las fincas de Airtable... esto puede tardar 20-30 segundos.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        {buscado && !loading && !error && (
          <div className="mt-4 mb-6 text-sm text-gray-600">
            Analizadas <span className="font-semibold">{totalUbicaciones.toLocaleString()}</span> fincas
            {" — "}
            <span className="font-semibold text-amber-700">{grupos.length}</span> grupos con posibles duplicados
          </div>
        )}

        <div className="space-y-4">
          {grupos.map((grupo) => {
            const estado = fusionando[grupo.prefix];
            const principalId = seleccion[grupo.prefix];

            return (
              <div
                key={grupo.prefix}
                className={`bg-white rounded-xl border p-4 ${
                  estado === "done"
                    ? "border-green-200 opacity-60"
                    : estado?.startsWith("error")
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
              >
                {/* Header del grupo */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400 font-mono">
                    NIT/Cédula prefix: <span className="text-gray-600">{grupo.prefix}*</span>
                    {" · "}
                    {grupo.totalCerts} certificados en total
                  </div>
                  {estado === "done" ? (
                    <span className="text-xs text-green-600 font-medium">✓ Fusionado</span>
                  ) : estado === "loading" ? (
                    <span className="text-xs text-blue-600 animate-pulse">Fusionando...</span>
                  ) : estado?.startsWith("error") ? (
                    <span className="text-xs text-red-600">{estado}</span>
                  ) : (
                    <button
                      onClick={() => fusionar(grupo)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Fusionar → mantener seleccionada
                    </button>
                  )}
                </div>

                {/* Miembros del grupo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grupo.members.map((m) => {
                    const isPrincipal = principalId === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isPrincipal
                            ? "border-green-400 bg-green-50"
                            : "border-gray-200 hover:border-gray-300 bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`principal-${grupo.prefix}`}
                          value={m.id}
                          checked={isPrincipal}
                          onChange={() =>
                            setSeleccion((prev) => ({ ...prev, [grupo.prefix]: m.id }))
                          }
                          className="mt-0.5 accent-green-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {m.nombre}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="font-mono">{m.cedula}</span>
                            {m.municipio && ` · ${m.municipio}`}
                          </div>
                          {m.cultivo && (
                            <div className="text-xs text-gray-400">{m.cultivo}</div>
                          )}
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isPrincipal
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {m.conteo} certificados
                            </span>
                            {isPrincipal && (
                              <span className="text-xs text-green-600 font-medium">
                                ← QUEDA
                              </span>
                            )}
                            {!isPrincipal && (
                              <span className="text-xs text-red-500">← se elimina</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {buscado && !loading && grupos.length === 0 && !error && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center text-green-700 font-medium mt-4">
            ✓ No se encontraron posibles duplicados
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
