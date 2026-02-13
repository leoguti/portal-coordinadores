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

  // Filtros
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>("");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");

  // Grupos expandidos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  // Agrupar ordenes filtradas por mes (YYYY-MM)
  const MONTHS_PER_PAGE = 6;
  const [monthPage, setMonthPage] = useState(0);

  const gruposPorMes = (() => {
    const map = new Map<string, { ordenes: Orden[]; total: number; estadoCounts: Record<string, number> }>();
    ordenesFiltradas.forEach((orden) => {
      const fecha = orden.fields["Fecha de pedido"] || "";
      const mesKey = fecha.substring(0, 7) || "sin-fecha";
      if (!map.has(mesKey)) {
        map.set(mesKey, { ordenes: [], total: 0, estadoCounts: {} });
      }
      const grupo = map.get(mesKey)!;
      grupo.ordenes.push(orden);
      grupo.total += orden.fields.Total || 0;
      const estado = orden.fields.Estado || "Sin estado";
      grupo.estadoCounts[estado] = (grupo.estadoCounts[estado] || 0) + 1;
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])); // Más reciente primero
  })();

  const totalPages = Math.ceil(gruposPorMes.length / MONTHS_PER_PAGE);
  const mesesPaginados = gruposPorMes.slice(
    monthPage * MONTHS_PER_PAGE,
    (monthPage + 1) * MONTHS_PER_PAGE
  );

  const formatMesLabel = (mesKey: string) => {
    if (mesKey === "sin-fecha") return "Sin fecha";
    const [year, month] = mesKey.split("-");
    const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${nombres[parseInt(month) - 1]} ${year}`;
  };

  const estadoDotColors: Record<string, string> = {
    Enviada: "bg-blue-500",
    Facturada: "bg-amber-500",
    Pagada: "bg-green-600",
    Rechazada: "bg-red-500",
  };

  function toggleGroup(mesKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mesKey)) next.delete(mesKey);
      else next.add(mesKey);
      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(new Set(mesesPaginados.map(([k]) => k)));
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

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
                  onChange={(e) => { setFiltroCoordinador(e.target.value); setMonthPage(0); }}
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
                onChange={(e) => { setFiltroBeneficiario(e.target.value); setMonthPage(0); }}
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
                onChange={(e) => { setFiltroEstado(e.target.value); setMonthPage(0); }}
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
                onChange={(e) => { setFiltroMes(e.target.value); setMonthPage(0); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {mesesUnicos.map(m => (
                  <option key={m} value={m}>{formatMesLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>
          {(filtroCoordinador || filtroBeneficiario || filtroEstado || filtroMes) && (
            <div className="mt-3">
              <button
                onClick={() => { setFiltroCoordinador(""); setFiltroBeneficiario(""); setFiltroEstado(""); setFiltroMes(""); setMonthPage(0); }}
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
            {/* Resumen y controles */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? "orden" : "ordenes"} en {gruposPorMes.length} {gruposPorMes.length === 1 ? "mes" : "meses"}
              </p>
              {mesesPaginados.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={expandAll} className="text-xs text-gray-600 hover:text-gray-900 underline">Expandir todos</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={collapseAll} className="text-xs text-gray-600 hover:text-gray-900 underline">Colapsar todos</button>
                </div>
              )}
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
              <div className="space-y-3">
                {mesesPaginados.map(([mesKey, grupo]) => {
                  const isExpanded = expandedGroups.has(mesKey);

                  return (
                    <div key={mesKey} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                      {/* Header del grupo mensual */}
                      <button
                        onClick={() => toggleGroup(mesKey)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                            &#9654;
                          </span>
                          <div className="text-left min-w-0">
                            <h3 className="text-base font-bold text-gray-900">
                              {formatMesLabel(mesKey)}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">
                                {grupo.ordenes.length} {grupo.ordenes.length === 1 ? "orden" : "ordenes"}
                              </span>
                              {Object.entries(grupo.estadoCounts).map(([estado, count]) => (
                                <span key={estado} className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <span className={`inline-block w-2 h-2 rounded-full ${estadoDotColors[estado] || "bg-gray-400"}`}></span>
                                  {count} {estado}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <span className="text-lg font-bold font-mono text-[#00d084]">
                            {formatCurrency(grupo.total)}
                          </span>
                        </div>
                      </button>

                      {/* Tabla de ordenes del mes */}
                      {isExpanded && (
                        <div className="border-t border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase"># Orden</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                                  {isAdmin && (
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Coordinador</th>
                                  )}
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Beneficiario</th>
                                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600 uppercase">Items</th>
                                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase">Total</th>
                                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600 uppercase">PDF</th>
                                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grupo.ordenes.map((orden, index) => {
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
                                      className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/50 transition-colors`}
                                    >
                                      <td className="px-4 py-2.5">
                                        <Link href={`/ordenes-servicio/${orden.id}`} className="font-bold text-[#00d084] hover:underline text-sm">
                                          #{numeroOrden}
                                        </Link>
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-gray-700">
                                        {fechaPedido ? new Date(fechaPedido + "T00:00:00").toLocaleDateString("es-CO") : "-"}
                                      </td>
                                      {isAdmin && (
                                        <td className="px-4 py-2.5 text-sm text-gray-700">{coordinador}</td>
                                      )}
                                      <td className="px-4 py-2.5 text-sm text-gray-900 font-medium">{beneficiario}</td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${estadoColors[estado] || "bg-gray-100 text-gray-800"}`}>
                                          {estado}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center text-sm text-gray-600">
                                        {itemsCount}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-sm text-[#00d084]">
                                        {formatCurrency(total)}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        {pdfUrl ? (
                                          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors">
                                            PDF
                                          </a>
                                        ) : (
                                          <span className="text-xs text-gray-300">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-2">
                                          <Link
                                            href={`/ordenes-servicio/${orden.id}`}
                                            className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors whitespace-nowrap"
                                          >
                                            Ver
                                          </Link>
                                          {puedeEliminar && (
                                            <button
                                              onClick={async () => {
                                                if (confirm(`Estas seguro de eliminar la orden #${numeroOrden}?\n\nEsta accion no se puede deshacer.`)) {
                                                  try {
                                                    const response = await fetch(`/api/ordenes-servicio/${orden.id}`, { method: "DELETE" });
                                                    if (response.ok) {
                                                      alert(`Orden #${numeroOrden} eliminada correctamente`);
                                                      window.location.reload();
                                                    } else {
                                                      const data = await response.json();
                                                      alert(`Error: ${data.error || "No se pudo eliminar la orden"}`);
                                                    }
                                                  } catch (err) {
                                                    console.error("Error eliminando orden:", err);
                                                    alert("Error al eliminar la orden");
                                                  }
                                                }
                                              }}
                                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors whitespace-nowrap"
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
                              <tfoot className="bg-gray-50 border-t border-gray-200">
                                <tr>
                                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-2.5 text-sm font-bold text-gray-700 text-right">
                                    Subtotal {formatMesLabel(mesKey)}:
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono font-bold text-sm text-[#00d084]">
                                    {formatCurrency(grupo.total)}
                                  </td>
                                  <td colSpan={2}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginacion por meses */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando meses {monthPage * MONTHS_PER_PAGE + 1}-{Math.min((monthPage + 1) * MONTHS_PER_PAGE, gruposPorMes.length)} de {gruposPorMes.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMonthPage(monthPage - 1)}
                    disabled={monthPage === 0}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setMonthPage(monthPage + 1)}
                    disabled={monthPage >= totalPages - 1}
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
