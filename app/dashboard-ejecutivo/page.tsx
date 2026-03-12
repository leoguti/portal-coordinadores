"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

const DashboardEjecutivo = dynamic(
  () => import("@/components/DashboardEjecutivo"),
  {
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
          <p className="mt-4 text-gray-600">Cargando dashboard ejecutivo...</p>
        </div>
      </div>
    ),
  }
);

export default function DashboardEjecutivoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
      <DashboardEjecutivo userName={session.user?.name || undefined} />
    </AuthenticatedLayout>
  );
}
