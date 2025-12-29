"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface KardexRecord {
  id: string;
  createdTime: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    "Name (from Coordinador)"?: string[];
    EstadoPago?: string;
    "mundep (from MunicipioOrigen)"?: string[];
    NombreCentrodeAcopio?: string[];
    Reciclaje?: number;
    Incineracion?: number;
    Flexibles?: number;
    PlasticoContaminado?: number;
    Lonas?: number;
    Carton?: number;
    Metal?: number;
    Total?: number;
    Descripción?: string;
    nombregestor?: string[];
  };
}

export default function KardexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kardexRecords, setKardexRecords] = useState<KardexRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchKardex();
    }
  }, [status]);

  const fetchKardex = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/kardex");
      
      if (!response.ok) {
        throw new Error("Error al cargar movimientos");
      }

      const data = await response.json();
      setKardexRecords(data.kardex || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("es-CO");
  };

  const getTipoIcon = (tipo?: string) => {
    if (tipo === "ENTRADA") return "⬇️";
    if (tipo === "SALIDA") return "⬆️";
    return "📦";
  };

  const getEstadoBadge = (estado?: string) => {
    const colors: Record<string, string> = {
      "Caja Menor": "bg-blue-100 text-blue-800",
      "Sin Costo": "bg-gray-100 text-gray-800",
      "Por Pagar": "bg-yellow-100 text-yellow-800",
      "En Orden": "bg-green-100 text-green-800",
    };
    
    const color = colors[estado || ""] || "bg-gray-100 text-gray-800";
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
        {estado || "Sin estado"}
      </span>
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kardex</h1>
          <p className="text-gray-600">
            Registro de movimientos logísticos de envases vacíos
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando movimientos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">⚠️ {error}</p>
          </div>
        ) : kardexRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay movimientos registrados
            </h2>
            <p className="text-gray-600">
              Aún no tienes entradas o salidas de inventario
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold">{kardexRecords.length}</span> movimientos
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Municipio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Centro Acopio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gestor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total (kg)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {kardexRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.fields.idkardex || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.fields.fechakardex)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-1">
                          {getTipoIcon(record.fields.TipoMovimiento)}
                          <span className="font-medium">{record.fields.TipoMovimiento || "-"}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.fields["mundep (from MunicipioOrigen)"]?.[0] || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.fields.NombreCentrodeAcopio?.[0] || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.fields.nombregestor?.[0] || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        {record.fields.Total?.toLocaleString("es-CO") || "0"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getEstadoBadge(record.fields.EstadoPago)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
