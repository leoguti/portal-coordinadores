"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { useVolverAlListado } from "@/lib/listadoFiltrosNav";
import { type ReembolsoCajaMenor } from "@/lib/airtable";

export default function ReembolsoDetallePage() {
  const params = useParams();
  useSession(); // Validate session
  const volverHref = useVolverAlListado("/caja-menor");
  const reembolsoId = params.id as string;

  const [reembolso, setReembolso] = useState<ReembolsoCajaMenor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReembolso() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/caja-menor/reembolsos/${reembolsoId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Error al cargar el reembolso");
          return;
        }

        const { reembolso: r } = await res.json();
        setReembolso(r);
      } catch (err) {
        console.error("Error loading reembolso:", err);
        setError("Error al cargar el reembolso");
      } finally {
        setLoading(false);
      }
    }

    if (reembolsoId) {
      loadReembolso();
    }
  }, [reembolsoId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando reembolso...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error || !reembolso) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || "Reembolso no encontrado"}</p>
            <Link
              href={volverHref}
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Volver a Caja Menor
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const numero = reembolso.fields.NumeroReembolso || 0;
  const fecha = reembolso.fields.Fecha || "";
  const coordinador = reembolso.fields.NombreCoordinador?.[0] || "Sin coordinador";
  const observaciones = reembolso.fields.Observaciones || "";
  const monto = reembolso.fields.Monto || 0;

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href={volverHref} className="hover:text-[#00d084] transition-colors">
              Caja Menor
            </Link>
            <span>&rsaquo;</span>
            <span>Reembolso #{numero}</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Reembolso #{numero}
            </h1>
            <span className="inline-block px-3 py-1 text-sm font-bold rounded border bg-blue-100 text-blue-800 border-blue-300">
              Reembolso
            </span>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Informacion del Reembolso
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {fecha
                  ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO")
                  : "Sin fecha"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coordinador</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {coordinador}
              </div>
            </div>
          </div>

          {/* Monto */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-blue-600 uppercase font-bold mb-1">Monto del Reembolso</p>
                <p className="text-3xl font-mono font-bold text-blue-700">
                  {formatCurrency(monto)}
                </p>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          {observaciones && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="text-sm font-bold text-amber-800 mb-1">Observaciones</h3>
              <p className="text-amber-700">{observaciones}</p>
            </div>
          )}
        </div>

        {/* Back button */}
        <div className="mt-6">
          <Link
            href={volverHref}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Volver a Caja Menor
          </Link>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
