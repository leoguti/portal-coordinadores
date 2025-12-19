"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import ImageUpload, { ImageFile } from "@/components/ImageUpload";
import Link from "next/link";

export default function NuevaActividadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
  const [observaciones, setObservaciones] = useState("");
  const [fotografias, setFotografias] = useState<ImageFile[]>([]);

  // Conditional logic based on "Tipo de Actividad"
  const isVisitaAcopio = tipo === "Visita acopio";
  const showPerfil = tipo !== "" && !isVisitaAcopio; // Se muestra cuando tipo NO es "Visita acopio"
  const showCultivo = tipo === "Recoleccion"; // Solo cuando es Recolección
  const showCantidadParticipantes = tipo === "Sensibilización"; // Solo cuando es Sensibilización

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

  // Convertir archivo a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remover el prefijo "data:image/jpeg;base64,"
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Subir una imagen a Airtable
  const uploadImage = async (recordId: string, imageFile: ImageFile): Promise<boolean> => {
    try {
      const base64 = await fileToBase64(imageFile.file);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId,
          fieldName: "Fotografias",
          file: base64,
          filename: imageFile.file.name,
          contentType: imageFile.file.type,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error(`Error uploading ${imageFile.file.name}:`, error);
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

          const success = await uploadImage(recordId, img);

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

      // Success - redirect to actividades list
      router.push("/actividades");
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
                  <span className="font-semibold">📋 Nota:</span> Dentro de los <strong>Documentos de la Actividad</strong>, por favor adjuntar las <strong>listas de chequeo</strong>.
                </p>
              </div>
            )}

            {/* Fotografías - Siempre visible */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fotografías
              </label>
              <ImageUpload
                images={fotografias}
                onChange={setFotografias}
                maxFiles={10}
                maxSizeMB={5}
                disabled={loading}
              />
            </div>

            {/* Documentos de Actividad - Siempre visible (placeholder - pendiente implementar) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documentos de Actividad
                {isVisitaAcopio && <span className="text-amber-600 ml-2">(incluir listas de chequeo)</span>}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                <p className="text-gray-500 text-sm">📄 Subida de documentos próximamente</p>
              </div>
            </div>

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
