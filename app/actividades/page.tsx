"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
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
    Estado?: string;
    Descripcion?: string;
    Tipo?: string;
    "Cantidad de Participantes"?: number;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    Fotografias?: AirtableAttachment[];
    [key: string]: any;
  };
}

export default function ActividadesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated") {
      fetchActividades();
    }
  }, [status, router]);

  async function fetchActividades() {
    try {
      setLoading(true);
      const response = await fetch("/api/actividades");
      
      if (!response.ok) {
        throw new Error("Error al cargar actividades");
      }

      const data = await response.json();
      setActividades(data.actividades || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError("No se pudieron cargar las actividades");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Actividades</h1>
            <p className="text-gray-600">Listado de actividades del coordinador</p>
          </div>
          <Link
            href="/actividades/nueva"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Nueva Actividad
          </Link>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando actividades...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && actividades.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay actividades registradas
            </h2>
            <p className="text-gray-600 mb-6">
              Comienza creando tu primera actividad
            </p>
            <Link
              href="/actividades/nueva"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <span className="text-xl">+</span>
              Crear Primera Actividad
            </Link>
          </div>
        )}

        {!loading && !error && actividades.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Total: {actividades.length} actividad{actividades.length !== 1 ? "es" : ""}
            </div>

            <div className="grid gap-4">
              {actividades.map((actividad) => {
                const firstPhoto = actividad.fields.Fotografias?.[0];
                const photoCount = actividad.fields.Fotografias?.length || 0;
                const remainingPhotos = photoCount > 1 ? photoCount - 1 : 0;

                return (
                  <Link
                    key={actividad.id}
                    href={`/actividades/${actividad.id}`}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex gap-6">
                      {/* Photo thumbnail */}
                      {firstPhoto && (
                        <div className="flex-shrink-0">
                          <div className="relative w-32 h-32">
                            <img
                              src={firstPhoto.thumbnails?.large?.url || firstPhoto.url}
                              alt="Foto de actividad"
                              className="w-full h-full object-cover rounded-lg"
                            />
                            {remainingPhotos > 0 && (
                              <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow">
                                +{remainingPhotos}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900 mb-1">
                              {actividad.fields["Nombre de la Actividad"] || "Sin nombre"}
                            </h3>
                            <div className="flex gap-4 text-sm text-gray-600">
                              {actividad.fields.Fecha && (
                                <span>📅 {actividad.fields.Fecha}</span>
                              )}
                              {actividad.fields["mundep (from Municipio)"]?.[0] && (
                                <span>📍 {actividad.fields["mundep (from Municipio)"][0]}</span>
                              )}
                            </div>
                          </div>
                          {actividad.fields.Tipo && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              {actividad.fields.Tipo}
                            </span>
                          )}
                        </div>

                        {actividad.fields.Descripcion && (
                          <p className="text-gray-700 mb-3 line-clamp-2">
                            {actividad.fields.Descripcion}
                          </p>
                        )}

                        <div className="flex gap-6 text-sm text-gray-600">
                          {actividad.fields["Cantidad de Participantes"] && (
                            <span><strong>Participantes:</strong> {actividad.fields["Cantidad de Participantes"]}</span>
                          )}
                          {photoCount > 0 && (
                            <span><strong>Fotos:</strong> {photoCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
