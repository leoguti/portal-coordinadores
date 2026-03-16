"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import Link from "next/link";
import Image from "next/image";

const TIPOS = [
  "Sensibilización",
  "Visita acopio",
  "Visita almacenes ",
  "Reuniones intersectoriales ",
  "Recoleccion",
];

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function maxFechaISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

export default function ActividadEnCursoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);

  // Resultado
  const [actividadId, setActividadId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }
  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!municipio) {
      setError("Debes seleccionar un municipio");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/actividades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          fecha,
          tipo,
          estado: "En curso",
          municipioId: municipio.id,
          descripcion: "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear la actividad");
      }

      const { actividad } = await res.json();
      const id = actividad.id;
      setActividadId(id);

      // Generar QR
      const qrRes = await fetch(`/api/actividades/qr?actividadId=${id}`);
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQrDataUrl(qrData.qr);
        setWaUrl(qrData.waUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  // Vista de éxito con QR
  if (actividadId && qrDataUrl) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-lg mx-auto text-center">
          <div className="mb-6">
            <Link href="/actividades" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Volver a Actividades
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">¡Actividad creada!</h1>
            <p className="text-gray-500 mb-6 text-sm">
              Comparte este QR con los participantes para que respondan la evaluación por WhatsApp.
            </p>

            <div className="flex justify-center mb-4">
              <Image
                src={qrDataUrl}
                alt="QR Evaluación"
                width={280}
                height={280}
                unoptimized
              />
            </div>

            <p className="text-xs text-gray-400 mb-6">
              El QR expira 7 días después de la fecha de la actividad.
            </p>

            <div className="flex flex-col gap-3">
              <a
                href={qrDataUrl}
                download={`QR-evaluacion-${actividadId}.png`}
                className="w-full py-3 bg-[#042726] hover:bg-[#032120] text-white rounded-lg font-medium transition-colors"
              >
                📥 Descargar QR
              </a>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  📱 Probar en WhatsApp
                </a>
              )}
              <Link
                href="/actividades"
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Ver todas las actividades
              </Link>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mb-4 inline-block text-sm">
            ← Volver a Actividades
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Actividad en campo</h1>
          <p className="text-gray-500 text-sm">
            Crea la actividad ahora para obtener el QR de evaluación. Puedes completar los detalles después.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Actividad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ej: Capacitación Municipio Zipaquirá"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de la actividad <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                min={hoyISO()}
                max={maxFechaISO()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Hoy o hasta 7 días en el futuro.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Actividad <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {TIPOS.map((t) => (
                  <label key={t} className="flex items-center">
                    <input
                      type="radio"
                      name="tipo"
                      value={t}
                      checked={tipo === t}
                      onChange={(e) => setTipo(e.target.value)}
                      required
                      className="mr-2"
                    />
                    <span className="text-sm">{t.trim()}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Municipio <span className="text-red-500">*</span>
              </label>
              <MunicipioSearch
                value={municipio}
                onChange={setMunicipio}
                placeholder="Buscar municipio..."
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? "Creando..." : "📍 Crear y obtener QR"}
              </button>
              <Link
                href="/actividades"
                className="px-5 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
