"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

type Tab = "cert" | "generadores" | "fincas";

interface CertItem {
  id: string;
  consecutivo: number;
  fechaSolicitud: string;
  origen: string;
  fechadevolucion: string;
  lugardevolucion: string;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  total: number;
  triplelavado: string;
  observaciones: string;
  coordinadorNombre: string;
  generadorNombre: string;
  generadorCedula: string;
  generadorTipoPersona: string;
  fincaNombre: string;
  municipioDevolucion: string;
  createdTime: string;
}
interface GenItem {
  id: string;
  nombre: string;
  nit: string;
  tipopersona: string;
  tipo: string;
  direccion: string;
  movil: string;
  email: string;
  estado: string;
  fechaSolicitud: string;
  origen: string;
  diffLegible?: Array<{ label: string; valor: string }>;
  createdTime: string;
}
interface FincaItem {
  id: string;
  nombre: string;
  movil: string;
  email: string;
  estado: string;
  fechaSolicitud: string;
  origen: string;
  cambiosPendientes: string;
  diffLegible?: Array<{ label: string; valor: string }>;
  createdTime: string;
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("es-CO").format(n);
}

export default function PendientesPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("cert");
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"aprobar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ cert: number; generadores: number; fincas: number } | null>(null);

  const isAdmin = isAdminOrSupervisor(session?.user?.rol);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/certificados/pendientes?tipo=${tab}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error || "Error cargando");
          setItems([]);
          return;
        }
        setItems(data.items || []);
      })
      .catch(() => {
        setError("Error de red");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const loadCounts = useCallback(() => {
    fetch("/api/certificados/pendientes/counts")
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setCounts({
          cert: Number(data.cert) || 0,
          generadores: Number(data.generadores) || 0,
          fincas: Number(data.fincas) || 0,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      load();
      loadCounts();
    }
  }, [status, load, loadCounts]);

  async function doAction(id: string, accion: "aprobar" | "rechazar", motivoTxt = "") {
    setSubmittingId(id);
    try {
      const tabla =
        tab === "cert" ? "certificados" : tab === "generadores" ? "generadores" : "fincas";
      const r = await fetch(`/api/${tabla}/${id}/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: accion === "rechazar" ? JSON.stringify({ motivo: motivoTxt }) : "{}",
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error || "Error");
        return;
      }
      setActionFor(null);
      setActionMode(null);
      setMotivo("");
      load();
      loadCounts();
    } catch {
      alert("Error de red");
    } finally {
      setSubmittingId(null);
    }
  }

  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d084]" />
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes pendientes</h1>
          <p className="text-sm text-gray-500">
            Revisa, edita y aprueba las solicitudes que llegan por WhatsApp.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden mb-4">
          {(
            [
              { v: "cert" as Tab, l: "Certificados", n: counts?.cert },
              { v: "generadores" as Tab, l: "Generadores", n: counts?.generadores },
              { v: "fincas" as Tab, l: "Fincas", n: counts?.fincas },
            ]
          ).map((t, idx) => {
            const isActive = tab === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setTab(t.v)}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                  idx > 0 ? "border-l border-gray-300" : ""
                } ${
                  isActive
                    ? "bg-[#00d084] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t.l}
                {typeof t.n === "number" && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/25 text-white"
                        : t.n > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-500">Cargando…</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            No hay solicitudes pendientes.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {tab === "cert" &&
              (items as CertItem[]).map((c) => (
                <CertCard
                  key={c.id}
                  c={c}
                  isAdmin={isAdmin}
                  onAprobar={() => doAction(c.id, "aprobar")}
                  onRechazar={() => {
                    setActionFor(c.id);
                    setActionMode("rechazar");
                  }}
                  submitting={submittingId === c.id}
                />
              ))}
            {tab === "generadores" &&
              (items as GenItem[]).map((g) => (
                <GenCard
                  key={g.id}
                  g={g}
                  onAprobar={() => doAction(g.id, "aprobar")}
                  onRechazar={() => {
                    setActionFor(g.id);
                    setActionMode("rechazar");
                  }}
                  submitting={submittingId === g.id}
                />
              ))}
            {tab === "fincas" &&
              (items as FincaItem[]).map((f) => (
                <FincaCard
                  key={f.id}
                  f={f}
                  onAprobar={() => doAction(f.id, "aprobar")}
                  onRechazar={() => {
                    setActionFor(f.id);
                    setActionMode("rechazar");
                  }}
                  submitting={submittingId === f.id}
                />
              ))}
          </div>
        )}

        {actionFor && actionMode === "rechazar" && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Rechazar solicitud
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Escribe el motivo del rechazo (mínimo 10 caracteres). Esto se le
                informará al agricultor.
              </p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                placeholder="Ej. Las cantidades no coinciden con lo entregado…"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setActionFor(null);
                    setActionMode(null);
                    setMotivo("");
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submittingId === actionFor}
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    doAction(actionFor, "rechazar", motivo.trim())
                  }
                  disabled={
                    submittingId === actionFor || motivo.trim().length < 10
                  }
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg"
                >
                  {submittingId === actionFor ? "Rechazando…" : "Confirmar rechazo"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

function CertCard({
  c,
  isAdmin,
  onAprobar,
  onRechazar,
  submitting,
}: {
  c: CertItem;
  isAdmin: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  submitting: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 mb-1">
            #{c.consecutivo || "—"} · {c.generadorNombre || "Sin nombre"}
          </h3>
          <div className="text-xs text-gray-700 space-y-0.5">
            <p>
              <span className="text-gray-500">
                {(c.generadorTipoPersona || "").toLowerCase().includes("juridic")
                  ? "NIT:"
                  : "Cédula:"}
              </span>{" "}
              {c.generadorCedula || "—"}
            </p>
            <p><span className="text-gray-500">Finca:</span> {c.fincaNombre || "—"}</p>
            <p><span className="text-gray-500">Municipio:</span> {c.municipioDevolucion || "—"}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Solicitado: {fmtFecha(c.fechaSolicitud)} · Origen: {c.origen}
          </p>
        </div>
        {isAdmin && (
          <p className="text-xs text-gray-500 whitespace-nowrap">{c.coordinadorNombre}</p>
        )}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-700">Total recolectado</span>
        <span className="text-2xl font-bold text-emerald-700">{fmtNum(c.total)} kg</span>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[#00865a] underline mb-2"
      >
        {open ? "Ocultar detalle" : "Ver detalle"}
      </button>

      {open && (
        <div className="bg-gray-50 rounded p-3 text-sm space-y-1 mb-3">
          <p><span className="text-gray-500">Devolución:</span> {c.fechadevolucion} · {c.lugardevolucion}</p>
          <p><span className="text-gray-500">Triple lavado:</span> {c.triplelavado}</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <Stat label="Rígidos" v={c.rigidos} />
            <Stat label="Flexibles" v={c.flexibles} />
            <Stat label="Metálicos" v={c.metalicos} />
            <Stat label="Embalaje" v={c.embalaje} />
          </div>
          {c.observaciones && (
            <p className="mt-2"><span className="text-gray-500">Obs:</span> {c.observaciones}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAprobar}
          disabled={submitting}
          className="flex-1 bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 text-white text-sm font-medium py-2 rounded-lg"
        >
          {submitting ? "Aprobando…" : "✓ Aprobar"}
        </button>
        <button
          onClick={onRechazar}
          disabled={submitting}
          className="flex-1 border border-red-300 hover:bg-red-50 disabled:opacity-50 text-red-700 text-sm font-medium py-2 rounded-lg"
        >
          ✗ Rechazar
        </button>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-white rounded px-2 py-1 text-center">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{fmtNum(v)}</p>
    </div>
  );
}

function GenCard({
  g,
  onAprobar,
  onRechazar,
  submitting,
}: {
  g: GenItem;
  onAprobar: () => void;
  onRechazar: () => void;
  submitting: boolean;
}) {
  const esRevision = g.estado === "pendiente_revision";
  const diffLegible = g.diffLegible || [];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-medium text-gray-900">{g.nombre || "Sin nombre"}</h3>
          <p className="text-xs text-gray-500">
            {g.tipopersona} · {g.tipo} · NIT/CC {g.nit || "—"}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
            esRevision
              ? "bg-orange-100 text-orange-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {esRevision ? "Revisar cambios" : "Nuevo registro"}
        </span>
      </div>
      {esRevision && diffLegible.length > 0 && (
        <div className="bg-orange-50 rounded p-3 text-sm space-y-1 mb-3">
          <p className="text-xs text-orange-800 font-semibold mb-1">
            Cambios solicitados:
          </p>
          {diffLegible.map((d, idx) => (
            <p key={`${d.label}-${idx}`}>
              <span className="text-orange-700">{d.label}:</span> {d.valor}
            </p>
          ))}
        </div>
      )}
      <div className="text-sm text-gray-700 space-y-1 mb-3">
        <p><span className="text-gray-500">Dirección:</span> {g.direccion || "—"}</p>
        <p><span className="text-gray-500">Móvil:</span> {g.movil || "—"}</p>
        <p><span className="text-gray-500">Email:</span> {g.email || "—"}</p>
        <p className="text-xs text-gray-500">
          Solicitado: {fmtFecha(g.fechaSolicitud)} · Origen: {g.origen}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAprobar}
          disabled={submitting}
          className="flex-1 bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 text-white text-sm font-medium py-2 rounded-lg"
        >
          {submitting ? "Aprobando…" : "✓ Aprobar registro"}
        </button>
        <button
          onClick={onRechazar}
          disabled={submitting}
          className="flex-1 border border-red-300 hover:bg-red-50 disabled:opacity-50 text-red-700 text-sm font-medium py-2 rounded-lg"
        >
          ✗ Rechazar
        </button>
      </div>
    </div>
  );
}

function FincaCard({
  f,
  onAprobar,
  onRechazar,
  submitting,
}: {
  f: FincaItem;
  onAprobar: () => void;
  onRechazar: () => void;
  submitting: boolean;
}) {
  const esRevision = f.estado === "pendiente_revision";
  const diffLegible = f.diffLegible || [];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-medium text-gray-900">{f.nombre || "Sin nombre"}</h3>
          <p className="text-xs text-gray-500">
            {esRevision ? "Edición pendiente" : "Finca nueva"} · Solicitado{" "}
            {fmtFecha(f.fechaSolicitud)} · {f.origen}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            esRevision
              ? "bg-orange-100 text-orange-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {esRevision ? "Revisar cambios" : "Pendiente"}
        </span>
      </div>

      {esRevision && diffLegible.length > 0 && (
        <div className="bg-orange-50 rounded p-3 text-sm space-y-1 mb-3">
          <p className="text-xs text-orange-800 font-semibold mb-1">
            Cambios solicitados:
          </p>
          {diffLegible.map((d, idx) => (
            <p key={`${d.label}-${idx}`}>
              <span className="text-orange-700">{d.label}:</span> {d.valor}
            </p>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-700 mb-3">
        <p><span className="text-gray-500">Móvil:</span> {f.movil || "—"}</p>
        <p><span className="text-gray-500">Email:</span> {f.email || "—"}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAprobar}
          disabled={submitting}
          className="flex-1 bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 text-white text-sm font-medium py-2 rounded-lg"
        >
          {submitting ? "Aprobando…" : "✓ Aprobar"}
        </button>
        <button
          onClick={onRechazar}
          disabled={submitting}
          className="flex-1 border border-red-300 hover:bg-red-50 disabled:opacity-50 text-red-700 text-sm font-medium py-2 rounded-lg"
        >
          ✗ Rechazar
        </button>
      </div>
    </div>
  );
}
