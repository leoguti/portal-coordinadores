"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import TerceroSearch from "@/components/TerceroSearch";
import {
  getKardexPorPagar,
  getCatalogoServicios,
  createOrdenServicio,
  type Kardex,
  type CatalogoServicio,
  type CreateItemOrdenParams,
} from "@/lib/airtable";

interface KardexSeleccionado extends Kardex {
  selected: boolean;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
}

interface TerceroSeleccionado {
  id: string;
  razonSocial: string;
  nit?: string;
}

interface ItemNoKardex {
  id: string;
  catalogoId: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  formaCobro: "Por Flete" | "Por Kilo";
}

export default function NuevaOrdenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [kardexList, setKardexList] = useState<KardexSeleccionado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroTipoMovimiento, setFiltroTipoMovimiento] = useState<string>("TODOS");
  const [kardexExpandido, setKardexExpandido] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 20;

  // Collapsible sections
  const [seccionKardexAbierta, setSeccionKardexAbierta] = useState(true);
  const [seccionCatalogoAbierta, setSeccionCatalogoAbierta] = useState(false);

  // Items no Kardex
  const [itemsNoKardex, setItemsNoKardex] = useState<ItemNoKardex[]>([]);
  const [catalogoServicios, setCatalogoServicios] = useState<CatalogoServicio[]>([]);

  // Form fields
  const [fechaPedido, setFechaPedido] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [beneficiario, setBeneficiario] = useState<TerceroSeleccionado | null>(null);
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load Kardex and Catalogo
  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Load Kardex and Catalogo in parallel
        const [kardexData, catalogoData] = await Promise.all([
          getKardexPorPagar(session.user.coordinatorRecordId),
          getCatalogoServicios(),
        ]);

        // Initialize Kardex with default values
        // Sort by date ascending (oldest first)
        const kardexConDefaults = kardexData
          .sort((a, b) => {
            const dateA = new Date(a.fields.fechakardex || "").getTime();
            const dateB = new Date(b.fields.fechakardex || "").getTime();
            return dateA - dateB; // Ascending: oldest first
          })
          .map((k) => ({
            ...k,
            selected: false,
            formaCobro: "Por Kilo" as const,
            cantidad: Math.abs(k.fields.Total || 0), // Use Total kg as default
            precioUnitario: 0,
          }));

        setKardexList(kardexConDefaults);
        setCatalogoServicios(catalogoData);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadData();
    }
  }, [session?.user?.coordinatorRecordId]);

  const toggleKardex = (id: string) => {
    setKardexList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, selected: !k.selected } : k))
    );
  };

  const updateKardexField = (
    id: string,
    field: keyof Pick<
      KardexSeleccionado,
      "formaCobro" | "cantidad" | "precioUnitario"
    >,
    value: any
  ) => {
    setKardexList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const selectedKardex = kardexList.filter((k) => k.selected);

  // Funciones para items del catálogo
  const agregarItemCatalogo = (catalogoId: string) => {
    const servicio = catalogoServicios.find((s) => s.id === catalogoId);
    if (!servicio) return;

    const nuevoItem: ItemNoKardex = {
      id: `cat-${Date.now()}`,
      catalogoId: servicio.id,
      descripcion: servicio.fields.Nombre || "",
      cantidad: 1,
      unidad: servicio.fields.UnidadMedida || "unidad",
      precioUnitario: 0,
      formaCobro: (servicio.fields.UnidadMedida === "Por Kilo" || servicio.fields.UnidadMedida === "Por Flete") 
        ? servicio.fields.UnidadMedida as "Por Kilo" | "Por Flete"
        : "Por Kilo",
    };
    setItemsNoKardex([...itemsNoKardex, nuevoItem]);
  };

  const eliminarItemNoKardex = (id: string) => {
    setItemsNoKardex(itemsNoKardex.filter((item) => item.id !== id));
  };

  const updateItemNoKardex = (
    id: string,
    field: keyof ItemNoKardex,
    value: any
  ) => {
    setItemsNoKardex((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calcularTotal = () => {
    const totalKardex = selectedKardex.reduce((sum, k) => {
      if (k.formaCobro === "Por Flete") {
        return sum + k.precioUnitario;
      } else {
        return sum + k.cantidad * k.precioUnitario;
      }
    }, 0);

    const totalNoKardex = itemsNoKardex.reduce((sum, item) => {
      if (item.formaCobro === "Por Flete") {
        return sum + item.precioUnitario;
      } else {
        return sum + item.cantidad * item.precioUnitario;
      }
    }, 0);

    return totalKardex + totalNoKardex;
  };

  const handleSubmit = async (estado: "Borrador" | "Enviada") => {
    if (!session?.user?.coordinatorRecordId) {
      setError("No se pudo identificar el coordinador");
      return;
    }

    if (selectedKardex.length === 0 && itemsNoKardex.length === 0) {
      setError("Debes seleccionar al menos un Kardex o agregar un servicio del catálogo");
      return;
    }

    if (!beneficiario) {
      setError("Debes seleccionar un beneficiario");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Items from Kardex
      const itemsKardex: CreateItemOrdenParams[] = selectedKardex.map((k) => ({
        kardexRecordId: k.id,
        formaCobro: k.formaCobro,
        cantidad: k.cantidad,
        precioUnitario: k.precioUnitario,
      }));

      // Items from Catalog
      const itemsCatalogo: CreateItemOrdenParams[] = itemsNoKardex.map((item) => ({
        catalogoRecordId: item.catalogoId,
        formaCobro: item.formaCobro,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
      }));

      const allItems = [...itemsKardex, ...itemsCatalogo];

      const ordenCreada = await createOrdenServicio({
        coordinatorRecordId: session.user.coordinatorRecordId,
        beneficiarioRecordId: beneficiario.id,
        fechaPedido,
        observaciones: observaciones.trim() || undefined,
        items: allItems,
        estado, // Pass estado to function
      });

      console.log("Orden creada:", ordenCreada);

      // Redirect to orders page
      router.push("/ordenes-servicio");
    } catch (err) {
      console.error("Error creating order:", err);
      setError(
        "Error al crear la orden. Por favor verifica los datos e intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter and paginate kardex
  const kardexFiltrados = kardexList.filter((k) => {
    // Filtro por fecha - criterio de bloqueo día 7
    if (k.fields.fechakardex) {
      const fechaKardex = new Date(k.fields.fechakardex + 'T00:00:00');
      const hoy = new Date();
      const diaActual = hoy.getDate();
      
      // Calcular mes y año desde el que mostramos registros
      let mesDesde, anioDesde;
      
      if (diaActual > 7) {
        // Si ya pasó el día 7, mostramos desde inicio del mes actual
        mesDesde = hoy.getMonth();
        anioDesde = hoy.getFullYear();
      } else {
        // Si aún no es día 7, mostramos desde inicio del mes anterior
        mesDesde = hoy.getMonth() - 1;
        anioDesde = hoy.getFullYear();
        if (mesDesde < 0) {
          mesDesde = 11;
          anioDesde -= 1;
        }
      }
      
      const fechaLimite = new Date(anioDesde, mesDesde, 1);
      
      // Comparar solo año y mes
      const kardexMes = fechaKardex.getMonth();
      const kardexAnio = fechaKardex.getFullYear();
      const limiteMes = fechaLimite.getMonth();
      const limiteAnio = fechaLimite.getFullYear();
      
      // Bloquear si el año es menor, o si es el mismo año pero el mes es menor
      if (kardexAnio < limiteAnio || (kardexAnio === limiteAnio && kardexMes < limiteMes)) {
        return false;
      }
    }
    
    // Filtro por tipo de movimiento
    if (filtroTipoMovimiento === "TODOS") return true;
    
    // Verificar que el campo TipoMovimiento existe y coincide
    const tipoMovimiento = k.fields.TipoMovimiento;
    return tipoMovimiento === filtroTipoMovimiento;
  });

  // Calcular fecha desde la que se muestran registros (para el mensaje)
  const getFechaDesde = () => {
    const hoy = new Date();
    const diaActual = hoy.getDate();
    
    let mesDesde, anioDesde;
    
    if (diaActual > 7) {
      // Mostrar desde inicio del mes actual
      mesDesde = hoy.getMonth();
      anioDesde = hoy.getFullYear();
    } else {
      // Mostrar desde inicio del mes anterior
      mesDesde = hoy.getMonth() - 1;
      anioDesde = hoy.getFullYear();
      if (mesDesde < 0) {
        mesDesde = 11;
        anioDesde -= 1;
      }
    }
    
    return new Date(anioDesde, mesDesde, 1);
  };

  // Contar registros por tipo (aplicando filtro de fecha)
  const contarPorTipo = (tipo: string) => {
    return kardexList.filter((k) => {
      // Aplicar filtro de fecha
      if (k.fields.fechakardex) {
        const fechaKardex = new Date(k.fields.fechakardex + 'T00:00:00');
        const hoy = new Date();
        const diaActual = hoy.getDate();
        
        let mesDesde, anioDesde;
        
        if (diaActual > 7) {
          mesDesde = hoy.getMonth();
          anioDesde = hoy.getFullYear();
        } else {
          mesDesde = hoy.getMonth() - 1;
          anioDesde = hoy.getFullYear();
          if (mesDesde < 0) {
            mesDesde = 11;
            anioDesde -= 1;
          }
        }
        
        const kardexMes = fechaKardex.getMonth();
        const kardexAnio = fechaKardex.getFullYear();
        const limiteMes = mesDesde;
        const limiteAnio = anioDesde;
        
        if (kardexAnio < limiteAnio || (kardexAnio === limiteAnio && kardexMes < limiteMes)) {
          return false;
        }
      }
      
      // Aplicar filtro de tipo
      if (tipo === "TODOS") return true;
      return k.fields.TipoMovimiento === tipo;
    }).length;
  };

  const totalPages = Math.ceil(kardexFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const kardexPaginados = kardexFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link
              href="/ordenes-servicio"
              className="hover:text-[#00d084] transition-colors"
            >
              Órdenes de Servicio
            </Link>
            <span>›</span>
            <span>Nueva Orden</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Nueva Orden de Servicio
          </h1>
        </div>

        <div className="space-y-6">
          {/* Datos básicos */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Datos de la Orden
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pedido
                </label>
                <input
                  type="date"
                  value={fechaPedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  required
                />
              </div>

              {/* Beneficiario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beneficiario *
                </label>
                <TerceroSearch
                  value={beneficiario}
                  onChange={setBeneficiario}
                  required
                  placeholder="Buscar tercero por nombre..."
                />
              </div>
            </div>

            {/* Observaciones */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                placeholder="Comentarios adicionales sobre la orden..."
              />
            </div>
          </div>

          {/* Kardex disponibles - Sección Colapsable */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <button
              onClick={() => setSeccionKardexAbierta(!seccionKardexAbierta)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Registros de Kardex
                </h2>
                <span className="px-3 py-1 bg-[#00d084] text-white text-sm rounded-full">
                  {selectedKardex.length} seleccionados
                </span>
              </div>
              <svg
                className={`w-6 h-6 text-gray-500 transition-transform ${
                  seccionKardexAbierta ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {seccionKardexAbierta && (
              <div className="px-6 pb-6">
                {/* Info sobre filtro de fecha */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ℹ️ <strong>Registros disponibles:</strong> Solo se muestran Kardex desde el{" "}
                <strong>
                  {getFechaDesde().toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </strong>
                {" "}hasta hoy.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Los registros de meses bloqueados (anteriores al día 7 del mes) no están disponibles para crear órdenes de servicio.
              </p>
            </div>

            {/* Filtro por Tipo de Movimiento */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por tipo de movimiento
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFiltroTipoMovimiento("TODOS");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filtroTipoMovimiento === "TODOS"
                      ? "bg-[#00d084] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Todos ({contarPorTipo("TODOS")})
                </button>
                <button
                  onClick={() => {
                    setFiltroTipoMovimiento("ENTRADA");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filtroTipoMovimiento === "ENTRADA"
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  Entrada ({contarPorTipo("ENTRADA")})
                </button>
                <button
                  onClick={() => {
                    setFiltroTipoMovimiento("SALIDA");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filtroTipoMovimiento === "SALIDA"
                      ? "bg-red-600 text-white"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  Salida ({contarPorTipo("SALIDA")})
                </button>
              </div>
            </div>

            {kardexFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {filtroTipoMovimiento === "TODOS" 
                  ? "No hay Kardex disponibles con estado \"Por Pagar\""
                  : `No hay Kardex de tipo "${filtroTipoMovimiento}"`
                }
              </div>
            ) : (
              <>
                <div className="space-y-2">
                {kardexPaginados.map((kardex) => {
                  const total = Math.abs(kardex.fields.Total || 0);
                  const municipio = kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
                  const fecha = kardex.fields.fechakardex || "Sin fecha";
                  const isExpanded = kardexExpandido === kardex.id;

                  const materiales = [
                    { nombre: "Reciclaje", kg: kardex.fields.Reciclaje || 0, color: "bg-green-500" },
                    { nombre: "Incineración", kg: kardex.fields.Incineracion || 0, color: "bg-orange-500" },
                    { nombre: "Flexibles", kg: kardex.fields.Flexibles || 0, color: "bg-blue-500" },
                    { nombre: "Contaminado", kg: kardex.fields.PlasticoContaminado || 0, color: "bg-red-500" },
                    { nombre: "Lonas", kg: kardex.fields.Lonas || 0, color: "bg-purple-500" },
                    { nombre: "Cartón", kg: kardex.fields.Carton || 0, color: "bg-yellow-500" },
                    { nombre: "Metal", kg: kardex.fields.Metal || 0, color: "bg-gray-500" },
                  ].filter(m => m.kg > 0);

                  return (
                    <div
                      key={kardex.id}
                      className={`border rounded-lg transition-all ${
                        kardex.selected
                          ? "border-[#00d084] bg-[#e6f9f3]"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {/* Compact View - Always visible */}
                      <div className="flex items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={kardex.selected}
                          onChange={() => toggleKardex(kardex.id)}
                          className="h-5 w-5 text-[#00d084] rounded focus:ring-[#00d084]"
                        />
                        
                        {/* Main Info - Compact */}
                        <div 
                          className="flex-1 flex items-center justify-between cursor-pointer"
                          onClick={() => setKardexExpandido(isExpanded ? null : kardex.id)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Kardex Number */}
                            <div className="font-semibold text-gray-900">
                              #{kardex.fields.idkardex}
                            </div>
                            
                            {/* Tipo Movimiento Badge */}
                            {kardex.fields.TipoMovimiento && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                kardex.fields.TipoMovimiento === "ENTRADA" 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {kardex.fields.TipoMovimiento}
                              </span>
                            )}
                            
                            {/* Fecha y Municipio */}
                            <div className="text-xs text-gray-600">
                              {fecha} • {municipio}
                            </div>
                          </div>

                          {/* Total */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">
                                {total.toLocaleString('es-CO')} kg
                              </div>
                            </div>
                            
                            {/* Expand Icon */}
                            <svg 
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Expanded View - Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                          {/* Desglose de materiales */}
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Desglose de materiales:</h4>
                            <div className="space-y-2">
                              {materiales.map((material) => {
                                const porcentaje = total > 0 ? (material.kg / total) * 100 : 0;
                                return (
                                  <div key={material.nombre} className="flex items-center gap-2">
                                    <div className="w-24 text-xs text-gray-600">{material.nombre}</div>
                                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                                      <div
                                        className={`h-full ${material.color} rounded-full`}
                                        style={{ width: `${Math.max(porcentaje, 5)}%` }}
                                      />
                                    </div>
                                    <div className="w-20 text-xs text-gray-600 text-right">
                                      {material.kg.toLocaleString('es-CO')} kg
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Anterior
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-lg transition-colors ${
                            page === currentPage
                              ? "bg-[#00d084] text-white font-semibold"
                              : "border border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
              </div>
            )}
          </div>

          {/* Catálogo de Servicios - Sección Colapsable */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <button
              onClick={() => setSeccionCatalogoAbierta(!seccionCatalogoAbierta)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  Catálogo de Servicios
                </h2>
                <span className="px-3 py-1 bg-[#00d084] text-white text-sm rounded-full">
                  {itemsNoKardex.length} agregados
                </span>
              </div>
              <svg
                className={`w-6 h-6 text-gray-500 transition-transform ${
                  seccionCatalogoAbierta ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {seccionCatalogoAbierta && (
              <div className="px-6 pb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Servicios adicionales que no provienen de registros de Kardex
                </p>

                {/* Lista de servicios del catálogo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catalogoServicios.map((servicio) => (
                    <button
                      key={servicio.id}
                      onClick={() => agregarItemCatalogo(servicio.id)}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#00d084] hover:bg-green-50 transition-all text-left group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 group-hover:text-[#00d084]">
                            {servicio.fields.Nombre}
                          </h3>
                          {servicio.fields.Descripcion && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {servicio.fields.Descripcion}
                            </p>
                          )}
                          <span className="inline-block mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {servicio.fields.UnidadMedida || "unidad"}
                          </span>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-[#00d084]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>

                {catalogoServicios.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay servicios disponibles en el catálogo
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumen estilo Factura */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Resumen de la Orden
            </h2>

            {selectedKardex.length === 0 && itemsNoKardex.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Selecciona Kardex o agrega servicios del catálogo para ver el resumen
              </p>
            ) : (
              <>
                {/* Info del Beneficiario */}
                {beneficiario && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Beneficiario</h3>
                    <div className="space-y-1">
                      <p className="text-base font-medium text-gray-900">{beneficiario.razonSocial}</p>
                      {beneficiario.nit && (
                        <p className="text-sm text-gray-600">NIT: {beneficiario.nit}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabla estilo factura */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                          Kardex
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">
                          Cantidad
                        </th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">
                          Unidad
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">
                          Valor Unit.
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedKardex.map((kardex) => {
                        const subtotal = kardex.formaCobro === "Por Flete" 
                          ? kardex.precioUnitario  // Por Flete: el precio es el total
                          : kardex.cantidad * kardex.precioUnitario;  // Por Kilo: cantidad × precio
                        return (
                          <tr key={kardex.id} className="border-b border-gray-200">
                            <td className="py-3 px-2 text-sm">
                              <div className="font-medium text-gray-900">
                                Kardex #{kardex.fields.idkardex}
                              </div>
                              <div className="text-xs text-gray-500">
                                {kardex.fields.fechakardex} • {kardex.fields["mundep (from MunicipioOrigen)"]?.[0]}
                              </div>
                              <div className="text-xs mt-1">
                                {kardex.fields.TipoMovimiento ? (
                                  <span className={`inline-block px-2 py-0.5 rounded ${
                                    kardex.fields.TipoMovimiento === "ENTRADA" 
                                      ? "bg-green-100 text-green-700" 
                                      : "bg-red-100 text-red-700"
                                  }`}>
                                    {kardex.fields.TipoMovimiento}
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                                    Sin tipo - #{kardex.fields.idkardex}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-3 px-2 text-sm font-medium text-gray-900">
                              {kardex.formaCobro === "Por Flete" 
                                ? "1" 
                                : kardex.cantidad.toLocaleString("es-CO")}
                            </td>
                            <td className="text-center py-3 px-2">
                              <select
                                value={kardex.formaCobro}
                                onChange={(e) =>
                                  updateKardexField(
                                    kardex.id,
                                    "formaCobro",
                                    e.target.value as "Por Flete" | "Por Kilo"
                                  )
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084] bg-white"
                              >
                                <option value="Por Kilo">Por Kilo</option>
                                <option value="Por Flete">Por Flete</option>
                              </select>
                            </td>
                            <td className="text-right py-3 px-2">
                              <input
                                type="number"
                                value={kardex.precioUnitario || ""}
                                onChange={(e) =>
                                  updateKardexField(
                                    kardex.id,
                                    "precioUnitario",
                                    e.target.value === "" ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                min="0"
                                step="1"
                                placeholder="0"
                                className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                              />
                            </td>
                            <td className="text-right py-3 px-2 text-sm font-semibold text-gray-900">
                              {formatCurrency(subtotal)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Items del Catálogo */}
                      {itemsNoKardex.map((item) => {
                        const subtotal = item.formaCobro === "Por Flete"
                          ? item.precioUnitario
                          : item.cantidad * item.precioUnitario;
                        return (
                          <tr key={item.id} className="border-b border-gray-200 bg-blue-50">
                            <td className="py-3 px-2 text-sm">
                              <div className="font-medium text-gray-900">
                                {item.descripcion}
                              </div>
                              <div className="text-xs text-gray-500">
                                📋 Catálogo
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">
                              {item.formaCobro === "Por Flete" ? (
                                <span className="text-sm text-gray-600">-</span>
                              ) : (
                                <input
                                  type="number"
                                  value={item.cantidad}
                                  onChange={(e) =>
                                    updateItemNoKardex(
                                      item.id,
                                      "cantidad",
                                      e.target.value === "" ? 0 : parseFloat(e.target.value)
                                    )
                                  }
                                  min="0"
                                  step="1"
                                  className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                                />
                              )}
                            </td>
                            <td className="text-center py-3 px-2">
                              <select
                                value={item.formaCobro}
                                onChange={(e) =>
                                  updateItemNoKardex(item.id, "formaCobro", e.target.value)
                                }
                                className="px-3 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                              >
                                <option value="Por Kilo">Por Kilo</option>
                                <option value="Por Flete">Por Flete</option>
                              </select>
                            </td>
                            <td className="text-right py-3 px-2">
                              <input
                                type="number"
                                value={item.precioUnitario || ""}
                                onChange={(e) =>
                                  updateItemNoKardex(
                                    item.id,
                                    "precioUnitario",
                                    e.target.value === "" ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                min="0"
                                step="1"
                                placeholder="0"
                                className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                              />
                            </td>
                            <td className="text-right py-3 px-2">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(subtotal)}
                                </span>
                                <button
                                  onClick={() => eliminarItemNoKardex(item.id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Eliminar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td colSpan={4} className="text-right py-4 px-2 text-lg font-bold text-gray-900">
                          TOTAL:
                        </td>
                        <td className="text-right py-4 px-2 text-xl font-bold text-[#00d084]">
                          {formatCurrency(calcularTotal())}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Error Message cerca de botones */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">{error}</p>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 justify-end">
                  <Link
                    href="/ordenes-servicio"
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSubmit("Borrador")}
                    disabled={submitting || (selectedKardex.length === 0 && itemsNoKardex.length === 0)}
                    className="px-6 py-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Guardando..." : "💾 Guardar Borrador"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit("Enviada")}
                    disabled={submitting || (selectedKardex.length === 0 && itemsNoKardex.length === 0)}
                    className="px-6 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Enviando..." : "📤 Crear y Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
