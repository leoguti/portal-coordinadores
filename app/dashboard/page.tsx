"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

const DashboardCoordinador = dynamic(() => import("@/components/DashboardCoordinador"), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
    </div>
  ),
});

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (canViewAll) {
    router.push("/dashboard-ejecutivo");
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto" />
        </div>
      </AuthenticatedLayout>
    );
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
      <DashboardCoordinador />
    </AuthenticatedLayout>
  );
}
