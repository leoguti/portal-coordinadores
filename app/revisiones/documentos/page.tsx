"use client";

/**
 * Bandeja de revisión de documentos de terceros (SOLO administradores).
 *
 * Patrón "cola de revisión" con panel dividido: lista a la izquierda y el
 * documento EMBEBIDO a la derecha junto a los datos del tercero (NIT y
 * nombre a la vista para comparar contra el PDF), acciones al pie y avance
 * automático al siguiente pendiente tras cada decisión. Nada se borra.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdmin } from "@/lib/roles";

interface Doc {
  id: string;
  terceroId: string | null;
  tipo: string;
  version: number;
  vigente: boolean;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
  archivoNombre: string;
  archivoSize: number | null;
  fechaSubida: string | null;
  fechaExpedicion: string | null;
  venceEl: string | null;
  origen: string | null;
  verificacionIa: string | null;
  tercero: { razonSocial: string; nit: string; tipoPersona: string } | null;
}

const CON_VIGENCIA = new Set(["RUT", "Certificación bancaria", "Cámara de Comercio", "Planilla SS"]);
const MOTIVOS_RAPIDOS = [
  "PDF protegido con contraseña — envía el archivo sin clave",
  "No corresponde al tipo de documento solicitado",
  "Documento ilegible o incompleto",
  "Documento desactualizado — sube una versión reciente",
];

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const fmtSize = (n: number | null) =>
  n == null ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
const esImagen = (nombre: string) => /\.(jpe?g|png|webp|gif|heic)$/i.test(nombre);

function EstadoBadge({ estado }: { estado: Doc["estado"] }) {
  const cfg =
    estado === "aprobado"
      ? "bg-green-100 text-green-700"
      : estado === "rechazado"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  const txt = estado === "aprobado" ? "Aprobado" : estado === "rechazado" ? "Rechazado" : "Pendiente";
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg}`}>{txt}</span>;
}

export default function RevisionDocumentosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [conteos, setConteos] = useState({ pendientes: 0, aprobados: 0, rechazados: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendiente" | "rechazado" | "aprobado">("pendiente");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fechaExp, setFechaExp] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const cargar = async () => {
    const res = await fetch("/api/documentos-terceros/pendientes");
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documentos || []);
      setConteos(data.conteos || { pendientes: 0, aprobados: 0, rechazados: 0 });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Cola visible: en pendientes, los que tienen alerta (🔒) van primero.
  const visibles = useMemo(() => {
    const lista = docs.filter((d) => d.estado === tab);
    lista.sort((a, b) => {
      if (tab === "pendiente" && !!a.verificacionIa !== !!b.verificacionIa) {
        return a.verificacionIa ? -1 : 1;
      }
      const ta = a.tercero?.razonSocial || "";
      const tb = b.tercero?.razonSocial || "";
      return ta.localeCompare(tb) || a.tipo.localeCompare(b.tipo);
    });
    return lista;
  }, [docs, tab]);

  // Selección: mantenerla válida; por defecto el primero de la cola.
  useEffect(() => {
    if (!visibles.some((d) => d.id === selectedId)) {
      setSelectedId(visibles[0]?.id || null);
      setRechazando(false);
      setMotivo("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles]);

  const sel = visibles.find((d) => d.id === selectedId) || null;

  const decidir = async (accion: "aprobar" | "rechazar") => {
    if (!sel) return;
    setBusy(true);
    setError(null);
    // Avance automático: el siguiente en la cola actual.
    const idx = visibles.findIndex((d) => d.id === sel.id);
    const siguiente = visibles[idx + 1]?.id || visibles[idx - 1]?.id || null;

    const res = await fetch(`/api/documentos-terceros/${sel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion,
        motivo: accion === "rechazar" ? motivo : undefined,
        fechaExpedicion: fechaExp[sel.id] || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setRechazando(false);
      setMotivo("");
      await cargar();
      setSelectedId(siguiente);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error guardando la decisión");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (session && !isAdmin(session.user?.rol)) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-sm text-gray-500">Esta sección es solo para administradores.</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/terceros" className="text-sm text-gray-500 hover:text-gray-700">← Terceros</Link>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">Revisión de documentos</h1>
          </div>
          {/* Tabs por estado */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {([
              ["pendiente", `Pendientes (${conteos.pendientes})`],
              ["rechazado", `Rechazados (${conteos.rechazados})`],
              ["aprobado", `Aprobados (${conteos.aprobados})`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-2 ${tab === k ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {visibles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            {tab === "pendiente" ? "No hay documentos pendientes de revisión 🎉" : "Nada por aquí."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
            {/* ── Cola (izquierda) ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:max-h-[78vh] lg:overflow-y-auto">
              {visibles.map((d) => {
                const activo = d.id === selectedId;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedId(d.id); setRechazando(false); setMotivo(""); }}
                    className={`w-full text-left px-3.5 py-2.5 border-b border-gray-50 last:border-b-0 transition-colors ${
                      activo ? "bg-[#e6f9f3] border-l-4 border-l-green-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate flex-1">
                        {d.tercero?.razonSocial || "(sin tercero)"}
                      </span>
                      {d.verificacionIa && <span title={d.verificacionIa}>🔒</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      <span className="font-semibold text-gray-500">{d.tipo}</span>
                      <span>v{d.version}</span>
                      <span className="font-mono">{d.tercero?.nit}</span>
                      <span className="ml-auto">{fmt(d.fechaSubida)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Documento + acciones (derecha) ───────────────────────── */}
            {sel && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-4">
                {/* Datos para comparar contra el documento */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-x-4 gap-y-1 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {sel.tercero?.razonSocial || "(sin tercero)"}
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono font-semibold text-gray-700">{sel.tercero?.nit || "—"}</span>
                      {" · "}{sel.tercero?.tipoPersona || "?"}
                      {sel.terceroId && (
                        <>
                          {" · "}
                          <Link href={`/terceros/${sel.terceroId}`} target="_blank" className="underline hover:text-green-700">
                            ver tercero ↗
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">{sel.tipo} · v{sel.version}</span>
                    <EstadoBadge estado={sel.estado} />
                    {sel.origen === "migracion" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">migrado</span>
                    )}
                  </div>
                </div>

                {sel.verificacionIa && (
                  <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 font-medium">
                    {sel.verificacionIa}
                  </div>
                )}

                {/* Vista previa embebida */}
                <div className="bg-gray-100">
                  {esImagen(sel.archivoNombre) ? (
                    <div className="flex items-center justify-center max-h-[58vh] overflow-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/documentos-terceros/${sel.id}/archivo`}
                        alt={sel.archivoNombre}
                        className="max-w-full h-auto"
                      />
                    </div>
                  ) : (
                    <iframe
                      key={sel.id}
                      src={`/api/documentos-terceros/${sel.id}/archivo`}
                      title={sel.archivoNombre}
                      className="w-full h-[58vh] border-0"
                    />
                  )}
                </div>

                <div className="px-4 py-1.5 border-t border-gray-100 flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="truncate">{sel.archivoNombre}</span>
                  <span>{fmtSize(sel.archivoSize)}</span>
                  <span>subido {fmt(sel.fechaSubida)}</span>
                  <a
                    href={`/api/documentos-terceros/${sel.id}/archivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto underline hover:text-green-700"
                  >
                    abrir en pestaña nueva ↗
                  </a>
                </div>

                {/* Acciones */}
                {sel.estado === "pendiente" && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 space-y-2">
                    {!rechazando ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {CON_VIGENCIA.has(sel.tipo) && (
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            Fecha de expedición:
                            <input
                              type="date"
                              value={fechaExp[sel.id] ?? (sel.fechaExpedicion || "")}
                              onChange={(e) => setFechaExp((p) => ({ ...p, [sel.id]: e.target.value }))}
                              className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                            />
                          </label>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => setRechazando(true)}
                            disabled={busy}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                          >
                            ✗ Rechazar
                          </button>
                          <button
                            onClick={() => decidir("aprobar")}
                            disabled={busy}
                            className="px-5 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {busy ? "..." : "✓ Aprobar y seguir"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {MOTIVOS_RAPIDOS.map((m) => (
                            <button
                              key={m}
                              onClick={() => setMotivo(m)}
                              className={`text-[11px] px-2 py-1 rounded-full border ${
                                motivo === m
                                  ? "border-red-400 bg-red-50 text-red-700"
                                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Motivo del rechazo (lo verá el coordinador)"
                            className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => decidir("rechazar")}
                            disabled={busy || !motivo.trim()}
                            className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                          >
                            {busy ? "..." : "Rechazar y seguir"}
                          </button>
                          <button
                            onClick={() => { setRechazando(false); setMotivo(""); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {sel.estado === "rechazado" && sel.motivoRechazo && (
                  <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-red-600">
                    Motivo del rechazo: {sel.motivoRechazo}
                  </div>
                )}
                {sel.estado === "aprobado" && sel.venceEl && (
                  <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
                    Vence el {fmt(sel.venceEl)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
