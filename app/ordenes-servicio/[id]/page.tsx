"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenById, getItemsOrden, getKardexByIds, type Orden, type ItemOrden, type Kardex } from "@/lib/airtable";

export default function OrdenDetallePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<Orden | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [kardexMap, setKardexMap] = useState<Map<string, Kardex>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = session?.user?.rol === "Administrador";

  useEffect(() => {
    loadOrden();
  }, [ordenId]);

  async function loadOrden() {
    try {
      setLoading(true);
      setError(null);

      const ordenData = await getOrdenById(ordenId);

      if (!ordenData) {
        setError("Orden no encontrada");
        return;
      }

      setOrden(ordenData);

      const itemsData = await getItemsOrden(ordenId);
      setItems(itemsData);

      const kardexIds = itemsData
        .filter(item => item.fields.Kardex && item.fields.Kardex.length > 0)
        .map(item => item.fields.Kardex![0]);

      if (kardexIds.length > 0) {
        const kardexData = await getKardexByIds(kardexIds);
        const kardexMapTemp = new Map<string, Kardex>();
        kardexData.forEach(k => kardexMapTemp.set(k.id, k));
        setKardexMap(kardexMapTemp);
      }

    } catch (err) {
      console.error("Error loading orden:", err);
      setError("Error al cargar la orden");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Admin actions
  async function handleSubirFactura(file: File) {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const formData = new FormData();
      formData.append("action", "subir-factura");
      formData.append("factura", file);

      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: "Factura subida correctamente. La orden ahora esta en estado Facturada." });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al subir la factura" });
      }
    } catch (err) {
      console.error("Error subiendo factura:", err);
      setActionMessage({ type: "error", text: "Error al subir la factura" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCambiarEstado(nuevoEstado: "Pagada" | "Rechazada") {
    const confirmMsg = nuevoEstado === "Pagada"
      ? "Marcar esta orden como Pagada?"
      : "Rechazar esta orden? Esta accion no se puede deshacer.";

    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cambiar-estado", estado: nuevoEstado }),
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: `Orden marcada como ${nuevoEstado}` });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al cambiar el estado" });
      }
    } catch (err) {
      console.error("Error cambiando estado:", err);
      setActionMessage({ type: "error", text: "Error al cambiar el estado" });
    } finally {
      setActionLoading(false);
    }
  }

  const estadoColors: Record<string, string> = {
    Enviada: "bg-blue-100 text-blue-800 border-blue-300",
    Facturada: "bg-amber-100 text-amber-800 border-amber-300",
    Pagada: "bg-green-700 text-white border-green-800",
    Rechazada: "bg-red-100 text-red-800 border-red-300",
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
              Volver a ordenes
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const numeroOrden = orden.fields.NumeroOrden || "S/N";
  const fechaPedido = orden.fields["Fecha de pedido"] || "";
  const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
  const coordinador = orden.fields.NombreCoordinador?.[0] || "Sin coordinador";
  const estado = orden.fields.Estado || "Sin estado";
  const observaciones = orden.fields.Observaciones || "";
  const total = orden.fields.Total || 0;
  const itemsCount = orden.fields.ItemsOrden?.length || 0;
  const facturaUrl = orden.fields.Factura?.[0]?.url || null;

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
              Ordenes de Servicio
            </Link>
            <span>&rsaquo;</span>
            <span>Orden #{numeroOrden}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Detalle de Orden #{numeroOrden}
              </h1>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold rounded border ${
                  estadoColors[estado] || "bg-gray-100 text-gray-800 border-gray-300"
                }`}
              >
                {estado}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Boton Ver PDF de la orden */}
              {orden.fields.PDF && orden.fields.PDF[0]?.url && (
                <a
                  href={orden.fields.PDF[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Ver PDF Orden
                </a>
              )}
              {/* Boton Descargar Factura */}
              {facturaUrl && (
                <a
                  href={facturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Ver Factura
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Action messages */}
        {actionMessage && (
          <div className={`mb-4 p-4 rounded-lg border ${
            actionMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <p>{actionMessage.text}</p>
          </div>
        )}

        {/* Admin Actions Panel */}
        {isAdmin && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Acciones de Administrador</h3>
            <div className="flex flex-wrap gap-3">
              {/* Subir Factura - solo si estado es "Enviada" */}
              {estado === "Enviada" && (
                <>
                  <input
                    ref={facturaInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleSubirFactura(file);
                      }
                    }}
                  />
                  <button
                    onClick={() => facturaInputRef.current?.click()}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Subiendo..." : "Subir Factura (PDF)"}
                  </button>
                </>
              )}

              {/* Marcar como Pagada - solo si estado es "Facturada" */}
              {estado === "Facturada" && (
                <button
                  onClick={() => handleCambiarEstado("Pagada")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Procesando..." : "Marcar como Pagada"}
                </button>
              )}

              {/* Rechazar - solo si estado es "Enviada" */}
              {estado === "Enviada" && (
                <button
                  onClick={() => handleCambiarEstado("Rechazada")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Procesando..." : "Rechazar Orden"}
                </button>
              )}

              {/* Message when no actions available */}
              {estado !== "Enviada" && estado !== "Facturada" && (
                <p className="text-sm text-gray-500 italic">
                  No hay acciones disponibles para ordenes en estado &quot;{estado}&quot;
                </p>
              )}
            </div>
          </div>
        )}

        {/* Contenido de la orden - Solo lectura */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Informacion de la Orden
          </h2>

          {/* Datos basicos */}
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

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordinador
                </label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                  {coordinador}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero de items
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {itemsCount} {itemsCount === 1 ? "item" : "items"}
              </div>
            </div>
          </div>

          {/* Factura info */}
          {facturaUrl && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-800">Factura del proveedor</h3>
                  <p className="text-xs text-amber-600 mt-1">
                    Archivo: {orden.fields.Factura?.[0]?.filename || "factura.pdf"}
                  </p>
                </div>
                <a
                  href={facturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors"
                >
                  Descargar Factura
                </a>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Items de la Orden</h3>

            {items.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                No hay items en esta orden
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Descripcion</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Forma Cobro</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const tipoItem = item.fields.TipoItem || "";
                      const formaCobro = item.fields.FormaCobro || "";
                      const cantidad = item.fields.Cantidad || 0;
                      const precioUnitario = item.fields.PrecioUnitario || 0;
                      const subtotal = item.fields["Cálculo"] || (cantidad * precioUnitario);
                      const nombre = item.fields.Name || "Sin nombre";

                      const kardexId = item.fields.Kardex?.[0];
                      const kardex = kardexId ? kardexMap.get(kardexId) : undefined;
                      const tipoMovimiento = kardex?.fields.TipoMovimiento;

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          {/* Tipo */}
                          <td className="px-4 py-3">
                            <div className="mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-bold rounded ${
                                  tipoItem === "CON Kardex"
                                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                                    : "bg-purple-100 text-purple-700 border border-purple-300"
                                }`}
                              >
                                {tipoItem === "CON Kardex" ? "KARDEX" : "CATALOGO"}
                              </span>
                            </div>
                            {tipoMovimiento && (
                              <div>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  tipoMovimiento === "ENTRADA"
                                    ? "bg-green-100 text-green-700 border border-green-300"
                                    : "bg-red-100 text-red-700 border border-red-300"
                                }`}>
                                  {tipoMovimiento}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Descripcion/Nombre */}
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {nombre}
                          </td>

                          {/* Cantidad */}
                          <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">
                            {cantidad.toFixed(2)}
                          </td>

                          {/* Forma de Cobro */}
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formaCobro}
                          </td>

                          {/* Precio Unitario */}
                          <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">
                            {formatCurrency(precioUnitario)}
                          </td>

                          {/* Subtotal */}
                          <td className="px-4 py-3 text-right text-sm font-mono font-bold text-[#00d084]">
                            {formatCurrency(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

          {/* Boton volver */}
          <div className="mt-6 pt-6 border-t border-gray-300">
            <Link
              href="/ordenes-servicio"
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Volver a ordenes
            </Link>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
