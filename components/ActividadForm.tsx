"use client";

import { useState, useMemo } from "react";
import MunicipioSearch from "@/components/MunicipioSearch";
import ImageUpload, { ImageFile } from "@/components/ImageUpload";

export interface ActividadFormData {
  name: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  modalidad: string[];
  perfilAsistentes: string;
  cultivo: string;
  municipio: { id: string; mundep: string } | null;
  cantidadParticipantes: string;
  observaciones: string;
}

interface ActividadFormProps {
  initialData?: Partial<ActividadFormData>;
  onSubmit: (data: ActividadFormData, fotografias: ImageFile[], documentos: ImageFile[]) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  error?: string | null;
  uploadProgress?: string | null;
  showImageUpload?: boolean;
  showDocumentUpload?: boolean;
}

export default function ActividadForm({
  initialData,
  onSubmit,
  submitLabel = "Guardar Actividad",
  loading = false,
  error = null,
  uploadProgress = null,
  showImageUpload = true,
  showDocumentUpload = true,
}: ActividadFormProps) {
  // Form state
  const [fecha, setFecha] = useState(initialData?.fecha || "");
  const [name, setName] = useState(initialData?.name || "");
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || "");
  const [tipo, setTipo] = useState(initialData?.tipo || "");
  const [modalidad, setModalidad] = useState<string[]>(initialData?.modalidad || []);
  const [perfilAsistentes, setPerfilAsistentes] = useState(initialData?.perfilAsistentes || "");
  const [cultivo, setCultivo] = useState(initialData?.cultivo || "");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(initialData?.municipio || null);
  const [cantidadParticipantes, setCantidadParticipantes] = useState(initialData?.cantidadParticipantes || "");
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "");
  const [fotografias, setFotografias] = useState<ImageFile[]>([]);
  const [documentos, setDocumentos] = useState<ImageFile[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calcular fechas permitidas (regla de 7 días de gracia)
  const { minDate, maxDate } = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Fecha máxima: hoy (no permitir futuro)
    const max = hoy.toISOString().split('T')[0];
    
    // Fecha mínima: basada en los 7 días de gracia
    // Si una actividad de un mes se puede editar hasta 7 días después del fin de ese mes,
    // entonces la fecha mínima permitida es el mes cuyo cierre aún no ha llegado
    
    // Calcular qué mes es el más antiguo que aún está abierto
    const mesAnterior = new Date(hoy);
    mesAnterior.setMonth(mesAnterior.getMonth() - 1);
    
    // Último día del mes anterior
    const ultimoDiaMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0);
    
    // Fecha de cierre del mes anterior
    const fechaCierreMesAnterior = new Date(ultimoDiaMesAnterior);
    fechaCierreMesAnterior.setDate(fechaCierreMesAnterior.getDate() + 7);
    
    // Si aún no ha pasado la fecha de cierre del mes anterior, podemos crear actividades de ese mes
    let min: string;
    if (hoy <= fechaCierreMesAnterior) {
      // Mes anterior aún está abierto, permitir desde inicio del mes anterior
      min = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1).toISOString().split('T')[0];
    } else {
      // Mes anterior ya cerró, solo permitir mes actual
      min = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    }
    
    return { minDate: min, maxDate: max };
  }, []);

  // Conditional logic based on "Tipo de Actividad"
  const isVisitaAcopio = tipo === "Visita acopio";
  const showPerfil = tipo !== "" && !isVisitaAcopio;
  const showCultivo = tipo === "Recoleccion";
  const showCantidadParticipantes = tipo === "Sensibilización";

  const toggleModalidad = (value: string) => {
    setModalidad(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    
    // Validar municipio obligatorio
    if (!municipio) {
      setValidationError("Debes seleccionar un municipio");
      return;
    }
    
    await onSubmit({
      name,
      fecha,
      descripcion,
      tipo,
      modalidad,
      perfilAsistentes: showPerfil ? perfilAsistentes : "",
      cultivo: showCultivo ? cultivo : "",
      municipio,
      cantidadParticipantes: showCantidadParticipantes ? cantidadParticipantes : "",
      observaciones,
    }, fotografias, documentos);
  };

  return (
    <>
      {(error || validationError) && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || validationError}
        </div>
      )}

      {uploadProgress && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          {uploadProgress}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-sm text-gray-500">
            Solo puedes registrar actividades dentro del período de gracia (7 días después del fin de mes). 
            Rango permitido: {new Date(minDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} - Hoy
          </p>
        </div>

        {/* Nombre */}
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

        {/* Descripción */}
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

        {/* Tipo de Actividad */}
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

        {/* Modalidad */}
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

        {/* Perfil de Asistentes - Condicional */}
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

        {/* Cantidad de Participantes - Condicional */}
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

        {/* Cultivo - Condicional */}
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

        {/* Nota para Visita Acopio */}
        {isVisitaAcopio && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 text-sm">
              <span className="font-semibold">📋 Nota:</span> Dentro de los <strong>Documentos de la Actividad</strong>, por favor adjuntar las <strong>listas de chequeo</strong>.
            </p>
          </div>
        )}

        {/* Fotografías - Solo en modo crear */}
        {showImageUpload && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotografías
            </label>
            <ImageUpload
              images={fotografias}
              onChange={setFotografias}
              maxFiles={10}
              maxSizeMB={3}
              disabled={loading}
            />
          </div>
        )}

        {/* Documentos de Actividad - Solo en modo crear */}
        {showDocumentUpload && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documentos de Actividad
              {isVisitaAcopio && <span className="text-amber-600 ml-2">(incluir listas de chequeo)</span>}
            </label>
            <ImageUpload
              images={documentos}
              onChange={setDocumentos}
              maxFiles={5}
              maxSizeMB={3}
              disabled={loading}
              acceptPdf
            />
          </div>
        )}

        {/* Municipio */}
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

        {/* Observaciones */}
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

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Guardando..." : submitLabel}
          </button>
        </div>
      </form>
    </>
  );
}
