"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { useVolverAlListado } from "@/lib/listadoFiltrosNav";
import ConfirmModal from "@/components/ConfirmModal";
import Link from "next/link";
import { puedeModificarActividad, getMensajeErrorActividad } from "@/lib/dateValidations";
import { puedeEditarActividad, actividadIncompleta, getMensajeIncompleta } from "@/lib/actividadCompleteness";
import { isAdmin } from "@/lib/roles";

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
    "Personas Evaluadas"?: number;
    CantidadEvaluaciones?: number;
    "Modalidad Evaluacion"?: string;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    Fotografias?: AirtableAttachment[];
    "Listado Asistencia"?: AirtableAttachment[];
    "Evaluaciones"?: AirtableAttachment[];
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
  const volverHref = useVolverAlListado("/actividades");
  const params = useParams();
  const actividadId = params.id as string;
  
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<AirtableAttachment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [evaluaciones, setEvaluaciones] = useState<{
    total: number; promedio: number;
    evaluaciones: { id: string; nombre: string; telefono: string; puntaje: number; timestamp: string; respuestaP1: string; respuestaP2: string; respuestaP3: string }[];
  } | null>(null);

  // Aprobación admin (sensibilización / evaluaciones por separado)
  const esAdmin = isAdmin(session?.user?.rol);
  const [procesandoAprobacion, setProcesandoAprobacion] = useState<string | null>(null);
  const [rechazoAbierto, setRechazoAbierto] = useState<"sensibilizacion" | "evaluaciones" | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [aprobacionError, setAprobacionError] = useState<string | null>(null);

  async function handleAprobacion(action: string, motivo?: string) {
    setProcesandoAprobacion(action);
    setAprobacionError(null);
    try {
      const res = await fetch(`/api/actividades/${actividadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la aprobación");
      setRechazoAbierto(null);
      setMotivoRechazo("");
      await fetchActividad();
    } catch (e) {
      setAprobacionError(e instanceof Error ? e.message : "Error en la aprobación");
    } finally {
      setProcesandoAprobacion(null);
    }
  }

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
        // Cargar evaluaciones
        const evalRes = await fetch(`/api/evaluaciones?actividadId=${actividadId}`);
        if (evalRes.ok) setEvaluaciones(await evalRes.json());
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
      router.push(volverHref);
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
          <Link href={volverHref} className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
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
              <Link href={volverHref} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
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
            
            {/* Banner: Actividad incompleta */}
            {actividadIncompleta(actividad.fields) && (
              <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 mb-1">
                      Actividad incompleta
                    </p>
                    <p className="text-sm text-amber-800">
                      {getMensajeIncompleta(actividad.fields)} Completa la
                      información para que la actividad cuente como soportada.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2">
              {/* Validar si puede editar (incluye excepción para incompletas) */}
              {puedeEditarActividad(actividad.fields) ? (
                <>
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

                  {/* Botón Eliminar - sólo si dentro de período (no aplica excepción) */}
                  {actividad.fields.Fecha && puedeModificarActividad(actividad.fields.Fecha) && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔒</span>
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-800 mb-1">Actividad Cerrada</p>
                      <p className="text-sm text-yellow-700">
                        {actividad.fields.Fecha && getMensajeErrorActividad(actividad.fields.Fecha)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel de revisión para el informe (solo actividades de Sensibilización).
            Todos ven el estado y el motivo; solo el Administrador ve los botones. */}
        {actividad.fields.Tipo === "Sensibilización" && (() => {
          const f = actividad.fields;
          const tieneEvals =
            (f["Personas Evaluadas"] || 0) > 0 ||
            (f.CantidadEvaluaciones || 0) > 0 ||
            (f.Evaluaciones || []).length > 0;
          return (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Revisión para el informe</h2>
                <span className="text-xs text-gray-400">
                  {esAdmin ? "Aprobada por defecto — rechaza lo que no cumple los requisitos" : ""}
                </span>
              </div>
              {aprobacionError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {aprobacionError}
                </div>
              )}
              <div className={`grid grid-cols-1 ${tieneEvals ? "md:grid-cols-2" : ""} gap-4`}>
                <BloqueAprobacion
                  titulo="Sensibilización"
                  slug="sensibilizacion"
                  estado={f.AprobacionSensibilizacion || "Pendiente"}
                  motivo={f.MotivoRechazoSensibilizacion}
                  esAdmin={esAdmin}
                  procesando={procesandoAprobacion}
                  rechazoAbierto={rechazoAbierto}
                  setRechazoAbierto={setRechazoAbierto}
                  motivoRechazo={motivoRechazo}
                  setMotivoRechazo={setMotivoRechazo}
                  onAccion={handleAprobacion}
                />
                {tieneEvals && (
                  <BloqueAprobacion
                    titulo="Evaluaciones"
                    slug="evaluaciones"
                    estado={f.AprobacionEvaluaciones || "Pendiente"}
                    motivo={f.MotivoRechazoEvaluaciones}
                    esAdmin={esAdmin}
                    procesando={procesandoAprobacion}
                    rechazoAbierto={rechazoAbierto}
                    setRechazoAbierto={setRechazoAbierto}
                    motivoRechazo={motivoRechazo}
                    setMotivoRechazo={setMotivoRechazo}
                    onAccion={handleAprobacion}
                  />
                )}
              </div>
            </div>
          );
        })()}

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
                        src={`/api/image-proxy?url=${encodeURIComponent(foto.url)}`}
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

            {/* Listado de Asistencia Section */}
            {actividad.fields["Listado Asistencia"] && actividad.fields["Listado Asistencia"].length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Listado de Asistencia ({actividad.fields["Listado Asistencia"].length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {actividad.fields["Listado Asistencia"].map((doc) => {
                    const isPdf = doc.type === "application/pdf";
                    const thumbUrl = doc.thumbnails?.large?.url || doc.url;
                    return isPdf ? (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-3xl shrink-0">📄</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                          <p className="text-xs text-gray-500">{(doc.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </a>
                    ) : (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedPhoto(doc)}
                        className="relative group overflow-hidden rounded-lg hover:shadow-lg transition-shadow"
                      >
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`}
                          alt={doc.filename}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity flex items-center justify-center">
                          <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                            🔍
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Evaluaciones WhatsApp Section */}
            {evaluaciones && evaluaciones.total > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Evaluaciones WhatsApp
                  </h2>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#042726]">{evaluaciones.total}</p>
                      <p className="text-xs text-gray-500">respuestas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{evaluaciones.promedio}<span className="text-sm font-normal text-gray-400">/3</span></p>
                      <p className="text-xs text-gray-500">prom. puntaje</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">P1</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">P2</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">P3</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Puntaje</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {evaluaciones.evaluaciones.map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{e.nombre || <span className="text-gray-400 italic">{e.telefono}</span>}</td>
                          <td className="px-4 py-2 text-gray-500">{e.telefono}</td>
                          <td className="px-4 py-2 text-center font-mono">{e.respuestaP1.toUpperCase()}</td>
                          <td className="px-4 py-2 text-center font-mono">{e.respuestaP2.toUpperCase()}</td>
                          <td className="px-4 py-2 text-center font-mono">{e.respuestaP3.toUpperCase()}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.puntaje === 3 ? "bg-green-100 text-green-800" : e.puntaje >= 2 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                              {e.puntaje}/3
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {e.timestamp ? new Date(e.timestamp).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* Evaluaciones (archivos) Section */}
            {actividad.fields["Evaluaciones"] && actividad.fields["Evaluaciones"].length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Evaluaciones ({actividad.fields["Evaluaciones"].length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {actividad.fields["Evaluaciones"].map((doc) => {
                    const isPdf = doc.type === "application/pdf";
                    const thumbUrl = doc.thumbnails?.large?.url || doc.url;
                    return isPdf ? (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-3xl shrink-0">📄</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                          <p className="text-xs text-gray-500">{(doc.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </a>
                    ) : (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedPhoto(doc)}
                        className="relative group overflow-hidden rounded-lg hover:shadow-lg transition-shadow"
                      >
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`}
                          alt={doc.filename}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity flex items-center justify-center">
                          <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                            🔍
                          </span>
                        </div>
                      </button>
                    );
                  })}
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
                {actividad.fields.Tipo === "Sensibilización" && (() => {
                  const papel = actividad.fields["Personas Evaluadas"] || 0;
                  const wa = actividad.fields.CantidadEvaluaciones || 0;
                  const total = papel + wa;
                  return (
                    <>
                      {actividad.fields["Modalidad Evaluacion"] && (
                        <div>
                          <dt className="font-medium text-gray-500">Modalidad de Evaluación</dt>
                          <dd className="text-gray-900">{actividad.fields["Modalidad Evaluacion"]}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="font-medium text-gray-500">Evaluadas en papel / presencial</dt>
                        <dd className="text-gray-900">{papel}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Evaluadas por WhatsApp</dt>
                        <dd className="text-gray-900">{wa}</dd>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <dt className="font-medium text-gray-500">Total evaluaciones</dt>
                        <dd className="text-gray-900 font-semibold">{total}</dd>
                      </div>
                    </>
                  );
                })()}
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
                src={`/api/image-proxy?url=${encodeURIComponent(selectedPhoto.url)}`}
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

/** Bloque de aprobación de un componente (sensibilización o evaluaciones). */
function BloqueAprobacion({
  titulo,
  slug,
  estado,
  motivo,
  esAdmin,
  procesando,
  rechazoAbierto,
  setRechazoAbierto,
  motivoRechazo,
  setMotivoRechazo,
  onAccion,
}: {
  titulo: string;
  slug: "sensibilizacion" | "evaluaciones";
  estado: string;
  motivo?: string;
  esAdmin: boolean;
  procesando: string | null;
  rechazoAbierto: "sensibilizacion" | "evaluaciones" | null;
  setRechazoAbierto: (v: "sensibilizacion" | "evaluaciones" | null) => void;
  motivoRechazo: string;
  setMotivoRechazo: (v: string) => void;
  onAccion: (action: string, motivo?: string) => void;
}) {
  const corregida = estado === "Pendiente" && !!motivo?.trim();
  const badge =
    estado === "Aprobada"
      ? "bg-green-100 text-green-800 border-green-300"
      : estado === "Rechazada"
        ? "bg-red-100 text-red-800 border-red-300"
        : "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{titulo}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge}`}>
          {estado}
        </span>
      </div>

      {corregida && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
          ✏️ Corregida tras rechazo — pendiente de re-revisión
        </p>
      )}

      {!!motivo?.trim() && (estado === "Rechazada" || corregida) && (
        <div className={`text-sm rounded p-2 mb-2 border ${estado === "Rechazada" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <span className={`font-semibold ${estado === "Rechazada" ? "text-red-700" : "text-gray-600"}`}>
            {estado === "Rechazada" ? "Motivo del rechazo:" : "Motivo del rechazo anterior:"}
          </span>{" "}
          <span className={estado === "Rechazada" ? "text-red-800" : "text-gray-700"}>{motivo}</span>
        </div>
      )}

      {esAdmin && (
        rechazoAbierto === slug ? (
          <div className="space-y-2">
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (obligatorio — el coordinador lo verá)"
              className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                disabled={!motivoRechazo.trim() || !!procesando}
                onClick={() => onAccion(`rechazar-${slug}`, motivoRechazo)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Confirmar rechazo
              </button>
              <button
                onClick={() => setRechazoAbierto(null)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {estado !== "Aprobada" && (
              <button
                disabled={!!procesando}
                onClick={() => onAccion(`aprobar-${slug}`)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
              >
                ✓ Aprobar
              </button>
            )}
            {estado !== "Rechazada" && (
              <button
                disabled={!!procesando}
                onClick={() => { setRechazoAbierto(slug); setMotivoRechazo(""); }}
                className="px-3 py-1.5 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
              >
                ✗ Rechazar
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
