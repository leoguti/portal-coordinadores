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
        // Solo mostrar ordenes facturadas o pagadas (con factura)
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

  // Filtrar ordenes que tienen factura (estados Facturada, Pagada) o todas segun filtro
  const estadosConFactura = ["Facturada", "Pagada"];
  const estadosFiltro = filtroEstado
    ? [filtroEstado]
    : estadosConFactura;

  const ordenesFiltradas = ordenes.filter(orden => {
    const estado = orden.fields.Estado || "";

    // Solo mostrar ordenes facturadas/pagadas (a menos que se filtre por otro estado)
    if (!filtroEstado && !estadosConFactura.includes(estado)) return false;
    if (filtroEstado && estado !== filtroEstado) return false;

    const beneficiario = orden.fields.RazonSocial?.[0] || "";
    if (filtroBeneficiario && beneficiario !== filtroBeneficiario) return false;

    const fecha = orden.fields["Fecha de pedido"] || "";
    if (filtroFechaDesde && fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && fecha > filtroFechaHasta) return false;

    return true;
  });

  // Calcular resumen por beneficiario
  const resumenPorBeneficiario = new Map<string, { total: number; count: number }>();
  ordenesFiltradas.forEach(orden => {
    const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
    const total = orden.fields.Total || 0;
    const current = resumenPorBeneficiario.get(beneficiario) || { total: 0, count: 0 };
    current.total += total;
    current.count += 1;
    resumenPorBeneficiario.set(beneficiario, current);
  });

  const totalGeneral = ordenesFiltradas.reduce((sum, o) => sum + (o.fields.Total || 0), 0);

  // Listas unicas para filtros
  const beneficiariosUnicos = [...new Set(ordenes.map(o => o.fields.RazonSocial?.[0] || "").filter(Boolean))].sort();

  const estadoColors: Record<string, string> = {
    Enviada: "bg-blue-100 text-blue-800",
    Facturada: "bg-amber-100 text-amber-800",
    Pagada: "bg-green-700 text-white",
    Rechazada: "bg-red-100 text-red-800",
  };

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
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiario</label>
              <select
                value={filtroBeneficiario}
                onChange={(e) => setFiltroBeneficiario(e.target.value)}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>
          </div>
          {(filtroBeneficiario || filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
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
            {/* Resumen por beneficiario */}
            {resumenPorBeneficiario.size > 0 && (
              <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Resumen por Beneficiario</h3>
                <div className="overflow-hidden border border-gray-300 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Beneficiario</th>
                        <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase">Ordenes</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...resumenPorBeneficiario.entries()]
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([beneficiario, data], index) => (
                          <tr key={beneficiario} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{beneficiario}</td>
                            <td className="px-4 py-2 text-sm text-center text-gray-600">{data.count}</td>
                            <td className="px-4 py-2 text-sm text-right font-mono font-bold text-[#00d084]">{formatCurrency(data.total)}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td className="px-4 py-2 text-sm font-bold text-gray-900">TOTAL</td>
                        <td className="px-4 py-2 text-sm text-center font-bold text-gray-900">{ordenesFiltradas.length}</td>
                        <td className="px-4 py-2 text-sm text-right font-mono font-bold text-[#00d084]">{formatCurrency(totalGeneral)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla detallada */}
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? "orden" : "ordenes"} encontradas
              </p>
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
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase"># Orden</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Coordinador</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Beneficiario</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Factura</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">PDF Orden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesFiltradas.map((orden, index) => {
                      const estado = orden.fields.Estado || "";
                      const facturaUrl = orden.fields.Factura?.[0]?.url || null;
                      const pdfUrl = orden.fields.PDF?.[0]?.url || null;

                      return (
                        <tr
                          key={orden.id}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          <td className="px-4 py-3">
                            <a
                              href={`/ordenes-servicio/${orden.id}`}
                              className="font-bold text-[#00d084] hover:underline"
                            >
                              #{orden.fields.NumeroOrden || "S/N"}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {orden.fields["Fecha de pedido"]
                              ? new Date(orden.fields["Fecha de pedido"]).toLocaleDateString("es-CO")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {orden.fields.NombreCoordinador?.[0] || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {orden.fields.RazonSocial?.[0] || "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                                estadoColors[estado] || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sm text-[#00d084]">
                            {formatCurrency(orden.fields.Total || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {facturaUrl ? (
                              <a
                                href={facturaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                              >
                                Factura
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pdfUrl ? (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
                              >
                                PDF
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        TOTAL GENERAL:
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-sm text-[#00d084]">
                        {formatCurrency(totalGeneral)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
