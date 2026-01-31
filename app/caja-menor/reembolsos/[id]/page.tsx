"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import {
  type ReembolsoCajaMenor,
  type GastoCajaMenor,
} from "@/lib/airtable";

export default function ReembolsoDetallePage() {
  const params = useParams();
  useSession(); // Validate session
  const reembolsoId = params.id as string;

  const [reembolso, setReembolso] = useState<ReembolsoCajaMenor | null>(null);
  const [gastosIncluidos, setGastosIncluidos] = useState<GastoCajaMenor[]>([]);
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

        // Fetch each gasto included in this reembolso
        const gastoIds = r.fields.GastosCajaMenor || [];
        const gastosData: GastoCajaMenor[] = [];
        for (const id of gastoIds) {
          try {
            const gRes = await fetch(`/api/caja-menor/${id}`);
            if (gRes.ok) {
              const { gasto } = await gRes.json();
              gastosData.push(gasto);
            }
          } catch {
            // Skip failed fetches
          }
        }
        setGastosIncluidos(gastosData);
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
    }).format(amount);
  };

  const calcValorNeto = (g: GastoCajaMenor) => {
    const valor = g.fields.Valor || 0;
    const pct = g.fields.PorcentajeRetencion || 0;
    return valor - valor * pct; // Airtable Percent: 0.03 = 3%
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
              href="/caja-menor"
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
  const montoTotal =
    reembolso.fields.MontoTotal ||
    gastosIncluidos.reduce((sum, g) => sum + calcValorNeto(g), 0);

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/caja-menor" className="hover:text-[#00d084] transition-colors">
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

          {/* Total */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-blue-600 uppercase font-bold mb-1">Monto Total</p>
                <p className="text-3xl font-mono font-bold text-blue-700">
                  {formatCurrency(montoTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Gastos incluidos</p>
                <p className="text-3xl font-bold text-gray-900">
                  {gastosIncluidos.length}
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

        {/* Gastos table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
              Gastos Incluidos
            </h3>
          </div>
          {gastosIncluidos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No se pudieron cargar los gastos.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Beneficiario</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Concepto</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Valor Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {gastosIncluidos.map((gasto, index) => (
                  <tr
                    key={gasto.id}
                    className={`border-b border-gray-200 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#00d084]">
                        #{gasto.fields.NumeroGasto || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {gasto.fields.Fecha
                        ? new Date(gasto.fields.Fecha + "T00:00:00").toLocaleDateString("es-CO")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {gasto.fields.RazonSocial?.[0] || "Sin beneficiario"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                      {gasto.fields.Concepto || ""}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#00d084]">
                      {formatCurrency(calcValorNeto(gasto))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/caja-menor/${gasto.id}`}
                        className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-gray-900 uppercase text-xs">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-blue-700 text-lg">
                    {formatCurrency(montoTotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Back button */}
        <div className="mt-6">
          <Link
            href="/caja-menor"
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Volver a Caja Menor
          </Link>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
