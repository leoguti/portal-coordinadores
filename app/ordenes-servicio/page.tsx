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
              /* Grid de Cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ordenes.map((orden) => {
                  const numeroOrden = orden.fields.NumeroOrden || "S/N";
                  const estado = orden.fields.Estado || "Sin estado";
                  const fechaPedido = orden.fields["Fecha de pedido"] || "Sin fecha";
                  const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
                  const itemsCount = orden.fields.ItemsOrden?.length || 0;

                  return (
                    <div
                      key={orden.id}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
                    >
                      {/* Header de la card */}
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Orden #{numeroOrden}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            estadoColors[estado] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {estado}
                        </span>
                      </div>

                      {/* Detalles */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-600">
                          <span className="mr-2">📅</span>
                          <span>{fechaPedido}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <span className="mr-2">👤</span>
                          <span className="truncate" title={beneficiario}>
                            {beneficiario}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <span className="mr-2">📋</span>
                          <span>{itemsCount} {itemsCount === 1 ? "item" : "items"}</span>
                        </div>
                      </div>

                      {/* Observaciones (si existen) */}
                      {orden.fields.Observaciones && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {orden.fields.Observaciones}
                          </p>
                        </div>
                      )}

                      {/* Botón de editar (solo si es borrador) */}
                      {estado === "Borrador" && (
                        <div className="mt-4">
                          <Link
                            href={`/ordenes-servicio/editar/${orden.id}`}
                            className="block w-full text-center px-4 py-2 border-2 border-[#00d084] text-[#00d084] hover:bg-[#e6f9f3] rounded-lg transition-colors font-medium"
                          >
                            ✏️ Editar Orden
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
