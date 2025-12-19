"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ConfirmModal from "@/components/ConfirmModal";
import Link from "next/link";

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
    full?: { url: string; width: number; height: number };
  };
}

interface Actividad {
  id: string;
  createdTime: string;
  fields: {
    "Nombre de la Actividad"?: string;
    Fecha?: string;
    Descripcion?: string;
    Tipo?: string;
    "Cantidad de Participantes"?: number;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    Fotografias?: AirtableAttachment[];
    Modalidad?: string[];
    Cultivo?: string;
    "Perfil de Asistentes"?: string;
    Departamento?: string[];
    [key: string]: any;
  };
}

export default function ActividadDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const actividadId = params.id as string;
  
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<AirtableAttachment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated" && actividadId) {
      fetchActividad();
    }
  }, [status, actividadId, router]);

  async function fetchActividad() {
    try {
      setLoading(true);
      const response = await fetch("/api/actividades");
      
      if (!response.ok) {
        throw new Error("Error al cargar actividad");
      }

      const data = await response.json();
      const found = data.actividades?.find((a: Actividad) => a.id === actividadId);
      
      if (!found) {
        setError("Actividad no encontrada");
      } else {
        setActividad(found);
      }
    } catch (err) {
      console.error("Error fetching activity:", err);
      setError("No se pudo cargar la actividad");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/actividades/${actividadId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al eliminar");
      }

      // Redirigir a la lista de actividades
      router.push("/actividades");
    } catch (err) {
      console.error("Error deleting activity:", err);
      setError(err instanceof Error ? err.message : "Error al eliminar la actividad");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || error) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || "Error al cargar la actividad"}
          </div>
          <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            ← Volver a Actividades
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!actividad) return null;

  const photoCount = actividad.fields.Fotografias?.length || 0;

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
                ← Volver a Actividades
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {actividad.fields["Nombre de la Actividad"] || "Sin nombre"}
              </h1>
              <div className="flex gap-4 text-gray-600">
                {actividad.fields.Fecha && (
                  <span>📅 {actividad.fields.Fecha}</span>
                )}
                {actividad.fields["mundep (from Municipio)"]?.[0] && (
                  <span>📍 {actividad.fields["mundep (from Municipio)"][0]}</span>
                )}
                {actividad.fields.Tipo && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {actividad.fields.Tipo}
                  </span>
                )}
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex gap-2">
              {/* Botón Editar */}
              <Link
                href={`/actividades/${actividadId}/editar`}
                className="px-4 py-2 text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </Link>
              
              {/* Botón Eliminar */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {actividad.fields.Descripcion && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Descripción</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{actividad.fields.Descripcion}</p>
              </div>
            )}

            {/* Photos Gallery */}
            {photoCount > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Fotografías ({photoCount})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {actividad.fields.Fotografias?.map((foto) => (
                    <button
                      key={foto.id}
                      onClick={() => setSelectedPhoto(foto)}
                      className="relative group overflow-hidden rounded-lg hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={foto.url}
                        alt={foto.filename}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity flex items-center justify-center">
                        <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                          🔍
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles</h2>
              <dl className="space-y-3 text-sm">
                {actividad.fields["Cantidad de Participantes"] && (
                  <div>
                    <dt className="font-medium text-gray-500">Participantes</dt>
                    <dd className="text-gray-900">{actividad.fields["Cantidad de Participantes"]}</dd>
                  </div>
                )}
                {actividad.fields.Modalidad && actividad.fields.Modalidad.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-500">Modalidad</dt>
                    <dd className="text-gray-900">{actividad.fields.Modalidad.join(", ")}</dd>
                  </div>
                )}
                {actividad.fields.Cultivo && (
                  <div>
                    <dt className="font-medium text-gray-500">Cultivo</dt>
                    <dd className="text-gray-900">{actividad.fields.Cultivo}</dd>
                  </div>
                )}
                {actividad.fields["Perfil de Asistentes"] && (
                  <div>
                    <dt className="font-medium text-gray-500">Perfil de Asistentes</dt>
                    <dd className="text-gray-900">{actividad.fields["Perfil de Asistentes"]}</dd>
                  </div>
                )}
                {actividad.fields.Departamento && actividad.fields.Departamento.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-500">Departamento</dt>
                    <dd className="text-gray-900">{actividad.fields.Departamento.join(", ")}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-gray-500">Fecha de Creación</dt>
                  <dd className="text-gray-900">{new Date(actividad.createdTime).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Photo Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-7xl max-h-full">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute -top-12 right-0 text-white text-4xl hover:text-gray-300"
              >
                ×
              </button>
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.filename}
                className="max-w-full max-h-[90vh] object-contain"
              />
              <div className="mt-4 text-white text-center">
                <p className="text-sm">{selectedPhoto.filename}</p>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Eliminar Actividad"
          message={`¿Estás seguro de que deseas eliminar "${actividad.fields["Nombre de la Actividad"]}"? Esta acción no se puede deshacer y se eliminarán todas las fotografías asociadas.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          loading={deleting}
        />
      </div>
    </AuthenticatedLayout>
  );
}
