"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenesCoordinador, type Orden } from "@/lib/airtable";

export default function OrdenesServicioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Cargar órdenes cuando la sesión esté lista
  useEffect(() => {
    async function loadOrdenes() {
      if (!session?.user?.coordinatorRecordId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getOrdenesCoordinador(session.user.coordinatorRecordId);
        setOrdenes(data);
      } catch (err) {
        console.error("Error loading ordenes:", err);
        setError("Error al cargar las órdenes. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadOrdenes();
    }
  }, [session?.user?.coordinatorRecordId]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const estadoColors: Record<string, string> = {
    Borrador: "bg-gray-100 text-gray-800",
    Enviada: "bg-blue-100 text-blue-800",
    Aprobada: "bg-green-100 text-green-800",
    Pagada: "bg-green-600 text-white",
    Rechazada: "bg-red-100 text-red-800",
  };

  // Verificar si una orden puede ser eliminada (restricción de fecha día 7)
  const puedeEliminarOrden = (fechaPedido: string): boolean => {
    if (!fechaPedido) return false;
    
    const fechaOrden = new Date(fechaPedido + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaActual = hoy.getDate();
    
    if (diaActual > 7) {
      // Después del día 7: solo mes actual
      const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return fechaOrden >= inicioMesActual;
    } else {
      // Días 1-7: mes anterior y actual
      const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return fechaOrden >= inicioMesAnterior;
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Órdenes de Servicio
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona las solicitudes de pago a Bogotá
            </p>
          </div>
          <Link
            href="/ordenes-servicio/nueva"
            className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
          >
            + Nueva Orden
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando órdenes...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Contador */}
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Total: {ordenes.length} {ordenes.length === 1 ? "orden" : "órdenes"}
              </p>
            </div>

            {/* Empty State */}
            {ordenes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay órdenes de servicio
                </h3>
                <p className="text-gray-600 mb-6">
                  Aún no has creado ninguna orden de servicio.
                </p>
                <Link
                  href="/ordenes-servicio/nueva"
                  className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
                >
                  Crear primera orden
                </Link>
              </div>
            ) : (
              /* Tabla de órdenes */
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        # Orden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Beneficiario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((orden, index) => {
                      const numeroOrden = orden.fields.NumeroOrden || "S/N";
                      const estado = orden.fields.Estado || "Sin estado";
                      const fechaPedido = orden.fields["Fecha de pedido"] || "";
                      const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
                      const itemsCount = orden.fields.ItemsOrden?.length || 0;
                      const puedeEliminar = puedeEliminarOrden(fechaPedido);

                      return (
                        <tr
                          key={orden.id}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          {/* Número de Orden */}
                          <td className="px-4 py-3">
                            <span className="font-bold text-[#00d084]">#{numeroOrden}</span>
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {fechaPedido
                              ? new Date(fechaPedido).toLocaleDateString("es-CO")
                              : "Sin fecha"}
                          </td>

                          {/* Beneficiario */}
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {beneficiario}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <span
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                estadoColors[estado] || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {estado}
                            </span>
                          </td>

                          {/* Items Count */}
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {itemsCount} {itemsCount === 1 ? "item" : "items"}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {/* Botón Ver Detalle */}
                              <Link
                                href={`/ordenes-servicio/${orden.id}`}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                              >
                                Ver Detalle
                              </Link>

                              {/* Botón Eliminar (solo si cumple restricción) */}
                              {puedeEliminar && (
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Eliminar orden #${numeroOrden}?`)) {
                                      alert("Función eliminar en desarrollo");
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                                  title="Eliminar orden"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
