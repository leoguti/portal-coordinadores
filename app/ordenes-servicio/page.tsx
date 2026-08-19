"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenesCoordinador, getAllOrdenes, computeConceptosOrdenes, type Orden } from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";
import { isAdminOrSupervisor, isAdmin } from "@/lib/roles";
import { groupOrdenesByMes } from "@/lib/ordenesGrouping";
import { semaforoDeOrdenes, diasSinFactura, DIAS_AVISO, DIAS_BLOQUEO } from "@/lib/ordenesSemaforo";
import { estaReabierta } from "@/lib/ordenesReapertura";
import {
  reflejarFiltrosEnUrl,
  leerExpandidosGuardados,
  guardarExpandidos,
} from "@/lib/listadoFiltrosNav";

function OrdenesServicioPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [conceptos, setConceptos] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros — inicializados desde query params (dashboard o "Volver a ordenes")
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>(searchParams.get("coordinador") || "");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState<string>(searchParams.get("beneficiario") || "");
  const [filtroEstado, setFiltroEstado] = useState<string>(searchParams.get("estado") || "");
  const [filtroMes, setFiltroMes] = useState<string>(searchParams.get("mes") || "");

  // Export PDF
  const [exportingPDF, setExportingPDF] = useState(false);

  // Paginacion de meses
  const [monthPage, setMonthPage] = useState(() => parseInt(searchParams.get("pag") || "0", 10) || 0);

  // Grupos expandidos (mes y beneficiario) — restaurados al volver del detalle
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(
    () => new Set(leerExpandidosGuardados("/ordenes-servicio").meses)
  );
  const [expandedBeneficiarios, setExpandedBeneficiarios] = useState<Set<string>>(
    () => new Set(leerExpandidosGuardados("/ordenes-servicio").beneficiarios)
  );

  // Refleja filtros y página en la URL (y sessionStorage para "Volver a ordenes")
  useEffect(() => {
    reflejarFiltrosEnUrl("/ordenes-servicio", {
      coordinador: filtroCoordinador,
      beneficiario: filtroBeneficiario,
      estado: filtroEstado,
      mes: filtroMes,
      pag: monthPage > 0 ? String(monthPage) : "",
    });
  }, [filtroCoordinador, filtroBeneficiario, filtroEstado, filtroMes, monthPage]);

  useEffect(() => {
    guardarExpandidos("/ordenes-servicio", {
      meses: expandedMeses,
      beneficiarios: expandedBeneficiarios,
    });
  }, [expandedMeses, expandedBeneficiarios]);

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const canWrite = isAdmin(session?.user?.rol);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadOrdenes() {
      if (!session?.user?.coordinatorRecordId) return;

      try {
        setLoading(true);
        setError(null);

        const data = canViewAll
          ? await getAllOrdenes()
          : await getOrdenesCoordinador(session.user.coordinatorRecordId);
        setOrdenes(data);

        // Cargar conceptos
        const ordenIds = data.map((o) => o.id);
        const conceptosData = await computeConceptosOrdenes(ordenIds);
        setConceptos(conceptosData);
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
  }, [session?.user?.coordinatorRecordId, canViewAll]);

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

  // --- Helpers ---
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO");

  const formatMesLabel = (mesKey: string) => {
    if (mesKey === "sin-fecha") return "Sin fecha";
    const [year, month] = mesKey.split("-");
    const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${nombres[parseInt(month) - 1]} ${year}`;
  };

  const puedeEliminarOrden = (orden: Orden): boolean => {
    const fechaPedido = orden.fields["Fecha de pedido"] || "";
    const estado = orden.fields.Estado || "";
    if (!fechaPedido) return false;
    if (estado === "Facturada" || estado === "Pagada") return false;
    // Reabierta para corrección por un admin: se puede eliminar aunque
    // el mes esté cerrado (la cascada libera los kardex).
    if (estaReabierta(orden.fields)) return true;
    return puedeModificarFecha(fechaPedido);
  };

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

  // Colores para etiquetas de concepto (estilo Airtable)
  const conceptoColorPalette = [
    "bg-blue-100 text-blue-800",
    "bg-emerald-100 text-emerald-800",
    "bg-purple-100 text-purple-800",
    "bg-orange-100 text-orange-800",
    "bg-pink-100 text-pink-800",
    "bg-cyan-100 text-cyan-800",
    "bg-yellow-100 text-yellow-800",
    "bg-rose-100 text-rose-800",
  ];

  const getConceptoColor = (concepto: string) => {
    if (concepto === "Transporte") return "bg-blue-100 text-blue-800";
    let hash = 0;
    for (let i = 0; i < concepto.length; i++) {
      hash = concepto.charCodeAt(i) + ((hash << 5) - hash);
    }
    return conceptoColorPalette[Math.abs(hash) % conceptoColorPalette.length];
  };

  // --- Semáforo de facturación ---
  // Para el coordinador: sus propias órdenes (bloquea crear en rojo).
  // Para admin: todas — sirve de vista de control por coordinador.
  const semaforo = semaforoDeOrdenes(ordenes);
  const creacionBloqueada = !canViewAll && semaforo.rojas.length > 0;

  // --- Filtros ---
  const coordinadoresUnicos = [...new Set(ordenes.map(o => o.fields.NombreCoordinador?.[0] || "").filter(Boolean))].sort();
  const beneficiariosUnicos = [...new Set(ordenes.map(o => o.fields.RazonSocial?.[0] || "").filter(Boolean))].sort();
  const estadosUnicos = [...new Set(ordenes.map(o => o.fields.Estado || "").filter(Boolean))].sort();
  const mesesUnicos = [...new Set(ordenes.map(o => (o.fields["Fecha de pedido"] || "").substring(0, 7)).filter(Boolean))].sort().reverse();

  const ordenesFiltradas = ordenes.filter(orden => {
    if (filtroCoordinador && (orden.fields.NombreCoordinador?.[0] || "") !== filtroCoordinador) return false;
    if (filtroBeneficiario && (orden.fields.RazonSocial?.[0] || "") !== filtroBeneficiario) return false;
    if (filtroEstado && orden.fields.Estado !== filtroEstado) return false;
    if (filtroMes && (orden.fields["Fecha de pedido"] || "").substring(0, 7) !== filtroMes) return false;
    return true;
  });

  // --- Agrupamiento doble: Mes → Beneficiario ---
  const gruposPorMes = groupOrdenesByMes(ordenesFiltradas);

  // Paginacion de meses (6 por pagina)
  const MONTHS_PER_PAGE = 6;
  const totalPages = Math.ceil(gruposPorMes.length / MONTHS_PER_PAGE);
  const mesesPaginados = gruposPorMes.slice(monthPage * MONTHS_PER_PAGE, (monthPage + 1) * MONTHS_PER_PAGE);

  // Toggle helpers
  function toggleMes(mesKey: string) {
    setExpandedMeses((prev) => {
      const next = new Set(prev);
      if (next.has(mesKey)) next.delete(mesKey);
      else next.add(mesKey);
      return next;
    });
  }

  function toggleBeneficiario(compoundKey: string) {
    setExpandedBeneficiarios((prev) => {
      const next = new Set(prev);
      if (next.has(compoundKey)) next.delete(compoundKey);
      else next.add(compoundKey);
      return next;
    });
  }

  function expandAll() {
    const mesKeys = new Set(mesesPaginados.map(([k]) => k));
    const benKeys = new Set<string>();
    mesesPaginados.forEach(([mesKey, grupo]) => {
      grupo.beneficiarios.forEach(([ben]) => benKeys.add(`${mesKey}|${ben}`));
    });
    setExpandedMeses(mesKeys);
    setExpandedBeneficiarios(benKeys);
  }

  function collapseAll() {
    setExpandedMeses(new Set());
    setExpandedBeneficiarios(new Set());
  }

  async function handleExportarPDF() {
    setExportingPDF(true);
    try {
      const params = new URLSearchParams();
      if (canViewAll) params.set("viewAll", "true");
      if (filtroCoordinador) params.set("filtroCoordinador", filtroCoordinador);
      if (filtroBeneficiario) params.set("filtroBeneficiario", filtroBeneficiario);
      if (filtroEstado) params.set("filtroEstado", filtroEstado);
      if (filtroMes) params.set("filtroMes", filtroMes);

      const res = await fetch(`/api/ordenes-servicio/reporte-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(data.error || "Error al generar el PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-ordenes-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      alert(err instanceof Error ? err.message : "Error al exportar el PDF");
    } finally {
      setExportingPDF(false);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ordenes de Servicio</h1>
            <p className="text-gray-600 mt-1">
              {canViewAll ? "Vista de administrador - Todas las ordenes" : "Gestiona las solicitudes de pago a Bogota"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && filtroBeneficiario && ordenesFiltradas.length > 0 && (
              <button
                onClick={handleExportarPDF}
                disabled={exportingPDF}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                {exportingPDF && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {exportingPDF ? "Generando..." : "Exportar PDF"}
              </button>
            )}
            {creacionBloqueada ? (
              <span
                title={`Tienes órdenes con más de ${DIAS_BLOQUEO} días sin factura`}
                className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
              >
                + Nueva Orden
              </span>
            ) : (
              <Link
                href="/ordenes-servicio-v2/nueva"
                className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
              >
                + Nueva Orden
              </Link>
            )}
          </div>
        </div>

        {/* Semáforo de facturación */}
        {!loading && !canViewAll && semaforo.rojas.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <p className="font-bold text-red-800 mb-1">
              🔴 No puedes crear órdenes nuevas
            </p>
            <p className="text-sm text-red-700">
              {semaforo.rojas.length === 1 ? "Tienes una orden" : `Tienes ${semaforo.rojas.length} órdenes`} con más de {DIAS_BLOQUEO} días esperando factura:{" "}
              {semaforo.rojas.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link href={`/ordenes-servicio/${r.id}`} className="font-bold underline">#{r.numero}</Link> ({r.dias} días)
                </span>
              ))}
              . Consigue la factura con el transportador y envíala a administración — el bloqueo se libera automáticamente cuando la orden pase a Facturada.
            </p>
          </div>
        )}
        {!loading && !canViewAll && semaforo.rojas.length === 0 && semaforo.amarillas.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <p className="font-bold text-yellow-800 mb-1">
              🟡 Órdenes próximas a bloquearte
            </p>
            <p className="text-sm text-yellow-800">
              {semaforo.amarillas.length === 1 ? "Tienes una orden" : `Tienes ${semaforo.amarillas.length} órdenes`} con más de {DIAS_AVISO} días esperando factura:{" "}
              {semaforo.amarillas.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link href={`/ordenes-servicio/${r.id}`} className="font-bold underline">#{r.numero}</Link> ({r.dias} días)
                </span>
              ))}
              . A los {DIAS_BLOQUEO} días no podrás crear órdenes nuevas. Consigue la factura con el transportador y envíala a administración.
            </p>
          </div>
        )}
        {!loading && canViewAll && (semaforo.rojas.length > 0 || semaforo.amarillas.length > 0) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <p className="font-bold text-amber-900 mb-2">
              Semáforo de facturación — {semaforo.rojas.length + semaforo.amarillas.length} {semaforo.rojas.length + semaforo.amarillas.length === 1 ? "orden" : "órdenes"} con más de {DIAS_AVISO} días sin factura
            </p>
            <ul className="text-sm text-amber-900 space-y-1">
              {[...semaforo.rojas, ...semaforo.amarillas].map((r) => (
                <li key={r.id}>
                  {r.dias >= DIAS_BLOQUEO ? "🔴" : "🟡"}{" "}
                  <Link href={`/ordenes-servicio/${r.id}`} className="font-bold underline">#{r.numero}</Link>
                  {" — "}{r.dias} días · {r.coordinador || "Sin coordinador"} · pedido del {r.fechaPedido ? formatDate(r.fechaPedido) : "?"}
                  {r.dias >= DIAS_BLOQUEO && <span className="font-medium"> · coordinador bloqueado para crear órdenes</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
          <div className={`grid grid-cols-1 gap-4 ${canViewAll ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            {canViewAll && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador</label>
                <select value={filtroCoordinador} onChange={(e) => { setFiltroCoordinador(e.target.value); setMonthPage(0); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent">
                  <option value="">Todos</option>
                  {coordinadoresUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiario</label>
              <select value={filtroBeneficiario} onChange={(e) => { setFiltroBeneficiario(e.target.value); setMonthPage(0); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent">
                <option value="">Todos</option>
                {beneficiariosUnicos.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setMonthPage(0); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent">
                <option value="">Todos</option>
                {estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
              <select value={filtroMes} onChange={(e) => { setFiltroMes(e.target.value); setMonthPage(0); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent">
                <option value="">Todos</option>
                {mesesUnicos.map(m => <option key={m} value={m}>{formatMesLabel(m)}</option>)}
              </select>
            </div>
          </div>
          {(filtroCoordinador || filtroBeneficiario || filtroEstado || filtroMes) && (
            <div className="mt-3">
              <button onClick={() => { setFiltroCoordinador(""); setFiltroBeneficiario(""); setFiltroEstado(""); setFiltroMes(""); setMonthPage(0); }} className="text-sm text-red-600 hover:text-red-800 underline">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

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

            {ordenesFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {ordenes.length === 0 ? "No hay ordenes de servicio" : "No hay ordenes con estos filtros"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {ordenes.length === 0 ? "Aun no has creado ninguna orden de servicio." : "Intenta cambiar los filtros de busqueda."}
                </p>
                {ordenes.length === 0 && (
                  <Link href="/ordenes-servicio-v2/nueva" className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium">
                    Crear primera orden
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {mesesPaginados.map(([mesKey, mesGrupo]) => {
                  const mesExpanded = expandedMeses.has(mesKey);

                  return (
                    <div key={mesKey} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                      {/* === NIVEL 1: MES === */}
                      <button
                        onClick={() => toggleMes(mesKey)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className={`text-gray-400 transition-transform duration-200 ${mesExpanded ? "rotate-90" : ""}`}>&#9654;</span>
                          <div className="text-left min-w-0">
                            <h3 className="text-base font-bold text-gray-900">{formatMesLabel(mesKey)}</h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-gray-500">
                                {mesGrupo.count} {mesGrupo.count === 1 ? "orden" : "ordenes"} &middot; {mesGrupo.beneficiarios.length} {mesGrupo.beneficiarios.length === 1 ? "beneficiario" : "beneficiarios"}
                              </span>
                              {Object.entries(mesGrupo.estadoCounts).map(([estado, count]) => (
                                <span key={estado} className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <span className={`inline-block w-2 h-2 rounded-full ${estadoDotColors[estado] || "bg-gray-400"}`}></span>
                                  {count} {estado}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <span className="text-lg font-bold font-mono text-[#00d084]">{formatCurrency(mesGrupo.total)}</span>
                        </div>
                      </button>

                      {/* Contenido del mes expandido */}
                      {mesExpanded && (
                        <div className="border-t border-gray-200">
                          {mesGrupo.beneficiarios.map(([beneficiario, benGrupo]) => {
                            const benKey = `${mesKey}|${beneficiario}`;
                            const benExpanded = expandedBeneficiarios.has(benKey);

                            return (
                              <div key={benKey} className="border-b border-gray-100 last:border-b-0">
                                {/* === NIVEL 2: BENEFICIARIO === */}
                                <button
                                  onClick={() => toggleBeneficiario(benKey)}
                                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50/80 transition-colors bg-gray-50/40"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className={`text-xs text-gray-400 transition-transform duration-200 ${benExpanded ? "rotate-90" : ""}`}>&#9654;</span>
                                    <div className="text-left min-w-0">
                                      <h4 className="text-sm font-bold text-gray-800 truncate">{beneficiario}</h4>
                                      <span className="text-xs text-gray-500">
                                        {benGrupo.ordenes.length} {benGrupo.ordenes.length === 1 ? "orden" : "ordenes"}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-sm font-bold font-mono text-[#00d084] flex-shrink-0 ml-4">
                                    {formatCurrency(benGrupo.total)}
                                  </span>
                                </button>

                                {/* Tabla de ordenes del beneficiario */}
                                {benExpanded && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">#</th>
                                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Factura</th>
                                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Concepto</th>
                                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                                          <th className="px-2 py-2 text-right text-xs font-bold text-gray-600 uppercase">Subtotal</th>
                                          <th className="px-2 py-2 text-right text-xs font-bold text-gray-600 uppercase">IVA</th>
                                          <th className="px-2 py-2 text-right text-xs font-bold text-gray-600 uppercase">Ret.</th>
                                          <th className="px-2 py-2 text-right text-xs font-bold text-gray-600 uppercase">Total</th>
                                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Docs</th>
                                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">F. Pago</th>
                                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {benGrupo.ordenes.map((orden, idx) => {
                                          const numOrden = orden.fields.NumeroOrden || "S/N";
                                          const estado = orden.fields.Estado || "Sin estado";
                                          const fechaPedido = orden.fields["Fecha de pedido"] || "";
                                          const numFactura = orden.fields.NumeroFactura || "";
                                          const fechaPago = orden.fields.FechaPago || "";
                                          const subtotalOrden = orden.fields.Total || 0;
                                          const ivaOrden = orden.fields.MontoIVA || 0;
                                          const retOrden = (orden.fields.MontoReteFuente || 0) + (orden.fields.MontoReteICA || 0) + (orden.fields.MontoReteIVA || 0);
                                          const hasTaxOrden = orden.fields.MontoIVA !== undefined;
                                          const total = hasTaxOrden
                                            ? subtotalOrden + ivaOrden - retOrden
                                            : subtotalOrden;
                                          const pdfUrl = orden.fields.PDF?.[0]?.url || null;
                                          const facturaUrl = orden.fields.Factura?.[0]?.url || null;
                                          const puedeEliminar = puedeEliminarOrden(orden);
                                          const tags = conceptos[orden.id] || [];
                                          const diasMora = diasSinFactura(orden.fields);
                                          const enMora = diasMora !== null && diasMora >= DIAS_AVISO;
                                          const reabierta = estaReabierta(orden.fields);

                                          return (
                                            <tr key={orden.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/50 transition-colors`}>
                                              <td className="px-4 py-2.5">
                                                <Link href={`/ordenes-servicio/${orden.id}`} className="font-bold text-[#00d084] hover:underline text-sm">
                                                  #{numOrden}
                                                </Link>
                                              </td>
                                              <td className="px-4 py-2.5 text-sm text-gray-700">
                                                {fechaPedido ? formatDate(fechaPedido) : "-"}
                                              </td>
                                              <td className="px-4 py-2.5 text-sm text-gray-900 font-medium">
                                                {numFactura || <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                  {tags.length > 0 ? tags.map((tag) => (
                                                    <span key={tag} className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getConceptoColor(tag)}`}>
                                                      {tag}
                                                    </span>
                                                  )) : <span className="text-gray-400 text-sm">-</span>}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${estadoColors[estado] || "bg-gray-100 text-gray-800"}`}>
                                                  {estado}
                                                </span>
                                                {enMora && (
                                                  <span
                                                    title={`${diasMora} días sin factura`}
                                                    className={`mt-1 block px-2 py-0.5 text-xs font-bold rounded whitespace-nowrap ${diasMora! >= DIAS_BLOQUEO ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                                                  >
                                                    {diasMora! >= DIAS_BLOQUEO ? "🔴" : "🟡"} {diasMora} d sin factura
                                                  </span>
                                                )}
                                                {reabierta && (
                                                  <span
                                                    title={`Reabierta para corrección hasta ${orden.fields.reabierta_hasta?.slice(0, 10)} por ${orden.fields.reapertura_por || "administración"}`}
                                                    className="mt-1 block px-2 py-0.5 text-xs font-bold rounded whitespace-nowrap bg-orange-100 text-orange-800"
                                                  >
                                                    🔓 Reabierta
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-2 py-2.5 text-right font-mono text-xs text-gray-700">
                                                {formatCurrency(subtotalOrden)}
                                              </td>
                                              <td className="px-2 py-2.5 text-right font-mono text-xs">
                                                {hasTaxOrden && ivaOrden > 0
                                                  ? <span className="text-green-700">+{formatCurrency(ivaOrden)}</span>
                                                  : <span className="text-gray-300">-</span>}
                                              </td>
                                              <td className="px-2 py-2.5 text-right font-mono text-xs">
                                                {hasTaxOrden && retOrden > 0
                                                  ? <span className="text-red-600">-{formatCurrency(retOrden)}</span>
                                                  : <span className="text-gray-300">-</span>}
                                              </td>
                                              <td className="px-2 py-2.5 text-right font-mono font-bold text-sm text-[#00d084]">
                                                {formatCurrency(total)}
                                              </td>
                                              <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                  {pdfUrl ? (
                                                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors">
                                                      Orden
                                                    </a>
                                                  ) : <span className="text-xs text-gray-300">-</span>}
                                                  {facturaUrl ? (
                                                    <a href={facturaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-0.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors">
                                                      Factura
                                                    </a>
                                                  ) : <span className="text-xs text-gray-300">-</span>}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2.5 text-sm">
                                                {fechaPago ? (
                                                  <span className="text-green-700 font-medium">{formatDate(fechaPago)}</span>
                                                ) : <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-2">
                                                  <Link href={`/ordenes-servicio/${orden.id}`} className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors whitespace-nowrap">
                                                    Ver
                                                  </Link>
                                                  {puedeEliminar && (
                                                    <button
                                                      onClick={async () => {
                                                        if (confirm(`Estas seguro de eliminar la orden #${numOrden}?\n\nEsta accion no se puede deshacer.`)) {
                                                          try {
                                                            const response = await fetch(`/api/ordenes-servicio/${orden.id}`, { method: "DELETE" });
                                                            if (response.ok) {
                                                              alert(`Orden #${numOrden} eliminada correctamente`);
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
                                        {(() => {
                                          const taxSum = benGrupo.ordenes.reduce((acc, o) => {
                                            acc.subtotal += o.fields.Total || 0;
                                            acc.iva += o.fields.MontoIVA || 0;
                                            acc.ret += (o.fields.MontoReteFuente || 0) + (o.fields.MontoReteICA || 0) + (o.fields.MontoReteIVA || 0);
                                            return acc;
                                          }, { subtotal: 0, iva: 0, ret: 0 });
                                          const hasTaxGroup = taxSum.iva > 0 || taxSum.ret > 0;
                                          return (
                                            <tr>
                                              <td colSpan={5} className="px-3 py-2 text-sm font-bold text-gray-700 text-right">
                                                Subtotal {beneficiario}:
                                              </td>
                                              <td className="px-2 py-2 text-right font-mono font-bold text-xs text-gray-700">
                                                {formatCurrency(taxSum.subtotal)}
                                              </td>
                                              <td className="px-2 py-2 text-right font-mono font-bold text-xs text-green-700">
                                                {hasTaxGroup && taxSum.iva > 0 ? `+${formatCurrency(taxSum.iva)}` : "-"}
                                              </td>
                                              <td className="px-2 py-2 text-right font-mono font-bold text-xs text-red-600">
                                                {hasTaxGroup && taxSum.ret > 0 ? `-${formatCurrency(taxSum.ret)}` : "-"}
                                              </td>
                                              <td className="px-2 py-2 text-right font-mono font-bold text-sm text-[#00d084]">
                                                {formatCurrency(benGrupo.total)}
                                              </td>
                                              <td colSpan={3}></td>
                                            </tr>
                                          );
                                        })()}
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total general */}
                <div className="bg-gray-900 rounded-lg shadow p-4 flex items-center justify-between">
                  <span className="text-white font-bold text-sm uppercase">
                    Total General ({ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? "orden" : "ordenes"})
                  </span>
                  <span className="text-xl font-bold font-mono text-[#00d084]">
                    {formatCurrency(ordenesFiltradas.reduce((sum, o) => {
                      const st = o.fields.Total || 0;
                      return sum + (o.fields.MontoIVA !== undefined ? st + (o.fields.MontoIVA || 0) - (o.fields.MontoReteFuente || 0) - (o.fields.MontoReteICA || 0) - (o.fields.MontoReteIVA || 0) : st);
                    }, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Paginacion por meses */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando meses {monthPage * MONTHS_PER_PAGE + 1}-{Math.min((monthPage + 1) * MONTHS_PER_PAGE, gruposPorMes.length)} de {gruposPorMes.length}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMonthPage(monthPage - 1)} disabled={monthPage === 0} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Anterior
                  </button>
                  <button onClick={() => setMonthPage(monthPage + 1)} disabled={monthPage >= totalPages - 1} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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

export default function OrdenesServicioPage() {
  return (
    <Suspense>
      <OrdenesServicioPageInner />
    </Suspense>
  );
}
