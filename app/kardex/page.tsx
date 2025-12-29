"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import KardexFormModal from "@/components/KardexFormModal";

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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [centroAcopio, setCentroAcopio] = useState("");
  const [gestor, setGestor] = useState("");
  const [estadoPago, setEstadoPago] = useState("");

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

  // Verificar si un kardex puede ser eliminado (misma lógica que órdenes)
  const puedeEliminarKardex = (fechaKardex: string): boolean => {
    if (!fechaKardex) return false;
    
    const fechaMovimiento = new Date(fechaKardex + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaActual = hoy.getDate();
    
    if (diaActual > 7) {
      // Después del día 7: solo mes actual
      const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return fechaMovimiento >= inicioMesActual;
    } else {
      // Días 1-7: mes anterior y actual
      const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return fechaMovimiento >= inicioMesAnterior;
    }
  };

  const handleDeleteKardex = async (kardexId: string, idkardex: number) => {
    if (!confirm(`¿Estás seguro de eliminar el movimiento #${idkardex}?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/kardex/${kardexId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        alert(`Movimiento #${idkardex} eliminado correctamente`);
        await fetchKardex();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'No se pudo eliminar el movimiento'}`);
      }
    } catch (error) {
      console.error('Error eliminando kardex:', error);
      alert('Error al eliminar el movimiento');
    }
  };

  const handleCreateKardex = async (formData: any) => {
    try {
      const response = await fetch("/api/kardex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Error al crear movimiento");
      }

      await fetchKardex();
    } catch (err) {
      throw err;
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

  const getMaterialIcon = (material: string) => {
    const icons: Record<string, string> = {
      "Reciclaje": "♻️",
      "Incineracion": "🔥",
      "Flexibles": "📦",
      "PlasticoContaminado": "⚠️",
      "Lonas": "🎪",
      "Carton": "📄",
      "Metal": "⚙️",
    };
    return icons[material] || "📦";
  };

  const materialesLabels: Record<string, string> = {
    "Reciclaje": "Reciclaje",
    "Incineracion": "Incineración",
    "Flexibles": "Flexibles",
    "PlasticoContaminado": "Plástico Contaminado",
    "Lonas": "Lonas",
    "Carton": "Cartón",
    "Metal": "Metal",
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Obtener valores únicos para filtros
  const getUniqueValues = (field: keyof KardexRecord["fields"]) => {
    const values = new Set<string>();
    kardexRecords.forEach((record) => {
      const value = record.fields[field];
      if (Array.isArray(value)) {
        value.forEach((v) => values.add(v));
      } else if (value) {
        values.add(String(value));
      }
    });
    return Array.from(values).sort();
  };

  // Aplicar filtros
  const filteredRecords = kardexRecords.filter((record) => {
    // Filtro de fecha desde
    if (fechaDesde && record.fields.fechakardex) {
      if (new Date(record.fields.fechakardex) < new Date(fechaDesde)) {
        return false;
      }
    }

    // Filtro de fecha hasta
    if (fechaHasta && record.fields.fechakardex) {
      if (new Date(record.fields.fechakardex) > new Date(fechaHasta)) {
        return false;
      }
    }

    // Filtro de tipo de movimiento
    if (tipoMovimiento && record.fields.TipoMovimiento !== tipoMovimiento) {
      return false;
    }

    // Filtro de municipio
    if (municipio) {
      const municipios = record.fields["mundep (from MunicipioOrigen)"] || [];
      if (!municipios.includes(municipio)) {
        return false;
      }
    }

    // Filtro de centro de acopio
    if (centroAcopio) {
      const centros = record.fields.NombreCentrodeAcopio || [];
      if (!centros.includes(centroAcopio)) {
        return false;
      }
    }

    // Filtro de gestor
    if (gestor) {
      const gestores = record.fields.nombregestor || [];
      if (!gestores.includes(gestor)) {
        return false;
      }
    }

    // Filtro de estado de pago
    if (estadoPago && record.fields.EstadoPago !== estadoPago) {
      return false;
    }

    return true;
  });

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setTipoMovimiento("");
    setMunicipio("");
    setCentroAcopio("");
    setGestor("");
    setEstadoPago("");
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kardex</h1>
            <p className="text-gray-600">
              Registro de movimientos logísticos de envases vacíos
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
          >
            <span className="text-xl">➕</span>
            Nuevo Movimiento
          </button>
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
            {/* Sección de Filtros */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">🔍 Filtros</h2>
                <button
                  onClick={limpiarFiltros}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Fecha Desde */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  />
                </div>

                {/* Fecha Hasta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  />
                </div>

                {/* Tipo de Movimiento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📦 Tipo Movimiento
                  </label>
                  <select
                    value={tipoMovimiento}
                    onChange={(e) => setTipoMovimiento(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    <option value="ENTRADA">⬇️ ENTRADA</option>
                    <option value="SALIDA">⬆️ SALIDA</option>
                  </select>
                </div>

                {/* Estado de Pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💰 Estado de Pago
                  </label>
                  <select
                    value={estadoPago}
                    onChange={(e) => setEstadoPago(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    <option value="Caja Menor">Caja Menor</option>
                    <option value="Sin Costo">Sin Costo</option>
                    <option value="Por Pagar">Por Pagar</option>
                    <option value="En Orden">En Orden</option>
                  </select>
                </div>

                {/* Municipio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏙️ Municipio
                  </label>
                  <select
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("mundep (from MunicipioOrigen)").map((mun) => (
                      <option key={mun} value={mun}>
                        {mun}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Centro de Acopio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏢 Centro de Acopio
                  </label>
                  <select
                    value={centroAcopio}
                    onChange={(e) => setCentroAcopio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("NombreCentrodeAcopio").map((centro) => (
                      <option key={centro} value={centro}>
                        {centro}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gestor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ♻️ Gestor
                  </label>
                  <select
                    value={gestor}
                    onChange={(e) => setGestor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("nombregestor").map((ges) => (
                      <option key={ges} value={ges}>
                        {ges}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Barra de resumen */}
            <div className="px-6 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Mostrando <span className="font-semibold">{filteredRecords.length}</span> de{" "}
                  <span className="font-semibold">{kardexRecords.length}</span> movimientos
                </p>
                {filteredRecords.length > 0 && (
                  <p className="text-sm text-gray-600">
                    Total filtrado:{" "}
                    <span className="font-semibold">
                      {filteredRecords
                        .reduce((sum, r) => sum + (r.fields.Total || 0), 0)
                        .toLocaleString("es-CO")}{" "}
                      kg
                    </span>
                  </p>
                )}
              </div>
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <>
                      <tr
                        key={record.id}
                        onClick={() => toggleRow(record.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {expandedRow === record.id ? "▼" : "▶"}
                            </span>
                            {record.fields.idkardex || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(record.fields.fechakardex)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="inline-flex items-center gap-1">
                            {getTipoIcon(record.fields.TipoMovimiento)}
                            <span className="font-medium text-gray-900">{record.fields.TipoMovimiento || "-"}</span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {record.fields.fechakardex && puedeEliminarKardex(record.fields.fechakardex) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteKardex(record.id, record.fields.idkardex || 0);
                              }}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                              title="Eliminar movimiento"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRow === record.id && (
                        <tr key={`${record.id}-detail`} className="bg-purple-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="flex flex-wrap gap-3 items-center">
                              <span className="text-sm font-semibold text-gray-900">📊</span>
                              {Object.entries(materialesLabels).map(([key, label]) => {
                                const valor = record.fields[key as keyof typeof record.fields] as number | undefined;
                                if (!valor || valor === 0) return null;
                                return (
                                  <div
                                    key={key}
                                    className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-purple-200 shadow-sm"
                                  >
                                    <span className="text-lg">{getMaterialIcon(key)}</span>
                                    <span className="text-xs font-medium text-gray-600">{label}:</span>
                                    <span className="text-sm font-bold text-purple-700">{valor.toLocaleString("es-CO")} kg</span>
                                  </div>
                                );
                              })}
                              {record.fields.Descripción && (
                                <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-purple-200 shadow-sm">
                                  <span className="text-sm font-semibold text-gray-900">📝</span>
                                  <span className="text-xs text-gray-700 italic">{record.fields.Descripción}</span>
                                </div>
                              )}
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
        )}

        {/* Modal para agregar nuevo movimiento */}
        {showAddModal && (
          <KardexFormModal
            onClose={() => setShowAddModal(false)}
            onSubmit={handleCreateKardex}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
