"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getAllOrdenes, type Orden } from "@/lib/airtable";

export default function ReportesFacturasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroBeneficiario, setFiltroBeneficiario] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>("");

  // Grupos expandidos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const isAdmin = session?.user?.rol === "Administrador";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated" && !isAdmin) {
      router.push("/dashboard");
    }
  }, [status, isAdmin, router]);

  useEffect(() => {
    async function loadOrdenes() {
      if (!isAdmin) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getAllOrdenes();
        setOrdenes(data);
      } catch (err) {
        console.error("Error loading ordenes:", err);
        setError("Error al cargar los datos. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      loadOrdenes();
    }
  }, [isAdmin]);

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

  if (!session || !isAdmin) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO");
  };

  // Filtrar ordenes
  const estadosConFactura = ["Facturada", "Pagada"];

  const ordenesFiltradas = ordenes.filter((orden) => {
    const estado = orden.fields.Estado || "";

    if (!filtroEstado && !estadosConFactura.includes(estado)) return false;
    if (filtroEstado && estado !== filtroEstado) return false;

    const beneficiario = orden.fields.RazonSocial?.[0] || "";
    if (filtroBeneficiario && beneficiario !== filtroBeneficiario) return false;

    const fecha = orden.fields["Fecha de pedido"] || "";
    if (filtroFechaDesde && fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && fecha > filtroFechaHasta) return false;

    return true;
  });

  // Agrupar por beneficiario
  const gruposPorBeneficiario = new Map<
    string,
    { ordenes: Orden[]; total: number; estadoCounts: Record<string, number> }
  >();

  ordenesFiltradas.forEach((orden) => {
    const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
    const total = orden.fields.Total || 0;
    const estado = orden.fields.Estado || "";

    if (!gruposPorBeneficiario.has(beneficiario)) {
      gruposPorBeneficiario.set(beneficiario, {
        ordenes: [],
        total: 0,
        estadoCounts: {},
      });
    }

    const grupo = gruposPorBeneficiario.get(beneficiario)!;
    grupo.ordenes.push(orden);
    grupo.total += total;
    grupo.estadoCounts[estado] = (grupo.estadoCounts[estado] || 0) + 1;
  });

  // Ordenar grupos por total descendente
  const gruposOrdenados = [...gruposPorBeneficiario.entries()].sort(
    (a, b) => b[1].total - a[1].total
  );

  const totalGeneral = ordenesFiltradas.reduce(
    (sum, o) => sum + (o.fields.Total || 0),
    0
  );

  // Listas unicas para filtros
  const beneficiariosUnicos = [
    ...new Set(
      ordenes
        .map((o) => o.fields.RazonSocial?.[0] || "")
        .filter(Boolean)
    ),
  ].sort();

  const estadoColors: Record<string, string> = {
    Enviada: "bg-blue-100 text-blue-800",
    Facturada: "bg-amber-100 text-amber-800",
    Pagada: "bg-green-700 text-white",
    Rechazada: "bg-red-100 text-red-800",
  };

  const estadoDotColors: Record<string, string> = {
    Enviada: "bg-blue-500",
    Facturada: "bg-amber-500",
    Pagada: "bg-green-600",
    Rechazada: "bg-red-500",
  };

  function toggleGroup(beneficiario: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(beneficiario)) {
        next.delete(beneficiario);
      } else {
        next.add(beneficiario);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(new Set(gruposOrdenados.map(([b]) => b)));
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Reporte de Facturas
          </h1>
          <p className="text-gray-600 mt-1">
            Consulta y seguimiento de ordenes facturadas y pagadas
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">
            Filtros
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Beneficiario
              </label>
              <select
                value={filtroBeneficiario}
                onChange={(e) => setFiltroBeneficiario(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {beneficiariosUnicos.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Facturada + Pagada</option>
                <option value="Facturada">Facturada</option>
                <option value="Pagada">Pagada</option>
                <option value="Enviada">Enviada</option>
                <option value="Rechazada">Rechazada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha desde
              </label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha hasta
              </label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
          </div>
          {(filtroBeneficiario ||
            filtroEstado ||
            filtroFechaDesde ||
            filtroFechaHasta) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setFiltroBeneficiario("");
                  setFiltroEstado("");
                  setFiltroFechaDesde("");
                  setFiltroFechaHasta("");
                }}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando reporte...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Resumen y controles */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {ordenesFiltradas.length}{" "}
                {ordenesFiltradas.length === 1 ? "orden" : "ordenes"} en{" "}
                {gruposOrdenados.length}{" "}
                {gruposOrdenados.length === 1
                  ? "beneficiario"
                  : "beneficiarios"}
              </p>
              {gruposOrdenados.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Expandir todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Colapsar todos
                  </button>
                </div>
              )}
            </div>

            {ordenesFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay ordenes con estos filtros
                </h3>
                <p className="text-gray-600">
                  Intenta cambiar los filtros de busqueda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {gruposOrdenados.map(([beneficiario, grupo]) => {
                  const isExpanded = expandedGroups.has(beneficiario);

                  return (
                    <div
                      key={beneficiario}
                      className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                    >
                      {/* Header del grupo */}
                      <button
                        onClick={() => toggleGroup(beneficiario)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span
                            className={`text-gray-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          >
                            &#9654;
                          </span>
                          <div className="text-left min-w-0">
                            <h3 className="text-base font-bold text-gray-900 truncate">
                              {beneficiario}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">
                                {grupo.ordenes.length}{" "}
                                {grupo.ordenes.length === 1
                                  ? "orden"
                                  : "ordenes"}
                              </span>
                              {Object.entries(grupo.estadoCounts).map(
                                ([estado, count]) => (
                                  <span
                                    key={estado}
                                    className="inline-flex items-center gap-1 text-xs text-gray-500"
                                  >
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${
                                        estadoDotColors[estado] || "bg-gray-400"
                                      }`}
                                    ></span>
                                    {count} {estado}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <span className="text-lg font-bold font-mono text-[#00d084]">
                            {formatCurrency(grupo.total)}
                          </span>
                        </div>
                      </button>

                      {/* Tabla de ordenes del grupo */}
                      {isExpanded && (
                        <div className="border-t border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">
                                    # Orden
                                  </th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">
                                    Fecha
                                  </th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">
                                    N.° Factura
                                  </th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">
                                    Concepto
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600 uppercase">
                                    Estado
                                  </th>
                                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase">
                                    Total
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600 uppercase">
                                    Docs
                                  </th>
                                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">
                                    F. Pago
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {grupo.ordenes.map((orden, index) => {
                                  const estado = orden.fields.Estado || "";
                                  const facturaUrl =
                                    orden.fields.Factura?.[0]?.url || null;
                                  const pdfUrl =
                                    orden.fields.PDF?.[0]?.url || null;
                                  const numFactura =
                                    orden.fields.NumeroFactura || "";
                                  const fechaPago =
                                    orden.fields.FechaPago || "";
                                  const observaciones =
                                    orden.fields.Observaciones || "";

                                  return (
                                    <tr
                                      key={orden.id}
                                      className={`border-b border-gray-100 ${
                                        index % 2 === 0
                                          ? "bg-white"
                                          : "bg-gray-50/50"
                                      } hover:bg-blue-50/50 transition-colors`}
                                    >
                                      <td className="px-4 py-2.5">
                                        <a
                                          href={`/ordenes-servicio/${orden.id}`}
                                          className="font-bold text-[#00d084] hover:underline text-sm"
                                        >
                                          #{orden.fields.NumeroOrden || "S/N"}
                                        </a>
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-gray-700">
                                        {orden.fields["Fecha de pedido"]
                                          ? formatDate(
                                              orden.fields["Fecha de pedido"]
                                            )
                                          : "-"}
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-gray-900 font-medium">
                                        {numFactura || (
                                          <span className="text-gray-400">
                                            -
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[200px] truncate" title={observaciones}>
                                        {observaciones || (
                                          <span className="text-gray-400">
                                            -
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${
                                            estadoColors[estado] ||
                                            "bg-gray-100 text-gray-800"
                                          }`}
                                        >
                                          {estado}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-sm text-[#00d084]">
                                        {formatCurrency(
                                          orden.fields.Total || 0
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          {pdfUrl ? (
                                            <a
                                              href={pdfUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center px-2 py-0.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                                              title="Ver PDF de la orden"
                                            >
                                              Orden
                                            </a>
                                          ) : (
                                            <span className="text-xs text-gray-300">
                                              -
                                            </span>
                                          )}
                                          {facturaUrl ? (
                                            <a
                                              href={facturaUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center px-2 py-0.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                                              title="Ver factura del proveedor"
                                            >
                                              Factura
                                            </a>
                                          ) : (
                                            <span className="text-xs text-gray-300">
                                              -
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 text-sm">
                                        {fechaPago ? (
                                          <span className="text-green-700 font-medium">
                                            {formatDate(fechaPago)}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">
                                            -
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-gray-50 border-t border-gray-200">
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-4 py-2.5 text-sm font-bold text-gray-700 text-right"
                                  >
                                    Subtotal {beneficiario}:
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

                {/* Total general */}
                <div className="bg-gray-900 rounded-lg shadow p-4 flex items-center justify-between">
                  <span className="text-white font-bold text-sm uppercase">
                    Total General ({ordenesFiltradas.length}{" "}
                    {ordenesFiltradas.length === 1 ? "orden" : "ordenes"})
                  </span>
                  <span className="text-xl font-bold font-mono text-[#00d084]">
                    {formatCurrency(totalGeneral)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
