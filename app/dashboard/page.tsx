"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import KpiCard from "@/components/KpiCard";
import ProgressBar, { DualProgressBar } from "@/components/ProgressBar";
import Link from "next/link";
import { type GastoCajaMenor } from "@/lib/airtable";
import { isAdminOrSupervisor } from "@/lib/roles";

const AdminDashboard = dynamic(() => import("@/components/AdminDashboard"), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando panel de control...</p>
      </div>
    </div>
  ),
});

interface DashboardStats {
  metas: {
    recoleccion: { meta: number; entradas: number; salidas: number };
    sensibilizacion: { meta: number; actual: number; evaluadas: number };
    configurada: boolean;
  };
  kpis: {
    movimientosKardex: number;
    totalKgSalidas: number;
    eventosSensibilizacion: number;
    personasCapacitadas: number;
    certificados: number;
  };
  alertas: {
    diasParaCierre: number;
    kardexPorPagar: number;
    ordenesSinFacturar: number;
    gastosPendientes: number;
  };
  notificaciones: Array<{
    tipo: "gasto" | "orden";
    id: string;
    numero: number;
    estado: string;
    observacion: string;
    fecha: string;
    concepto?: string;
  }>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [gastosNovedades, setGastosNovedades] = useState<GastoCajaMenor[]>([]);
  const [rubroNames, setRubroNames] = useState<Map<string, string>>(new Map());
  const [loadingGastos, setLoadingGastos] = useState(true);

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const añoActual = new Date().getFullYear();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadStats() {
      if (!session?.user?.coordinatorRecordId || canViewAll) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadStats();
    }
  }, [session?.user?.coordinatorRecordId, canViewAll]);

  // Cargar novedades de caja menor
  useEffect(() => {
    async function loadGastos() {
      if (!session?.user?.coordinatorRecordId || canViewAll) {
        setLoadingGastos(false);
        return;
      }
      try {
        const res = await fetch("/api/caja-menor");
        if (res.ok) {
          const data = await res.json();
          const gastos = (data.gastos || []) as GastoCajaMenor[];
          const conNovedades = gastos.filter((g) => {
            const tieneObs = g.fields.ObservacionesAdmin && g.fields.ObservacionesAdmin.trim() !== "";
            const estadoCambiado = g.fields.Estado && g.fields.Estado !== "Pendiente";
            return tieneObs || estadoCambiado;
          });
          conNovedades.sort((a, b) => (b.fields.Fecha || "").localeCompare(a.fields.Fecha || ""));
          setGastosNovedades(conNovedades.slice(0, 5));

          // Load rubro names
          try {
            const resRubros = await fetch("/api/rubros");
            if (resRubros.ok) {
              const rubrosData = await resRubros.json();
              const map = new Map<string, string>();
              for (const r of rubrosData.rubros || []) {
                map.set(r.id, r.fields.Nombre || "Rubro");
              }
              setRubroNames(map);
            }
          } catch { /* not critical */ }
        }
      } catch (err) {
        console.error("Error loading gastos novedades:", err);
      } finally {
        setLoadingGastos(false);
      }
    }
    if (session?.user?.coordinatorRecordId) {
      loadGastos();
    }
  }, [session?.user?.coordinatorRecordId, canViewAll]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  const totalAlertas = stats
    ? stats.alertas.kardexPorPagar + stats.alertas.ordenesSinFacturar + stats.alertas.gastosPendientes
    : 0;

  if (canViewAll) {
    router.push("/dashboard-ejecutivo");
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Bienvenido, {session.user?.name || "Coordinador"}!
          </h1>
          <p className="text-gray-600">{session.user?.email}</p>
        </div>

        {/* Sección solo para coordinadores */}
        {!canViewAll && (
          <>
            {/* SECCIÓN 1: Barras de Metas Anuales */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Metas {añoActual}
              </h2>
              {loading ? (
                <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                  Cargando metas...
                </div>
              ) : stats && !stats.metas.configurada ? (
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-6 text-center">
                  <p className="text-amber-700 font-medium">
                    Meta no configurada — contacta al administrador
                  </p>
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DualProgressBar
                    label={`Meta Recolección ${añoActual}`}
                    entradas={stats.metas.recoleccion.entradas}
                    salidas={stats.metas.recoleccion.salidas}
                    meta={stats.metas.recoleccion.meta}
                    unit="kg"
                  />
                  <ProgressBar
                    label={`Meta Sensibilización ${añoActual}`}
                    actual={stats.metas.sensibilizacion.actual}
                    meta={stats.metas.sensibilizacion.meta}
                    evaluadas={stats.metas.sensibilizacion.evaluadas}
                    unit="personas"
                    color="#3B82F6"
                    actualLabel="Personas Sensibilizadas"
                    evaluadasLabel="Personas Evaluadas"
                  />
                </div>
              ) : null}
            </div>

            {/* SECCIÓN 2: KPIs del Año */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KpiCard
                title="Movimientos Kardex"
                value={loading ? "..." : stats?.kpis.movimientosKardex ?? 0}
                description={`Entradas y salidas en ${añoActual}`}
                icon="📦"
                color="purple"
              />
              <KpiCard
                title="Certificados de Entrega"
                value={loading ? "..." : stats?.kpis.certificados ?? 0}
                description={`Certificados de entrega en ${añoActual}`}
                icon="📜"
                color="green"
              />
              <KpiCard
                title="Eventos Sensibilización"
                value={loading ? "..." : stats?.kpis.eventosSensibilizacion ?? 0}
                description={`Actividades realizadas en ${añoActual}`}
                icon="🎤"
                color="blue"
              />
              <KpiCard
                title="Personas Sensibilizadas"
                value={
                  loading
                    ? "..."
                    : stats?.kpis.personasCapacitadas.toLocaleString("es-CO") ?? "0"
                }
                description={`Participantes sensibilización ${añoActual}`}
                icon="👥"
                color="campolimpio"
              />
            </div>

            {/* SECCIÓN 3: Alertas y Pendientes */}
            {stats && totalAlertas > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Alertas y Pendientes
                </h2>
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
                  <div className="flex items-center gap-3 p-4">
                    <span className="text-xl">⏰</span>
                    <span className="text-sm text-gray-700">
                      Faltan <strong>{stats.alertas.diasParaCierre} días</strong> para el cierre de{" "}
                      {new Date().toLocaleDateString("es-CO", { month: "long" })}
                    </span>
                  </div>
                  {stats.alertas.kardexPorPagar > 0 && (
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📦</span>
                        <span className="text-sm text-gray-700">
                          <strong>{stats.alertas.kardexPorPagar}</strong> kardex &quot;Por Pagar&quot; sin orden de servicio
                        </span>
                      </div>
                      <Link href="/kardex" className="text-sm text-[#00d084] hover:text-[#00b872] font-medium">
                        Ver →
                      </Link>
                    </div>
                  )}
                  {stats.alertas.ordenesSinFacturar > 0 && (
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📑</span>
                        <span className="text-sm text-gray-700">
                          <strong>{stats.alertas.ordenesSinFacturar}</strong> órdenes pendientes por facturar
                        </span>
                      </div>
                      <Link href="/ordenes-servicio" className="text-sm text-[#00d084] hover:text-[#00b872] font-medium">
                        Ver →
                      </Link>
                    </div>
                  )}
                  {stats.alertas.gastosPendientes > 0 && (
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">💰</span>
                        <span className="text-sm text-gray-700">
                          <strong>{stats.alertas.gastosPendientes}</strong> gastos de caja menor pendientes de aprobación
                        </span>
                      </div>
                      <Link href="/caja-menor" className="text-sm text-[#00d084] hover:text-[#00b872] font-medium">
                        Ver →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* SECCIÓN 4: Accesos Rápidos */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/ordenes-servicio-v2/nueva"
              className="group p-5 bg-white border-2 border-gray-200 hover:border-[#00d084] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Nueva Orden</h3>
                <p className="text-xs text-gray-500">Orden de servicio</p>
              </div>
            </Link>
            <Link
              href="/caja-menor/nuevo"
              className="group p-5 bg-white border-2 border-gray-200 hover:border-[#00d084] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Nuevo Gasto</h3>
                <p className="text-xs text-gray-500">Caja menor</p>
              </div>
            </Link>
            <Link
              href="/kardex"
              className="group p-5 bg-white border-2 border-gray-200 hover:border-[#00d084] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Nuevo Kardex</h3>
                <p className="text-xs text-gray-500">Registro de movimiento</p>
              </div>
            </Link>
            <Link
              href="/mapa"
              className="group p-5 bg-white border-2 border-gray-200 hover:border-[#00d084] rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center transition-colors">
                <span className="text-2xl">🗺️</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Mapa</h3>
                <p className="text-xs text-gray-500">Cobertura geográfica</p>
              </div>
            </Link>
          </div>
        </div>

        {/* SECCIÓN 5: Notificaciones del Admin (solo coordinadores) */}
        {!canViewAll && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔔</span> Notificaciones
              {stats && stats.notificaciones.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {stats.notificaciones.length}
                </span>
              )}
            </h2>
            {loading ? (
              <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
                Cargando notificaciones...
              </div>
            ) : !stats || stats.notificaciones.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-gray-500">No hay notificaciones recientes</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {stats.notificaciones.map((notif) => {
                    const esGasto = notif.tipo === "gasto";
                    const estadoColors: Record<string, string> = {
                      Rechazado: "bg-red-100 text-red-800 border-red-300",
                      Rechazada: "bg-red-100 text-red-800 border-red-300",
                      Aprobado: "bg-green-100 text-green-800 border-green-300",
                      Enviada: "bg-blue-100 text-blue-800 border-blue-300",
                      Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
                    };

                    return (
                      <div key={`${notif.tipo}-${notif.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-[#00d084]">
                                {esGasto ? `Gasto #${notif.numero}` : `Orden #${notif.numero}`}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-bold rounded border ${
                                  estadoColors[notif.estado] || "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {notif.estado}
                              </span>
                            </div>
                            {notif.concepto && (
                              <p className="text-sm text-gray-700 mb-1">{notif.concepto}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {notif.fecha
                                ? new Date(notif.fecha + "T00:00:00").toLocaleDateString("es-CO")
                                : ""}
                            </p>
                            {notif.observacion && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                <span className="font-bold text-amber-700">Observación:</span>
                                <p className="text-amber-800 mt-1">{notif.observacion}</p>
                              </div>
                            )}
                          </div>
                          <Link
                            href={esGasto ? `/caja-menor/${notif.id}` : `/ordenes-servicio`}
                            className="px-3 py-1.5 bg-[#00d084] text-white text-sm font-medium rounded hover:bg-[#00b872] transition-colors"
                          >
                            Ver
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-4">
                  <Link
                    href="/caja-menor"
                    className="text-sm text-[#00d084] hover:text-[#00b872] font-medium"
                  >
                    Ver gastos →
                  </Link>
                  <Link
                    href="/ordenes-servicio"
                    className="text-sm text-[#00d084] hover:text-[#00b872] font-medium"
                  >
                    Ver órdenes →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 6: Novedades Caja Menor (solo coordinadores) */}
        {!canViewAll && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>💰</span> Novedades Caja Menor
            </h2>
            {loadingGastos ? (
              <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
                Cargando novedades...
              </div>
            ) : gastosNovedades.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-gray-500">No hay novedades en tus gastos de caja menor</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {gastosNovedades.map((gasto) => {
                    const estado = gasto.fields.Estado || "Pendiente";
                    const observaciones = gasto.fields.ObservacionesAdmin || "";
                    const fecha = gasto.fields.Fecha || "";
                    const numero = gasto.fields.NumeroGasto || 0;
                    const rubroId = gasto.fields.Rubro?.[0];
                    const concepto = rubroId ? rubroNames.get(rubroId) || "" : "";
                    const valorNeto = (gasto.fields.Valor || 0) - ((gasto.fields.Valor || 0) * (gasto.fields.PorcentajeRetencion || 0));

                    const estadoColors: Record<string, string> = {
                      Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
                      Aprobado: "bg-green-100 text-green-800 border-green-300",
                      Rechazado: "bg-red-100 text-red-800 border-red-300",
                      Reembolsado: "bg-blue-100 text-blue-800 border-blue-300",
                    };

                    return (
                      <div key={gasto.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-[#00d084]">Gasto #{numero}</span>
                              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${estadoColors[estado] || "bg-gray-100 text-gray-800"}`}>
                                {estado}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">{concepto}</p>
                            <p className="text-xs text-gray-500">
                              {fecha ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO") : ""} •
                              <span className="font-mono font-bold text-gray-700 ml-1">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(valorNeto)}
                              </span>
                            </p>
                            {observaciones && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                <span className="font-bold text-amber-700">Observación del Admin:</span>
                                <p className="text-amber-800 mt-1">{observaciones}</p>
                              </div>
                            )}
                          </div>
                          <Link
                            href={`/caja-menor/${gasto.id}`}
                            className="px-3 py-1.5 bg-[#00d084] text-white text-sm font-medium rounded hover:bg-[#00b872] transition-colors"
                          >
                            Ver
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <Link
                    href="/caja-menor"
                    className="text-sm text-[#00d084] hover:text-[#00b872] font-medium"
                  >
                    Ver todos los gastos →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
