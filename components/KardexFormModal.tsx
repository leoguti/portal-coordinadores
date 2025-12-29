"use client";

import { useState } from "react";

interface KardexFormData {
  fechakardex: string;
  TipoMovimiento: string;
  MunicipioOrigen?: string;
  CentroAcopio?: string;
  Gestor?: string;
  EstadoPago: string;
  Reciclaje: number;
  Incineracion: number;
  Flexibles: number;
  PlasticoContaminado: number;
  Lonas: number;
  Carton: number;
  Metal: number;
  Descripción: string;
}

interface KardexFormModalProps {
  onClose: () => void;
  onSubmit: (data: KardexFormData) => Promise<void>;
}

export default function KardexFormModal({ onClose, onSubmit }: KardexFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<KardexFormData>({
    fechakardex: new Date().toISOString().split("T")[0],
    TipoMovimiento: "ENTRADA",
    EstadoPago: "Por Pagar",
    Reciclaje: 0,
    Incineracion: 0,
    Flexibles: 0,
    PlasticoContaminado: 0,
    Lonas: 0,
    Carton: 0,
    Metal: 0,
    Descripción: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const calculateTotal = () => {
    return (
      formData.Reciclaje +
      formData.Incineracion +
      formData.Flexibles +
      formData.PlasticoContaminado +
      formData.Lonas +
      formData.Carton +
      formData.Metal
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      alert("Error al crear movimiento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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
                  <option value="En Orden">En Orden</option>
                  <option value="Caja Menor">Caja Menor</option>
                  <option value="Sin Costo">Sin Costo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cantidades por Material */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              ⚖️ Cantidades por Material (kg)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Plástico Contaminado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ⚠️ Plástico Contaminado
                </label>
                <input
                  type="number"
                  name="PlasticoContaminado"
                  value={formData.PlasticoContaminado}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Metal */}
              <div>
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
                  {calculateTotal().toLocaleString("es-CO")} kg
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
