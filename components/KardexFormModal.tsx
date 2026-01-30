"use client";

import { useState, useEffect } from "react";
import MunicipioSearch from "./MunicipioSearch";
import ImageUpload, { ImageFile } from "./ImageUpload";
import { getFechaMinimaPermitida, getFechaMaximaPermitida } from "@/lib/dateValidations";

interface KardexFormData {
  fechakardex: string;
  TipoMovimiento: string;
  origenTipo?: string; // "municipio" | "centro" - solo para SALIDA
  MunicipioOrigen?: string;
  CentroAcopio?: string;
  Gestor?: string;
  EstadoPago: string;
  Reciclaje: number | string;
  Incineracion: number | string;
  Flexibles: number | string;
  PlasticoContaminado: number | string;
  Lonas: number | string;
  Carton: number | string;
  Metal: number | string;
}

interface KardexFormModalProps {
  onClose: () => void;
  onSubmit: (data: KardexFormData) => Promise<void>;
}

interface SelectOption {
  id: string;
  name: string;
}

interface CentroAcopio {
  id: string;
  name: string;
  municipioId?: string; // ID del municipio asociado al centro
}

interface Gestor {
  id: string;
  name: string;
}

export default function KardexFormModal({ onClose, onSubmit }: KardexFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [centrosAcopio, setCentrosAcopio] = useState<CentroAcopio[]>([]);
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [loadingGestores, setLoadingGestores] = useState(true);
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [centroSeleccionado, setCentroSeleccionado] = useState<CentroAcopio | null>(null); // Guardar centro completo
  const [fotoBascula, setFotoBascula] = useState<ImageFile[]>([]);
  
  const [formData, setFormData] = useState<KardexFormData>({
    fechakardex: new Date().toISOString().split("T")[0],
    TipoMovimiento: "ENTRADA",
    origenTipo: "municipio", // default para SALIDA
    EstadoPago: "Por Pagar",
    Reciclaje: "",
    Incineracion: "",
    Flexibles: "",
    PlasticoContaminado: "",
    Lonas: "",
    Carton: "",
    Metal: "",
  });

  // Fechas permitidas según regla de 7 días (función centralizada)
  const fechaMinima = getFechaMinimaPermitida();
  const fechaMaxima = getFechaMaximaPermitida();

  // Cargar centros de acopio y gestores al montar el componente
  useEffect(() => {
    const fetchCentrosAcopio = async () => {
      try {
        const response = await fetch("/api/centros-acopio/list");
        if (response.ok) {
          const data = await response.json();
          setCentrosAcopio(data.centros || []);
        }
      } catch (error) {
        console.error("Error cargando centros de acopio:", error);
      } finally {
        setLoadingCentros(false);
      }
    };

    const fetchGestores = async () => {
      try {
        const response = await fetch("/api/gestores/list");
        if (response.ok) {
          const data = await response.json();
          setGestores(data.gestores || []);
        }
      } catch (error) {
        console.error("Error cargando gestores:", error);
      } finally {
        setLoadingGestores(false);
      }
    };

    fetchCentrosAcopio();
    fetchGestores();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // Si cambia el tipo de movimiento, resetear origen y foto báscula
    if (name === "TipoMovimiento") {
      setMunicipio(null);
      setCentroSeleccionado(null);
      setFotoBascula([]); // Limpiar foto al cambiar tipo
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        origenTipo: "municipio",
        MunicipioOrigen: undefined,
        CentroAcopio: undefined,
      }));
      return;
    }
    
    // Si cambia el tipo de origen en SALIDA, limpiar campos correspondientes
    if (name === "origenTipo") {
      setMunicipio(null);
      setCentroSeleccionado(null);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        MunicipioOrigen: undefined,
        CentroAcopio: undefined,
      }));
      return;
    }
    
    // Si cambia el centro de acopio, guardar el objeto completo con municipioId
    if (name === "CentroAcopio" && value) {
      const centroCompleto = centrosAcopio.find(c => c.id === value);
      setCentroSeleccionado(centroCompleto || null);
      console.log('🔍 [KARDEX FORM] Centro seleccionado:', centroCompleto);
    } else if (name === "CentroAcopio" && !value) {
      setCentroSeleccionado(null);
    }
    
    // Para campos numéricos, evitar que se guarden con ceros prefijados
    if (e.target.type === "number" && value !== "") {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue === 0) {
        // Si es 0, mantener como string vacío para evitar ceros prefijados
        setFormData((prev) => ({ ...prev, [name]: "" }));
        return;
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateTotal = () => {
    const toNumber = (val: number | string) => {
      if (val === "" || val === null || val === undefined) return 0;
      return typeof val === "number" ? val : parseFloat(val) || 0;
    };

    return (
      toNumber(formData.Reciclaje) +
      toNumber(formData.Incineracion) +
      toNumber(formData.Flexibles) +
      toNumber(formData.PlasticoContaminado) +
      toNumber(formData.Lonas) +
      toNumber(formData.Carton) +
      toNumber(formData.Metal)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isSalida = formData.TipoMovimiento === "SALIDA";
    
    // Validaciones de reglas de negocio
    
    // 1. Al menos un material con valor > 0
    const totalKilos = calculateTotal();
    if (totalKilos === 0) {
      alert("⚠️ Debes registrar al menos un material con kilos > 0");
      return;
    }
    
    // 2. ENTRADA: Centro de Acopio obligatorio
    if (!isSalida && !formData.CentroAcopio) {
      alert("⚠️ Para ENTRADAS, el Centro de Acopio es obligatorio");
      return;
    }
    
    // 3. ENTRADA: Municipio obligatorio
    if (!isSalida && !municipio) {
      alert("⚠️ Para ENTRADAS, debes seleccionar un municipio");
      return;
    }
    
    // 4. SALIDA: Gestor obligatorio
    if (isSalida && !formData.Gestor) {
      alert("⚠️ Para SALIDAS, el Gestor es obligatorio");
      return;
    }
    
    // 5. SALIDA desde municipio: Municipio obligatorio
    if (isSalida && formData.origenTipo === "municipio" && !municipio) {
      alert("⚠️ Para SALIDAS desde municipio, debes seleccionar el municipio de origen");
      return;
    }
    
    // 6. SALIDA desde centro: Centro de Acopio obligatorio
    if (isSalida && formData.origenTipo === "centro" && !formData.CentroAcopio) {
      alert("⚠️ Para SALIDAS desde centro de acopio, debes seleccionar el centro de origen");
      return;
    }
    
    // 7. Foto de báscula obligatoria para SALIDAS
    if (isSalida && fotoBascula.length === 0) {
      alert("⚠️ La foto de báscula es obligatoria para las SALIDAS");
      return;
    }
    
    setLoading(true);
    
    try {
      const toNumber = (val: number | string) => {
        if (val === "" || val === null || val === undefined) return 0;
        return typeof val === "number" ? val : parseFloat(val) || 0;
      };
      
      // Convert File to base64 if foto exists
      let fotoData: { url: string; name: string } | undefined;
      if (fotoBascula.length > 0) {
        const file = fotoBascula[0].file;
        const reader = new FileReader();
        
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        const base64 = await base64Promise;
        fotoData = {
          url: base64,
          name: file.name,
        };
      }
      
      const submitData = {
        ...formData,
        // Para SALIDA desde centro: enviar municipioId del centro automáticamente
        // Para SALIDA desde municipio: enviar municipio seleccionado
        // Para ENTRADA: siempre enviar municipio seleccionado
        MunicipioOrigen: isSalida 
          ? (formData.origenTipo === "municipio" 
              ? municipio?.id 
              : centroSeleccionado?.municipioId) // NUEVO: municipio del centro
          : municipio?.id,
        CentroAcopio: isSalida
          ? (formData.origenTipo === "centro" ? formData.CentroAcopio : undefined)
          : (formData.CentroAcopio || undefined),
        Gestor: formData.Gestor || undefined,
        Reciclaje: toNumber(formData.Reciclaje),
        Incineracion: toNumber(formData.Incineracion),
        Flexibles: toNumber(formData.Flexibles),
        PlasticoContaminado: toNumber(formData.PlasticoContaminado),
        Lonas: toNumber(formData.Lonas),
        Carton: toNumber(formData.Carton),
        Metal: toNumber(formData.Metal),
        fotoBascula: fotoData, // Enviar foto como { url: base64, name }
      };

      console.log("🔍 [KARDEX FORM] fotoBascula state:", fotoBascula);
      console.log("🔍 [KARDEX FORM] fotoData converted:", fotoData);
      console.log("🔍 [KARDEX FORM] submitData.fotoBascula:", submitData.fotoBascula);
      console.log("🔍 [KARDEX FORM] centroSeleccionado:", centroSeleccionado);
      console.log("🔍 [KARDEX FORM] submitData.MunicipioOrigen:", submitData.MunicipioOrigen);

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      alert("Error al crear movimiento");
    } finally {
      setLoading(false);
    }
  };

  const isSalida = formData.TipoMovimiento === "SALIDA";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">➕ Nuevo Movimiento de Kardex</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información General */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              📋 Información General
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 Fecha *
                </label>
                <input
                  type="date"
                  name="fechakardex"
                  value={formData.fechakardex}
                  onChange={handleChange}
                  min={fechaMinima}
                  max={fechaMaxima}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {new Date().getDate() > 7 
                    ? "Solo se permiten fechas del mes actual"
                    : "Se permiten fechas del mes actual y anterior"}
                </p>
              </div>

              {/* Tipo de Movimiento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📦 Tipo de Movimiento *
                </label>
                <select
                  name="TipoMovimiento"
                  value={formData.TipoMovimiento}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="ENTRADA">⬇️ ENTRADA</option>
                  <option value="SALIDA">⬆️ SALIDA</option>
                </select>
              </div>

              {/* Estado de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  💰 Estado de Pago *
                </label>
                <select
                  name="EstadoPago"
                  value={formData.EstadoPago}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="Por Pagar">Por Pagar</option>
                  <option value="Caja Menor">Caja Menor</option>
                  <option value="Sin Costo">Sin Costo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ubicación y Destino */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              📍 Ubicación y Destino
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Origen - Solo para SALIDA */}
              {isSalida && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 Origen de la Salida *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="origenTipo"
                        value="municipio"
                        checked={formData.origenTipo === "municipio"}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">🏙️ Municipio</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="origenTipo"
                        value="centro"
                        checked={formData.origenTipo === "centro"}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">🏢 Centro de Acopio</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Municipio de Origen - Solo si NO es salida o si es salida desde municipio */}
              {(!isSalida || (isSalida && formData.origenTipo === "municipio")) && (
                <div className={isSalida ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏙️ Municipio {isSalida ? "de Origen *" : ""}
                  </label>
                  <MunicipioSearch
                    value={municipio}
                    onChange={setMunicipio}
                    placeholder="Buscar municipio..."
                    required={isSalida && formData.origenTipo === "municipio"}
                  />
                </div>
              )}

              {/* Centro de Acopio Origen - Solo para SALIDA desde centro */}
              {isSalida && formData.origenTipo === "centro" && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏢 Centro de Acopio de Origen *
                  </label>
                  {loadingCentros ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Cargando centros...
                    </div>
                  ) : (
                    <select
                      name="CentroAcopio"
                      value={formData.CentroAcopio || ""}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">-- Seleccione centro de origen --</option>
                      {centrosAcopio.map((centro) => (
                        <option key={centro.id} value={centro.id}>
                          {centro.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Centro de Acopio Destino - Solo para ENTRADA */}
              {!isSalida && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏢 Centro de Acopio (Destino)
                  </label>
                  {loadingCentros ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Cargando centros...
                    </div>
                  ) : (
                    <select
                      name="CentroAcopio"
                      value={formData.CentroAcopio || ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">-- Seleccione centro de destino --</option>
                      {centrosAcopio.map((centro) => (
                        <option key={centro.id} value={centro.id}>
                          {centro.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Gestor - Solo para SALIDA */}
              {isSalida && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ♻️ Gestor de Residuos *
                  </label>
                  {loadingGestores ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Cargando gestores...
                    </div>
                  ) : (
                    <select
                      name="Gestor"
                      value={formData.Gestor || ""}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">-- Seleccione un gestor --</option>
                      {gestores.map((gestor) => (
                        <option key={gestor.id} value={gestor.id}>
                          {gestor.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cantidades por Material */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              ⚖️ Cantidades por Material (kg)
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Reciclaje */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ♻️ Reciclaje
                </label>
                <input
                  type="number"
                  name="Reciclaje"
                  value={formData.Reciclaje}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Incineración */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🔥 Incineración
                </label>
                <input
                  type="number"
                  name="Incineracion"
                  value={formData.Incineracion}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Flexibles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📦 Flexibles
                </label>
                <input
                  type="number"
                  name="Flexibles"
                  value={formData.Flexibles}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Plástico Contaminado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ⚠️ P. Contaminado
                </label>
                <input
                  type="number"
                  name="PlasticoContaminado"
                  value={formData.PlasticoContaminado}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Lonas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🎪 Lonas
                </label>
                <input
                  type="number"
                  name="Lonas"
                  value={formData.Lonas}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Cartón */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📄 Cartón
                </label>
                <input
                  type="number"
                  name="Carton"
                  value={formData.Carton}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Metal */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ⚙️ Metal
                </label>
                <input
                  type="number"
                  name="Metal"
                  value={formData.Metal}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Total Calculado */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  📊 Total:
                </span>
                <span className="text-2xl font-bold text-purple-700">
                  {calculateTotal().toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                </span>
              </div>
            </div>
          </div>

          {/* Foto de Báscula */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              📸 Foto de Báscula {isSalida && <span className="text-red-500">*</span>}
            </h3>
            
            {isSalida && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                <p className="text-amber-800 text-sm">
                  <span className="font-semibold">⚠️ Obligatorio:</span> Para salidas, la foto de la báscula es requerida.
                </p>
              </div>
            )}
            
            {!isSalida && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                <p className="text-blue-800 text-sm">
                  <span className="font-semibold">ℹ️ Opcional:</span> Para entradas, la foto de la báscula es opcional pero recomendada.
                </p>
              </div>
            )}

            <ImageUpload
              images={fotoBascula}
              onChange={setFotoBascula}
              maxFiles={1}
              maxSizeMB={5}
              disabled={loading}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  ✅ Guardar Movimiento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
