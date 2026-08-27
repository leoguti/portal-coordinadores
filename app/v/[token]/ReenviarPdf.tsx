"use client";

import { useState } from "react";

/**
 * Botón de reenvío del PDF oficial al contacto REGISTRADO (enmascarado).
 * El visitante nunca ve el correo completo ni puede elegir el destino.
 */
export default function ReenviarPdf({
  token,
  emailEnmascarado,
  movilEnmascarado,
}: {
  token: string;
  emailEnmascarado: string;
  movilEnmascarado: string;
}) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function reenviar() {
    setEstado("enviando");
    setMensaje(null);
    try {
      const res = await fetch("/api/certificados/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEstado("ok");
        setMensaje(`PDF enviado al correo registrado (${data.email}). Revise también la carpeta de spam.`);
      } else {
        setEstado("error");
        setMensaje(data.mensaje || data.error || "No se pudo reenviar. Intente más tarde.");
      }
    } catch {
      setEstado("error");
      setMensaje("Error de conexión. Intente de nuevo.");
    }
  }

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 space-y-2">
      <p className="text-xs text-gray-500">
        El PDF oficial contiene los datos completos, por eso no se descarga desde aquí:
        solo se reenvía a los contactos que el generador registró en CampoLimpio.
      </p>
      {emailEnmascarado ? (
        <button
          onClick={reenviar}
          disabled={estado === "enviando" || estado === "ok"}
          className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {estado === "enviando"
            ? "Enviando..."
            : estado === "ok"
              ? "✓ Enviado"
              : `Reenviar PDF al correo registrado (${emailEnmascarado})`}
        </button>
      ) : (
        <p className="text-sm text-gray-600">Este certificado no tiene correo registrado.</p>
      )}
      {movilEnmascarado && (
        <p className="text-xs text-gray-500">
          También puede pedirlo escribiendo al WhatsApp de CampoLimpio desde el número registrado ({movilEnmascarado}).
        </p>
      )}
      {mensaje && (
        <p className={`text-sm ${estado === "ok" ? "text-green-700" : "text-red-700"}`}>{mensaje}</p>
      )}
    </div>
  );
}
