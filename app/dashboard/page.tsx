"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import KpiCard from "@/components/KpiCard";
import RecentList from "@/components/RecentList";
import Link from "next/link";

/**
 * Dashboard Page - Protected Route
 * 
 * Main overview page with KPIs, recent items, and quick actions
 */

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Recent Items Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
          <RecentList items={recentItems} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
