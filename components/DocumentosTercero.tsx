"use client";

/**
 * Repositorio versionado de documentos del tercero.
 *
 * - Cada subida crea una versión nueva (v1, v2, …). NADA se borra.
 * - Todo documento nace "pendiente" y lo revisa un administrador (la
 *   aprobación llega en el Sprint B; mientras tanto el estado es visible).
 * - Los archivos se sirven solo vía /api/documentos-terceros/[id]/archivo
 *   (requiere sesión).
 */

import { useCallback, useEffect, useState } from "react";
import { puedeSubirVersion, TipoDocumento } from "@/lib/documentosTercerosReglas";

interface Doc {
  id: string;
  tipo: string;
  version: number;
  vigente: boolean;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
  archivoNombre: string;
  fechaSubida: string | null;
  fechaExpedicion: string | null;
  venceEl: string | null;
}

const CON_VIGENCIA = new Set(["RUT", "Certificación bancaria", "Cámara de Comercio", "Planilla SS"]);

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function EstadoBadge({ doc }: { doc: Doc }) {
  const cfg =
    doc.estado === "aprobado"
      ? { cls: "bg-green-100 text-green-700", txt: "Aprobado" }
      : doc.estado === "rechazado"
        ? { cls: "bg-red-100 text-red-700", txt: "Rechazado" }
        : { cls: "bg-amber-100 text-amber-700", txt: "En revisión" };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.txt}
    </span>
  );
}

