"use client";

/**
 * Bandeja de revisión de documentos de terceros (SOLO administradores).
 *
 * Los documentos suben en estado "pendiente" (portal o migración); aquí se
 * aprueban o rechazan con motivo. Nada se borra: un rechazo pide al
 * coordinador subir una versión corregida.
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
  tercero: { razonSocial: string; nit: string; tipoPersona: string } | null;
}

const CON_VIGENCIA = new Set(["RUT", "Certificación bancaria", "Cámara de Comercio", "Planilla SS"]);

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const fmtSize = (n: number | null) =>
  n == null ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default function RevisionDocumentosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [conteos, setConteos] = useState({ pendientes: 0, aprobados: 0, rechazados: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendiente" | "rechazado" | "aprobado">("pendiente");
  const [busy, setBusy] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
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

  const decidir = async (doc: Doc, accion: "aprobar" | "rechazar") => {
    setBusy(doc.id);
    setError(null);
    const res = await fetch(`/api/documentos-terceros/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion,
        motivo: accion === "rechazar" ? motivo : undefined,
        fechaExpedicion: fechaExp[doc.id] || undefined,
      }),
    });
    setBusy(null);
    if (res.ok) {
      setRechazando(null);
      setMotivo("");
      await cargar();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error guardando la decisión");
    }
  };

  const visibles = useMemo(() => docs.filter((d) => d.estado === tab), [docs, tab]);

  // Agrupar por tercero para revisar en bloque.
  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; nit: string; docs: Doc[] }>();
    for (const d of visibles) {
      const k = d.terceroId || "sin-tercero";
      if (!m.has(k)) {
        m.set(k, {
          nombre: d.tercero?.razonSocial || "(sin tercero)",
          nit: d.tercero?.nit || "",
          docs: [],
        });
      }
      m.get(k)!.docs.push(d);
    }
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  }, [visibles]);

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
          <p className="text-sm text-gray-500">
            Esta sección es solo para administradores.
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revisión de documentos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Documentos de terceros subidos por los coordinadores. Aprueba los
            correctos; rechaza con motivo los que no sirvan (el coordinador verá
            el motivo y subirá una versión corregida). Nada se elimina.
          </p>
        </div>

        {/* Tabs por estado */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm w-fit">
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

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {grupos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            {tab === "pendiente" ? "No hay documentos pendientes de revisión 🎉" : "Nada por aquí."}
          </div>
        ) : (
          grupos.map(([terceroId, g]) => (
            <div key={terceroId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">{g.nombre}</span>
                {g.nit && <span className="text-xs text-gray-400 font-mono">{g.nit}</span>}
                {terceroId !== "sin-tercero" && (
                  <Link
                    href={`/terceros/${terceroId}`}
                    target="_blank"
                    className="ml-auto text-xs text-gray-400 hover:text-green-700 underline"
                  >
                    Ver tercero →
                  </Link>
                )}
              </div>

              <div className="divide-y divide-gray-50">
                {g.docs.map((d) => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{d.tipo}</span>
                      <span className="text-xs text-gray-400">v{d.version}</span>
                      {d.origen === "migracion" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">migrado</span>
                      )}
                      <a
                        href={`/api/documentos-terceros/${d.id}/archivo`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:underline inline-flex items-center gap-1 max-w-[280px]"
                        title={d.archivoNombre}
                      >
                        📎 <span className="truncate">{d.archivoNombre}</span>
                      </a>
                      <span className="text-[11px] text-gray-400">
                        {fmtSize(d.archivoSize)} · subido {fmt(d.fechaSubida)}
                      </span>
                      {d.estado === "rechazado" && d.motivoRechazo && (
                        <span className="text-[11px] text-red-600">Motivo: {d.motivoRechazo}</span>
                      )}
                      {d.estado === "aprobado" && d.venceEl && (
                        <span className="text-[11px] text-gray-400">vence {fmt(d.venceEl)}</span>
                      )}
                    </div>

                    {d.estado === "pendiente" && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {CON_VIGENCIA.has(d.tipo) && (
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                            Fecha de expedición:
                            <input
                              type="date"
                              value={fechaExp[d.id] ?? (d.fechaExpedicion || "")}
                              onChange={(e) => setFechaExp((p) => ({ ...p, [d.id]: e.target.value }))}
                              className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                            />
                          </label>
                        )}
                        <button
                          onClick={() => decidir(d, "aprobar")}
                          disabled={busy === d.id}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {busy === d.id ? "..." : "✓ Aprobar"}
                        </button>
                        {rechazando === d.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={motivo}
                              onChange={(e) => setMotivo(e.target.value)}
                              placeholder="Motivo del rechazo (lo verá el coordinador)"
                              className="border border-red-300 rounded px-2 py-1.5 text-xs w-64"
                            />
                            <button
                              onClick={() => decidir(d, "rechazar")}
                              disabled={busy === d.id || !motivo.trim()}
                              className="px-2.5 py-1.5 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => { setRechazando(null); setMotivo(""); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => { setRechazando(d.id); setMotivo(""); }}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-red-300 text-red-600 hover:bg-red-50"
                          >
                            ✗ Rechazar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AuthenticatedLayout>
  );
}
