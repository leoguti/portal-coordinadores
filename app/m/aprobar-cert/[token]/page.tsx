"use client";

/**
 * Página del enlace mágico que recibe el COORDINADOR por email para decidir
 * una solicitud de certificado (aprobar / rechazar).
 *
 * Política de dispositivo: en desktop (≥ md) los botones de decisión son
 * visibles directo. En móvil (< md) hay una ceremonia extra: primero un
 * interstitial de responsabilidad ("Entiendo, voy a decidir ahora") que
 * revela los botones. Aprobar SIEMPRE pasa además por el modal de
 * confirmación de responsabilidad (en móvil: doble ceremonia, intencional).
 *
 * Invalidación: el GET verifica el estado vivo del cert. Si ya fue decidido
 * (por este link, por la bandeja o anulado), se muestra "ya fue resuelta".
 */

import { useEffect, useState, use } from "react";
import MagicLinkLayout, {
  FormCard,
  ErrorPanel,
  LoadingSpinner,
} from "@/components/MagicLinkLayout";

interface Solicitud {
  nombreAgricultor: string;
  cedulaAgricultor: string;
  finca: string;
  municipioDevolucion: string;
  lugarDevolucion: string;
  fechaRecoleccion: string;
  fechaSolicitud: string;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  total: number;
  triplelavado: string;
  observaciones: string;
}

interface Payload {
  resuelto: boolean;
  estado?: string;
  consecutivo: number;
  expiraEn?: string;
  coordinadorNombre?: string;
  waAgricultorUrl?: string | null;
  solicitud?: Solicitud;
}

