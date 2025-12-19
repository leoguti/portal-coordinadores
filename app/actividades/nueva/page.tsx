"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import Link from "next/link";

export default function NuevaActividadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fecha, setFecha] = useState("");
  const [name, setName] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("");
  const [modalidad, setModalidad] = useState<string[]>([]);
  const [perfilAsistentes, setPerfilAsistentes] = useState<string[]>([]);
  const [cultivo, setCultivo] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Conditional logic based on "Tipo de Actividad"
  const showModalidad = tipo !== "";
  const showPerfil = ["Sensibilización", "Visita almacenes", "Reuniones intersectoriales", "Recoleccion"].includes(tipo);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/actividades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          fecha,
          descripcion,
          tipo,
          cultivo,
          municipio,
          modalidad: modalidad.length > 0 ? modalidad : undefined,
          perfilAsistentes: perfilAsistentes.length > 0 ? perfilAsistentes : undefined,
          observaciones: observaciones || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear la actividad");
      }

      // Success - redirect to actividades list
      router.push("/actividades");
    } catch (err) {
      console.error("Error creating activity:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const toggleModalidad = (value: string) => {
    setModalidad(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const togglePerfilAsistentes = (value: string) => {
    setPerfilAsistentes(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Volver a Actividades
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Nueva Actividad</h1>
          <p className="text-gray-600">Registrar una nueva actividad</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la Actividad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Capacitación en Manejo de Residuos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción de la actividad <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe los detalles de la actividad..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Actividad <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                <option value="Sensibilización">Sensibilización</option>
                <option value="Visita acopio">Visita acopio</option>
                <option value="Visita almacenes">Visita almacenes</option>
                <option value="Reuniones intersectoriales">Reuniones intersectoriales</option>
                <option value="Recoleccion">Recolección</option>
              </select>
            </div>

            {/* Modalidad - Shown for all activity types except empty */}
            {showModalidad && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modalidad de la Actividad <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={modalidad.includes("Virtual")}
                      onChange={() => toggleModalidad("Virtual")}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span>Virtual</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={modalidad.includes("Presencial")}
                      onChange={() => toggleModalidad("Presencial")}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span>Presencial</span>
                  </label>
                </div>
              </div>
            )}

            {/* Perfil de Asistentes - Shown only for specific activity types */}
            {showPerfil && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perfil de Asistentes <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perfilAsistentes.includes("Técnicos / Profesionales")}
                      onChange={() => togglePerfilAsistentes("Técnicos / Profesionales")}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span>Técnicos / Profesionales</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perfilAsistentes.includes("Agricultores/ Productor")}
                      onChange={() => togglePerfilAsistentes("Agricultores/ Productor")}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span>Agricultores / Productor</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perfilAsistentes.includes("Distribuidores/ almacenes")}
                      onChange={() => togglePerfilAsistentes("Distribuidores/ almacenes")}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span>Distribuidores / almacenes</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cultivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={cultivo}
                onChange={(e) => setCultivo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: PALMA, CAFÉ, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Municipio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Fusagasugá"
              />
              <p className="text-xs text-gray-500 mt-1">Próximamente: selector de municipios desde tabla</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observaciones adicionales..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? "Guardando..." : "Guardar Actividad"}
              </button>
              <Link
                href="/actividades"
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
