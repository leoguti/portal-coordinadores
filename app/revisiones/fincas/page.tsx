"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import { calcularDigitoVerificador } from "@/lib/nit";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FincaItem {
  /** Legacy: ya no se usa (la lista se ancla en FINCAS). Puede venir null. */
  ubicacionId: string | null;
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
    fijo: string;
    email: string;
    coordinadorAsignadoId: string | null;
    revisado: boolean;
    notas: string;
  } | null;
}

interface GeneradorGrupo {
  generadorId: string | null;
  generador: {
    nombre: string;
    nit: string;
    tipo: string;
    tipopersona: string;
    direccionSede: string;
    movil: string;
    email: string;
    municipioId: string | null;
    municipioLabel: string | null;
  } | null;
  fincas: FincaItem[];
  totalFincas: number;
  revisadas: number;
}

interface Cultivo {
  id: string;
  nombre: string;
}

const TIPOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"];

// ─── FlagBadge ────────────────────────────────────────────────────────────────

function FlagBadge({ notas }: { notas: string }) {
  if (!notas) return null;
  const flags = notas.split("|").map((f) => f.trim());
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f, i) => (
        <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {f.includes("SIN_MUNICIPIO") ? "Sin municipio" :
           f.includes("SIN_NOMBRE") ? "Sin nombre" :
           f.includes("NIT_RARO") ? "NIT raro" :
           f.includes("cultivo_no_mapeado") ? "Cultivo sin mapear" : f}
        </span>
      ))}
    </div>
  );
}

// ─── Data completeness score ──────────────────────────────────────────────────

function completenessScore(f: FincaItem): number {
  let score = 0;
  if (f.finca?.nombre) score++;
  if (f.finca?.municipioId || f.original.municipio) score++;
  if ((f.finca?.cultivoIds || []).length > 0) score++;
  if (f.finca?.movil || f.original.movil) score++;
  if (f.finca?.email || f.original.email) score++;
  if (f.finca?.revisado) score += 2; // marcado como revisado pesa más
  return score;
}

// ─── CompareMergeModal ────────────────────────────────────────────────────────