export default function DocumentosTercero({
  terceroId,
  tipoPersona,
  onCambio,
}: {
  terceroId: string;
  tipoPersona: "Natural" | "Jurídica" | "";
  /** Se llama tras subir, para que el padre refresque la completitud. */
  onCambio?: () => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [fechaExp, setFechaExp] = useState<Record<string, string>>({});
  const [historialAbierto, setHistorialAbierto] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/documentos-terceros?terceroId=${terceroId}`);
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documentos || []);
    }
    setLoading(false);
  }, [terceroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const subir = async (tipo: string, file: File) => {
    setSubiendo(tipo);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("terceroId", terceroId);
    fd.append("tipo", tipo);
    if (fechaExp[tipo]) fd.append("fechaExpedicion", fechaExp[tipo]);
    const res = await fetch("/api/documentos-terceros", { method: "POST", body: fd });
    setSubiendo(null);
    if (res.ok) {
      setFechaExp((p) => ({ ...p, [tipo]: "" }));
      await cargar();
      onCambio?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error subiendo el documento");
    }
  };

  const requeridos = [
    { tipo: "RUT", aplica: true },
    { tipo: "Certificación bancaria", aplica: true },
    { tipo: "Cédula", aplica: tipoPersona === "Natural" },
    { tipo: "Cámara de Comercio", aplica: tipoPersona === "Jurídica" },
  ];
  const aplicables = requeridos.filter((r) => r.aplica);
  const cargados = aplicables.filter((r) => docs.some((d) => d.tipo === r.tipo)).length;
  const otros = docs.filter((d) => d.tipo === "Otro" || d.tipo === "Planilla SS");

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400">
        Cargando documentos...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Documentos para Órdenes de Servicio</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Solo se requieren para OS — para Caja Menor no hay que subir nada.
          </p>
        </div>
        <span className={`text-xs font-semibold ${cargados === aplicables.length ? "text-green-700" : "text-amber-600"}`}>
          {cargados} de {aplicables.length} cargados
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {requeridos.map(({ tipo, aplica }) => {
        const versiones = docs
          .filter((d) => d.tipo === tipo)
          .sort((a, b) => b.version - a.version);
        const vigente = versiones.find((d) => d.vigente) || versiones[0] || null;
        const anteriores = versiones.filter((d) => d !== vigente);
        const tiene = versiones.length > 0;
        const enSubida = subiendo === tipo;

        const borde = aplica
          ? tiene
            ? "border-green-300 bg-green-50"
            : "border-amber-300 bg-amber-50"
          : tiene
            ? "border-gray-300 bg-white"
            : "border-gray-200 bg-gray-50";

        return (
          <div key={tipo} className={`rounded-lg border p-3 ${borde}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base leading-none">{aplica ? (tiene ? "✅" : "⬜") : "○"}</span>
              <span className="text-sm font-medium text-gray-800 flex-1">
                {tipo}
                {!aplica && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (no aplica para {tipoPersona === "Jurídica" ? "empresas" : "personas naturales"})
                  </span>
                )}
              </span>
              {vigente && <EstadoBadge doc={vigente} />}
              {!tiene && aplica && (
                <span className="text-xs font-semibold text-amber-600">Pendiente por subir</span>
              )}
            </div>

            {/* Versión vigente */}
            {vigente && (
              <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/api/documentos-terceros/${vigente.id}/archivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-200 hover:border-green-400 hover:text-green-700 max-w-[260px]"
                    title={vigente.archivoNombre}
                  >
                    📎 <span className="truncate">v{vigente.version} · {vigente.archivoNombre}</span>
                  </a>
                  {vigente.fechaSubida && (
                    <span className="text-gray-400">subido {fmtFecha(vigente.fechaSubida)}</span>
                  )}
                  {vigente.venceEl && (
                    <span className="text-gray-400">vence {fmtFecha(vigente.venceEl)}</span>
                  )}
                </div>
                {vigente.estado === "rechazado" && vigente.motivoRechazo && (
                  <p className="text-red-600">Motivo del rechazo: {vigente.motivoRechazo} — sube una versión corregida.</p>
                )}
              </div>
            )}

            {/* Historial de versiones anteriores (nunca se borran) */}
            {anteriores.length > 0 && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setHistorialAbierto((p) => ({ ...p, [tipo]: !p[tipo] }))}
                  className="text-[11px] text-gray-400 hover:text-gray-600 underline"
                >
                  {historialAbierto[tipo] ? "Ocultar" : "Ver"} versiones anteriores ({anteriores.length})
                </button>
                {historialAbierto[tipo] && (
                  <div className="mt-1 space-y-0.5">
                    {anteriores.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-[11px] text-gray-500">
                        <a
                          href={`/api/documentos-terceros/${d.id}/archivo`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate max-w-[220px]"
                        >
                          📄 v{d.version} · {d.archivoNombre}
                        </a>
                        <span className="text-gray-300">{fmtFecha(d.fechaSubida)}</span>
                        <EstadoBadge doc={d} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subida de nueva versión — con candado: sobre un documento
                aprobado no se piden ni aceptan versiones hasta la ventana
                de renovación (30 días antes del vencimiento). */}
            {(() => {
              const regla = puedeSubirVersion(versiones, tipo as TipoDocumento);
              if (!regla.permitido) {
                return (
                  <p className="mt-2 text-[11px] text-gray-400">
                    🔒 {regla.motivo}
                  </p>
                );
              }
              return (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center text-xs">
                    <span className={`px-3 py-1.5 rounded border cursor-pointer ${
                      aplica && !tiene
                        ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    }`}>
                      {enSubida ? "Subiendo..." : tiene ? "Subir versión nueva" : "Seleccionar archivo"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => e.target.files?.[0] && subir(tipo, e.target.files[0])}
                      disabled={enSubida}
                      className="hidden"
                    />
                  </label>
                  {CON_VIGENCIA.has(tipo) && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                      Fecha de expedición del documento:
                      <input
                        type="date"
                        value={fechaExp[tipo] || ""}
                        onChange={(e) => setFechaExp((p) => ({ ...p, [tipo]: e.target.value }))}
                        className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                      />
                    </label>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Otros documentos */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🗂️</span>
          <span className="text-sm font-medium text-gray-800 flex-1">
            Otros documentos
            <span className="ml-1 text-xs font-normal text-gray-400">(cualquier documento adicional)</span>
          </span>
          <span className="text-xs text-gray-400">
            {otros.length > 0 ? `${otros.length} archivo(s)` : "Ninguno"}
          </span>
        </div>
        {otros.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {otros.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs text-gray-600">
                <a
                  href={`/api/documentos-terceros/${d.id}/archivo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate max-w-[260px]"
                  title={d.archivoNombre}
                >
                  📎 {d.tipo === "Planilla SS" ? "Planilla SS · " : ""}{d.archivoNombre}
                </a>
                <span className="text-gray-300">{fmtFecha(d.fechaSubida)}</span>
                <EstadoBadge doc={d} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-2">
          <label className="inline-flex items-center text-xs">
            <span className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer">
              {subiendo === "Otro" ? "Subiendo..." : "+ Agregar documento"}
            </span>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => e.target.files?.[0] && subir("Otro", e.target.files[0])}
              disabled={subiendo === "Otro"}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        🔒 Los documentos no se pueden eliminar: cada subida crea una versión
        nueva y el historial completo queda guardado para auditoría. Un
        administrador revisa y aprueba cada documento.
      </p>
    </div>
  );
}
