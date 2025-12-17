"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Dashboard Page - Protected Route
 * 
 * Only accessible to authenticated users
 * Shows user email and sign out button
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Portal Coordinadores
          </h1>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              ¡Bienvenido!
            </h2>
            <p className="text-xl text-gray-600">
              Hola, <span className="font-semibold text-blue-600">{session.user?.email}</span>
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold mb-4">Información de Sesión</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email:</dt>
                  <dd className="text-sm text-gray-900">{session.user?.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estado:</dt>
                  <dd className="text-sm text-green-600 font-medium">Autenticado ✓</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Este es un dashboard de prueba con autenticación mínima.
              No hay conexión a base de datos ni roles implementados.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
