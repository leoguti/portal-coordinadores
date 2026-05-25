"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

const spinner = (
  <div className="flex items-center justify-center py-20">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
      <p className="mt-4 text-gray-600">Cargando...</p>
    </div>
  </div>
);

const DashboardEjecutivo = dynamic(
  () => import("@/components/DashboardEjecutivo"),
  { loading: () => spinner }
);

const MetasPorZona = dynamic(() => import("@/components/MetasPorZona"), {
  loading: () => spinner,
});

export default function DashboardEjecutivoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "zonas">("resumen");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
      </div>
    );
  }

  if (!session) return null;

  if (!isAdminOrSupervisor(session.user?.rol)) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
            Acceso restringido a administradores y supervisores.
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setTab("resumen")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "resumen"
                ? "bg-[#00d084] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setTab("zonas")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === "zonas"
                ? "bg-[#00d084] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Metas por Zona
          </button>
        </div>
      </div>

      {tab === "resumen" ? (
        <DashboardEjecutivo userName={session.user?.name || undefined} />
      ) : (
        <MetasPorZona />
      )}
    </AuthenticatedLayout>
  );
}
