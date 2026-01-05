"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Fragment } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import KardexFormModal from "@/components/KardexFormModal";
import { puedeModificarFecha, getFechaCorteMesesCerrados } from "@/lib/dateValidations";

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
    nombregestor?: string[];
    AÑO?: string;
    MES?: string;
  };
}

export default function KardexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allKardexRecords, setAllKardexRecords] = useState<KardexRecord[]>([]); // TODOS los registros
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Pagination (cliente)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  // Admin features
  const isAdmin = session?.user?.rol === "Administrador";
  const [coordinadores, setCoordinadores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCoordinador, setSelectedCoordinador] = useState("");
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipoMovimiento, setTipoMovimiento] = useState("");
  const [mes, setMes] = useState(""); // Filtro por año-mes
  const [municipio, setMunicipio] = useState("");
  const [centroAcopio, setCentroAcopio] = useState("");
  const [gestor, setGestor] = useState("");
  const [estadoPago, setEstadoPago] = useState("");
  
  // Vista de resúmenes
  const [showResumen, setShowResumen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchKardex();
      // Solo cargar coordinadores si es admin
      if (isAdmin) {
        fetchCoordinadores();
      }
    }
  }, [status, isAdmin]);

  // Fetch coordinadores (solo para admin)
  const fetchCoordinadores = async () => {
    try {
      const response = await fetch("/api/coordinadores");
      if (response.ok) {
        const data = await response.json();
        setCoordinadores(data.coordinadores || []);
      }
    } catch (err) {
      console.error("Error cargando coordinadores:", err);
    }
  };

  const fetchKardex = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Traer TODOS los registros sin paginación
      const allRecords: KardexRecord[] = [];
      let offset: string | undefined = undefined;
      
      do {
        const params = new URLSearchParams();
        params.append("pageSize", "100"); // Máximo por página
        
        if (offset) {
          params.append("offset", offset);
        }
        
        if (isAdmin && selectedCoordinador) {
          params.append("coordinatorId", selectedCoordinador);
        }
        
        const url = `/api/kardex?${params.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Error al cargar movimientos");
        }

        const data = await response.json();
        allRecords.push(...(data.kardex || []));
        offset = data.offset;
        
        // Si no hay más páginas, salir del loop
        if (!data.hasMore) break;
      } while (offset);
      
      setAllKardexRecords(allRecords);
      setCurrentPage(1); // Reset a primera página
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  // Recargar cuando cambia el filtro de coordinador
  useEffect(() => {
    if (isAdmin && status === "authenticated") {
      fetchKardex();
    }
  }, [selectedCoordinador]);

  // Verificar si un kardex puede ser eliminado
  const puedeEliminarKardex = (fechaKardex: string, estadoPago?: string): boolean => {
    if (!fechaKardex) return false;
    
    // No se puede eliminar si está en una orden
    if (estadoPago === "En Orden") return false;
    
    // Usar función centralizada
    return puedeModificarFecha(fechaKardex);
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
    allKardexRecords.forEach((record) => {
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
  const filteredRecords = allKardexRecords.filter((record) => {
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

    // Filtro de mes (año-mes)
    if (mes && record.fields.MES !== mes) {
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

  // Paginación en cliente
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Total en kg de TODOS los registros filtrados
  const totalKg = filteredRecords.reduce((sum, r) => sum + (r.fields.Total || 0), 0);

  // ========== CÁLCULOS DE RESÚMENES ==========
  
  // Obtener fecha de corte para meses cerrados (usar función centralizada)
  const fechaCorteCerrado = getFechaCorteMesesCerrados();
  
  // Filtrar solo registros de meses cerrados (estrictamente menores a la fecha de corte)
  const registrosCerrados = filteredRecords.filter((record) => {
    if (!record.fields.fechakardex) return false;
    const fechaMovimiento = new Date(record.fields.fechakardex + 'T00:00:00');
    return fechaMovimiento < fechaCorteCerrado;
  });
  
  // Resumen por Mes (solo meses cerrados)
  const resumenPorMes = registrosCerrados.reduce((acc, record) => {
    const mes = record.fields.MES;
    const tipo = record.fields.TipoMovimiento;
    const total = record.fields.Total || 0;
    
    if (!mes || !tipo) return acc;
    
    if (!acc[mes]) {
      acc[mes] = { mes, entradas: 0, salidas: 0, saldo: 0 };
    }
    
    if (tipo === "ENTRADA") {
      acc[mes].entradas += total;
    } else if (tipo === "SALIDA") {
      acc[mes].salidas += total;
    }
    
    acc[mes].saldo = acc[mes].entradas - acc[mes].salidas;
    
    return acc;
  }, {} as Record<string, { mes: string; entradas: number; salidas: number; saldo: number }>);
  
  const resumenMensual = Object.values(resumenPorMes)
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12); // Solo últimos 12 meses
  
  // Resumen por Año (solo años COMPLETAMENTE cerrados)
  const resumenPorAnio = registrosCerrados.reduce((acc, record) => {
    const anioRaw = record.fields.AÑO;
    const anio = anioRaw ? String(anioRaw) : null; // Convertir a string por si viene como número
    const tipo = record.fields.TipoMovimiento;
    const total = record.fields.Total || 0;
    
    if (!anio || !tipo) return acc;
    
    if (!acc[anio]) {
      acc[anio] = { año: anio, entradas: 0, salidas: 0, saldo: 0 };
    }
    
    if (tipo === "ENTRADA") {
      acc[anio].entradas += total;
    } else if (tipo === "SALIDA") {
      acc[anio].salidas += total;
    }
    
    acc[anio].saldo = acc[anio].entradas - acc[anio].salidas;
    
    return acc;
  }, {} as Record<string, { año: string; entradas: number; salidas: number; saldo: number }>);
  
  // Filtrar solo años completamente cerrados y limitar a últimos 3 años
  const anioCorteCerrado = fechaCorteCerrado.getFullYear();
  const mesCorteCerrado = fechaCorteCerrado.getMonth(); // 0-11
  
  const resumenAnual = Object.values(resumenPorAnio)
    .filter((item) => {
      const anioNumero = parseInt(item.año);
      // Solo incluir años anteriores al año de corte
      // O si es el mismo año, solo si el mes de corte es enero (mes 0) - significa que todo el año anterior está cerrado
      return anioNumero < anioCorteCerrado || (anioNumero === anioCorteCerrado && mesCorteCerrado === 0);
    })
    .sort((a, b) => b.año.localeCompare(a.año))
    .slice(0, 3); // Solo últimos 3 años

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setTipoMovimiento("");
    setMes("");
    setMunicipio("");
    setCentroAcopio("");
    setGestor("");
    setEstadoPago("");
    setSelectedCoordinador("");
    setCurrentPage(1);
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Kardex
              {isAdmin && <span className="ml-3 text-sm px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">👑 Vista Admin</span>}
            </h1>
            <p className="text-gray-600">
              Registro de movimientos logísticos de envases vacíos
              {isAdmin && <span className="ml-2 text-purple-600 font-medium">(Viendo todos los coordinadores)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowResumen(!showResumen)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                <span className="text-xl">📊</span>
                {showResumen ? "Ocultar Resúmenes" : "Ver Resúmenes"}
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              <span className="text-xl">➕</span>
              Nuevo Movimiento
            </button>
          </div>
        </div>

        {/* Sección de Resúmenes - SOLO ADMIN */}
        {isAdmin && showResumen && allKardexRecords.length > 0 && (
          <div className="mb-8 space-y-6">
            {/* Resumen por Año */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    📅 Resumen por Año (últimos 3 años)
                  </h2>
                  <span className="text-xs text-gray-600">
                    🔒 Solo períodos completamente cerrados
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase">⬇️ Entradas (kg)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase">⬆️ Salidas (kg)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase font-bold">💰 Saldo (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {resumenAnual.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No hay datos con año disponible
                        </td>
                      </tr>
                    ) : (
                      resumenAnual.map((item) => (
                        <tr key={item.año} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.año}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 font-semibold">
                            {item.entradas.toLocaleString("es-CO")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700 font-semibold">
                            {item.salidas.toLocaleString("es-CO")}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                            item.saldo >= 0 ? "text-blue-700" : "text-red-700"
                          }`}>
                            {item.saldo.toLocaleString("es-CO")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen por Mes */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-purple-50 border-b border-purple-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    📆 Resumen por Mes (últimos 12 meses)
                  </h2>
                  <span className="text-xs text-gray-600">
                    🔒 Solo períodos completamente cerrados
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase">⬇️ Entradas (kg)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase">⬆️ Salidas (kg)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase font-bold">💰 Saldo (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {resumenMensual.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No hay datos con mes disponible
                        </td>
                      </tr>
                    ) : (
                      resumenMensual.map((item) => (
                        <tr key={item.mes} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.mes}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 font-semibold">
                            {item.entradas.toLocaleString("es-CO")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700 font-semibold">
                            {item.salidas.toLocaleString("es-CO")}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                            item.saldo >= 0 ? "text-blue-700" : "text-red-700"
                          }`}>
                            {item.saldo.toLocaleString("es-CO")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando movimientos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">⚠️ {error}</p>
          </div>
        ) : allKardexRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay movimientos registrados
            </h2>
            <p className="text-gray-600">
              {isAdmin 
                ? "No hay movimientos de ningún coordinador en el sistema"
                : "Aún no tienes entradas o salidas de inventario"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Sección de Filtros */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  🔍 Filtros
                  <span className="ml-2 text-xs text-purple-600">
                    (Total en base: {allKardexRecords.length.toLocaleString("es-CO")} movimientos)
                  </span>
                </h2>
                <button
                  onClick={limpiarFiltros}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* ADMIN ONLY: Filtro de Coordinador */}
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      👤 Coordinador
                    </label>
                    <select
                      value={selectedCoordinador}
                      onChange={(e) => setSelectedCoordinador(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    >
                      <option value="">Todos los coordinadores</option>
                      {coordinadores.map((coord) => (
                        <option key={coord.id} value={coord.id}>
                          {coord.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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

                {/* Mes (Año-Mes) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Mes (Año-Mes)
                  </label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Todos</option>
                    {getUniqueValues("MES").map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
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
                  Mostrando <span className="font-semibold">{startIndex + 1}-{Math.min(endIndex, totalRecords)}</span> de{" "}
                  <span className="font-semibold">{totalRecords.toLocaleString("es-CO")}</span> movimientos
                  {totalRecords < allKardexRecords.length && (
                    <span className="ml-2 text-gray-500">
                      (filtrados de {allKardexRecords.length.toLocaleString("es-CO")} totales)
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  Total:{" "}
                  <span className="font-semibold">
                    {totalKg.toLocaleString("es-CO")} kg
                  </span>
                </p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coordinador
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total (kg)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedRecords.map((record) => (
                    <Fragment key={record.id}>
                      <tr
                        onClick={() => toggleRow(record.id)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {expandedRow === record.id ? "▼" : "▶"}
                            </span>
                            {formatDate(record.fields.fechakardex)}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {record.fields["Name (from Coordinador)"]?.[0] || "-"}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="inline-flex items-center gap-1">
                            {getTipoIcon(record.fields.TipoMovimiento)}
                            <span className="font-medium text-gray-900">{record.fields.TipoMovimiento || "-"}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                          {record.fields.Total?.toLocaleString("es-CO") || "0"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(record.id);
                            }}
                            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors"
                            title="Ver detalles"
                          >
                            {expandedRow === record.id ? "Cerrar" : "Ver más"}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === record.id && (
                        <tr className="bg-purple-50">
                          <td colSpan={isAdmin ? 5 : 4} className="px-6 py-4">
                            <div className="space-y-3">
                              {/* Información general */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-3 border-b border-purple-200">
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Consecutivo</span>
                                  <p className="text-sm font-semibold text-gray-900 mt-1">
                                    #{record.fields.idkardex || "-"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Estado de Pago</span>
                                  <div className="mt-1">
                                    {getEstadoBadge(record.fields.EstadoPago)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Municipio</span>
                                  <p className="text-sm font-semibold text-gray-900 mt-1">
                                    {record.fields["mundep (from MunicipioOrigen)"]?.[0] || "-"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Centro Acopio</span>
                                  <p className="text-sm font-semibold text-gray-900 mt-1">
                                    {record.fields.NombreCentrodeAcopio?.[0] || "-"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">Gestor</span>
                                  <p className="text-sm font-semibold text-gray-900 mt-1">
                                    {record.fields.nombregestor?.[0] || "-"}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Desglose de materiales */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-500">📊 Desglose por Material</span>
                                  <div className="flex items-center gap-2 bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-300">
                                    <span className="text-xs font-medium text-purple-700">Total General:</span>
                                    <span className="text-base font-bold text-purple-900">
                                      {(record.fields.Total || 0).toLocaleString("es-CO")} kg
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(materialesLabels).map(([key, label]) => {
                                    const valor = record.fields[key as keyof typeof record.fields] as number | undefined;
                                    if (!valor || valor === 0) return null;
                                    return (
                                      <div
                                        key={key}
                                        className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-purple-200 shadow-sm"
                                      >
                                        <span className="text-base">{getMaterialIcon(key)}</span>
                                        <span className="text-xs font-medium text-gray-600">{label}:</span>
                                        <span className="text-sm font-bold text-purple-700">{valor.toLocaleString("es-CO")} kg</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              {/* Acciones en desplegable */}
                              {record.fields.fechakardex && puedeEliminarKardex(record.fields.fechakardex, record.fields.EstadoPago) ? (
                                <div className="pt-3 border-t border-purple-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteKardex(record.id, record.fields.idkardex || 0);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                                  >
                                    🗑️ Eliminar movimiento
                                  </button>
                                </div>
                              ) : record.fields.EstadoPago === "En Orden" ? (
                                <div className="pt-3 border-t border-purple-200">
                                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded border border-gray-300">
                                    <span>🔒</span>
                                    <span>No se puede eliminar: este movimiento está asociado a una orden de servicio</span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Controles de paginación */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                      Página <span className="font-semibold">{currentPage}</span> de{" "}
                      <span className="font-semibold">{totalPages}</span>
                    </span>
                    <select
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <option key={page} value={page}>
                          Página {page}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
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
