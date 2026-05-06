"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdmin } from "@/lib/roles";

interface Coord {
  id: string;
  name: string;
  email: string;
  rol: string;
  telefono: string;
  puntosLogisticosCount: number;
}

interface MetaMensualRow {
  id: string | null;
  año: number;
  mes: number;
  metaRecoleccion: number;
  metaSensibilizacion: number;
  metaEvaluaciones: number;
}

interface PuntoLogistico {
  id: string;
  nombre: string;
  tipo: string;
  municipio: string;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ROLES = ["Coordinador", "Supervisor", "Administrador", "Desactivado"];

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

export default function AdminCoordinadorDetallePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [coord, setCoord] = useState<Coord | null>(null);
  const [loadingCoord, setLoadingCoord] = useState(true);
  const [savingCoord, setSavingCoord] = useState(false);
  const [coordMsg, setCoordMsg] = useState<string | null>(null);

  // Form state for basic fields
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fTel, setFTel] = useState("");
  const [fRol, setFRol] = useState("Coordinador");

  // Metas mensuales
  const currentYear = new Date().getFullYear();
  const [añoMetas, setAñoMetas] = useState(currentYear);
  const [metas, setMetas] = useState<MetaMensualRow[]>([]);
  const [loadingMetas, setLoadingMetas] = useState(true);
  const [savingMetas, setSavingMetas] = useState(false);
  const [metasMsg, setMetasMsg] = useState<string | null>(null);

  // Puntos logísticos
  const [puntos, setPuntos] = useState<PuntoLogistico[]>([]);
  const [loadingPuntos, setLoadingPuntos] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<PuntoLogistico[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadCoord = useCallback(async () => {
    setLoadingCoord(true);
    try {
      const res = await fetch(`/api/admin/coordinadores/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCoord(data);
        setFName(data.name);
        setFEmail(data.email);
        setFTel(data.telefono);
        setFRol(data.rol);
      }
    } finally {
      setLoadingCoord(false);
    }
  }, [id]);

  const loadMetas = useCallback(async () => {
    setLoadingMetas(true);
    try {
      const res = await fetch(
        `/api/admin/coordinadores/${id}/metas-mensuales?año=${añoMetas}`
      );
      if (res.ok) {
        const data = await res.json();
        setMetas(data.metas);
      }
    } finally {
      setLoadingMetas(false);
    }
  }, [id, añoMetas]);

  const loadPuntos = useCallback(async () => {
    setLoadingPuntos(true);
    try {
      const res = await fetch(`/api/admin/coordinadores/${id}/puntos-logisticos`);
      if (res.ok) {
        const data = await res.json();
        setPuntos(data.items);
      }
    } finally {
      setLoadingPuntos(false);
    }
  }, [id]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin(session?.user?.rol)) return;
    loadCoord();
    loadPuntos();
  }, [status, session, loadCoord, loadPuntos]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin(session?.user?.rol)) return;
    loadMetas();
  }, [status, session, loadMetas]);

  // Búsqueda de puntos para vincular
  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/coordinadores/${id}/puntos-logisticos/buscar?q=${encodeURIComponent(searchQ.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, id]);

  async function saveCoord(e: React.FormEvent) {
    e.preventDefault();
    setSavingCoord(true);
    setCoordMsg(null);
    try {
      const res = await fetch(`/api/admin/coordinadores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fName,
          email: fEmail,
          telefono: fTel,
          rol: fRol,
        }),
      });
      if (res.ok) {
        setCoordMsg("Guardado.");
        await loadCoord();
      } else {
        const data = await res.json().catch(() => ({}));
        setCoordMsg(data.error || "Error al guardar");
      }
    } finally {
      setSavingCoord(false);
      setTimeout(() => setCoordMsg(null), 3000);
    }
  }

  async function saveMetas() {
    setSavingMetas(true);
    setMetasMsg(null);
    try {
      const res = await fetch(`/api/admin/coordinadores/${id}/metas-mensuales`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          año: añoMetas,
          metas: metas.map((m) => ({
            id: m.id,
            mes: m.mes,
            metaRecoleccion: m.metaRecoleccion,
            metaSensibilizacion: m.metaSensibilizacion,
            metaEvaluaciones: m.metaEvaluaciones,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetasMsg(
          `Guardado. ${data.created} creados, ${data.updated} actualizados.`
        );
        await loadMetas();
      } else {
        const data = await res.json().catch(() => ({}));
        setMetasMsg(data.error || "Error al guardar");
      }
    } finally {
      setSavingMetas(false);
      setTimeout(() => setMetasMsg(null), 4000);
    }
  }

  async function vincularPunto(puntoId: string) {
    const res = await fetch(`/api/admin/coordinadores/${id}/puntos-logisticos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puntoId }),
    });
    if (res.ok) {
      setSearchQ("");
      setSearchResults([]);
      await loadPuntos();
    }
  }

  async function desvincularPunto(puntoId: string) {
    if (!confirm("¿Desvincular este punto del coordinador?")) return;
    const res = await fetch(
      `/api/admin/coordinadores/${id}/puntos-logisticos/${puntoId}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadPuntos();
  }

  function updateMeta(
    mes: number,
    field: "metaRecoleccion" | "metaSensibilizacion" | "metaEvaluaciones",
    value: number
  ) {
    setMetas((prev) =>
      prev.map((m) => (m.mes === mes ? { ...m, [field]: value } : m))
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084]" />
      </div>
    );
  }
  if (!session) return null;

  if (!isAdmin(session.user?.rol)) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
            Acceso restringido a administradores.
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const totalRec = metas.reduce((s, m) => s + (m.metaRecoleccion || 0), 0);
  const totalSens = metas.reduce((s, m) => s + (m.metaSensibilizacion || 0), 0);
  const totalEval = metas.reduce((s, m) => s + (m.metaEvaluaciones || 0), 0);

  const yearOptions = Array.from({ length: currentYear - 2024 + 2 }, (_, i) => 2024 + i);

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href="/admin/coordinadores"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver a la lista
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {loadingCoord ? "Cargando..." : coord?.name || "Coordinador"}
          </h1>
          <p className="text-sm text-gray-500">{coord?.email}</p>
        </div>

        {/* BLOQUE 1: Datos básicos */}
        <form
          onSubmit={saveCoord}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Datos básicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre
              </label>
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={fEmail}
                onChange={(e) => setFEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Teléfono
              </label>
              <input
                value={fTel}
                onChange={(e) => setFTel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Rol
              </label>
              <select
                value={fRol}
                onChange={(e) => setFRol(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savingCoord}
              className="bg-[#00d084] hover:bg-[#00b872] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {savingCoord ? "Guardando..." : "Guardar"}
            </button>
            {coordMsg && (
              <span className="text-xs text-gray-600">{coordMsg}</span>
            )}
          </div>
        </form>

        {/* BLOQUE 2: Metas mensuales (sólo aplica a rol Coordinador) */}
        {fRol === "Coordinador" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Metas mensuales
            </h2>
            <select
              value={añoMetas}
              onChange={(e) => setAñoMetas(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {loadingMetas ? (
            <div className="text-center text-gray-400 py-6">Cargando metas...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2.5 font-semibold text-gray-600 w-32">
                        Mes
                      </th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">
                        Recolección (kg)
                      </th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">
                        Sensibilización (personas)
                      </th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">
                        Evaluaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metas.map((m) => (
                      <tr key={m.mes} className="border-b last:border-0">
                        <td className="p-2.5 font-medium">{MESES[m.mes - 1]}</td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={m.metaRecoleccion}
                            onChange={(e) =>
                              updateMeta(m.mes, "metaRecoleccion", Number(e.target.value) || 0)
                            }
                            className="w-32 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={m.metaSensibilizacion}
                            onChange={(e) =>
                              updateMeta(m.mes, "metaSensibilizacion", Number(e.target.value) || 0)
                            }
                            className="w-32 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={m.metaEvaluaciones}
                            onChange={(e) =>
                              updateMeta(m.mes, "metaEvaluaciones", Number(e.target.value) || 0)
                            }
                            className="w-32 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="p-2.5">TOTAL AÑO</td>
                      <td className="p-2.5 text-right">{fmt(totalRec)}</td>
                      <td className="p-2.5 text-right">{fmt(totalSens)}</td>
                      <td className="p-2.5 text-right">{fmt(totalEval)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveMetas}
                  disabled={savingMetas}
                  className="bg-[#00d084] hover:bg-[#00b872] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {savingMetas ? "Guardando..." : `Guardar metas ${añoMetas}`}
                </button>
                {metasMsg && (
                  <span className="text-xs text-gray-600">{metasMsg}</span>
                )}
              </div>
            </>
          )}
        </div>
        )}

        {/* BLOQUE 3: Puntos Logísticos vinculados */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Puntos logísticos vinculados ({puntos.length})
          </h2>

          <div className="mb-4 relative">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar punto logístico para vincular (mín. 2 letras)..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {searchQ.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {searching ? (
                  <div className="p-3 text-sm text-gray-400">Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">Sin resultados.</div>
                ) : (
                  searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => vincularPunto(p.id)}
                      className="block w-full text-left p-3 hover:bg-green-50 border-b last:border-0"
                    >
                      <div className="font-medium text-sm">{p.nombre}</div>
                      <div className="text-xs text-gray-500">
                        {p.tipo} {p.municipio ? `· ${p.municipio}` : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {loadingPuntos ? (
            <div className="text-center text-gray-400 py-6">Cargando puntos...</div>
          ) : puntos.length === 0 ? (
            <div className="text-center text-gray-400 py-6">
              Sin puntos vinculados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Nombre</th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Tipo</th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Municipio</th>
                    <th className="p-2.5 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {puntos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-2.5 font-medium">{p.nombre}</td>
                      <td className="p-2.5 text-gray-600">{p.tipo}</td>
                      <td className="p-2.5 text-gray-600">{p.municipio}</td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => desvincularPunto(p.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
