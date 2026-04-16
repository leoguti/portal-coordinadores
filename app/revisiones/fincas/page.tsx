"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FincaItem {
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

interface GeneradorGrupo {
  generadorId: string | null;
  generador: { nombre: string; nit: string; tipo: string } | null;
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

// ─── MergeModal ───────────────────────────────────────────────────────────────

function MergeModal({
  finca,
  candidates,
  onConfirm,
  onClose,
}: {
  finca: FincaItem;
  candidates: FincaItem[];
  onConfirm: (survivorFincaId: string, deleteFincaId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string>(candidates[0]?.fincaId || "");
  const [keepCurrent, setKeepCurrent] = useState(true);
  const [loading, setLoading] = useState(false);

  const survivorId = keepCurrent ? finca.fincaId! : selected;
  const deleteId = keepCurrent ? selected : finca.fincaId!;

  const handleConfirm = async () => {
    if (!survivorId || !deleteId) return;
    setLoading(true);
    await onConfirm(survivorId, deleteId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Fusionar fincas</h2>
        <p className="text-sm text-gray-500 mb-4">
          Las ubicaciones de la finca eliminada pasarán a la finca que conserves. La otra se borrará permanentemente.
        </p>

        {/* Finca actual */}
        <div
          className={`rounded-lg border-2 p-3 mb-2 cursor-pointer transition-colors ${keepCurrent ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"}`}
          onClick={() => setKeepCurrent(true)}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${keepCurrent ? "border-green-500" : "border-gray-300"}`}>
              {keepCurrent && <div className="w-2 h-2 rounded-full bg-green-500" />}
            </div>
            <span className="text-xs font-semibold text-green-700 uppercase">Conservar esta</span>
          </div>
          <p className="text-sm font-medium text-gray-800 ml-6">{finca.finca?.nombre || finca.original.direccion || "Sin nombre"}</p>
          <p className="text-xs text-gray-500 ml-6">{finca.original.municipio || "Sin municipio"}</p>
        </div>

        {/* Candidatas */}
        <div className="space-y-2 mb-4">
          {candidates.map((c) => {
            const isSelected = selected === c.fincaId;
            return (
              <div
                key={c.fincaId}
                className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${!keepCurrent && isSelected ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"}`}
                onClick={() => { setSelected(c.fincaId!); setKeepCurrent(false); }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!keepCurrent && isSelected ? "border-green-500" : "border-gray-300"}`}>
                    {!keepCurrent && isSelected && <div className="w-2 h-2 rounded-full bg-green-500" />}
                  </div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Conservar esta</span>
                </div>
                <p className="text-sm font-medium text-gray-800 ml-6">{c.finca?.nombre || c.original.direccion || "Sin nombre"}</p>
                <p className="text-xs text-gray-500 ml-6">{c.original.municipio || "Sin municipio"}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">
          Se eliminará permanentemente la finca no seleccionada. Esta acción no se puede deshacer.
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading || !selected}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
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

// ─── EditPanel ────────────────────────────────────────────────────────────────

function EditPanel({
  item,
  cultivos,
  onSave,
  onClose,
}: {
  item: FincaItem;
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
  const [certificados, setCertificados] = useState<any[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  useEffect(() => {
    fetch(`/api/generadores/${item.ubicacionId}/certificados`)
      .then((r) => r.json())
      .then((d) => setCertificados(d.certificados || []))
      .catch(() => setCertificados([]))
      .finally(() => setLoadingCerts(false));
  }, [item.ubicacionId]);

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
    <div className="bg-white px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Izquierda: datos originales */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos originales</p>
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

        {/* Derecha: editable */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Nueva estructura (editar)</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Generador — Nombre</label>
              <input value={generadorNombre} onChange={(e) => setGeneradorNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">NIT / Cédula</label>
                <input value={generadorNit} onChange={(e) => setGeneradorNit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={generadorTipo} onChange={(e) => setGeneradorTipo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Email finca</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Certificados */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Certificados ({loadingCerts ? "..." : certificados.length})
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
                  <th className="text-center py-1 pr-3">Total</th>
                  <th className="text-center py-1">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certificados.map((c: any, i: number) => (
                  <tr key={i} className="text-gray-600">
                    <td className="py-1 pr-3 font-mono">{c.consecutivo ?? "—"}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {c.fechadevolucion
                        ? new Date(c.fechadevolucion).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-1 pr-3 max-w-[160px] truncate">{c.municipiodevolucion || "—"}</td>
                    <td className="py-1 pr-3 text-center font-semibold">{c.total ?? 0}</td>
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
      </div>

      {/* Acciones */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
        <button onClick={() => handleSave(true)} disabled={saving}
          className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar y marcar revisado"}
        </button>
        <button onClick={() => handleSave(false)} disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
          Solo guardar
        </button>
        <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── FincaRow ─────────────────────────────────────────────────────────────────

function FincaRow({
  item,
  cultivos,
  isExpanded,
  onToggle,
  canMerge,
  onMergeClick,
  onSave,
}: {
  item: FincaItem;
  cultivos: Cultivo[];
  isExpanded: boolean;
  onToggle: () => void;
  canMerge: boolean;
  onMergeClick: () => void;
  onSave: (fincaId: string, data: any) => Promise<void>;
}) {
  const revisado = item.finca?.revisado;
  const tieneProblemas = item.finca?.notas && item.finca.notas.length > 0;

  return (
    <div className={`border-l-2 ml-4 ${revisado ? "border-green-300" : tieneProblemas ? "border-amber-300" : "border-gray-200"}`}>
      <div
        className={`flex items-start justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? "bg-gray-50" : ""}`}
        onClick={onToggle}
      >
        <div className="flex items-start gap-2 min-w-0">
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

        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {canMerge && (
            <button
              onClick={onMergeClick}
              className="text-xs px-2 py-1 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
            >
              Fusionar
            </button>
          )}
          <span className="text-gray-400 text-sm" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {isExpanded && item.fincaId && (
        <EditPanel item={item} cultivos={cultivos} onSave={onSave} onClose={onToggle} />
      )}
    </div>
  );
}

// ─── GeneradorRow ─────────────────────────────────────────────────────────────

function GeneradorRow({
  grupo,
  cultivos,
  expandedFinca,
  onFincaToggle,
  onSave,
  onMerge,
  search,
}: {
  grupo: GeneradorGrupo;
  cultivos: Cultivo[];
  expandedFinca: string | null;
  onFincaToggle: (id: string) => void;
  onSave: (fincaId: string, data: any) => Promise<void>;
  onMerge: (finca: FincaItem, candidates: FincaItem[]) => void;
  search: string;
}) {
  const [expanded, setExpanded] = useState(grupo.revisadas < grupo.totalFincas);
  const pct = grupo.totalFincas > 0 ? Math.round((grupo.revisadas / grupo.totalFincas) * 100) : 0;
  const allDone = grupo.revisadas === grupo.totalFincas && grupo.totalFincas > 0;

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
    <div className={`rounded-xl border overflow-hidden ${allDone ? "border-green-200" : "border-gray-200"}`}>
      {/* Cabecera generador */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3 ${
          allDone ? "bg-green-50 hover:bg-green-100" : "bg-white hover:bg-gray-50"
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
            <div className="flex items-center gap-2 mt-0.5">
              {grupo.generador?.nit && (
                <span className="text-xs text-gray-400 font-mono">{grupo.generador.nit}</span>
              )}
              {grupo.generador?.tipo && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{grupo.generador.tipo}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
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
      </button>

      {/* Fincas del generador */}
      {expanded && (
        <div className="divide-y divide-gray-50 bg-gray-50/50 px-2 pb-2 pt-1">
          {visibleFincas.map((finca) => (
            <FincaRow
              key={finca.fincaId || finca.ubicacionId}
              item={finca}
              cultivos={cultivos}
              isExpanded={expandedFinca === (finca.fincaId || finca.ubicacionId)}
              onToggle={() => onFincaToggle(finca.fincaId || finca.ubicacionId)}
              canMerge={grupo.fincas.length > 1 && !!finca.fincaId}
              onMergeClick={() =>
                onMerge(
                  finca,
                  grupo.fincas.filter((f) => f.fincaId !== finca.fincaId && !!f.fincaId)
                )
              }
              onSave={onSave}
            />
          ))}
        </div>
      )}
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
  const [filtro, setFiltro] = useState<"pendientes" | "todas" | "revisadas">("pendientes");
  const [expandedFinca, setExpandedFinca] = useState<string | null>(null);
  const [totalFincas, setTotalFincas] = useState(0);
  const [totalRevisadas, setTotalRevisadas] = useState(0);
  const [mergeData, setMergeData] = useState<{ finca: FincaItem; candidates: FincaItem[] } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadData = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    Promise.all([
      fetch("/api/revisiones/fincas").then((r) => r.json()),
      fetch("/api/cultivos").then((r) => r.json()),
    ]).then(([f, c]) => {
      setGrupos(f.grupos || []);
      setTotalFincas(f.totalFincas || 0);
      setTotalRevisadas(f.totalRevisadas || 0);
      setCultivos(c.cultivos || []);
      setLoading(false);
    });
  }, [status]);

  useEffect(() => { loadData(); }, [loadData]);

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
      setMergeData(null);
      loadData();
    }
  }, [loadData]);

  const pct = totalFincas > 0 ? Math.round((totalRevisadas / totalFincas) * 100) : 0;

  const gruposFiltrados = grupos.filter((g) => {
    if (filtro === "pendientes") return g.revisadas < g.totalFincas;
    if (filtro === "revisadas") return g.revisadas === g.totalFincas;
    return true;
  });

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
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revisión de Fincas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verifica los datos de cada generador y sus fincas. Fusiona duplicados cuando sea necesario.
          </p>
        </div>

        {/* Progreso global */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{totalRevisadas} de {totalFincas} fincas revisadas</span>
            <span className="text-sm font-semibold text-green-700">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["pendientes", "todas", "revisadas"] as const).map((f) => {
              const label =
                f === "pendientes" ? `Pendientes (${grupos.filter((g) => g.revisadas < g.totalFincas).length})` :
                f === "revisadas" ? `Completos (${grupos.filter((g) => g.revisadas === g.totalFincas).length})` :
                "Todos";
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-4 py-2 ${filtro === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
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
                expandedFinca={expandedFinca}
                onFincaToggle={(id) => setExpandedFinca(expandedFinca === id ? null : id)}
                onSave={handleSave}
                onMerge={(finca, candidates) => setMergeData({ finca, candidates })}
                search={search}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal fusión */}
      {mergeData && (
        <MergeModal
          finca={mergeData.finca}
          candidates={mergeData.candidates}
          onConfirm={handleMerge}
          onClose={() => setMergeData(null)}
        />
      )}
    </AuthenticatedLayout>
  );
}
