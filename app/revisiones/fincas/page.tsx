"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";

interface FincaRevision {
  ubicacionId: string;
  fincaId: string | null;
  original: {
    nombre: string;
    nit: string;
    direccion: string;
    municipio: string;
    cultivo: string;
    movil: string;
    email: string;
    tipo: string;
  };
  finca: {
    nombre: string;
    generadorId: string | null;
    municipioId: string | null;
    cultivoIds: string[];
    movil: string;
    email: string;
    revisado: boolean;
    notas: string;
  } | null;
}

interface Cultivo {
  id: string;
  nombre: string;
}

const TIPOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"];

function FlagBadge({ notas }: { notas: string }) {
  if (!notas) return null;
  const flags = notas.split("|").map((f) => f.trim());
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map((f, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {f.includes("SIN_MUNICIPIO") ? "Sin municipio" :
           f.includes("SIN_NOMBRE") ? "Sin nombre" :
           f.includes("NIT_RARO") ? "NIT raro" :
           f.includes("cultivo_no_mapeado") ? "Cultivo sin mapear" : f}
        </span>
      ))}
    </div>
  );
}

function EditPanel({
  item,
  cultivos,
  onSave,
  onClose,
}: {
  item: FincaRevision;
  cultivos: Cultivo[];
  onSave: (fincaId: string, data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState(item.finca?.nombre || item.original.direccion || "");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [selectedCultivos, setSelectedCultivos] = useState<string[]>(item.finca?.cultivoIds || []);
  const [movil, setMovil] = useState(item.finca?.movil || item.original.movil || "");
  const [email, setEmail] = useState(item.finca?.email || item.original.email || "");
  const [generadorNombre, setGeneradorNombre] = useState(item.original.nombre || "");
  const [generadorNit, setGeneradorNit] = useState(item.original.nit || "");
  const [generadorTipo, setGeneradorTipo] = useState(item.original.tipo || "AGRICOLA");
  const [saving, setSaving] = useState(false);
  const [showCultivos, setShowCultivos] = useState(false);

  // Pre-cargar municipio si ya tiene uno
  useEffect(() => {
    if (item.finca?.municipioId && item.original.municipio) {
      setMunicipio({ id: item.finca.municipioId, mundep: item.original.municipio });
    }
  }, [item]);

  const toggleCultivo = (id: string) => {
    setSelectedCultivos((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async (marcarRevisado: boolean) => {
    if (!item.fincaId) return;
    setSaving(true);
    await onSave(item.fincaId, {
      nombre,
      municipioId: municipio?.id || null,
      cultivoIds: selectedCultivos,
      movil,
      email,
      generadorId: item.finca?.generadorId,
      generadorNombre,
      generadorNit,
      generadorTipo,
      marcarRevisado,
    });
    setSaving(false);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Columna izquierda: datos originales */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Original (ubicacion)</h3>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-gray-400">Nombre:</span> <span className="text-gray-700">{item.original.nombre || "—"}</span></div>
            <div><span className="text-gray-400">NIT:</span> <span className="text-gray-700 font-mono">{item.original.nit || "—"}</span></div>
            <div><span className="text-gray-400">Dirección:</span> <span className="text-gray-700">{item.original.direccion || "—"}</span></div>
            <div><span className="text-gray-400">Municipio:</span> <span className="text-gray-700">{item.original.municipio || <span className="text-red-400">Sin municipio</span>}</span></div>
            <div><span className="text-gray-400">Cultivo:</span> <span className="text-gray-700">{item.original.cultivo || "—"}</span></div>
            <div><span className="text-gray-400">Móvil:</span> <span className="text-gray-700">{item.original.movil || "—"}</span></div>
            <div><span className="text-gray-400">Email:</span> <span className="text-gray-700">{item.original.email || "—"}</span></div>
          </div>
        </div>

        {/* Columna derecha: datos editables */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Nueva estructura (editar)</h3>
          <div className="space-y-3">

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Generador — Nombre</label>
              <input
                value={generadorNombre}
                onChange={(e) => setGeneradorNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">NIT / Cédula</label>
                <input
                  value={generadorNit}
                  onChange={(e) => setGeneradorNit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select
                  value={generadorTipo}
                  onChange={(e) => setGeneradorTipo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Dirección finca</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Municipio</label>
              <MunicipioSearch
                value={municipio}
                onChange={setMunicipio}
                placeholder="Buscar municipio..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cultivos ({selectedCultivos.length} seleccionados)
              </label>
              <button
                type="button"
                onClick={() => setShowCultivos(!showCultivos)}
                className="w-full text-left border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                {selectedCultivos.length === 0
                  ? "Seleccionar cultivos..."
                  : cultivos.filter((c) => selectedCultivos.includes(c.id)).map((c) => c.nombre).join(", ")}
              </button>
              {showCultivos && (
                <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto p-2">
                  <div className="grid grid-cols-2 gap-1">
                    {cultivos.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCultivos.includes(c.id)}
                          onChange={() => toggleCultivo(c.id)}
                          className="accent-green-600"
                        />
                        {c.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Móvil finca</label>
                <input
                  value={movil}
                  onChange={(e) => setMovil(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email finca</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar y marcar revisado"}
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Solo guardar
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function RevisionFincasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [fincas, setFincas] = useState<FincaRevision[]>([]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"pendientes" | "revisadas" | "todas">("pendientes");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/revisiones/fincas").then((r) => r.json()),
      fetch("/api/cultivos").then((r) => r.json()),
    ]).then(([f, c]) => {
      setFincas(f.fincas || []);
      setCultivos(c.cultivos || []);
      setLoading(false);
    });
  }, [status]);

  const handleSave = useCallback(async (fincaId: string, data: any) => {
    const res = await fetch(`/api/revisiones/fincas/${fincaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      // Actualizar estado local
      setFincas((prev) =>
        prev.map((f) =>
          f.fincaId === fincaId
            ? {
                ...f,
                finca: f.finca
                  ? { ...f.finca, revisado: data.marcarRevisado ? true : f.finca.revisado }
                  : f.finca,
              }
            : f
        )
      );
      if (data.marcarRevisado) setExpandedId(null);
    }
  }, []);

  const visible = fincas.filter((f) => {
    if (filtro === "pendientes" && f.finca?.revisado) return false;
    if (filtro === "revisadas" && !f.finca?.revisado) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        f.original.nombre.toLowerCase().includes(s) ||
        f.original.nit.includes(s) ||
        f.original.direccion.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalRevisadas = fincas.filter((f) => f.finca?.revisado).length;
  const pct = fincas.length > 0 ? Math.round((totalRevisadas / fincas.length) * 100) : 0;

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revisión de Fincas</h1>
          <p className="text-sm text-gray-500 mt-1">Verifica y corrige los datos de cada finca migrada</p>
        </div>

        {/* Progreso */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{totalRevisadas} de {fincas.length} revisadas</span>
            <span className="text-sm font-semibold text-green-700">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["pendientes", "todas", "revisadas"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-4 py-2 capitalize ${filtro === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {f === "pendientes" ? `Pendientes (${fincas.filter(f => !f.finca?.revisado).length})` :
                 f === "revisadas" ? `Revisadas (${totalRevisadas})` : "Todas"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, NIT o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {visible.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">
              {filtro === "pendientes" ? "Todas las fincas están revisadas" : "Sin resultados"}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visible.map((item) => {
                const isExpanded = expandedId === item.ubicacionId;
                const tieneProblemas = item.finca?.notas && item.finca.notas.length > 0;
                const revisado = item.finca?.revisado;

                return (
                  <div key={item.ubicacionId}>
                    {/* Fila */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.ubicacionId)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {revisado ? (
                              <span className="text-green-500 text-sm">✓</span>
                            ) : tieneProblemas ? (
                              <span className="text-amber-500 text-sm">⚠</span>
                            ) : (
                              <span className="text-gray-300 text-sm">○</span>
                            )}
                            <span className="font-medium text-gray-900 text-sm truncate">
                              {item.original.nombre || "Sin nombre"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 ml-5">
                            <span className="text-xs text-gray-400 font-mono">{item.original.nit || "—"}</span>
                            <span className="text-xs text-gray-400 truncate">{item.original.direccion || "—"}</span>
                            {item.original.municipio && (
                              <span className="text-xs text-gray-400">{item.original.municipio}</span>
                            )}
                          </div>
                          {tieneProblemas && !revisado && (
                            <div className="ml-5">
                              <FlagBadge notas={item.finca?.notas || ""} />
                            </div>
                          )}
                        </div>
                        <span className="text-gray-400 text-sm flex-shrink-0">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Panel expandido */}
                    {isExpanded && item.fincaId && (
                      <EditPanel
                        item={item}
                        cultivos={cultivos}
                        onSave={handleSave}
                        onClose={() => setExpandedId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
