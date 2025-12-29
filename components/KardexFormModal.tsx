"use client";

import { useState, useEffect } from "react";
import MunicipioSearch from "./MunicipioSearch";
import GestorSearch from "./GestorSearch";

interface KardexFormData {
  fechakardex: string;
  TipoMovimiento: string;
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
  Descripción: string;
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
}

export default function KardexFormModal({ onClose, onSubmit }: KardexFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [centrosAcopio, setCentrosAcopio] = useState<CentroAcopio[]>([]);
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [gestor, setGestor] = useState<SelectOption | null>(null);
  
  const [formData, setFormData] = useState<KardexFormData>({
    fechakardex: new Date().toISOString().split("T")[0],
    TipoMovimiento: "ENTRADA",
    EstadoPago: "Por Pagar",
    Reciclaje: "",
    Incineracion: "",
    Flexibles: "",
    PlasticoContaminado: "",
    Lonas: "",
    Carton: "",
    Metal: "",
    Descripción: "",
  });

  // Cargar centros de acopio al montar el componente
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

    fetchCentrosAcopio();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
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
    setLoading(true);
    
    try {
      const toNumber = (val: number | string) => {
        if (val === "" || val === null || val === undefined) return 0;
        return typeof val === "number" ? val : parseFloat(val) || 0;
      };

      const submitData = {
        ...formData,
        MunicipioOrigen: municipio?.id,
        CentroAcopio: formData.CentroAcopio || undefined,
        Gestor: gestor?.id,
        Reciclaje: toNumber(formData.Reciclaje),
        Incineracion: toNumber(formData.Incineracion),
        Flexibles: toNumber(formData.Flexibles),
        PlasticoContaminado: toNumber(formData.PlasticoContaminado),
        Lonas: toNumber(formData.Lonas),
        Carton: toNumber(formData.Carton),
        Metal: toNumber(formData.Metal),
      };

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
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
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
              {/* Municipio de Origen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🏙️ Municipio de Origen
                </label>
                <MunicipioSearch
                  value={municipio}
                  onChange={setMunicipio}
                  placeholder="Buscar municipio..."
                />
              </div>

              {/* Centro de Acopio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🏢 Centro de Acopio
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
                    <option value="">-- Seleccione un centro --</option>
                    {centrosAcopio.map((centro) => (
                      <option key={centro.id} value={centro.id}>
                        {centro.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Gestor - Solo para SALIDA */}
              {isSalida && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ♻️ Gestor de Residuos *
                  </label>
                  <GestorSearch
                    value={gestor}
                    onChange={setGestor}
                    placeholder="Buscar gestor..."
                    required={isSalida}
                  />
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

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 Descripción / Observaciones
            </label>
            <textarea
              name="Descripción"
              value={formData.Descripción}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              placeholder="Detalles adicionales del movimiento..."
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
