"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ActividadForm, { ActividadFormData } from "@/components/ActividadForm";
import ImageUpload, { ImageFile } from "@/components/ImageUpload";
import Link from "next/link";
import { getMensajeErrorActividad } from "@/lib/dateValidations";
import { puedeEditarActividad, actividadIncompleta, getMensajeIncompleta } from "@/lib/actividadCompleteness";

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

interface Actividad {
  id: string;
  fields: {
    "Nombre de la Actividad"?: string;
    Fecha?: string;
    Descripcion?: string;
    Tipo?: string;
    Estado?: string;
    Modalidad?: string[];
    "Perfil de Asistentes"?: string;
    Cultivo?: string;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    "Cantidad de Participantes"?: number;
    Observaciones?: string;
    Fotografias?: AirtableAttachment[];
    "Listado Asistencia"?: AirtableAttachment[];
    "Evaluaciones"?: AirtableAttachment[];
    "Modalidad Evaluacion"?: string;
  };
}

export default function EditarActividadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const actividadId = params.id as string;

  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<AirtableAttachment[]>([]);
  const [photosToRemove, setPhotosToRemove] = useState<Set<string>>(new Set());
  const [newPhotos, setNewPhotos] = useState<ImageFile[]>([]);
  const [existingDocs, setExistingDocs] = useState<AirtableAttachment[]>([]);
  const [docsToRemove, setDocsToRemove] = useState<Set<string>>(new Set());
  const [newDocs, setNewDocs] = useState<ImageFile[]>([]);
  const [existingEvals, setExistingEvals] = useState<AirtableAttachment[]>([]);
  const [evalsToRemove, setEvalsToRemove] = useState<Set<string>>(new Set());
  const [newEvals, setNewEvals] = useState<ImageFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [currentModalidadEval, setCurrentModalidadEval] = useState<string>("");

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
      const response = await fetch(`/api/actividades/${actividadId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al cargar actividad");
      }

      const data = await response.json();
      setActividad(data.actividad);
      setExistingPhotos(data.actividad.fields?.Fotografias || []);
      setExistingDocs(data.actividad.fields?.["Listado Asistencia"] || []);
      setExistingEvals(data.actividad.fields?.["Evaluaciones"] || []);
      setCurrentModalidadEval(data.actividad.fields?.["Modalidad Evaluacion"] || "");
    } catch (err) {
      console.error("Error fetching activity:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la actividad");
    } finally {
      setLoading(false);
    }
  }

  // Subir archivo usando FormData (evita límite de 4.5MB de base64/JSON)
  const uploadFile = async (recordId: string, file: File, fieldName: string): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recordId", recordId);
    formData.append("fieldName", fieldName);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    return response.ok;
  };

  const toggleRemovePhoto = (photoId: string) => {
    setPhotosToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const toggleRemoveDoc = (docId: string) => {
    setDocsToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleRemoveEval = (evalId: string) => {
    setEvalsToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(evalId)) {
        next.delete(evalId);
      } else {
        next.add(evalId);
      }
      return next;
    });
  };

  async function handleSubmit(data: ActividadFormData, _fotografias: ImageFile[], _documentos: ImageFile[], _evaluaciones: ImageFile[]) {
    setError(null);
    setUploadProgress(null);

    // Validar archivos obligatorios (existentes - removidos + nuevos)
    const finalPhotosCount = (existingPhotos.length - photosToRemove.size) + newPhotos.length;
    if (finalPhotosCount === 0) {
      setError("Debes mantener o adjuntar al menos una fotografía de la actividad");
      return;
    }

    const isSens = data.tipo === "Sensibilización";
    if (isSens) {
      const finalDocsCount = (existingDocs.length - docsToRemove.size) + newDocs.length;
      if (finalDocsCount === 0) {
        setError("Debes adjuntar el Listado de Asistencia para actividades de sensibilización");
        return;
      }
      const evaluadasNum = Number(data.personasEvaluadas) || 0;
      if (evaluadasNum > 0) {
        const finalEvalsCount = (existingEvals.length - evalsToRemove.size) + newEvals.length;
        if (finalEvalsCount === 0) {
          setError("Debes adjuntar el soporte de las evaluaciones presenciales");
          return;
        }
      }
    }

    setSaving(true);

    try {
      // Build the remaining existing photos (excluding removed ones)
      const remainingPhotos = existingPhotos
        .filter((p) => !photosToRemove.has(p.id))
        .map((p) => ({ id: p.id }));

      // Build the remaining existing docs (excluding removed ones)
      const remainingDocs = existingDocs
        .filter((d) => !docsToRemove.has(d.id))
        .map((d) => ({ id: d.id }));

      // Build the remaining existing evals (excluding removed ones)
      const remainingEvals = existingEvals
        .filter((e) => !evalsToRemove.has(e.id))
        .map((e) => ({ id: e.id }));

      // Step 1: Update activity fields + remaining photos + remaining docs + remaining evals
      setUploadProgress("Guardando cambios...");
      // Si la actividad estaba "En curso", al guardar el formulario completo pasa a "Completada"
      const estadoActual = actividad?.fields?.Estado;
      const nuevoEstado = estadoActual === "En curso" ? "Completada" : undefined;

      const response = await fetch(`/api/actividades/${actividadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          fecha: data.fecha,
          descripcion: data.descripcion,
          tipo: data.tipo,
          estado: nuevoEstado,
          modalidad: data.modalidad,
          perfilAsistentes: data.perfilAsistentes || undefined,
          cultivo: data.cultivo || undefined,
          municipioId: data.municipio?.id,
          cantidadParticipantes: data.cantidadParticipantes ? parseInt(data.cantidadParticipantes) : undefined,
          modalidadEvaluacion: data.modalidadEvaluacion || undefined,
          observaciones: data.observaciones || undefined,
          fotografias: remainingPhotos,
          documentos: remainingDocs,
          evaluaciones: remainingEvals,
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || "Error al actualizar");
      }

      // Step 2: Upload new photos (if any)
      if (newPhotos.length > 0) {
        let uploaded = 0;
        let failed = 0;

        for (const img of newPhotos) {
          setUploadProgress(`Subiendo foto ${uploaded + failed + 1} de ${newPhotos.length}...`);

          try {
            const uploadOk = await uploadFile(actividadId, img.file, "Fotografias");

            if (uploadOk) {
              uploaded++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }

        if (failed > 0) {
          setUploadProgress(`Cambios guardados. ${uploaded} fotos subidas, ${failed} fallaron.`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Step 3: Upload new documents (if any)
      if (newDocs.length > 0) {
        let uploadedDocs = 0;
        let failedDocs = 0;

        for (const doc of newDocs) {
          setUploadProgress(`Subiendo documento ${uploadedDocs + failedDocs + 1} de ${newDocs.length}...`);

          try {
            const uploadOk = await uploadFile(actividadId, doc.file, "Listado Asistencia");

            if (uploadOk) {
              uploadedDocs++;
            } else {
              failedDocs++;
            }
          } catch {
            failedDocs++;
          }
        }

        if (failedDocs > 0) {
          setUploadProgress(`Cambios guardados. ${uploadedDocs} documentos subidos, ${failedDocs} fallaron.`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Step 4: Upload new evaluaciones (if any)
      if (newEvals.length > 0) {
        let uploadedEvals = 0;
        let failedEvals = 0;

        for (const evalFile of newEvals) {
          setUploadProgress(`Subiendo evaluación ${uploadedEvals + failedEvals + 1} de ${newEvals.length}...`);

          try {
            const uploadOk = await uploadFile(actividadId, evalFile.file, "Evaluaciones");

            if (uploadOk) {
              uploadedEvals++;
            } else {
              failedEvals++;
            }
          } catch {
            failedEvals++;
          }
        }

        if (failedEvals > 0) {
          setUploadProgress(`Cambios guardados. ${uploadedEvals} evaluaciones subidas, ${failedEvals} fallaron.`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      router.push(`/actividades/${actividadId}`);
    } catch (err) {
      console.error("Error updating activity:", err);
      setError(err instanceof Error ? err.message : "Error al actualizar la actividad");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error && !actividad) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/actividades" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            ← Volver a Actividades
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!actividad) return null;

  // Verificar si puede modificar la actividad (con excepción para incompletas)
  const puedeModificar = puedeEditarActividad(actividad.fields);
  const esIncompleta = actividadIncompleta(actividad.fields);

  // Si no puede modificar, mostrar mensaje y redirigir
  if (!puedeModificar) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href={`/actividades/${actividadId}`} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
              ← Volver al detalle
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Actividad</h1>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
            <div className="flex items-start gap-4">
              <span className="text-4xl">🔒</span>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-yellow-800 mb-2">
                  Esta actividad ya no se puede editar
                </h2>
                <p className="text-yellow-700 mb-4">
                  {actividad.fields.Fecha && getMensajeErrorActividad(actividad.fields.Fecha)}
                </p>
                <Link
                  href={`/actividades/${actividadId}`}
                  className="inline-block px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                >
                  Volver al detalle
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Preparar datos iniciales para el formulario
  const initialData: Partial<ActividadFormData> = {
    name: actividad.fields["Nombre de la Actividad"] || "",
    fecha: actividad.fields.Fecha || "",
    descripcion: actividad.fields.Descripcion || "",
    tipo: actividad.fields.Tipo || "",
    modalidad: actividad.fields.Modalidad || [],
    perfilAsistentes: actividad.fields["Perfil de Asistentes"] || "",
    cultivo: actividad.fields.Cultivo || "",
    municipio: actividad.fields.Municipio?.[0] && actividad.fields["mundep (from Municipio)"]?.[0]
      ? { id: actividad.fields.Municipio[0], mundep: actividad.fields["mundep (from Municipio)"][0] }
      : null,
    cantidadParticipantes: actividad.fields["Cantidad de Participantes"]?.toString() || "",
    modalidadEvaluacion: actividad.fields["Modalidad Evaluacion"] || "",
    observaciones: actividad.fields.Observaciones || "",
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href={`/actividades/${actividadId}`} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Volver al detalle
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Actividad</h1>
          <p className="text-gray-600">Modificar información de la actividad</p>
        </div>

        {esIncompleta && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 mb-1">
                  Actividad incompleta
                </p>
                <p className="text-sm text-amber-800">
                  {getMensajeIncompleta(actividad.fields)}{" "}
                  Esta actividad sigue editable fuera del período habitual hasta que se completen los archivos faltantes.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8">
          {uploadProgress && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              {uploadProgress}
            </div>
          )}

          <ActividadForm
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel="Guardar Cambios"
            loading={saving}
            error={error}
            showImageUpload={false}
            showDocumentUpload={false}
            onModalidadEvaluacionChange={setCurrentModalidadEval}
            evalUploadSection={
              actividad.fields.Tipo === "Sensibilización" &&
              (currentModalidadEval === "Híbrida" || currentModalidadEval === "Solo manual") ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Soporte de evaluaciones en papel <span className="text-red-500">*</span>
                  </label>

                  {existingEvals.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-3">
                        Archivos actuales ({existingEvals.length - evalsToRemove.size} de {existingEvals.length} se conservan)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {existingEvals.map((evalFile) => {
                          const isMarkedForRemoval = evalsToRemove.has(evalFile.id);
                          const isPdf = evalFile.type === "application/pdf";
                          const thumbUrl = evalFile.thumbnails?.large?.url || evalFile.url;
                          return (
                            <div key={evalFile.id} className="relative group">
                              <div className={`aspect-square rounded-lg overflow-hidden bg-gray-100 ${isMarkedForRemoval ? "opacity-40" : ""}`}>
                                {isPdf ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                                    <span className="text-4xl">📄</span>
                                    <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                                  </div>
                                ) : (
                                  <img src={`/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`} alt={evalFile.filename} className="w-full h-full object-cover" />
                                )}
                              </div>
                              {isMarkedForRemoval ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg">
                                  <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded mb-2">Se eliminará</span>
                                  <button type="button" onClick={() => toggleRemoveEval(evalFile.id)} className="text-xs text-blue-600 hover:text-blue-800 underline">Deshacer</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => toggleRemoveEval(evalFile.id)} disabled={saving} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                              <p className="text-xs text-gray-500 mt-1 truncate">{evalFile.filename}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <ImageUpload
                    images={newEvals}
                    onChange={setNewEvals}
                    maxFiles={Math.max(0, 5 - (existingEvals.length - evalsToRemove.size))}
                    maxSizeMB={4}
                    disabled={saving}
                    acceptPdf
                  />
                  <p className="text-xs text-gray-500 mt-1">Adjunta fotos o PDF de los formularios físicos de evaluación.</p>
                </div>
              ) : null
            }
          />

          {/* Photo Management Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Fotografias <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">Obligatorio: al menos una foto.</p>

            {/* Existing Photos */}
            {existingPhotos.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  Fotos actuales ({existingPhotos.length - photosToRemove.size} de {existingPhotos.length} se conservan)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {existingPhotos.map((photo) => {
                    const isMarkedForRemoval = photosToRemove.has(photo.id);
                    const thumbUrl = photo.thumbnails?.large?.url || photo.url;
                    return (
                      <div key={photo.id} className="relative group">
                        <div className={`aspect-square rounded-lg overflow-hidden bg-gray-100 ${isMarkedForRemoval ? "opacity-40" : ""}`}>
                          <img
                            src={`/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`}
                            alt={photo.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {isMarkedForRemoval && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg">
                            <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded mb-2">
                              Se eliminara
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRemovePhoto(photo.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Deshacer
                            </button>
                          </div>
                        )}
                        {!isMarkedForRemoval && (
                          <button
                            type="button"
                            onClick={() => toggleRemovePhoto(photo.id)}
                            disabled={saving}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate" title={photo.filename}>
                          {photo.filename}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* New Photos Upload */}
            <div>
              <p className="text-sm text-gray-600 mb-3">Agregar nuevas fotos</p>
              <ImageUpload
                images={newPhotos}
                onChange={setNewPhotos}
                maxFiles={Math.max(0, 10 - (existingPhotos.length - photosToRemove.size))}
                maxSizeMB={4}
                disabled={saving}
              />
            </div>
          </div>

          {/* Document Management Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Listado de Asistencia
              {actividad.fields.Tipo === "Sensibilización" && (
                <span className="text-red-500"> *</span>
              )}
            </h3>
            {actividad.fields.Tipo === "Sensibilización" && (
              <p className="text-xs text-gray-500 mb-4">
                Obligatorio para actividades de sensibilización.
              </p>
            )}

            {/* Existing Documents */}
            {existingDocs.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  Documentos actuales ({existingDocs.length - docsToRemove.size} de {existingDocs.length} se conservan)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {existingDocs.map((doc) => {
                    const isMarkedForRemoval = docsToRemove.has(doc.id);
                    const isPdf = doc.type === "application/pdf";
                    const thumbUrl = doc.thumbnails?.large?.url || doc.url;
                    return (
                      <div key={doc.id} className="relative group">
                        <div className={`aspect-square rounded-lg overflow-hidden bg-gray-100 ${isMarkedForRemoval ? "opacity-40" : ""}`}>
                          {isPdf ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                              <span className="text-4xl">📄</span>
                              <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={`/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`}
                              alt={doc.filename}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        {isMarkedForRemoval && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg">
                            <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded mb-2">
                              Se eliminara
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRemoveDoc(doc.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Deshacer
                            </button>
                          </div>
                        )}
                        {!isMarkedForRemoval && (
                          <button
                            type="button"
                            onClick={() => toggleRemoveDoc(doc.id)}
                            disabled={saving}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* New Documents Upload */}
            <div>
              <p className="text-sm text-gray-600 mb-3">Agregar nuevos documentos</p>
              <ImageUpload
                images={newDocs}
                onChange={setNewDocs}
                maxFiles={Math.max(0, 5 - (existingDocs.length - docsToRemove.size))}
                maxSizeMB={4}
                disabled={saving}
                acceptPdf
              />
            </div>
          </div>


          <div className="mt-6">
            <Link
              href={`/actividades/${actividadId}`}
              className="block w-full text-center px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
