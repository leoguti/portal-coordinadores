"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getCentrosAcopio, getAllKardex, type CentroAcopio, type Kardex } from "@/lib/airtable";

interface SaldoCentro {
  centroId: string;
  centroNombre: string;
  municipio: string;
  entradas: {
    cantidad: number;
    totalKg: number;
  };
  salidas: {
    cantidad: number;
    totalKg: number;
  };
  saldo: number;
  materiales: {
    reciclaje: number;
    incineracion: number;
    plasticoContaminado: number;
    flexibles: number;
    lonas: number;
    carton: number;
    metal: number;
  };
}

export default function SaldosCentrosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saldos, setSaldos] = useState<SaldoCentro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function cargarSaldos() {
      try {
        setLoading(true);
        setError(null);

        // Cargar centros y kardex
        const [centros, kardexes] = await Promise.all([
          getCentrosAcopio(),
          getAllKardex(),
        ]);

        // Calcular saldos por centro
        const saldosPorCentro = centros.map((centro) => {
          const centroId = centro.id;
          
          // Filtrar kardex de este centro
          const kardexCentro = kardexes.filter((k) => 
            k.fields.CentrodeAcopio?.includes(centroId)
          );

          const entradas = kardexCentro.filter((k) => k.fields.TipoMovimiento === "ENTRADA");
          const salidas = kardexCentro.filter((k) => k.fields.TipoMovimiento === "SALIDA");

          // Sumar totales
          const totalEntradas = entradas.reduce((sum, k) => sum + (k.fields.Total || 0), 0);
          const totalSalidas = salidas.reduce((sum, k) => sum + Math.abs(k.fields.Total || 0), 0);
          const saldo = totalEntradas - totalSalidas;

          // Calcular por material
          const materiales = {
            reciclaje: 0,
            incineracion: 0,
            plasticoContaminado: 0,
            flexibles: 0,
            lonas: 0,
            carton: 0,
            metal: 0,
          };

          kardexCentro.forEach((k) => {
            const factor = k.fields.TipoMovimiento === "ENTRADA" ? 1 : -1;
            materiales.reciclaje += (k.fields.Reciclaje || 0) * factor;
            materiales.incineracion += (k.fields.Incineracion || 0) * factor;
            materiales.plasticoContaminado += (k.fields.PlasticoContaminado || 0) * factor;
            materiales.flexibles += (k.fields.Flexibles || 0) * factor;
            materiales.lonas += (k.fields.Lonas || 0) * factor;
            materiales.carton += (k.fields.Carton || 0) * factor;
            materiales.metal += (k.fields.Metal || 0) * factor;
          });

          return {
            centroId,
            centroNombre: centro.fields.Nombre || "Sin nombre",
            municipio: centro.fields["mundep (from Municipio)"]?.[0] || "Sin municipio",
            entradas: {
              cantidad: entradas.length,
              totalKg: totalEntradas,
            },
            salidas: {
              cantidad: salidas.length,
              totalKg: totalSalidas,
            },
            saldo,
            materiales,
          };
        });

        // Ordenar por saldo descendente
        saldosPorCentro.sort((a, b) => b.saldo - a.saldo);

        setSaldos(saldosPorCentro);
      } catch (err) {
        console.error("Error loading saldos:", err);
        setError("Error al cargar los saldos. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      cargarSaldos();
    }
  }, [session]);

  const formatKg = (kg: number) => {
    return new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);
  };

  if (status === "loading" || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Calculando saldos...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 Saldos Centros de Acopio
          </h1>
          <p className="text-gray-600 mt-1">
            Balance de inventario por centro basado en entradas y salidas
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Resumen Global */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-600 mb-1">Total Centros</div>
            <div className="text-2xl font-bold text-gray-900">{saldos.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Saldo Total</div>
            <div className="text-2xl font-bold text-green-600">
              {formatKg(saldos.reduce((sum, s) => sum + s.saldo, 0))} kg
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-sm text-gray-600 mb-1">Movimientos</div>
            <div className="text-2xl font-bold text-gray-900">
              {saldos.reduce((sum, s) => sum + s.entradas.cantidad + s.salidas.cantidad, 0)}
            </div>
          </div>
        </div>

        {/* Tabla de Saldos */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Centro de Acopio
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Municipio
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Entradas
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Salidas
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Saldo (kg)
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((saldo, index) => (
                <>
                  <tr
                    key={saldo.centroId}
                    className={`border-b border-gray-200 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-blue-50 transition-colors`}
                  >
                    {/* Centro */}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {saldo.centroNombre}
                    </td>

                    {/* Municipio */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {saldo.municipio}
                    </td>

                    {/* Entradas */}
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-mono text-green-600">
                        +{formatKg(saldo.entradas.totalKg)}
                      </div>
                      <div className="text-xs text-gray-500">
                        ({saldo.entradas.cantidad} mov)
                      </div>
                    </td>

                    {/* Salidas */}
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-mono text-red-600">
                        -{formatKg(saldo.salidas.totalKg)}
                      </div>
                      <div className="text-xs text-gray-500">
                        ({saldo.salidas.cantidad} mov)
                      </div>
                    </td>

                    {/* Saldo */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-mono font-bold ${
                          saldo.saldo >= 0 ? "text-[#00d084]" : "text-red-600"
                        }`}
                      >
                        {formatKg(saldo.saldo)}
                      </span>
                    </td>

                    {/* Botón Expandir */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setExpandido(expandido === saldo.centroId ? null : saldo.centroId)
                        }
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                      >
                        {expandido === saldo.centroId ? "Ocultar" : "Ver"}
                      </button>
                    </td>
                  </tr>

                  {/* Fila expandida con detalle de materiales */}
                  {expandido === saldo.centroId && (
                    <tr className="bg-blue-50 border-b border-gray-200">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">
                          Desglose por Material:
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Reciclaje</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.reciclaje)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Incineración</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.incineracion)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Plástico Cont.</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.plasticoContaminado)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Flexibles</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.flexibles)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Lonas</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.lonas)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Cartón</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.carton)} kg
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border">
                            <div className="text-xs text-gray-600">Metal</div>
                            <div className="text-sm font-mono font-bold">
                              {formatKg(saldo.materiales.metal)} kg
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
