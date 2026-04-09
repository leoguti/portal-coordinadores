"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import Link from "next/link";

interface Ubicacion {
  id: string;
  nombre: string;
  cedula: string;
  direccion: string;
  municipio: string;
  mundep: string;
  cultivo: string;
  email: string;
  movil: string;
  conteo_certificados: number;
  codigomunId: string | null;
}

export default function EditarUbicacionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [movil, setMovil] = useState("");
  const [email, setEmail] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    fetch(`/api/ubicaciones/${id}`)
      .then((r) => r.json())
      .then((data: Ubicacion) => {
        setUbicacion(data);
        setNombre(data.nombre);
        setCedula(data.cedula);
        setDireccion(data.direccion);
        setCultivo(data.cultivo);
        setMovil(data.movil);
        setEmail(data.email);
        if (data.codigomunId) {
          setMunicipio({ id: data.codigomunId, mundep: data.mundep || data.municipio });
        }
      })
      .catch(() => setError("No se pudo cargar el generador."))
      .finally(() => setLoading(false));
  }, [status, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!nombre.trim() || !cedula.trim() || !direccion.trim() || !cultivo.trim() || !movil.trim()) {
      setError("Nombre, cédula, dirección, cultivo y teléfono son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/ubicaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          cedula: cedula.trim(),
          direccion: direccion.trim(),
          cultivo: cultivo.trim(),
          movil: movil.trim(),
          email: email.trim(),
          municipioId: municipio?.id ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Error al guardar.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/ubicaciones"), 1500);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AuthenticatedLayout>
        <div className="p-6 text-center text-gray-400 text-sm mt-20">Cargando...</div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/ubicaciones"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Generadores
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Editar generador</h1>
        </div>

        {/* Estadística */}
        {ubicacion && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {ubicacion.conteo_certificados}
              </div>
              <div className="text-xs text-blue-500 mt-0.5">certificados</div>
            </div>
            <div className="text-sm text-blue-700">
              <div className="font-medium">{ubicacion.nombre}</div>
              <div className="text-blue-500">{ubicacion.mundep || ubicacion.municipio}</div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Guardado correctamente. Redirigiendo...
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00d084]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono / Móvil <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={movil}
                onChange={(e) => setMovil(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cultivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cultivo}
                onChange={(e) => setCultivo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00d084]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Municipio
              </label>
              <MunicipioSearch
                value={municipio}
                onChange={setMunicipio}
                placeholder="Buscar municipio..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-[#00d084] text-white font-semibold rounded-lg hover:bg-[#00b870] transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <Link
              href="/ubicaciones"
              className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm text-center"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  );
}