function fmtKg(n: number): string {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n)} kg`;
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

const LABEL_ESTADO: Record<string, string> = {
  aprobado: "aprobada",
  rechazado: "rechazada",
  anulado: "anulada",
};

function dispositivoActual(): "movil" | "desktop" {
  return typeof window !== "undefined" && window.innerWidth < 768
    ? "movil"
    : "desktop";
}

export default function AprobarCertPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modales de decisión
  const [modal, setModal] = useState<"aprobar" | "rechazar" | null>(null);
  // Ceremonia móvil: en < md los botones de decisión solo se revelan tras
  // aceptar el interstitial de responsabilidad.
  const [movilListo, setMovilListo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [decidido, setDecidido] = useState<{
    tipo: "aprobado" | "rechazado";
    consecutivo: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/m/${token}/aprobar-cert`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "Este enlace no es válido.");
          return;
        }
        setPayload(data as Payload);
      })
      .catch(() => setLoadError("Error de red. Intenta de nuevo."));
  }, [token]);

  async function decidir(accion: "aprobar" | "rechazar") {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/m/${token}/${accion}-cert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispositivo: dispositivoActual(),
          ...(accion === "rechazar" ? { motivo: motivo.trim() } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.code === "RESUELTO") {
          // Alguien decidió primero (bandeja u otro tab): recargar estado.
          setModal(null);
          setPayload(null);
          setLoadError(null);
          const r2 = await fetch(`/api/m/${token}/aprobar-cert`);
          const d2 = await r2.json();
          if (r2.ok) setPayload(d2 as Payload);
          else setLoadError(d2.error || "Esta solicitud ya fue resuelta.");
          return;
        }
        setSubmitError(data.error || "Error procesando la decisión");
        return;
      }
      setModal(null);
      setDecidido({
        tipo: accion === "aprobar" ? "aprobado" : "rechazado",
        consecutivo: Number(data.consecutivo) || payload?.consecutivo || 0,
      });
    } catch {
      setSubmitError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const titulo = "Revisar solicitud de certificado";

  if (loadError) {
    return (
      <MagicLinkLayout titulo={titulo}>
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }

  if (decidido) {
    const esAprobado = decidido.tipo === "aprobado";
    return (
      <MagicLinkLayout titulo={titulo}>
        <div
          className={`rounded-lg border p-6 text-center ${
            esAprobado
              ? "bg-green-50 border-green-200"
              : "bg-orange-50 border-orange-200"
          }`}
        >
          <div className="text-4xl mb-2">{esAprobado ? "✅" : "🚫"}</div>
          {esAprobado ? (
            <>
              <p className="text-green-800 font-medium">
                Certificado #{decidido.consecutivo} aprobado.
              </p>
              <p className="text-sm text-green-700 mt-2">
                El certificado se emitió a tu nombre. El agricultor recibirá el
                PDF por WhatsApp en unos minutos.
              </p>
            </>
          ) : (
            <>
              <p className="text-orange-800 font-medium">
                Solicitud #{decidido.consecutivo} rechazada.
              </p>
              <p className="text-sm text-orange-700 mt-2">
                Le informaremos el motivo al agricultor por WhatsApp — podrá
                corregir los datos y volver a enviar la solicitud.
              </p>
            </>
          )}
          <p className="text-xs text-gray-500 mt-4">
            Este enlace quedó inactivo. Ya puedes cerrar esta página.
          </p>
        </div>
      </MagicLinkLayout>
    );
  }

  if (!payload) {
    return (
      <MagicLinkLayout titulo={titulo}>
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  // ── Ya resuelta (por este link, por la bandeja o anulada) ──
  if (payload.resuelto) {
    const label = LABEL_ESTADO[payload.estado || ""] || payload.estado;
    return (
      <MagicLinkLayout titulo={titulo}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">📁</div>
          <p className="text-gray-900 font-medium">
            Esta solicitud ya fue resuelta.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            La solicitud de certificado{" "}
            {payload.consecutivo ? `#${payload.consecutivo} ` : ""}fue{" "}
            <strong>{label}</strong>. No hay acciones pendientes en este
            enlace.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Puedes consultar el detalle en el portal, en Solicitudes
            pendientes / Certificados.
          </p>
        </div>
      </MagicLinkLayout>
    );
  }

  const s = payload.solicitud!;

  return (
    <MagicLinkLayout
      titulo={titulo}
      subtitulo={
        payload.coordinadorNombre
          ? `Coordinador: ${payload.coordinadorNombre}`
          : undefined
      }
    >
      {/* ── Encabezado de la solicitud ── */}
      <FormCard>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-semibold text-gray-900">
            Solicitud #{payload.consecutivo} · {s.nombreAgricultor || "—"}
          </h2>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
            Pendiente
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Enviada por WhatsApp el {fmtFecha(s.fechaSolicitud)}
        </p>

        <dl className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {(
            [
              ["Agricultor", s.nombreAgricultor],
              ["Cédula / NIT", s.cedulaAgricultor],
              ["Finca", s.finca],
              ["Municipio", s.municipioDevolucion],
              ["Lugar de devolución", s.lugarDevolucion],
              ["Fecha de recolección", s.fechaRecoleccion],
              ["Triple lavado", s.triplelavado],
            ] as const
          ).map(([label, valor]) => (
            <div key={label} className="flex gap-2 px-3 py-1.5 text-sm">
              <dt className="text-gray-500 w-36 shrink-0">{label}</dt>
              <dd className="text-gray-900 break-words min-w-0">
                {valor || "—"}
              </dd>
            </div>
          ))}
        </dl>

        {/* Kilos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {(
            [
              ["Rígidos", s.rigidos],
              ["Flexibles", s.flexibles],
              ["Metálicos", s.metalicos],
              ["Embalaje", s.embalaje],
            ] as const
          ).map(([label, v]) => (
            <div
              key={label}
              className="bg-gray-50 rounded px-2 py-1.5 text-center"
            >
              <p className="text-[10px] text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{fmtKg(v)}</p>
            </div>
          ))}
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mt-2 flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-700">
            Total recolectado
          </span>
          <span className="text-xl font-bold text-emerald-700">
            {fmtKg(s.total)}
          </span>
        </div>

        {s.observaciones && (
          <p className="text-sm text-gray-700 mt-3">
            <span className="text-gray-500">Observaciones:</span>{" "}
            {s.observaciones}
          </p>
        )}
      </FormCard>

      {/* ── Bloque de responsabilidad ── */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-3">
        <p className="text-sm font-semibold text-amber-900 mb-1.5">
          ⚠️ La aprobación de este certificado es tu responsabilidad
        </p>
        <p className="text-sm text-amber-800 leading-relaxed">
          El certificado se emite <strong>con tu nombre</strong>. Si tienes
          cualquier duda sobre los datos, habla primero con el agricultor. No
          apruebes hasta estar completamente seguro de que la información es
          correcta. Si no logras verificarla, rechaza la solicitud indicando el
          motivo — el agricultor podrá corregirla y volver a enviarla.
        </p>
      </div>

      {/* ── WhatsApp al agricultor ──
          En móvil pre-interstitial el botón vive DENTRO del interstitial;
          este standalone se muestra en desktop siempre y en móvil tras la
          ceremonia (así hay exactamente un botón WA en cada estado). */}
      {payload.waAgricultorUrl && (
        <a
          href={payload.waAgricultorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${movilListo ? "block" : "hidden md:block"} w-full text-center border border-[#25d366] text-[#128c7e] hover:bg-green-50 font-medium py-2.5 rounded-lg mb-3`}
        >
          💬 Hablar con {s.nombreAgricultor.split(" ")[0] || "el agricultor"}{" "}
          por WhatsApp
        </a>
      )}

      {/* ── Móvil: interstitial de responsabilidad antes de decidir ── */}
      {!movilListo && (
        <div className="md:hidden bg-white border border-gray-300 rounded-lg p-4 mb-3 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-1.5">
            📱 Vas a decidir desde el celular
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Este certificado se emite <strong>bajo tu responsabilidad como
            coordinador</strong>. Si tienes cualquier duda, habla primero con
            el agricultor.
          </p>
          {payload.waAgricultorUrl && (
            <a
              href={payload.waAgricultorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center border border-[#25d366] text-[#128c7e] hover:bg-green-50 font-medium py-2.5 rounded-lg mb-2"
            >
              💬 Hablar con{" "}
              {s.nombreAgricultor.split(" ")[0] || "el agricultor"} por
              WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => setMovilListo(true)}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-lg"
          >
            Entiendo, voy a decidir ahora
          </button>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-red-700 text-sm">{submitError}</p>
        </div>
      )}

      {/* ── Decisión: directo en desktop; en móvil tras el interstitial ── */}
      <div className={`${movilListo ? "flex" : "hidden md:flex"} gap-3 mb-3`}>
        <button
          type="button"
          onClick={() => setModal("aprobar")}
          disabled={submitting}
          className="flex-1 bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 text-white font-medium py-3 rounded-lg"
        >
          ✓ Aprobar
        </button>
        <button
          type="button"
          onClick={() => {
            setMotivo("");
            setModal("rechazar");
          }}
          disabled={submitting}
          className="flex-1 border border-red-300 hover:bg-red-50 disabled:opacity-50 text-red-700 font-medium py-3 rounded-lg"
        >
          ✗ Rechazar
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Este enlace vence el {fmtFecha(payload.expiraEn || "")} y deja de
        funcionar en cuanto la solicitud se decida. También puedes gestionarla
        en el portal, en Solicitudes pendientes.
      </p>

      {/* ── Modal aprobar ── */}
      {modal === "aprobar" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmar aprobación
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Al aprobar, este certificado se emite{" "}
              <strong>bajo tu responsabilidad como coordinador</strong>.
              ¿Verificaste los datos con el agricultor?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => decidir("aprobar")}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-[#00d084] hover:bg-[#00b870] disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                {submitting ? "Aprobando…" : "Sí, aprobar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal rechazar ── */}
      {modal === "rechazar" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Rechazar solicitud
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Escribe el motivo del rechazo (mínimo 10 caracteres). Se le
              informará al agricultor, que podrá corregir y volver a enviar.
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
                type="button"
                onClick={() => setModal(null)}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => decidir("rechazar")}
                disabled={submitting || motivo.trim().length < 10}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                {submitting ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MagicLinkLayout>
  );
}
