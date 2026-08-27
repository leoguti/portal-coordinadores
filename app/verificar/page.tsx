"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Página PÚBLICA de verificación manual — para certificados sin QR
// (históricos) o cuando el verificador prefiere digitar en el dominio
// oficial en vez de confiar en el QR impreso.

export default function VerificarPage() {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setBuscando(true);
    try {
      const res = await fetch("/api/certificados/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consecutivo: numero, cedula }),
      });
      const data = await res.json();
      if (res.ok && data.encontrado && data.token) {
        router.push(`/v/${data.token}`);
        return;
      }
      setMensaje(data.mensaje || data.error || "No se pudo verificar. Intente de nuevo.");
    } catch {
      setMensaje("Error de conexión. Intente de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#042726] text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-lg font-bold">CampoLimpio</p>
          <p className="text-sm opacity-80">Verificación oficial de certificados — portal.campolimpio.org</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
          <h1 className="font-bold text-gray-900 text-lg mb-1">Verificar un certificado</h1>
          <p className="text-sm text-gray-600 mb-4">
            Ingrese el número del certificado y la cédula o NIT del generador tal como aparecen en el documento.
            Si el certificado tiene código QR, también puede escanearlo directamente.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número del certificado</label>
              <input
                type="number"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej: 94241"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula o NIT del generador</label>
              <input
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Solo números, sin puntos"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={buscando}
              className="w-full px-4 py-2.5 bg-[#00d084] hover:bg-[#00a868] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {buscando ? "Verificando..." : "Verificar certificado"}
            </button>
          </form>
          {mensaje && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{mensaje}</p>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-2">
          <p>
            <strong>Importante:</strong> la verificación de certificados CampoLimpio solo es válida en{" "}
            <strong>portal.campolimpio.org</strong>. Desconfíe de páginas parecidas en otros dominios.
          </p>
          <p>
            CampoLimpio Colombia — Programa de Manejo de Envases Vacíos ·{" "}
            <a className="underline" href="mailto:certificados@campolimpio.org">certificados@campolimpio.org</a>
          </p>
        </div>
      </main>
    </div>
  );
}
