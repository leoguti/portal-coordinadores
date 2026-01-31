"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import {
  getGastosCajaMenorCoordinador,
  getAllGastosCajaMenor,
  type GastoCajaMenor,
  type AsignacionCajaMenor,
} from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";

export default function CajaMenorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gastos, setGastos] = useState<GastoCajaMenor[]>([]);
  const [asignacion, setAsignacion] = useState<AsignacionCajaMenor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");

  const isAdmin = session?.user?.rol === "Administrador";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) return;

      try {
        setLoading(true);
        setError(null);

        let data: GastoCajaMenor[];
        if (isAdmin) {
          data = await getAllGastosCajaMenor();
        } else {
          data = await getGastosCajaMenorCoordinador(session.user.coordinatorRecordId);
        }
        setGastos(data);

        // Cargar asignacion del mes actual para el coordinador
        const mesActual = new Date().toISOString().substring(0, 7);
        try {
          const res = await fetch(`/api/caja-menor/asignaciones?mes=${mesActual}`);
          if (res.ok) {
            const { asignaciones } = await res.json();
            if (!isAdmin && asignaciones.length > 0) {
              // Buscar la asignacion de este coordinador
              const miAsignacion = asignaciones.find(
                (a: AsignacionCajaMenor) =>
                  a.fields.Coordinador?.includes(session.user.coordinatorRecordId!)
              );
              setAsignacion(miAsignacion || null);
            }
          }
        } catch {
          // No es critico si falla la carga de asignaciones
        }
      } catch (err) {
        console.error("Error loading gastos:", err);
        setError("Error al cargar los gastos. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadData();
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

  if (!session) return null;

  // Calcular valores en frontend (Airtable formula+currency puede retornar null)
  const calcValorNeto = (g: GastoCajaMenor) => {
    const valor = g.fields.Valor || 0;
    const pct = g.fields.PorcentajeRetencion || 0;
    return valor - (valor * pct / 100);
  };

  const estadoColors: Record<string, string> = {
    Pendiente: "bg-yellow-100 text-yellow-800",
    Aprobado: "bg-green-100 text-green-800",
    Rechazado: "bg-red-100 text-red-800",
  };

  const puedeEliminarGasto = (fecha: string, estado: string): boolean => {
    if (!fecha) return false;
    if (estado !== "Pendiente") return false;
    return puedeModificarFecha(fecha);
  };

  // Listas unicas para filtros
  const coordinadoresUnicos = [
    ...new Set(gastos.map((g) => g.fields.NombreCoordinador?.[0] || "").filter(Boolean)),
  ].sort();
  const estadosUnicos = [
    ...new Set(gastos.map((g) => g.fields.Estado || "").filter(Boolean)),
  ].sort();
  const mesesUnicos = [
    ...new Set(gastos.map((g) => (g.fields.Fecha || "").substring(0, 7)).filter(Boolean)),
  ]
    .sort()
    .reverse();

  // Aplicar filtros
  const gastosFiltrados = gastos.filter((gasto) => {
    if (filtroCoordinador && (gasto.fields.NombreCoordinador?.[0] || "") !== filtroCoordinador)
      return false;
    if (filtroEstado && gasto.fields.Estado !== filtroEstado) return false;
    if (filtroMes && (gasto.fields.Fecha || "").substring(0, 7) !== filtroMes) return false;
    return true;
  });

  // Calcular resumen del mes filtrado (o mes actual)
  const mesFiltro = filtroMes || new Date().toISOString().substring(0, 7);
  const gastosDelMes = gastos.filter(
    (g) => (g.fields.Fecha || "").substring(0, 7) === mesFiltro
  );
  const totalGastadoMes = gastosDelMes
    .filter((g) => g.fields.Estado !== "Rechazado")
    .reduce((sum, g) => sum + (g.fields.Valor || 0), 0);
  const totalAprobadoMes = gastosDelMes
    .filter((g) => g.fields.Estado === "Aprobado")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleEliminar = async (gastoId: string, numero: number) => {
    if (
      !confirm(
        `Estas seguro de eliminar el gasto #${numero}?\n\nEsta accion no se puede deshacer.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/caja-menor/${gastoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setGastos((prev) => prev.filter((g) => g.id !== gastoId));
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || "No se pudo eliminar el gasto"}`);
      }
    } catch (err) {
      console.error("Error eliminando gasto:", err);
      alert("Error al eliminar el gasto");
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Caja Menor</h1>
            <p className="text-gray-600 mt-1">
              {isAdmin
                ? "Vista de administrador - Todos los gastos"
                : "Registra y consulta tus gastos de caja menor"}
            </p>
          </div>
          {!isAdmin && (
            <Link
              href="/caja-menor/nuevo"
              className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
            >
              + Nuevo Gasto
            </Link>
          )}
        </div>

        {/* Resumen del mes (solo coordinador) */}
        {!isAdmin && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Asignado ({mesFiltro})
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {asignacion ? formatCurrency(asignacion.fields.MontoAsignado || 0) : "—"}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Registrado (sin rechazados)
              </p>
              <p className="text-2xl font-bold text-yellow-700">
                {formatCurrency(totalGastadoMes)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Aprobado (neto)
              </p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(totalAprobadoMes)}
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
          <div
            className={`grid grid-cols-1 gap-4 ${
              isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"
            }`}
          >
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Coordinador
                </label>
                <select
                  value={filtroCoordinador}
                  onChange={(e) => {
                    setFiltroCoordinador(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {coordinadoresUnicos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {estadosUnicos.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
              <select
                value={filtroMes}
                onChange={(e) => {
                  setFiltroMes(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              >
                <option value="">Todos</option>
                {mesesUnicos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(filtroCoordinador || filtroEstado || filtroMes) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setFiltroCoordinador("");
                  setFiltroEstado("");
                  setFiltroMes("");
                  setCurrentPage(1);
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando gastos...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Contador */}
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Total: {gastosFiltrados.length}{" "}
                {gastosFiltrados.length === 1 ? "gasto" : "gastos"}
                {gastosFiltrados.length !== gastos.length && (
                  <span className="ml-1 text-gray-400">(de {gastos.length})</span>
                )}
                {gastosFiltrados.length > ITEMS_PER_PAGE && (
                  <span className="ml-2">
                    (Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, gastosFiltrados.length)})
                  </span>
                )}
              </p>
            </div>

            {/* Empty State */}
            {gastosFiltrados.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {gastos.length === 0
                    ? "No hay gastos registrados"
                    : "No hay gastos con estos filtros"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {gastos.length === 0
                    ? "Aun no has registrado ningun gasto de caja menor."
                    : "Intenta cambiar los filtros de busqueda."}
                </p>
                {gastos.length === 0 && !isAdmin && (
                  <Link
                    href="/caja-menor/nuevo"
                    className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
                  >
                    Registrar primer gasto
                  </Link>
                )}
              </div>
            ) : (
              /* Tabla de gastos */
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        #
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
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Concepto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Neto
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                      const endIndex = startIndex + ITEMS_PER_PAGE;
                      const gastosPaginados = gastosFiltrados.slice(startIndex, endIndex);

                      return gastosPaginados.map((gasto, index) => {
                        const numero = gasto.fields.NumeroGasto || 0;
                        const fecha = gasto.fields.Fecha || "";
                        const beneficiario = gasto.fields.RazonSocial?.[0] || "Sin beneficiario";
                        const coordinador = gasto.fields.NombreCoordinador?.[0] || "";
                        const concepto = gasto.fields.Concepto || "";
                        const valor = gasto.fields.Valor || 0;
                        const valorNeto = calcValorNeto(gasto);
                        const estado = gasto.fields.Estado || "Pendiente";
                        const puedeEliminar = puedeEliminarGasto(fecha, estado);

                        return (
                          <tr
                            key={gasto.id}
                            className={`border-b border-gray-200 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-blue-50 transition-colors`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-bold text-[#00d084]">#{numero}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {fecha
                                ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO")
                                : "Sin fecha"}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-sm text-gray-700">{coordinador}</td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {beneficiario}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                              {concepto}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-mono text-gray-900">
                                {formatCurrency(valor)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-[#00d084] font-mono">
                                {formatCurrency(valorNeto)}
                              </span>
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
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/caja-menor/${gasto.id}`}
                                  className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors whitespace-nowrap"
                                >
                                  Ver
                                </Link>
                                {puedeEliminar && !isAdmin && (
                                  <button
                                    onClick={() => handleEliminar(gasto.id, numero)}
                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors whitespace-nowrap"
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

            {/* Paginacion */}
            {gastosFiltrados.length > ITEMS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Pagina {currentPage} de{" "}
                  {Math.ceil(gastosFiltrados.length / ITEMS_PER_PAGE)}
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
                    disabled={
                      currentPage >= Math.ceil(gastosFiltrados.length / ITEMS_PER_PAGE)
                    }
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
