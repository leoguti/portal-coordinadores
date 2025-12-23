"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import TerceroSearch from "@/components/TerceroSearch";
import {
  getOrdenById,
  getItemsOrden,
  getKardexByIds,
  getKardexPorPagar,
  getTerceroById,
  type Kardex,
  type Tercero,
} from "@/lib/airtable";

interface KardexConItem {
  kardexId: string;
  itemId: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  // Datos del Kardex para mostrar
  idkardex?: number;
  fechakardex?: string;
  municipio?: string;
  tipoMovimiento?: string; // "ENTRADA" | "SALIDA"
  materiales: { nombre: string; kg: number; color: string }[];
}

interface KardexDisponible extends Kardex {
  selected: boolean;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
}

interface TerceroSeleccionado {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: string;
  email?: string;
}

export default function EditarOrdenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const ordenId = params.id as string;

  const [items, setItems] = useState<KardexConItem[]>([]);
  const [kardexDisponibles, setKardexDisponibles] = useState<KardexDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAgregarKardex, setShowAgregarKardex] = useState(false);
  
  // Pagination and filter
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroKardex, setFiltroKardex] = useState("");
  const ITEMS_PER_PAGE = 20;

  // Form fields
  const [fechaPedido, setFechaPedido] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [beneficiario, setBeneficiario] = useState<TerceroSeleccionado | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [numeroOrden, setNumeroOrden] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load existing order
  useEffect(() => {
    async function loadOrden() {
      if (!session?.user?.coordinatorRecordId || !ordenId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const orden = await getOrdenById(ordenId);
        if (!orden) {
          setError("No se encontró la orden");
          return;
        }

        if (!orden.fields.Coordinador?.includes(session.user.coordinatorRecordId)) {
          setError("No tienes permisos para editar esta orden");
          return;
        }

        if (orden.fields.Estado !== "Borrador") {
          setError("Solo se pueden editar órdenes en estado Borrador");
          return;
        }

        setNumeroOrden(orden.fields.NumeroOrden || null);
        setFechaPedido(orden.fields["Fecha de pedido"] || new Date().toISOString().split("T")[0]);
        setObservaciones(orden.fields.Observaciones || "");

        // Load beneficiario details
        if (orden.fields.Beneficiario && orden.fields.Beneficiario[0]) {
          try {
            const terceroId = orden.fields.Beneficiario[0];
            const tercero = await getTerceroById(terceroId);
            
            if (tercero) {
              setBeneficiario({
                id: tercero.id,
                razonSocial: tercero.fields.RazonSocial || "",
                nit: tercero.fields.NIT,
                direccion: tercero.fields.Direccion,
                movil: tercero.fields.Movil,
                email: tercero.fields["Correo Electrónico"],
              });
            } else {
              // Fallback if tercero not found
              setBeneficiario({
                id: orden.fields.Beneficiario[0],
                razonSocial: orden.fields.RazonSocial?.[0] || "Beneficiario",
              });
            }
          } catch (errTercero) {
            console.error("Error loading tercero details:", errTercero);
            // Fallback to basic info from orden
            setBeneficiario({
              id: orden.fields.Beneficiario[0],
              razonSocial: orden.fields.RazonSocial?.[0] || "Beneficiario",
            });
          }
        }

        const itemsOrden = await getItemsOrden(ordenId);
        const kardexIds = itemsOrden
          .filter(item => item.fields.Kardex?.[0])
          .map(item => item.fields.Kardex![0]);

        let kardexConItems: KardexConItem[] = [];

        if (kardexIds.length > 0) {
          const kardexRecords = await getKardexByIds(kardexIds);
          
          kardexConItems = itemsOrden
            .filter(item => item.fields.Kardex?.[0])
            .map(item => {
              const kardexId = item.fields.Kardex![0];
              const kardex = kardexRecords.find(k => k.id === kardexId);

              const materiales = kardex ? [
                { nombre: "Reciclaje", kg: kardex.fields.Reciclaje || 0, color: "bg-green-500" },
                { nombre: "Incineración", kg: kardex.fields.Incineracion || 0, color: "bg-orange-500" },
                { nombre: "Flexibles", kg: kardex.fields.Flexibles || 0, color: "bg-blue-500" },
                { nombre: "Contaminado", kg: kardex.fields.PlasticoContaminado || 0, color: "bg-red-500" },
                { nombre: "Lonas", kg: kardex.fields.Lonas || 0, color: "bg-purple-500" },
                { nombre: "Cartón", kg: kardex.fields.Carton || 0, color: "bg-yellow-500" },
                { nombre: "Metal", kg: kardex.fields.Metal || 0, color: "bg-gray-500" },
              ].filter(m => m.kg > 0) : [];

              return {
                kardexId,
                itemId: item.id,
                formaCobro: (item.fields.FormaCobro || "Por Kilo") as "Por Flete" | "Por Kilo",
                cantidad: item.fields.Cantidad || 0,
                precioUnitario: item.fields.PrecioUnitario || 0,
                idkardex: kardex?.fields.idkardex,
                fechakardex: kardex?.fields.fechakardex,
                municipio: kardex?.fields["mundep (from MunicipioOrigen)"]?.[0],
                tipoMovimiento: kardex?.fields.TipoMovimiento,
                materiales,
              };
            });

          setItems(kardexConItems);
        }

        // Load available Kardex "Por Pagar"
        const kardexPorPagar = await getKardexPorPagar(session.user.coordinatorRecordId);
        
        // Filter out Kardex already in this order
        const kardexIdsEnOrden = kardexConItems.map(k => k.kardexId);
        const kardexFiltrados = kardexPorPagar.filter(k => !kardexIdsEnOrden.includes(k.id));

        // Initialize with default values
        const kardexConDefaults = kardexFiltrados.map((k) => ({
          ...k,
          selected: false,
          formaCobro: "Por Kilo" as const,
          cantidad: Math.abs(k.fields.Total || 0),
          precioUnitario: 0,
        }));

        setKardexDisponibles(kardexConDefaults);
      } catch (err) {
        console.error("Error loading orden:", err);
        setError("Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId && ordenId) {
      loadOrden();
    }
  }, [session?.user?.coordinatorRecordId, ordenId]);

  const updateItem = (
    itemId: string,
    field: "formaCobro" | "precioUnitario",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    if (confirm("¿Estás seguro de eliminar este Kardex de la orden?")) {
      setItems((prev) => prev.filter((item) => item.itemId !== itemId));
      setError(null);
    }
  };

  const toggleKardexDisponible = (id: string) => {
    setKardexDisponibles((prev) =>
      prev.map((k) => (k.id === id ? { ...k, selected: !k.selected } : k))
    );
  };

  const updateKardexDisponible = (
    id: string,
    field: keyof Pick<KardexDisponible, "formaCobro" | "precioUnitario">,
    value: any
  ) => {
    setKardexDisponibles((prev) =>
      prev.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const agregarKardexSeleccionados = () => {
    const seleccionados = kardexDisponibles.filter(k => k.selected);
    
    if (seleccionados.length === 0) {
      setError("Selecciona al menos un Kardex para agregar");
      return;
    }

    // Convert to KardexConItem format (they will be "new" so no itemId yet)
    const nuevosItems: KardexConItem[] = seleccionados.map(k => {
      const materiales = [
        { nombre: "Reciclaje", kg: k.fields.Reciclaje || 0, color: "bg-green-500" },
        { nombre: "Incineración", kg: k.fields.Incineracion || 0, color: "bg-orange-500" },
        { nombre: "Flexibles", kg: k.fields.Flexibles || 0, color: "bg-blue-500" },
        { nombre: "Contaminado", kg: k.fields.PlasticoContaminado || 0, color: "bg-red-500" },
        { nombre: "Lonas", kg: k.fields.Lonas || 0, color: "bg-purple-500" },
        { nombre: "Cartón", kg: k.fields.Carton || 0, color: "bg-yellow-500" },
        { nombre: "Metal", kg: k.fields.Metal || 0, color: "bg-gray-500" },
      ].filter(m => m.kg > 0);

      return {
        kardexId: k.id,
        itemId: `new-${k.id}`, // Temporal ID for new items
        formaCobro: k.formaCobro,
        cantidad: k.cantidad,
        precioUnitario: k.precioUnitario,
        idkardex: k.fields.idkardex,
        fechakardex: k.fields.fechakardex,
        municipio: k.fields["mundep (from MunicipioOrigen)"]?.[0],
        tipoMovimiento: k.fields.TipoMovimiento,
        materiales,
      };
    });

    setItems(prev => [...prev, ...nuevosItems]);
    setKardexDisponibles(prev => prev.filter(k => !k.selected));
    setShowAgregarKardex(false);
    setError(null);
  };

  const calcularTotal = () => {
    return items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);
  };

  // Filter and paginate kardexDisponibles
  const kardexFiltrados = kardexDisponibles.filter(k => {
    if (!filtroKardex) return true;
    const idKardex = String(k.fields.idkardex || "");
    return idKardex.includes(filtroKardex);
  });

  const totalPages = Math.ceil(kardexFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const kardexPaginados = kardexFiltrados.slice(startIndex, endIndex);

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

  if (!session || (error && !items.length)) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
            <p className="text-red-800">{error}</p>
            <Link
              href="/ordenes-servicio"
              className="inline-block mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Volver a Órdenes
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
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
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/ordenes-servicio" className="hover:text-[#00d084]">
              Órdenes de Servicio
            </Link>
            <span>›</span>
            <span>Editar Orden {numeroOrden ? `#${numeroOrden}` : ""}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Editar Orden {numeroOrden ? `#${numeroOrden}` : ""}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Datos de la Orden
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pedido
                </label>
                <input
                  type="date"
                  value={fechaPedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beneficiario *
                </label>
                <TerceroSearch
                  value={beneficiario}
                  onChange={setBeneficiario}
                  required
                  placeholder="Buscar tercero..."
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084]"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Items ({items.length})
            </h2>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 mb-4">
                <div className="text-4xl mb-2">📦</div>
                <p className="text-gray-600">No hay items en esta orden</p>
                <p className="text-sm text-gray-500 mt-1">Agrega Kardex usando el botón de abajo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                <div key={item.itemId} className="border rounded-lg p-4 bg-gray-50 relative">
                  {/* Botón eliminar */}
                  <button
                    onClick={() => removeItem(item.itemId)}
                    className="absolute top-3 right-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar este Kardex de la orden"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <div className="flex items-start justify-between mb-3 pr-8">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {item.cantidad.toLocaleString("es-CO")} kg
                      </h3>
                      <p className="text-xs text-gray-500">Kardex #{item.idkardex}</p>
                    </div>
                  </div>

                  {item.materiales.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {item.materiales.map((material) => {
                        const porcentaje = item.cantidad > 0 ? (material.kg / item.cantidad) * 100 : 0;
                        return (
                          <div key={material.nombre} className="flex items-center gap-2">
                            <div className="w-24 text-xs text-gray-600 truncate">{material.nombre}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-5">
                              <div
                                className={`h-full ${material.color} flex items-center justify-end pr-2 rounded-full`}
                                style={{ width: `${Math.max(porcentaje, 5)}%` }}
                              >
                                <span className="text-xs font-semibold text-white">{material.kg} kg</span>
                              </div>
                            </div>
                            <div className="w-10 text-xs text-gray-500 text-right">{porcentaje.toFixed(0)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-4 text-sm text-gray-600 border-t pt-2 mb-3">
                    <div>📅 {item.fechakardex || "Sin fecha"}</div>
                    <div className="flex-1 truncate">📍 {item.municipio || "Sin municipio"}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Forma de cobro
                      </label>
                      <select
                        value={item.formaCobro}
                        onChange={(e) => updateItem(item.itemId, "formaCobro", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                      >
                        <option value="Por Kilo">Por Kilo</option>
                        <option value="Por Flete">Por Flete</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad (kg)</label>
                      <input
                        type="text"
                        value={item.cantidad.toLocaleString("es-CO")}
                        readOnly
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Precio unitario</label>
                      <input
                        type="number"
                        value={item.precioUnitario || ""}
                        onChange={(e) => updateItem(item.itemId, "precioUnitario", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                        min="0"
                        step="1"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                      />
                    </div>
                    <div className="md:col-span-3 text-right">
                      <span className="text-sm font-semibold">
                        Subtotal: {formatCurrency(item.cantidad * item.precioUnitario)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Botón agregar más Kardex */}
            <div className="mt-4">
              <button
                onClick={() => setShowAgregarKardex(!showAgregarKardex)}
                className="w-full px-4 py-3 border-2 border-dashed border-[#00d084] text-[#00d084] hover:bg-[#e6f9f3] rounded-lg transition-colors font-medium"
              >
                {showAgregarKardex ? "✕ Cancelar" : "+ Agregar más Kardex a esta orden"}
              </button>
            </div>
          </div>

          {/* Kardex disponibles para agregar */}
          {showAgregarKardex && (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Kardex "Por Pagar" Disponibles ({kardexDisponibles.length})
                </h2>
                {totalPages > 1 && (
                  <div className="text-sm text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                )}
              </div>

              {/* Filtro por número de Kardex */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Filtrar por Número de Kardex (opcional)
                </label>
                <input
                  type="text"
                  value={filtroKardex}
                  onChange={(e) => {
                    setFiltroKardex(e.target.value);
                    setCurrentPage(1); // Reset to page 1 when filtering
                  }}
                  placeholder="Ej: 22154"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                />
                {filtroKardex && (
                  <p className="text-sm text-gray-500 mt-1">
                    Mostrando {kardexFiltrados.length} de {kardexDisponibles.length} Kardex
                  </p>
                )}
              </div>

              {kardexFiltrados.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {filtroKardex 
                    ? `No se encontraron Kardex con el número "${filtroKardex}"`
                    : "No hay más Kardex disponibles para agregar"
                  }
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {kardexPaginados.map((kardex) => {
                      const total = Math.abs(kardex.fields.Total || 0);
                      const municipio = kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
                      const fecha = kardex.fields.fechakardex || "Sin fecha";

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
                          className={`border rounded-lg p-4 transition-all ${
                            kardex.selected ? "border-[#00d084] bg-[#e6f9f3]" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={kardex.selected}
                              onChange={() => toggleKardexDisponible(kardex.id)}
                              className="mt-1 h-5 w-5 text-[#00d084] rounded focus:ring-[#00d084]"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {total.toLocaleString("es-CO")} kg
                                  </h3>
                                  <p className="text-xs text-gray-500">Kardex #{kardex.fields.idkardex}</p>
                                </div>
                              </div>

                              {materiales.length > 0 && (
                                <div className="mb-2 space-y-1">
                                  {materiales.slice(0, 3).map((material) => {
                                    const porcentaje = total > 0 ? (material.kg / total) * 100 : 0;
                                    return (
                                      <div key={material.nombre} className="flex items-center gap-2">
                                        <div className="w-20 text-xs text-gray-600 truncate">{material.nombre}</div>
                                        <div className="flex-1 bg-gray-200 rounded-full h-4">
                                          <div
                                            className={`h-full ${material.color} rounded-full`}
                                            style={{ width: `${Math.max(porcentaje, 5)}%` }}
                                          />
                                        </div>
                                        <div className="w-16 text-xs text-gray-500 text-right">{material.kg} kg</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div className="flex gap-4 text-xs text-gray-600 mb-2">
                                <div>📅 {fecha}</div>
                                <div className="flex-1 truncate">📍 {municipio}</div>
                              </div>

                              {kardex.selected && (
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#7bdcb5]">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Forma de cobro
                                    </label>
                                    <select
                                      value={kardex.formaCobro}
                                      onChange={(e) =>
                                        updateKardexDisponible(kardex.id, "formaCobro", e.target.value as "Por Flete" | "Por Kilo")
                                      }
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                                    >
                                      <option value="Por Kilo">Por Kilo</option>
                                      <option value="Por Flete">Por Flete</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Precio unitario
                                    </label>
                                    <input
                                      type="number"
                                      value={kardex.precioUnitario || ""}
                                      onChange={(e) =>
                                        updateKardexDisponible(kardex.id, "precioUnitario", e.target.value === "" ? 0 : parseFloat(e.target.value))
                                      }
                                      min="0"
                                      step="1"
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084]"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
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

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={agregarKardexSeleccionados}
                      disabled={!kardexDisponibles.some(k => k.selected)}
                      className="px-6 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Agregar Seleccionados ({kardexDisponibles.filter(k => k.selected).length})
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Resumen estilo Factura */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Resumen de la Orden
            </h2>

            {/* Info del Beneficiario */}
            {beneficiario && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Beneficiario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-base font-medium text-gray-900">{beneficiario.razonSocial}</p>
                    {beneficiario.nit && (
                      <p className="text-sm text-gray-600 mt-1">NIT: {beneficiario.nit}</p>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {beneficiario.direccion && (
                      <p>📍 {beneficiario.direccion}</p>
                    )}
                    {beneficiario.movil && (
                      <p>📱 {beneficiario.movil}</p>
                    )}
                    {beneficiario.email && (
                      <p>✉️ {beneficiario.email}</p>
                    )}
                  </div>
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
                  {items.map((item) => {
                    const subtotal = item.cantidad * item.precioUnitario;
                    return (
                      <tr key={item.itemId} className="border-b border-gray-200">
                        <td className="py-3 px-2 text-sm">
                          <div className="font-medium text-gray-900">
                            Kardex #{item.idkardex}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.fechakardex} • {item.municipio}
                          </div>
                          <div className="text-xs mt-1">
                            {item.tipoMovimiento ? (
                              <span className={`inline-block px-2 py-0.5 rounded ${
                                item.tipoMovimiento === "ENTRADA" 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {item.tipoMovimiento}
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                                Sin tipo - #{item.idkardex}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-sm font-medium text-gray-900">
                          {item.cantidad.toLocaleString("es-CO")}
                        </td>
                        <td className="text-center py-3 px-2 text-sm text-gray-600">
                          {item.formaCobro === "Por Kilo" ? "kg" : "flete"}
                        </td>
                        <td className="text-right py-3 px-2 text-sm text-gray-900">
                          {formatCurrency(item.precioUnitario)}
                        </td>
                        <td className="text-right py-3 px-2 text-sm font-semibold text-gray-900">
                          {formatCurrency(subtotal)}
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
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">{error}</p>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 justify-end">
              <Link
                href="/ordenes-servicio"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </Link>
              <button
                disabled
                className="px-6 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                title="Funcionalidad en desarrollo"
              >
                💾 Guardar Cambios (Próximamente)
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
