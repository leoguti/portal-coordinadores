"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function OrdenesServicioPage() {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Órdenes de Servicio</h1>
          <p className="text-gray-600">Gestión de órdenes de servicio</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Órdenes de Servicio
          </h2>
          <p className="text-gray-600 mb-4">
            Esta funcionalidad estará disponible próximamente
          </p>
          <div className="inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg">
            🚧 En desarrollo - Tabla en proceso de creación en Airtable
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
