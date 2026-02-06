"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenesCoordinador, getAllOrdenes, type Orden } from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";

export default function OrdenesServicioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>("");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");

  const isAdmin = session?.user?.rol === "Administrador";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Cargar ordenes cuando la sesion este lista
  useEffect(() => {
    async function loadOrdenes() {
      if (!session?.user?.coordinatorRecordId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let data: Orden[];
        if (isAdmin) {
          data = await getAllOrdenes();
        } else {
          data = await getOrdenesCoordinador(session.user.coordinatorRecordId);
        }
        setOrdenes(data);
      } catch (err) {
        console.error("Error loading ordenes:", err);
        setError("Error al cargar las ordenes. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadOrdenes();
    }
  }, [session?.user?.coordinatorRecordId, isAdmin]);

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
    Enviada: "bg-blue-100 text-blue-800",
    Facturada: "bg-amber-100 text-amber-800",
    Pagada: "bg-green-700 text-white",
    Rechazada: "bg-red-100 text-red-800",
  };

  // Verificar si una orden puede ser eliminada
  // Regla: No eliminar si Facturada/Pagada + regla de 7 días
  const puedeEliminarOrden = (fechaPedido: string, estado: string): boolean => {
    if (!fechaPedido) return false;
    if (estado === "Facturada" || estado === "Pagada") return false;
    return puedeModificarFecha(fechaPedido);
  };

  // Obtener listas unicas para filtros
  const coordinadoresUnicos = [...new Set(ordenes.map(o => o.fields.NombreCoordinador?.[0] || "").filter(Boolean))].sort();
  const beneficiariosUnicos = [...new Set(ordenes.map(o => o.fields.RazonSocial?.[0] || "").filter(Boolean))].sort();
  const estadosUnicos = [...new Set(ordenes.map(o => o.fields.Estado || "").filter(Boolean))].sort();
  const mesesUnicos = [...new Set(ordenes.map(o => (o.fields["Fecha de pedido"] || "").substring(0, 7)).filter(Boolean))].sort().reverse();

  // Aplicar filtros
  const ordenesFiltradas = ordenes.filter(orden => {
    if (filtroCoordinador && (orden.fields.NombreCoordinador?.[0] || "") !== filtroCoordinador) return false;
    if (filtroBeneficiario && (orden.fields.RazonSocial?.[0] || "") !== filtroBeneficiario) return false;
    if (filtroEstado && orden.fields.Estado !== filtroEstado) return false;
    if (filtroMes && (orden.fields["Fecha de pedido"] || "").substring(0, 7) !== filtroMes) return false;
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Ordenes de Servicio
            </h1>
            <p className="text-gray-600 mt-1">
              {isAdmin ? "Vista de administrador - Todas las ordenes" : "Gestiona las solicitudes de pago a Bogota"}
            </p>
          </div>
          <Link
            href="/ordenes-servicio-v2/nueva"
            className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
          >
            + Nueva Orden
          </Link>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
          <div className={`grid grid-cols-1 gap-4 ${isAdmin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador</label>
                <select
                  value={filtroCoordinador}
                  onChange={(e) => { setFiltroCoordinador(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {coordinadoresUnicos.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiario</label>
              <select
                value={filtroBeneficiario}
                onChange={(e) => { setFiltroBeneficiario(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {beneficiariosUnicos.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {estadosUnicos.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
              <select
                value={filtroMes}
                onChange={(e) => { setFiltroMes(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {mesesUnicos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          {(filtroCoordinador || filtroBeneficiario || filtroEstado || filtroMes) && (
            <div className="mt-3">
              <button
                onClick={() => { setFiltroCoordinador(""); setFiltroBeneficiario(""); setFiltroEstado(""); setFiltroMes(""); setCurrentPage(1); }}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
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
              <p className="mt-4 text-gray-600">Cargando ordenes...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Contador y paginacion */}
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Total: {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? "orden" : "ordenes"}
                {ordenesFiltradas.length !== ordenes.length && (
                  <span className="ml-1 text-gray-400">(de {ordenes.length})</span>
                )}
                {ordenesFiltradas.length > ITEMS_PER_PAGE && (
                  <span className="ml-2">
                    (Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, ordenesFiltradas.length)})
                  </span>
                )}
              </p>
            </div>

            {/* Empty State */}
            {ordenesFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {ordenes.length === 0 ? "No hay ordenes de servicio" : "No hay ordenes con estos filtros"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {ordenes.length === 0
                    ? "Aun no has creado ninguna orden de servicio."
                    : "Intenta cambiar los filtros de busqueda."}
                </p>
                {ordenes.length === 0 && (
                  <Link
                    href="/ordenes-servicio-v2/nueva"
                    className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
                  >
                    Crear primera orden
                  </Link>
                )}
              </div>
            ) : (
              /* Tabla de ordenes */
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
                      {isAdmin && (
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                          Coordinador
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Beneficiario
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        PDF
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Calcular ordenes para la pagina actual
                      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                      const endIndex = startIndex + ITEMS_PER_PAGE;
                      const ordenesPaginadas = ordenesFiltradas.slice(startIndex, endIndex);

                      return ordenesPaginadas.map((orden, index) => {
                        const numeroOrden = orden.fields.NumeroOrden || "S/N";
                        const estado = orden.fields.Estado || "Sin estado";
                        const fechaPedido = orden.fields["Fecha de pedido"] || "";
                        const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
                        const coordinador = orden.fields.NombreCoordinador?.[0] || "Sin coordinador";
                        const itemsCount = orden.fields.ItemsOrden?.length || 0;
                        const total = orden.fields.Total || 0;
                        const puedeEliminar = puedeEliminarOrden(fechaPedido, estado);
                        const pdfUrl = orden.fields.PDF?.[0]?.url || null;

                      return (
                        <tr
                          key={orden.id}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          {/* Numero de Orden */}
                          <td className="px-4 py-3">
                            <span className="font-bold text-[#00d084]">#{numeroOrden}</span>
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {fechaPedido
                              ? new Date(fechaPedido + 'T00:00:00').toLocaleDateString("es-CO")
                              : "Sin fecha"}
                          </td>

                          {/* Coordinador (solo admin) */}
                          {isAdmin && (
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {coordinador}
                            </td>
                          )}

                          {/* Beneficiario */}
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {beneficiario}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-1 text-xs font-bold rounded ${
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

                          {/* Total */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-bold text-[#00d084] font-mono">
                              {formatCurrency(total)}
                            </span>
                          </td>

                          {/* PDF */}
                          <td className="px-4 py-3 text-center">
                            {pdfUrl ? (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
                                title="Descargar PDF"
                              >
                                PDF
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {/* Boton Ver Detalle */}
                              <Link
                                href={`/ordenes-servicio/${orden.id}`}
                                className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors whitespace-nowrap"
                              >
                                Ver
                              </Link>

                              {/* Boton Eliminar - solo si cumple restriccion */}
                              {puedeEliminar && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Estas seguro de eliminar la orden #${numeroOrden}?\n\nEsta accion no se puede deshacer.`)) {
                                      try {
                                        const response = await fetch(`/api/ordenes-servicio/${orden.id}`, {
                                          method: 'DELETE',
                                        });

                                        if (response.ok) {
                                          alert(`Orden #${numeroOrden} eliminada correctamente`);
                                          window.location.reload();
                                        } else {
                                          const data = await response.json();
                                          alert(`Error: ${data.error || 'No se pudo eliminar la orden'}`);
                                        }
                                      } catch (error) {
                                        console.error('Error eliminando orden:', error);
                                        alert('Error al eliminar la orden');
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                  title="Eliminar orden"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Controles de paginacion */}
            {ordenesFiltradas.length > ITEMS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Pagina {currentPage} de {Math.ceil(ordenesFiltradas.length / ITEMS_PER_PAGE)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(ordenesFiltradas.length / ITEMS_PER_PAGE)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
