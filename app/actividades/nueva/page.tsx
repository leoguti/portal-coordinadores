"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { useVolverAlListado } from "@/lib/listadoFiltrosNav";
import MunicipioSearch from "@/components/MunicipioSearch";
import ImageUpload, { ImageFile } from "@/components/ImageUpload";
import Link from "next/link";

export default function NuevaActividadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const volverHref = useVolverAlListado("/actividades");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Form state
  const [fecha, setFecha] = useState("");
  const [name, setName] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("");
  const [modalidad, setModalidad] = useState<string[]>([]);
  const [perfilAsistentes, setPerfilAsistentes] = useState(""); // singleSelect en Airtable
  const [cultivo, setCultivo] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [cantidadParticipantes, setCantidadParticipantes] = useState("");
  const [personasEvaluadas, setPersonasEvaluadas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fotografias, setFotografias] = useState<ImageFile[]>([]);
  const [documentos, setDocumentos] = useState<ImageFile[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<ImageFile[]>([]);

  // Refs para validación HTML5 nativa de los uploaders
  const fotoCheckRef = useRef<HTMLInputElement>(null);
  const docCheckRef = useRef<HTMLInputElement>(null);
  const evalCheckRef = useRef<HTMLInputElement>(null);

  // Conditional logic based on "Tipo de Actividad"
  const isSensibilizacion = tipo === "Sensibilización";
  const isVisitaAcopio = tipo === "Visita acopio";
  const showPerfil = tipo !== "" && !isVisitaAcopio; // Se muestra cuando tipo NO es "Visita acopio"
  const showCultivo = tipo === "Recoleccion"; // Solo cuando es Recolección
  const showCantidadParticipantes = tipo === "Sensibilización"; // Solo cuando es Sensibilización
  const evaluadasNum = Number(personasEvaluadas) || 0;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Validación HTML5 nativa para los uploaders (replica el comportamiento
  // del tooltip del navegador "Por favor, completa este campo").
  useEffect(() => {
    fotoCheckRef.current?.setCustomValidity(
      fotografias.length > 0 ? "" : "Adjunta al menos una fotografía de la actividad"
    );
  }, [fotografias.length]);

  useEffect(() => {
    if (!docCheckRef.current) return;
    const requiere = isSensibilizacion;
    docCheckRef.current.setCustomValidity(
      !requiere || documentos.length > 0
        ? ""
        : "Adjunta el Listado de Asistencia"
    );
  }, [isSensibilizacion, documentos.length]);

  useEffect(() => {
    if (!evalCheckRef.current) return;
    const requiere = isSensibilizacion && evaluadasNum > 0;
    evalCheckRef.current.setCustomValidity(
      !requiere || evaluaciones.length > 0
        ? ""
        : "Adjunta el soporte de las evaluaciones presenciales"
    );
  }, [isSensibilizacion, evaluadasNum, evaluaciones.length]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // Subir un archivo a Airtable usando FormData (evita límite de 4.5MB de base64/JSON)
  const uploadFile = async (recordId: string, file: File, fieldName: string): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordId", recordId);
      formData.append("fieldName", fieldName);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      return response.ok;
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validar municipio obligatorio
    if (!municipio) {
      setError("Debes seleccionar un municipio");
      return;
    }

    // Validar personas evaluadas <= participantes
    if (showCantidadParticipantes && personasEvaluadas && cantidadParticipantes) {
      if (Number(personasEvaluadas) > Number(cantidadParticipantes)) {
        setError("Las personas evaluadas no pueden ser más que los participantes");
        return;
      }
    }

    // Validar fotografías obligatorias para toda actividad
    if (fotografias.length === 0) {
      setError("Debes adjuntar al menos una fotografía de la actividad");
      return;
    }

    // Validar listado de asistencia obligatorio en Sensibilización
    if (isSensibilizacion && documentos.length === 0) {
      setError("Debes adjuntar el Listado de Asistencia para actividades de sensibilización");
      return;
    }

    // Validar soporte de evaluaciones cuando hay evaluaciones presenciales
    const evaluadasNum = Number(personasEvaluadas) || 0;
    if (isSensibilizacion && evaluadasNum > 0 && evaluaciones.length === 0) {
      setError("Debes adjuntar el soporte de las evaluaciones presenciales");
      return;
    }

    setLoading(true);
    setUploadProgress(null);

    try {
      // Paso 1: Crear la actividad
      setUploadProgress("Creando actividad...");
      
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
          cultivo: showCultivo ? cultivo : undefined,
          municipioId: municipio?.id,
          modalidad: modalidad.length > 0 ? modalidad : undefined,
          perfilAsistentes: showPerfil && perfilAsistentes ? perfilAsistentes : undefined,
          cantidadParticipantes: showCantidadParticipantes && cantidadParticipantes ? parseInt(cantidadParticipantes) : undefined,
          personasEvaluadas: showCantidadParticipantes && personasEvaluadas ? parseInt(personasEvaluadas) : undefined,
          observaciones: observaciones || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear la actividad");
      }

      const { actividad } = await response.json();
      const recordId = actividad.id;

      // Paso 2: Subir fotografías (si hay)
      if (fotografias.length > 0) {
        let uploaded = 0;
        let failed = 0;

        for (const img of fotografias) {
          setUploadProgress(`Subiendo foto ${uploaded + failed + 1} de ${fotografias.length}...`);
          
          // Marcar como subiendo
          setFotografias(prev => prev.map(f => 
            f.id === img.id ? { ...f, uploading: true } : f
          ));

          const success = await uploadFile(recordId, img.file, "Fotografias");

          // Actualizar estado de la imagen
          setFotografias(prev => prev.map(f => 
            f.id === img.id 
              ? { ...f, uploading: false, uploaded: success, error: success ? undefined : "Error al subir" } 
              : f
          ));

          if (success) {
            uploaded++;
          } else {
            failed++;
          }
        }

        if (failed > 0) {
          setUploadProgress(`Actividad creada. ${uploaded} fotos subidas, ${failed} fallaron.`);
          // Esperar un momento para que el usuario vea el mensaje
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Paso 3: Subir documentos (si hay)
      if (documentos.length > 0) {
        let uploadedDocs = 0;
        let failedDocs = 0;

        for (const doc of documentos) {
          setUploadProgress(`Subiendo documento ${uploadedDocs + failedDocs + 1} de ${documentos.length}...`);

          setDocumentos(prev => prev.map(f =>
            f.id === doc.id ? { ...f, uploading: true } : f
          ));

          const success = await uploadFile(recordId, doc.file, "Listado Asistencia");

          setDocumentos(prev => prev.map(f =>
            f.id === doc.id
              ? { ...f, uploading: false, uploaded: success, error: success ? undefined : "Error al subir" }
              : f
          ));

          if (success) {
            uploadedDocs++;
          } else {
            failedDocs++;
          }
        }

        if (failedDocs > 0) {
          setUploadProgress(`Actividad creada. ${uploadedDocs} documentos subidos, ${failedDocs} fallaron.`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Paso 4: Subir evaluaciones (si hay, solo Sensibilización)
      if (evaluaciones.length > 0) {
        let uploadedEvals = 0;
        let failedEvals = 0;

        for (const doc of evaluaciones) {
          setUploadProgress(`Subiendo evaluación ${uploadedEvals + failedEvals + 1} de ${evaluaciones.length}...`);

          setEvaluaciones(prev => prev.map(f =>
            f.id === doc.id ? { ...f, uploading: true } : f
          ));

          const success = await uploadFile(recordId, doc.file, "Evaluaciones");

          setEvaluaciones(prev => prev.map(f =>
            f.id === doc.id
              ? { ...f, uploading: false, uploaded: success, error: success ? undefined : "Error al subir" }
              : f
          ));

          if (success) {
            uploadedEvals++;
          } else {
            failedEvals++;
          }
        }

        if (failedEvals > 0) {
          setUploadProgress(`Actividad creada. ${uploadedEvals} evaluaciones subidas, ${failedEvals} fallaron.`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Success - redirect to actividades list
      router.push(volverHref);
    } catch (err) {
      console.error("Error creating activity:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const toggleModalidad = (value: string) => {
    setModalidad(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href={volverHref} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
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

          {uploadProgress && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              {uploadProgress}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Fecha - Siempre visible */}
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

            {/* Nombre - Siempre visible */}
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

            {/* Descripción - Siempre visible */}
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

            {/* Tipo de Actividad - Siempre visible (singleSelect como radio buttons) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Actividad <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {[
                  { value: "Sensibilización", label: "Sensibilización" },
                  { value: "Visita acopio", label: "Visita acopio" },
                  { value: "Visita almacenes ", label: "Visita almacenes" },
                  { value: "Reuniones intersectoriales ", label: "Reuniones intersectoriales" },
                  { value: "Recoleccion", label: "Recolección" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      name="tipo"
                      value={option.value}
                      checked={tipo === option.value}
                      onChange={(e) => setTipo(e.target.value)}
                      className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      required
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modalidad - Siempre visible (multipleSelect como checkboxes) */}
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

            {/* Perfil de Asistentes - Solo cuando tipo NO es "Visita acopio" */}
            {showPerfil && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perfil de Asistentes <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { value: "Técnicos / Profesionales ", label: "Técnicos / Profesionales" },
                    { value: "Agricultores/ Productor ", label: "Agricultores / Productor" },
                    { value: "Distribuidores/ almacenes", label: "Distribuidores / almacenes" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="perfilAsistentes"
                        value={option.value}
                        checked={perfilAsistentes === option.value}
                        onChange={(e) => setPerfilAsistentes(e.target.value)}
                        className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        required
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Cantidad de Participantes - Solo cuando tipo es "Sensibilización" */}
            {showCantidadParticipantes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad de Participantes <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cantidadParticipantes}
                  onChange={(e) => setCantidadParticipantes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de participantes"
                />
              </div>
            )}

            {/* Personas Evaluadas en papel - Solo Sensibilización */}
            {showCantidadParticipantes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evaluadas en papel / presencial <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max={cantidadParticipantes || undefined}
                  value={personasEvaluadas}
                  onChange={(e) => setPersonasEvaluadas(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de evaluaciones físicas recolectadas"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Solo evaluaciones en papel o presenciales. Las respuestas por WhatsApp se registran automáticamente.
                </p>
              </div>
            )}

            {/* Cultivo - Solo cuando tipo es "Recoleccion" */}
            {showCultivo && (
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
            )}

            {/* Nota especial para Visita Acopio */}
            {isVisitaAcopio && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <span className="font-semibold">📋 Nota:</span> Dentro del <strong>Listado de Asistencia</strong>, por favor adjuntar las <strong>listas de chequeo</strong>.
                </p>
              </div>
            )}

            {/* Fotografías - Siempre visible y OBLIGATORIO */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fotografías <span className="text-red-500">*</span>
              </label>
              <ImageUpload
                images={fotografias}
                onChange={setFotografias}
                maxFiles={10}
                maxSizeMB={4}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Adjunta al menos una foto que evidencie la actividad realizada.
              </p>
              <input
                ref={fotoCheckRef}
                type="text"
                value={fotografias.length}
                onChange={() => {}}
                required
                tabIndex={-1}
                aria-hidden="true"
                className="absolute left-0 top-8 w-1 h-1 opacity-0 pointer-events-none"
              />
            </div>

            {/* Listado de Asistencia - Obligatorio en Sensibilización */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Listado de Asistencia
                {isSensibilizacion && <span className="text-red-500"> *</span>}
                {isVisitaAcopio && <span className="text-amber-600 ml-2">(incluir listas de chequeo)</span>}
              </label>
              <ImageUpload
                images={documentos}
                onChange={setDocumentos}
                maxFiles={5}
                maxSizeMB={4}
                disabled={loading}
                acceptPdf
              />
              {isSensibilizacion && (
                <p className="text-xs text-gray-500 mt-1">
                  Obligatorio para actividades de sensibilización.
                </p>
              )}
              <input
                ref={docCheckRef}
                type="text"
                value={documentos.length}
                onChange={() => {}}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute left-0 top-8 w-1 h-1 opacity-0 pointer-events-none"
              />
            </div>

            {/* Evaluaciones - Solo Sensibilización; obligatorio si evaluadas > 0 */}
            {isSensibilizacion && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Soporte de Evaluaciones presenciales
                  {evaluadasNum > 0 && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <ImageUpload
                  images={evaluaciones}
                  onChange={setEvaluaciones}
                  maxFiles={5}
                  maxSizeMB={3}
                  disabled={loading}
                  acceptPdf
                />
                <p className="text-xs text-gray-500 mt-1">
                  {evaluadasNum > 0
                    ? "Obligatorio: adjunta los formularios físicos / PDFs de las evaluaciones presenciales."
                    : "Si registras evaluaciones presenciales (>0), aquí debes adjuntar su soporte."}
                </p>
                <input
                  ref={evalCheckRef}
                  type="text"
                  value={evaluaciones.length}
                  onChange={() => {}}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute left-0 top-8 w-1 h-1 opacity-0 pointer-events-none"
                />
              </div>
            )}

            {/* Municipio - Selector con búsqueda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Municipio <span className="text-red-500">*</span>
              </label>
              <MunicipioSearch
                value={municipio}
                onChange={setMunicipio}
                placeholder="Buscar municipio..."
                required
              />
            </div>

            {/* Observaciones - Siempre visible */}
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
                href={volverHref}
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
