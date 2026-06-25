"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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

const DashboardCertificados = dynamic(
  () => import("@/components/DashboardCertificados"),
  { loading: () => spinner }
);

export default function DashboardEjecutivoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "zonas" | "certificados">("resumen");
  const [coordinadores, setCoordinadores] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/coordinadores?onlyCoordinadores=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCoordinadores(d.coordinadores || []))
      .catch(() => {});
  }, []);

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
      <div className="max-w-7xl mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap">
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
          <button
            onClick={() => setTab("certificados")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === "certificados"
                ? "bg-[#00d084] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Certificados
          </button>
        </div>

        {/* Acceso al board de Junta Directiva (sin ítem de menú aparte) */}
        <Link
          href="/dashboard-junta"
          className="inline-flex items-center gap-2 rounded-lg border border-[#00d084] bg-white px-4 py-2 text-sm font-medium text-[#00a868] shadow-sm transition-colors hover:bg-[#00d084] hover:text-white"
        >
          🏛️ Board Junta
        </Link>
      </div>

      {tab === "resumen" && (
        <DashboardEjecutivo userName={session.user?.name || undefined} />
      )}
      {tab === "zonas" && <MetasPorZona />}
      {tab === "certificados" && (
        <div className="max-w-7xl mx-auto">
          <DashboardCertificados scope="all" coordinadores={coordinadores} />
        </div>
      )}
    </AuthenticatedLayout>
  );
}