function CompareMergeModal({
  a,
  b,
  onConfirm,
  onClose,
}: {
  a: FincaItem;
  b: FincaItem;
  onConfirm: (survivorFincaId: string, deleteFincaId: string) => Promise<void>;
  onClose: () => void;
}) {
  // Preselecciona la de mayor completitud
  const scoreA = completenessScore(a);
  const scoreB = completenessScore(b);
  const [survivorId, setSurvivorId] = useState<string>(
    scoreB > scoreA ? (b.fincaId || "") : (a.fincaId || "")
  );
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!survivorId) return;
    const deleteId = survivorId === a.fincaId ? b.fincaId : a.fincaId;
    if (!deleteId) return;
    setLoading(true);
    await onConfirm(survivorId, deleteId);
    setLoading(false);
  };

  const renderCol = (f: FincaItem, score: number) => {
    const isSurvivor = survivorId === f.fincaId;
    return (
      <div
        onClick={() => setSurvivorId(f.fincaId!)}
        className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
          isSurvivor ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSurvivor ? "border-green-500" : "border-gray-300"}`}>
              {isSurvivor && <div className="w-2 h-2 rounded-full bg-green-500" />}
            </div>
            <span className={`text-xs font-semibold uppercase ${isSurvivor ? "text-green-700" : "text-gray-400"}`}>
              {isSurvivor ? "Conservar esta" : "Elegir"}
            </span>
          </label>
          <span className="text-xs text-gray-400">{score}/7 datos</span>
        </div>
        <dl className="space-y-1.5 text-sm">
          <div>
            <dt className="text-xs text-gray-400">Nombre / Dirección</dt>
            <dd className="text-gray-800">{f.finca?.nombre || f.original.direccion || <span className="text-gray-300 italic">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Municipio</dt>
            <dd className="text-gray-800">{f.original.municipio || <span className="text-gray-300 italic">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Cultivos</dt>
            <dd className="text-gray-800">{(f.finca?.cultivoIds || []).length} seleccionados</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Móvil</dt>
            <dd className="text-gray-800 font-mono">{f.finca?.movil || f.original.movil || <span className="text-gray-300 italic">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Email</dt>
            <dd className="text-gray-800 truncate">{f.finca?.email || f.original.email || <span className="text-gray-300 italic">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Estado</dt>
            <dd>{f.finca?.revisado ? <span className="text-green-700">✓ revisada</span> : <span className="text-gray-400">pendiente</span>}</dd>
          </div>
        </dl>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Comparar y fusionar fincas</h2>
        <p className="text-sm text-gray-500 mb-4">
          Elige cuál finca conservar. La otra se eliminará permanentemente y sus ubicaciones (con certificados) pasarán a la seleccionada.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {renderCol(a, scoreA)}
          {renderCol(b, scoreB)}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-4">
          Hemos preseleccionado la finca con más datos completos. Revísala antes de confirmar.
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading || !survivorId}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Fusionando..." : "Confirmar fusión"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteFincaModal ─────────────────────────────────────────────────────────

function DeleteFincaModal({
  finca,
  siblings,
  onConfirm,
  onClose,
}: {
  finca: FincaItem;
  siblings: FincaItem[]; // otras fincas del mismo generador
  onConfirm: (survivorFincaId: string, deleteFincaId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string>(siblings[0]?.fincaId || "");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!target || !finca.fincaId) return;
    setLoading(true);
    await onConfirm(target, finca.fincaId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Eliminar finca</h2>
        <p className="text-sm text-gray-500 mb-4">
          Vas a eliminar esta finca. Sus ubicaciones (con los certificados asociados) deben moverse a otra finca del mismo generador.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 uppercase mb-1">A eliminar</p>
          <p className="text-sm font-medium text-gray-800">{finca.finca?.nombre || finca.original.direccion || "Sin nombre"}</p>
          <p className="text-xs text-gray-500">{finca.original.municipio || "Sin municipio"}</p>
        </div>

        {siblings.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">
            Este generador solo tiene esta finca. No hay dónde mover los certificados. Primero debes crear o asignar otra finca a este generador.
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-500 mb-2">Mover ubicaciones y certificados a:</label>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {siblings.map((s) => {
                const isSelected = target === s.fincaId;
                return (
                  <div
                    key={s.fincaId}
                    onClick={() => setTarget(s.fincaId!)}
                    className={`rounded-lg border-2 p-2.5 cursor-pointer transition-colors ${isSelected ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-green-500" : "border-gray-300"}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-green-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{s.finca?.nombre || s.original.direccion || "Sin nombre"}</p>
                        <p className="text-xs text-gray-500">{s.original.municipio || "—"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading || !target || siblings.length === 0}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Eliminando..." : "Eliminar y mover"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditPanel ────────────────────────────────────────────────────────────────

function EditPanel({
  item,
  generador,
  cultivos,
  isAdmin,
  onSave,
  onReassigned,
  onClose,
}: {
  item: FincaItem;
  generador: GeneradorGrupo["generador"];
  cultivos: Cultivo[];
  isAdmin: boolean;
  onSave: (fincaId: string, data: any) => Promise<void>;
  onReassigned: (fincaId: string) => void;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState(item.finca?.nombre || item.original.direccion || "");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [selectedCultivos, setSelectedCultivos] = useState<string[]>(item.finca?.cultivoIds || []);
  const [movil, setMovil] = useState(item.finca?.movil || item.original.movil || "");
  const [fijo, setFijo] = useState(item.finca?.fijo || "");
  const [email, setEmail] = useState(item.finca?.email || item.original.email || "");
  const [saving, setSaving] = useState(false);
  const [showCultivos, setShowCultivos] = useState(false);
  const [certificados, setCertificados] = useState<any[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  useEffect(() => {
    if (!item.fincaId) { setLoadingCerts(false); return; }
    fetch(`/api/fincas/${item.fincaId}/certificados`)
      .then((r) => r.json())
      .then((d) => setCertificados(d.certificados || []))
      .catch(() => setCertificados([]))
      .finally(() => setLoadingCerts(false));
  }, [item.fincaId]);

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
      fijo,
      email,
      marcarRevisado,
    });
    setSaving(false);
  };

  // Campos requeridos para marcar como revisado
  const missing: string[] = [];
  if (!nombre.trim()) missing.push("nombre/dirección");
  if (!municipio?.id) missing.push("municipio");
  if (selectedCultivos.length === 0) missing.push("cultivo");
  if (!movil.trim() && !fijo.trim()) missing.push("móvil o fijo");
  if (!generador?.tipopersona) missing.push("tipo persona del generador");
  const isComplete = missing.length === 0;

  return (
    <div className="bg-white px-4 py-4">
      <div className="grid grid-cols-1 gap-6">
        {/* Editable — datos de la finca */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos de la finca</p>
          <p className="text-xs text-gray-400 mb-3 italic">
            Los datos del generador (nombre, NIT, tipo) se editan desde el encabezado del grupo.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Dirección finca</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Municipio</label>
              <MunicipioSearch value={municipio} onChange={setMunicipio} placeholder="Buscar municipio..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cultivos ({selectedCultivos.length} seleccionados)
              </label>
              <button type="button" onClick={() => setShowCultivos(!showCultivos)}
                className="w-full text-left border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                {selectedCultivos.length === 0
                  ? "Seleccionar cultivos..."
                  : cultivos.filter((c) => selectedCultivos.includes(c.id)).map((c) => c.nombre).join(", ")}
              </button>
              {showCultivos && (
                <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto p-2">
                  <div className="grid grid-cols-2 gap-1">
                    {cultivos.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedCultivos.includes(c.id)}
                          onChange={() => toggleCultivo(c.id)} className="accent-green-600" />
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
                <input value={movil} onChange={(e) => setMovil(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono fijo</label>
                <input value={fijo} onChange={(e) => setFijo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email finca</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Certificados */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        {(() => {
          const sorted = [...certificados].sort((a: any, b: any) => {
            const aDate = a.fechadevolucion ? new Date(a.fechadevolucion).getTime() : 0;
            const bDate = b.fechadevolucion ? new Date(b.fechadevolucion).getTime() : 0;
            return bDate - aDate;
          });
          const recent = sorted.slice(0, 5);
          return (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Certificados {loadingCerts ? "" : `(${certificados.length}${certificados.length > 5 ? ` — mostrando los 5 más recientes` : ""})`}
              </p>
              {loadingCerts ? (
                <p className="text-sm text-gray-400">Cargando...</p>
              ) : certificados.length === 0 ? (
                <p className="text-sm text-gray-400">Sin certificados</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left py-1 pr-3">#</th>
                        <th className="text-left py-1 pr-3">Fecha</th>
                        <th className="text-left py-1 pr-3">Municipio devolución</th>
                        <th className="text-center py-1">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recent.map((c: any, i: number) => (
                        <tr key={i} className="text-gray-600">
                          <td className="py-1 pr-3 font-mono">{c.consecutivo ?? "—"}</td>
                          <td className="py-1 pr-3 whitespace-nowrap">
                            {c.fechadevolucion
                              ? new Date(c.fechadevolucion).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="py-1 pr-3 max-w-[160px] truncate">{c.municipiodevolucion || "—"}</td>
                          <td className="py-1 text-center">
                            {c.certificadopdf_r2_url ? (
                              <a href={c.certificadopdf_r2_url} target="_blank" rel="noopener noreferrer"
                                className="text-green-700 hover:text-green-900 font-medium">PDF</a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Acciones */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 items-center">
        <button
          onClick={() => handleSave(isComplete)}
          disabled={saving}
          className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600">
          Cancelar
        </button>
        {!isComplete && (
          <span className="text-xs text-amber-600 ml-auto">
            Faltan datos: {missing.join(", ")}
          </span>
        )}
      </div>

      {/* Reasignar a otro coordinador (solo mantenimiento / admin) */}
      {isAdmin && (
        <ReassignSection
          fincaId={item.fincaId || ""}
          currentCoordinadorId={item.finca?.coordinadorAsignadoId || null}
          onReassigned={onReassigned}
        />
      )}
    </div>
  );
}

// ─── ReassignSection ──────────────────────────────────────────────────────────

function ReassignSection({
  fincaId,
  currentCoordinadorId,
  onReassigned,
}: {
  fincaId: string;
  currentCoordinadorId: string | null;
  onReassigned: (fincaId: string) => void;
}) {
  const [coordinadores, setCoordinadores] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/coordinadores?onlyCoordinadores=true")
      .then((r) => r.json())
      .then((d) => setCoordinadores((d.coordinadores || []).filter((c: any) => c.id !== currentCoordinadorId)))
      .catch(() => setCoordinadores([]));
  }, [currentCoordinadorId]);

  const handleReassign = async () => {
    if (!target || !fincaId) return;
    setLoading(true);
    const res = await fetch(`/api/revisiones/fincas/${fincaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinadorAsignadoId: target }),
    });
    setLoading(false);
    if (res.ok) {
      onReassigned(fincaId);
    } else {
      alert("Error al reasignar");
    }
  };

  const selectedName = coordinadores.find((c) => c.id === target)?.name || "";

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Esta finca no es mía
      </p>
      <p className="text-xs text-gray-500 mb-2">
        Mueve esta finca a otro coordinador. No cambia los certificados ni el historial.
      </p>
      {!confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Seleccionar coordinador…</option>
            {coordinadores.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => target && setConfirming(true)}
            disabled={!target}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reasignar
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-sm text-amber-900">
            ¿Confirmas mover esta finca a <b>{selectedName}</b>? Dejará de aparecer en tu lista.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReassign}
              disabled={loading}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50"
            >
              {loading ? "Moviendo..." : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FincaRow ─────────────────────────────────────────────────────────────────

function FincaRow({
  item,
  generador,
  cultivos,
  isAdmin,
  isExpanded,
  onToggle,
  showSelection,
  isSelected,
  onToggleSelect,
  onDelete,
  onSave,
  onReassigned,
}: {
  item: FincaItem;
  generador: GeneradorGrupo["generador"];
  cultivos: Cultivo[];
  isAdmin: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  showSelection: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onSave: (fincaId: string, data: any) => Promise<void>;
  onReassigned: (fincaId: string) => void;
}) {
  const router = useRouter();
  const revisado = item.finca?.revisado;
  const tieneProblemas = item.finca?.notas && item.finca.notas.length > 0;

  const irAGenerarCertificado = () => {
    if (!item.fincaId) return;
    const p = new URLSearchParams({
      fincaId: item.fincaId,
      fincaNombre: item.finca?.nombre || "",
      generadorId: item.finca?.generadorId || "",
      generadorNombre: generador?.nombre || "",
    });
    router.push(`/certificados/generar?${p.toString()}`);
  };

  return (
    <div className={`border-l-2 ml-4 ${isSelected ? "border-blue-400 bg-blue-50/40" : revisado ? "border-green-300" : tieneProblemas ? "border-amber-300" : "border-gray-200"}`}>
      <div
        className={`flex items-start justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? "bg-gray-50" : ""}`}
        onClick={onToggle}
      >
        <div className="flex items-start gap-2 min-w-0">
          {showSelection && item.fincaId && (
            <label
              className="mt-0.5 flex-shrink-0 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="accent-blue-600 w-4 h-4 cursor-pointer"
                title="Marcar para comparar con otra finca"
              />
            </label>
          )}
          <span className="mt-0.5 flex-shrink-0 text-sm">
            {revisado ? "✓" : tieneProblemas ? "⚠" : "○"}
          </span>
          <div className="min-w-0">
            <p className={`text-sm truncate ${revisado ? "text-green-700" : tieneProblemas ? "text-amber-700" : "text-gray-800"}`}>
              {item.finca?.nombre || item.original.direccion || <span className="text-gray-400 italic">Sin nombre</span>}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {item.original.municipio && (
                <span className="text-xs text-gray-400">{item.original.municipio}</span>
              )}
              {item.original.cultivo && (
                <span className="text-xs text-gray-400 truncate max-w-[160px]">{item.original.cultivo}</span>
              )}
            </div>
            {tieneProblemas && !revisado && (
              <div className="mt-1">
                <FlagBadge notas={item.finca?.notas || ""} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {item.fincaId && (
            <button
              onClick={irAGenerarCertificado}
              className="text-xs font-semibold text-white bg-[#00d084] hover:bg-[#00a868] px-2.5 py-1 rounded whitespace-nowrap transition-colors"
              title="Generar un certificado para esta finca"
            >
              📄 Generar certificado
            </button>
          )}
          {isAdmin && item.fincaId && (
            <button
              onClick={onDelete}
              className="text-xs p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Eliminar esta finca (moviendo sus certificados a otra)"
            >
              🗑️
            </button>
          )}
          <span
            className="text-gray-400 text-sm px-1 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {isExpanded && item.fincaId && (
        <EditPanel item={item} generador={generador} cultivos={cultivos} isAdmin={isAdmin} onSave={onSave} onReassigned={onReassigned} onClose={onToggle} />
      )}
    </div>
  );
}

// ─── GeneradorEditForm ────────────────────────────────────────────────────────

function GeneradorEditForm({
  grupo,
  onSaved,
  onCancel,
}: {
  grupo: GeneradorGrupo;
  onSaved: (fields: {
    nombre: string;
    nit: string;
    tipo: string;
    tipopersona: string;
    direccionSede: string;
    movil: string;
    email: string;
    municipioId: string | null;
    municipioLabel: string | null;
  }) => void;
  onCancel: () => void;
}) {
  // Parse NIT existente: si trae "9001234-5" separar; si trae "90012345" dejar como base
  const existingNit = grupo.generador?.nit || "";
  const parseNit = (raw: string): { base: string; dv: string } => {
    const clean = raw.replace(/[^\d-]/g, "");
    if (clean.includes("-")) {
      const [b, d] = clean.split("-");
      return { base: b || "", dv: d || "" };
    }
    return { base: clean, dv: "" };
  };
  const initial = parseNit(existingNit);

  const [nombre, setNombre] = useState(grupo.generador?.nombre || "");
  const [tipo, setTipo] = useState(grupo.generador?.tipo || "AGRICOLA");
  const [tipopersona, setTipopersona] = useState(grupo.generador?.tipopersona || "Natural");
  const [nitBase, setNitBase] = useState(initial.base);
  const [dv, setDv] = useState(initial.dv);
  const [direccionSede, setDireccionSede] = useState(grupo.generador?.direccionSede || "");
  const [movil, setMovil] = useState(grupo.generador?.movil || "");
  const [email, setEmail] = useState(grupo.generador?.email || "");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(
    grupo.generador?.municipioId && grupo.generador?.municipioLabel
      ? { id: grupo.generador.municipioId, mundep: grupo.generador.municipioLabel }
      : null
  );
  const [saving, setSaving] = useState(false);

  const isJuridica = tipopersona === "Juridica";
  const baseSoloDigitos = nitBase.replace(/\D/g, "");
  const dvEsperado = baseSoloDigitos.length >= 8 ? calcularDigitoVerificador(baseSoloDigitos) : null;
  const dvNumber = dv === "" ? null : parseInt(dv, 10);
  const dvValido = !isJuridica || (dvNumber !== null && !isNaN(dvNumber) && dvNumber === dvEsperado);

  // Campos requeridos
  const missing: string[] = [];
  if (!nombre.trim()) missing.push("nombre");
  if (!baseSoloDigitos) missing.push("NIT/Cédula");
  if (isJuridica && !dvValido) missing.push("DV válido");
  const puedeGuardar = missing.length === 0;

  const handleSave = async () => {
    if (!grupo.generadorId || !puedeGuardar) return;
    const nitFinal = isJuridica ? `${baseSoloDigitos}-${dv}` : baseSoloDigitos;
    setSaving(true);
    const res = await fetch(`/api/revisiones/generadores/${grupo.generadorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        nit: nitFinal,
        tipo,
        tipopersona,
        direccion_sede: direccionSede.trim(),
        movil: movil.trim(),
        email: email.trim(),
        municipioId: municipio?.id || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved({
        nombre,
        nit: nitFinal,
        tipo,
        tipopersona,
        direccionSede: direccionSede.trim(),
        movil: movil.trim(),
        email: email.trim(),
        municipioId: municipio?.id || null,
        municipioLabel: municipio?.mundep || null,
      });
    } else {
      alert("Error al guardar generador");
    }
  };

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del generador</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo actividad</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">Persona</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={tipopersona === "Natural"}
              onChange={() => setTipopersona("Natural")} className="accent-green-600" />
            Natural (cédula)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={tipopersona === "Juridica"}
              onChange={() => setTipopersona("Juridica")} className="accent-green-600" />
            Jurídica (NIT con DV)
          </label>
        </div>
      </div>

      <div className="mb-3 flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {isJuridica ? "NIT (sin DV)" : "Cédula"}
          </label>
          <input value={nitBase} onChange={(e) => setNitBase(e.target.value)}
            placeholder={isJuridica ? "900123456" : "12345678"}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        {isJuridica && (
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">DV</label>
            <input value={dv} onChange={(e) => setDv(e.target.value.replace(/\D/g, "").slice(0, 1))}
              placeholder="?"
              className={`w-full border rounded-lg px-3 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 ${
                dv === "" ? "border-gray-300 focus:ring-green-500"
                  : dvValido ? "border-green-400 bg-green-50 focus:ring-green-500"
                  : "border-red-400 bg-red-50 focus:ring-red-500"
              }`} />
          </div>
        )}
        {isJuridica && dv !== "" && dvEsperado !== null && (
          <div className="text-xs pb-2">
            {dvValido ? (
              <span className="text-green-600">✓ válido</span>
            ) : (
              <span className="text-red-600">DV incorrecto</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Dirección de la sede</label>
          <input
            value={direccionSede}
            onChange={(e) => setDireccionSede(e.target.value)}
            placeholder="Calle / Carrera / Vereda…"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Municipio sede</label>
          <MunicipioSearch
            value={municipio}
            onChange={setMunicipio}
            placeholder="Buscar municipio..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Móvil</label>
          <input
            value={movil}
            onChange={(e) => setMovil(e.target.value)}
            inputMode="numeric"
            placeholder="3001234567"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="agricultor@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={handleSave} disabled={saving || !puedeGuardar}
          title={!puedeGuardar ? `Faltan: ${missing.join(", ")}` : ""}
          className="px-4 py-1.5 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Guardando..." : "Guardar generador"}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700">
          Cancelar
        </button>
        {!puedeGuardar && (
          <span className="text-xs text-amber-600 ml-2">Faltan: {missing.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

// ─── GeneradorRow ─────────────────────────────────────────────────────────────

function GeneradorRow({
  grupo,
  cultivos,
  isAdmin,
  expandedFinca,
  onFincaToggle,
  onSave,
  onMergeGenerador,
  onGeneradorSaved,
  onDeleteFinca,
  onReassigned,
  selectedFincaIds,
  onToggleFincaSelection,
  duplicadosNit,
  search,
}: {
  grupo: GeneradorGrupo;
  cultivos: Cultivo[];
  isAdmin: boolean;
  expandedFinca: string | null;
  onFincaToggle: (id: string) => void;
  onSave: (fincaId: string, data: any) => Promise<void>;
  onMergeGenerador: (grupo: GeneradorGrupo, candidates: GeneradorGrupo[]) => void;
  onGeneradorSaved: (
    grupoId: string,
    fields: {
      nombre: string;
      nit: string;
      tipo: string;
      tipopersona: string;
      direccionSede: string;
      movil: string;
      email: string;
      municipioId: string | null;
      municipioLabel: string | null;
    }
  ) => void;
  onDeleteFinca: (finca: FincaItem, siblings: FincaItem[]) => void;
  onReassigned: (fincaId: string) => void;
  selectedFincaIds: Set<string>;
  onToggleFincaSelection: (fincaId: string, grupoId: string | null) => void;
  duplicadosNit: GeneradorGrupo[];
  search: string;
}) {
  // Colapsado por defecto: el coordinador puede tener cientos de generadores;
  // expande el que busca. (Antes se auto-expandía por estado de migración.)
  const [expanded, setExpanded] = useState(false);
  const [editingGen, setEditingGen] = useState(false);
  const pct = grupo.totalFincas > 0 ? Math.round((grupo.revisadas / grupo.totalFincas) * 100) : 0;
  const allDone = grupo.revisadas === grupo.totalFincas && grupo.totalFincas > 0;
  // Indicadores de NIT duplicado solo para admin (son accionables solo por ellos).
  const showDup = isAdmin && duplicadosNit.length > 0;

  const visibleFincas = search
    ? grupo.fincas.filter((f) => {
        const s = search.toLowerCase();
        return (
          f.original.nombre.toLowerCase().includes(s) ||
          f.original.nit.includes(s) ||
          f.original.direccion.toLowerCase().includes(s)
        );
      })
    : grupo.fincas;

  if (search && visibleFincas.length === 0) return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${allDone ? "border-green-200" : showDup ? "border-red-200" : "border-gray-200"}`}>
      {/* Cabecera generador */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer px-4 py-3 transition-colors flex items-center justify-between gap-3 ${
          allDone ? "bg-green-50 hover:bg-green-100" : showDup ? "bg-red-50/60 hover:bg-red-50" : "bg-white hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
            allDone ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
          }`}>
            {allDone ? "✓" : grupo.totalFincas}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {grupo.generador?.nombre || <span className="text-gray-400 italic font-normal">Sin generador vinculado</span>}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {grupo.generador?.nit && (
                <span className="text-xs text-gray-400 font-mono">{grupo.generador.nit}</span>
              )}
              {grupo.generador?.tipo && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{grupo.generador.tipo}</span>
              )}
              {showDup && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  NIT repetido en {duplicadosNit.length + 1} generadores
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {grupo.generadorId && !editingGen && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingGen(true); setExpanded(true); }}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 bg-white transition-colors"
              title="Editar datos del generador"
            >
              Editar
            </button>
          )}
          {isAdmin && duplicadosNit.length > 0 && grupo.generadorId && (
            <button
              onClick={(e) => { e.stopPropagation(); onMergeGenerador(grupo, duplicadosNit); }}
              className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 bg-white transition-colors font-medium"
              title="Este NIT aparece en otros generadores — fúsionalos"
            >
              Fusionar generador
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-amber-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{grupo.revisadas}/{grupo.totalFincas}</span>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Edit form del generador (inline) */}
      {editingGen && grupo.generadorId && (
        <GeneradorEditForm
          grupo={grupo}
          onSaved={(fields) => {
            onGeneradorSaved(grupo.generadorId!, fields);
            setEditingGen(false);
          }}
          onCancel={() => setEditingGen(false)}
        />
      )}

      {/* Fincas del generador */}
      {expanded && (
        <div className="divide-y divide-gray-50 bg-gray-50/50 px-2 pb-2 pt-1">
          {visibleFincas.map((finca) => {
            const fid = finca.fincaId || finca.ubicacionId || "";
            const siblings = grupo.fincas.filter((f) => f.fincaId !== finca.fincaId && !!f.fincaId);
            return (
              <FincaRow
                key={fid}
                item={finca}
                generador={grupo.generador}
                cultivos={cultivos}
                isAdmin={isAdmin}
                isExpanded={expandedFinca === fid}
                onToggle={() => onFincaToggle(fid)}
                showSelection={isAdmin && grupo.fincas.length > 1}
                isSelected={!!finca.fincaId && selectedFincaIds.has(finca.fincaId)}
                onToggleSelect={() => finca.fincaId && onToggleFincaSelection(finca.fincaId, grupo.generadorId)}
                onDelete={() => onDeleteFinca(finca, siblings)}
                onSave={onSave}
                onReassigned={onReassigned}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── GeneradorMergeModal ──────────────────────────────────────────────────────

function GeneradorMergeModal({
  grupo,
  candidates,
  onConfirm,
  onClose,
}: {
  grupo: GeneradorGrupo;
  candidates: GeneradorGrupo[];
  onConfirm: (survivorGeneradorId: string, deleteGeneradorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(grupo.generadorId);
  const [loading, setLoading] = useState(false);

  const allGroups = [grupo, ...candidates];

  const handleConfirm = async () => {
    if (!selectedId) return;
    // Fusiona los demás uno a uno hacia el sobreviviente
    const toDelete = allGroups.filter((g) => g.generadorId !== selectedId && g.generadorId);
    setLoading(true);
    for (const g of toDelete) {
      await onConfirm(selectedId, g.generadorId!);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold text-gray-900 mb-1">Fusionar generadores duplicados</h2>
        <p className="text-sm text-gray-500 mb-4">
          Estos {allGroups.length} generadores comparten el mismo NIT base. Elige cuál conservar — las fincas de los otros se reasignarán y los duplicados se eliminarán.
        </p>

        <div className="space-y-2 mb-4">
          {allGroups.map((g) => {
            const isSelected = selectedId === g.generadorId;
            return (
              <div
                key={g.generadorId}
                onClick={() => setSelectedId(g.generadorId)}
                className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${isSelected ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${isSelected ? "border-green-500" : "border-gray-300"}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{g.generador?.nombre || "Sin nombre"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono">NIT: {g.generador?.nit || "—"}</span>
                      {g.generador?.tipo && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{g.generador.tipo}</span>
                      )}
                      <span className="text-xs text-gray-500">{g.totalFincas} {g.totalFincas === 1 ? "finca" : "fincas"}</span>
                    </div>
                    {isSelected && (
                      <p className="text-xs text-green-700 mt-1 font-medium">Este se conserva</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">
          Los otros {allGroups.length - 1} generadores se eliminarán. Sus fincas se reasignarán al que conservas. Esta acción no se puede deshacer.
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading || !selectedId}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Fusionando..." : `Fusionar ${allGroups.length - 1} duplicado${allGroups.length - 1 === 1 ? "" : "s"}`}
          </button>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateFincaModal ─────────────────────────────────────────────────────────

const TIPOS_GEN = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"];

interface GeneradorSearchResult {
  id: string;
  nombre: string;
  nit: string;
  tipo: string;
}

function CreateFincaModal({
  cultivos,
  onCreated,
  onClose,
}: {
  cultivos: Cultivo[];
  onCreated: () => void;
  onClose: () => void;
}) {
  // Modo de generador: buscar existente o crear nuevo
  const [genMode, setGenMode] = useState<"buscar" | "crear">("buscar");
  const [genSearch, setGenSearch] = useState("");
  const [genResults, setGenResults] = useState<GeneradorSearchResult[]>([]);
  const [genSelected, setGenSelected] = useState<GeneradorSearchResult | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  // Campos para crear nuevo generador
  const [generadorNombre, setGeneradorNombre] = useState("");
  const [generadorNit, setGeneradorNit] = useState("");
  const [generadorTipo, setGeneradorTipo] = useState("AGRICOLA");

  // Campos de la finca
  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [selectedCultivos, setSelectedCultivos] = useState<string[]>([]);
  const [showCultivos, setShowCultivos] = useState(false);
  const [movil, setMovil] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Debounced búsqueda de generadores
  useEffect(() => {
    if (genMode !== "buscar" || genSearch.trim().length < 2) {
      setGenResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setGenLoading(true);
      const res = await fetch(`/api/revisiones/generadores/buscar?q=${encodeURIComponent(genSearch.trim())}`);
      const data = await res.json();
      setGenResults(data.generadores || []);
      setGenLoading(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [genSearch, genMode]);

  const toggleCultivo = (id: string) => {
    setSelectedCultivos((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const validar = (): string | null => {
    // Generador
    if (genMode === "buscar") {
      if (!genSelected) return "Selecciona un generador o crea uno nuevo";
    } else {
      if (!generadorNombre.trim()) return "Nombre del generador es obligatorio";
      if (!generadorNit.trim()) return "NIT/Cédula del generador es obligatorio";
    }
    // Finca — todos los campos obligatorios
    if (!nombre.trim()) return "Nombre/dirección de la finca es obligatorio";
    if (!municipio) return "Municipio es obligatorio";
    if (selectedCultivos.length === 0) return "Al menos un cultivo es obligatorio";
    if (!movil.trim()) return "Móvil es obligatorio";
    if (!email.trim()) return "Email es obligatorio";
    if (!/\S+@\S+\.\S+/.test(email)) return "Email no tiene un formato válido";
    return null;
  };

  const handleSave = async () => {
    setError("");
    const errMsg = validar();
    if (errMsg) { setError(errMsg); return; }

    setSaving(true);
    const payload: any = {
      nombre,
      municipioId: municipio?.id || null,
      cultivoIds: selectedCultivos,
      movil,
      email,
    };
    if (genMode === "buscar" && genSelected) {
      payload.generadorId = genSelected.id;
    } else {
      payload.generadorNombre = generadorNombre;
      payload.generadorNit = generadorNit;
      payload.generadorTipo = generadorTipo;
    }

    const res = await fetch("/api/revisiones/fincas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      onCreated();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Error al crear la finca");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Agregar finca nueva</h2>
        <p className="text-sm text-gray-500 mb-4">
          Se creará el generador y la finca. La finca queda asignada a ti como responsable.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Generador */}
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">Generador *</p>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button type="button"
                  onClick={() => { setGenMode("buscar"); setGenSelected(null); setError(""); }}
                  className={`px-3 py-1 ${genMode === "buscar" ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  Buscar existente
                </button>
                <button type="button"
                  onClick={() => { setGenMode("crear"); setGenSelected(null); setError(""); }}
                  className={`px-3 py-1 ${genMode === "crear" ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
                  Crear nuevo
                </button>
              </div>
            </div>

            {genMode === "buscar" ? (
              <div>
                {genSelected ? (
                  <div className="rounded-lg border-2 border-green-500 bg-green-50 p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{genSelected.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-mono">{genSelected.nit}</span>
                        {genSelected.tipo && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{genSelected.tipo}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setGenSelected(null); setGenSearch(""); }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">Cambiar</button>
                  </div>
                ) : (
                  <>
                    <input
                      value={genSearch}
                      onChange={(e) => setGenSearch(e.target.value)}
                      placeholder="Buscar por NIT o nombre..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {genLoading && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
                    {genResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {genResults.map((g) => (
                          <button key={g.id} type="button" onClick={() => setGenSelected(g)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50">
                            <p className="text-sm text-gray-800 truncate">{g.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400 font-mono">{g.nit}</span>
                              {g.tipo && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{g.tipo}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {!genLoading && genSearch.trim().length >= 2 && genResults.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Sin resultados. Usa "Crear nuevo" si no existe.</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
                  <input value={generadorNombre} onChange={(e) => setGeneradorNombre(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NIT / Cédula *</label>
                    <input value={generadorNit} onChange={(e) => setGeneradorNit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                    <select value={generadorTipo} onChange={(e) => setGeneradorTipo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {TIPOS_GEN.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Finca */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Finca</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Dirección *</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Finca La Esperanza - Vereda El Rosal"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Municipio *</label>
                <MunicipioSearch value={municipio} onChange={setMunicipio} placeholder="Buscar municipio..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Cultivos * ({selectedCultivos.length} seleccionados)
                </label>
                <button type="button" onClick={() => setShowCultivos(!showCultivos)}
                  className="w-full text-left border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                  {selectedCultivos.length === 0
                    ? "Seleccionar cultivos..."
                    : cultivos.filter((c) => selectedCultivos.includes(c.id)).map((c) => c.nombre).join(", ")}
                </button>
                {showCultivos && (
                  <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {cultivos.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                          <input type="checkbox" checked={selectedCultivos.includes(c.id)}
                            onChange={() => toggleCultivo(c.id)} className="accent-green-600" />
                          {c.nombre}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Móvil *</label>
                  <input value={movil} onChange={(e) => setMovil(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {saving ? "Creando..." : "Crear finca"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RevisionFincasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [grupos, setGrupos] = useState<GeneradorGrupo[]>([]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"pendientes" | "todas" | "revisadas" | "duplicados" | "incompletos">("todas");
  const [filtroPersona, setFiltroPersona] = useState<"todos" | "Natural" | "Juridica" | "sin-clasificar">("todos");
  const [expandedFinca, setExpandedFinca] = useState<string | null>(null);
  const [totalFincas, setTotalFincas] = useState(0);
  const [totalRevisadas, setTotalRevisadas] = useState(0);
  const [compareData, setCompareData] = useState<{ a: FincaItem; b: FincaItem } | null>(null);
  const [deleteData, setDeleteData] = useState<{ finca: FincaItem; siblings: FincaItem[] } | null>(null);
  const [mergeGenData, setMergeGenData] = useState<{ grupo: GeneradorGrupo; candidates: GeneradorGrupo[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Selección para fusionar (hasta 2 fincas del mismo generador)
  const [selectedFincaIds, setSelectedFincaIds] = useState<Set<string>>(new Set());
  const [selectionGeneradorId, setSelectionGeneradorId] = useState<string | null>(null);

  // Filtro por coordinador (solo admin)
  const [selectedCoordinador, setSelectedCoordinador] = useState<string>("");
  const [coordinadores, setCoordinadores] = useState<{id: string; name: string}[]>([]);

  // Las herramientas de mantenimiento (fusionar duplicados, reasignar, eliminar)
  // solo las ven Admin/Supervisor; el coordinador del día a día ve la vista simple.
  const isAdmin = !!session?.user?.rol && ["Administrador", "Supervisor"].includes(session.user.rol);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadData = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (session?.user?.rol && ["Administrador", "Supervisor"].includes(session.user.rol) && selectedCoordinador) {
      params.set("coordinadorId", selectedCoordinador);
    }
    Promise.all([
      fetch(`/api/revisiones/fincas?${params.toString()}`).then((r) => r.json()),
      fetch("/api/cultivos").then((r) => r.json()),
    ]).then(([f, c]) => {
      setGrupos(f.grupos || []);
      setTotalFincas(f.totalFincas || 0);
      setTotalRevisadas(f.totalRevisadas || 0);
      setCultivos(c.cultivos || []);
      setLoading(false);
    });
  }, [status, session, selectedCoordinador]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cargar coordinadores si es admin
  useEffect(() => {
    if (session?.user?.rol && ["Administrador", "Supervisor"].includes(session.user.rol)) {
      fetch("/api/coordinadores?onlyCoordinadores=true")
        .then((r) => r.json())
        .then((data) => setCoordinadores(data.coordinadores || []))
        .catch(() => {});
    }
  }, [session?.user?.rol]);

  const handleSave = useCallback(async (fincaId: string, data: any) => {
    const res = await fetch(`/api/revisiones/fincas/${fincaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok && data.marcarRevisado) {
      setGrupos((prev) =>
        prev.map((g) => {
          const updated = g.fincas.map((f) =>
            f.fincaId === fincaId && f.finca ? { ...f, finca: { ...f.finca, revisado: true } } : f
          );
          return {
            ...g,
            fincas: updated,
            revisadas: updated.filter((f) => f.finca?.revisado).length,
          };
        })
      );
      setTotalRevisadas((n) => n + 1);
      setExpandedFinca(null);
    }
  }, []);

  const handleMerge = useCallback(async (survivorFincaId: string, deleteFincaId: string) => {
    const res = await fetch("/api/revisiones/fincas/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survivorFincaId, deleteFincaId }),
    });
    if (res.ok) {
      setCompareData(null);
      setDeleteData(null);
      setSelectedFincaIds(new Set());
      setSelectionGeneradorId(null);
      loadData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error al fusionar");
    }
  }, [loadData]);

  const toggleFincaSelection = useCallback((fincaId: string, grupoId: string | null) => {
    setSelectedFincaIds((prev) => {
      // Si selecciona de otro generador → resetea
      if (selectionGeneradorId && selectionGeneradorId !== grupoId) {
        setSelectionGeneradorId(grupoId);
        return new Set([fincaId]);
      }
      const next = new Set(prev);
      if (next.has(fincaId)) {
        next.delete(fincaId);
        if (next.size === 0) setSelectionGeneradorId(null);
      } else {
        if (next.size >= 2) return prev; // Máximo 2
        next.add(fincaId);
        if (!selectionGeneradorId) setSelectionGeneradorId(grupoId);
      }
      return next;
    });
  }, [selectionGeneradorId]);

  const clearSelection = useCallback(() => {
    setSelectedFincaIds(new Set());
    setSelectionGeneradorId(null);
  }, []);

  const openCompareFromSelection = useCallback(() => {
    if (selectedFincaIds.size !== 2) return;
    const ids = Array.from(selectedFincaIds);
    let a: FincaItem | null = null;
    let b: FincaItem | null = null;
    for (const g of grupos) {
      for (const f of g.fincas) {
        if (f.fincaId === ids[0]) a = f;
        if (f.fincaId === ids[1]) b = f;
      }
    }
    if (a && b) setCompareData({ a, b });
  }, [selectedFincaIds, grupos]);

  const handleReassigned = useCallback((fincaId: string) => {
    // La finca se movió a otro coordinador — la quitamos de la vista actual
    setGrupos((prev) =>
      prev
        .map((g) => {
          const filtered = g.fincas.filter((f) => f.fincaId !== fincaId);
          const revisadas = filtered.filter((f) => f.finca?.revisado).length;
          return { ...g, fincas: filtered, totalFincas: filtered.length, revisadas };
        })
        .filter((g) => g.fincas.length > 0)
    );
    setTotalFincas((n) => Math.max(0, n - 1));
    setExpandedFinca(null);
  }, []);

  const handleGeneradorSaved = useCallback(
    (
      grupoId: string,
      fields: {
        nombre: string;
        nit: string;
        tipo: string;
        tipopersona: string;
        direccionSede: string;
        movil: string;
        email: string;
        municipioId: string | null;
        municipioLabel: string | null;
      }
    ) => {
      setGrupos((prev) =>
        prev.map((g) =>
          g.generadorId === grupoId
            ? {
                ...g,
                generador: {
                  nombre: fields.nombre,
                  nit: fields.nit,
                  tipo: fields.tipo,
                  tipopersona: fields.tipopersona,
                  direccionSede: fields.direccionSede,
                  movil: fields.movil,
                  email: fields.email,
                  municipioId: fields.municipioId,
                  municipioLabel: fields.municipioLabel,
                },
              }
            : g
        )
      );
    },
    []
  );

  const handleMergeGenerador = useCallback(async (survivorGeneradorId: string, deleteGeneradorId: string) => {
    const res = await fetch("/api/revisiones/generadores/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survivorGeneradorId, deleteGeneradorId }),
    });
    if (res.ok) {
      setMergeGenData(null);
      loadData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error al fusionar generador");
    }
  }, [loadData]);

  // Detección de NITs duplicados (prefijo sin último dígito — estándar NIT Colombia)
  const nitPrefix = (nit: string) => {
    const d = (nit || "").replace(/\D/g, "");
    return d.length >= 5 ? d.slice(0, -1) : "";
  };

  const duplicadosMap = new Map<string, GeneradorGrupo[]>();
  for (const g of grupos) {
    const key = nitPrefix(g.generador?.nit || "");
    if (!key || !g.generadorId) continue;
    if (!duplicadosMap.has(key)) duplicadosMap.set(key, []);
    duplicadosMap.get(key)!.push(g);
  }

  const getDuplicadosFor = (grupo: GeneradorGrupo): GeneradorGrupo[] => {
    const key = nitPrefix(grupo.generador?.nit || "");
    if (!key) return [];
    const all = duplicadosMap.get(key) || [];
    if (all.length <= 1) return [];
    return all.filter((g) => g.generadorId !== grupo.generadorId);
  };

  const totalGeneradoresConDuplicados = Array.from(duplicadosMap.values())
    .filter((arr) => arr.length > 1)
    .reduce((sum, arr) => sum + arr.length, 0);

  // Una finca es "incompleta" si le falta municipio, cultivos, móvil o email
  const fincaIncompleta = (item: FincaItem): boolean => {
    const f = item.finca;
    if (!f) return true;
    if (!f.municipioId) return true;
    if ((f.cultivoIds || []).length === 0) return true;
    if (!f.movil && !item.original.movil) return true;
    if (!f.email && !item.original.email) return true;
    return false;
  };

  const grupoTieneIncompletas = (g: GeneradorGrupo): boolean => {
    // Generador sin clasificar (Natural/Jurídica) también es incompleto
    if (!g.generador?.tipopersona) return true;
    return g.fincas.some(fincaIncompleta);
  };

  const gruposFiltrados = grupos.filter((g) => {
    // Filtro por tipopersona
    const tp = g.generador?.tipopersona || "";
    if (filtroPersona === "Natural" && tp !== "Natural") return false;
    if (filtroPersona === "Juridica" && tp !== "Juridica") return false;
    if (filtroPersona === "sin-clasificar" && tp !== "") return false;

    if (filtro === "pendientes") return g.revisadas < g.totalFincas;
    if (filtro === "revisadas") return g.revisadas === g.totalFincas;
    if (filtro === "duplicados") return getDuplicadosFor(g).length > 0;
    if (filtro === "incompletos") return grupoTieneIncompletas(g);
    return true;
  });

  const totalIncompletos = grupos.filter(grupoTieneIncompletas).length;
  const totalNatural = grupos.filter((g) => g.generador?.tipopersona === "Natural").length;
  const totalJuridica = grupos.filter((g) => g.generador?.tipopersona === "Juridica").length;
  const totalSinClasificar = grupos.filter((g) => !g.generador?.tipopersona).length;

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Generadores y Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Busca un generador para ver y actualizar sus datos y los de sus fincas.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-shrink-0 px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Agregar finca
          </button>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="text-gray-700"><b>{grupos.length}</b> generador{grupos.length !== 1 ? "es" : ""}</span>
          <span className="text-gray-700"><b>{totalFincas}</b> finca{totalFincas !== 1 ? "s" : ""}</span>
          {totalIncompletos > 0 && (
            <span className="text-amber-700"><b>{totalIncompletos}</b> con datos incompletos</span>
          )}
        </div>

        {/* Banner de duplicados (solo mantenimiento / admin) */}
        {isAdmin && totalGeneradoresConDuplicados > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-600 text-lg flex-shrink-0">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {totalGeneradoresConDuplicados} generadores con NIT duplicado detectados
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Son generadores distintos que comparten el mismo NIT base (sin dígito de verificación). Úsalos con el filtro "Duplicados" y fusionalos uno a uno.
              </p>
            </div>
            <button
              onClick={() => setFiltro("duplicados")}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex-shrink-0"
            >
              Ver duplicados
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm flex-wrap">
            {(["todas", "incompletos", "duplicados"] as const).map((f) => {
              if (f === "duplicados" && (!isAdmin || totalGeneradoresConDuplicados === 0)) return null;
              const label =
                f === "duplicados" ? `Duplicados (${totalGeneradoresConDuplicados})` :
                f === "incompletos" ? `Incompletos (${totalIncompletos})` :
                `Todos (${grupos.length})`;
              const isActive = filtro === f;
              const activeClass =
                f === "duplicados" ? "bg-red-600 text-white" :
                f === "incompletos" ? "bg-amber-600 text-white" :
                "bg-[#042726] text-white";
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-4 py-2 ${isActive ? activeClass : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value as typeof filtroPersona)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="todos">Todos los tipos ({grupos.length})</option>
            <option value="Natural">Natural ({totalNatural})</option>
            <option value="Juridica">Jurídica ({totalJuridica})</option>
            <option value="sin-clasificar">Sin clasificar ({totalSinClasificar})</option>
          </select>
          {session?.user?.rol && ["Administrador", "Supervisor"].includes(session.user.rol) && coordinadores.length > 0 && (
            <select
              value={selectedCoordinador}
              onChange={(e) => setSelectedCoordinador(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Todos los coordinadores</option>
              {coordinadores.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Buscar por nombre, NIT o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Lista de generadores */}
        {gruposFiltrados.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-12 bg-white rounded-xl border border-gray-200">
            {filtro === "pendientes" ? "Todos los generadores están completos" : "Sin resultados"}
          </div>
        ) : (
          <div className="space-y-3">
            {gruposFiltrados.map((grupo) => (
              <GeneradorRow
                key={grupo.generadorId || "sin-generador"}
                grupo={grupo}
                cultivos={cultivos}
                isAdmin={isAdmin}
                expandedFinca={expandedFinca}
                onFincaToggle={(id) => setExpandedFinca(expandedFinca === id ? null : id)}
                onSave={handleSave}
                onMergeGenerador={(g, candidates) => setMergeGenData({ grupo: g, candidates })}
                onGeneradorSaved={handleGeneradorSaved}
                onDeleteFinca={(finca, siblings) => setDeleteData({ finca, siblings })}
                onReassigned={handleReassigned}
                selectedFincaIds={selectedFincaIds}
                onToggleFincaSelection={toggleFincaSelection}
                duplicadosNit={getDuplicadosFor(grupo)}
                search={search}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barra flotante de selección (solo mantenimiento / admin) */}
      {isAdmin && selectedFincaIds.size > 0 && !compareData && !deleteData && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-gray-200 shadow-xl rounded-full px-5 py-3 flex items-center gap-4 max-w-[92vw]">
          <span className="text-sm text-gray-700">
            {selectedFincaIds.size === 1 ? (
              <>Selecciona <b>otra finca</b> del mismo generador para compararlas</>
            ) : (
              <>2 fincas seleccionadas — ¿son la misma?</>
            )}
          </span>
          {selectedFincaIds.size === 2 && (
            <button
              onClick={openCompareFromSelection}
              className="text-sm px-4 py-1.5 bg-[#042726] text-white rounded-full hover:bg-[#032120] font-medium"
            >
              Comparar y fusionar
            </button>
          )}
          <button
            onClick={clearSelection}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal comparación lado a lado (2 fincas) */}
      {compareData && (
        <CompareMergeModal
          a={compareData.a}
          b={compareData.b}
          onConfirm={handleMerge}
          onClose={() => setCompareData(null)}
        />
      )}

      {/* Modal eliminar finca (reasigna certificados) */}
      {deleteData && (
        <DeleteFincaModal
          finca={deleteData.finca}
          siblings={deleteData.siblings}
          onConfirm={handleMerge}
          onClose={() => setDeleteData(null)}
        />
      )}

      {/* Modal fusión generador */}
      {mergeGenData && (
        <GeneradorMergeModal
          grupo={mergeGenData.grupo}
          candidates={mergeGenData.candidates}
          onConfirm={handleMergeGenerador}
          onClose={() => setMergeGenData(null)}
        />
      )}

      {/* Modal crear finca nueva */}
      {showCreate && (
        <CreateFincaModal
          cultivos={cultivos}
          onCreated={() => { setShowCreate(false); loadData(); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </AuthenticatedLayout>
  );
}
