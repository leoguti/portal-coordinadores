"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenById, type Orden } from "@/lib/airtable";

export default function OrdenDetallePage() {
  const params = useParams();
  const router = useRouter();
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrden() {
      try {
        setLoading(true);
        setError(null);
        const data = await getOrdenById(ordenId);
        
        if (!data) {
          setError("Orden no encontrada");
          return;
        }
        
        setOrden(data);
      } catch (err) {
        console.error("Error loading orden:", err);
        setError("Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    }

    if (ordenId) {
      loadOrden();
    }
  }, [ordenId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando orden...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error || !orden) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || "Orden no encontrada"}</p>
            <Link
              href="/ordenes-servicio"
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Volver a órdenes
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const numeroOrden = orden.fields.NumeroOrden || "S/N";
  const fechaPedido = orden.fields["Fecha de pedido"] || "";
  const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
  const estado = orden.fields.Estado || "Sin estado";
  const observaciones = orden.fields.Observaciones || "";
  const total = orden.fields.Total || 0;
  const itemsCount = orden.fields.ItemsOrden?.length || 0;

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link
              href="/ordenes-servicio"
              className="hover:text-[#00d084] transition-colors"
            >
              Órdenes de Servicio
            </Link>
            <span>›</span>
            <span>Orden #{numeroOrden}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Detalle de Orden #{numeroOrden}
          </h1>
        </div>

        {/* Contenido de la orden - Solo lectura */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            📄 Información de la Orden
          </h2>

          {/* Datos básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de pedido
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {fechaPedido
                  ? new Date(fechaPedido).toLocaleDateString("es-CO")
                  : "Sin fecha"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beneficiario
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-medium">
                {beneficiario}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                <span className="text-sm font-semibold text-gray-900">{estado}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de items
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {itemsCount} {itemsCount === 1 ? "item" : "items"}
              </div>
            </div>
          </div>

          {/* Items - Por implementar */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Items</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                ℹ️ Listado de items en desarrollo. Se mostrará la lista completa con detalles de cada Kardex/Servicio.
              </p>
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">TOTAL:</span>
              <span className="text-2xl font-bold text-[#00d084]">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Observaciones */}
          {observaciones && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                {observaciones}
              </div>
            </div>
          )}

          {/* Botón volver */}
          <div className="mt-6 pt-6 border-t border-gray-300">
            <Link
              href="/ordenes-servicio"
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Volver a órdenes
            </Link>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
