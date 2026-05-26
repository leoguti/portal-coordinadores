"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

const spinner = (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
  </div>
);

const DashboardCoordinador = dynamic(() => import("@/components/DashboardCoordinador"), { loading: () => spinner });
const DashboardCertificados = dynamic(() => import("@/components/DashboardCertificados"), { loading: () => spinner });

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "certificados">("resumen");

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (canViewAll) {
    router.push("/dashboard-ejecutivo");
    return <AuthenticatedLayout>{spinner}</AuthenticatedLayout>;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto mb-4">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setTab("resumen")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "resumen" ? "bg-[#00d084] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setTab("certificados")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              tab === "certificados" ? "bg-[#00d084] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Mis Certificados
          </button>
        </div>
      </div>

      {tab === "resumen" && <DashboardCoordinador />}
      {tab === "certificados" && (
        <div className="max-w-7xl mx-auto">
          <DashboardCertificados scope="mine" />
        </div>
      )}
    </AuthenticatedLayout>
  );
}
