"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import KpiCard from "@/components/KpiCard";
import RecentList from "@/components/RecentList";
import Link from "next/link";
import { type GastoCajaMenor } from "@/lib/airtable";

/**
 * Dashboard Page - Protected Route
 * 
 * Main overview page with KPIs, recent items, and quick actions
 */

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gastosConNovedades, setGastosConNovedades] = useState<GastoCajaMenor[]>([]);
  const [loadingNovedades, setLoadingNovedades] = useState(true);

  const isAdmin = session?.user?.rol === "Administrador";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Cargar gastos con novedades (observaciones o cambios de estado)
  useEffect(() => {
    async function loadGastosConNovedades() {
      if (!session?.user?.coordinatorRecordId || isAdmin) {
        setLoadingNovedades(false);
        return;
      }

      try {
        const res = await fetch("/api/caja-menor");
        if (res.ok) {
          const { gastos } = await res.json();
          // Filtrar gastos que tienen observaciones del admin o estado != Pendiente
          const conNovedades = (gastos as GastoCajaMenor[]).filter((g) => {
            const tieneObs = g.fields.ObservacionesAdmin && g.fields.ObservacionesAdmin.trim() !== "";
            const estadoCambiado = g.fields.Estado && g.fields.Estado !== "Pendiente";
            return tieneObs || estadoCambiado;
          });
          // Ordenar por fecha más reciente
          conNovedades.sort((a, b) => {
            const fechaA = a.fields.Fecha || "";
            const fechaB = b.fields.Fecha || "";
            return fechaB.localeCompare(fechaA);
          });
          // Tomar solo los últimos 5
          setGastosConNovedades(conNovedades.slice(0, 5));
        }
      } catch (err) {
        console.error("Error loading gastos con novedades:", err);
      } finally {
        setLoadingNovedades(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadGastosConNovedades();
    }
  }, [session?.user?.coordinatorRecordId, isAdmin]);

  // Show loading state
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

  // Don't render anything if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  // Placeholder data for recent items
  const recentItems = [
    {
      id: "1",
      type: "actividad" as const,
      title: "Capacitación en Manejo de Residuos",
      date: "Hace 2 horas",
      description: "Fusagasugá - 45 participantes",
    },
    {
      id: "2",
      type: "certificado" as const,
      title: "Certificado #2024-123",
      date: "Hace 5 horas",
      description: "Emitido para Finca El Paraíso",
    },
    {
      id: "3",
      type: "kardex" as const,
      title: "Movimiento de Inventario",
      date: "Ayer",
      description: "Recepción de 50 unidades",
    },
    {
      id: "4",
      type: "actividad" as const,
      title: "Jornada de Recolección",
      date: "Hace 2 días",
      description: "Girardot - 30 participantes",
    },
    {
      id: "5",
      type: "certificado" as const,
      title: "Certificado #2024-122",
      date: "Hace 3 días",
      description: "Emitido para Finca La Esperanza",
    },
    {
      id: "6",
      type: "kardex" as const,
      title: "Salida de Inventario",
      date: "Hace 4 días",
      description: "Entrega de 25 unidades",
    },
  ];

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Bienvenido, {session.user?.name || "Coordinador"}!
          </h1>
          <p className="text-gray-600">
            {session.user?.email}
          </p>
        </div>

        {/* KPI Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard
            title="Total Actividades"
            value="34"
            description="Actividades registradas este mes"
            icon="📋"
            color="blue"
          />
          <KpiCard
            title="Certificados Emitidos"
            value="127"
            description="Certificados generados este mes"
            icon="📜"
            color="green"
          />
          <KpiCard
            title="Movimientos Kardex"
            value="89"
            description="Entradas y salidas registradas"
            icon="📦"
            color="purple"
          />
        </div>

        {/* Quick Actions Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/actividades/nueva"
              className="p-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold mb-1">Nueva Actividad</h3>
                <p className="text-sm text-blue-100">Registrar una nueva actividad</p>
              </div>
              <span className="text-3xl">➕</span>
            </Link>
            <Link
              href="/mapa"
              className="p-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-colors flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold mb-1">Mapa de Actividades</h3>
                <p className="text-sm text-amber-100">Ver cobertura geográfica</p>
              </div>
              <span className="text-3xl">🗺️</span>
            </Link>
            <Link
              href="/certificados"
              className="p-6 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold mb-1">Ver Certificados</h3>
                <p className="text-sm text-green-100">Consultar certificados emitidos</p>
              </div>
              <span className="text-3xl">📜</span>
            </Link>
            <Link
              href="/kardex"
              className="p-6 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-md transition-colors flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold mb-1">Ver Kardex</h3>
                <p className="text-sm text-purple-100">Consultar movimientos logísticos</p>
              </div>
              <span className="text-3xl">📦</span>
            </Link>
          </div>
        </div>

        {/* Notificaciones de Caja Menor */}
        {!isAdmin && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔔</span> Novedades en Caja Menor
            </h2>
            {loadingNovedades ? (
              <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
                Cargando novedades...
              </div>
            ) : gastosConNovedades.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-gray-500">No hay novedades en tus gastos de caja menor</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {gastosConNovedades.map((gasto) => {
                    const estado = gasto.fields.Estado || "Pendiente";
                    const observaciones = gasto.fields.ObservacionesAdmin || "";
                    const fecha = gasto.fields.Fecha || "";
                    const numero = gasto.fields.NumeroGasto || 0;
                    const concepto = gasto.fields.Concepto || "";
                    const valorNeto = (gasto.fields.Valor || 0) - ((gasto.fields.Valor || 0) * (gasto.fields.PorcentajeRetencion || 0));

                    const estadoColors: Record<string, string> = {
                      Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
                      Aprobado: "bg-green-100 text-green-800 border-green-300",
                      Rechazado: "bg-red-100 text-red-800 border-red-300",
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

        {/* Recent Items Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
          <RecentList items={recentItems} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
