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

interface TerceroSeleccionado {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: string;
  correo?: string;
}

interface ItemOrden {
  id: string;
  tipo: "KARDEX" | "CATALOGO";
  kardexId?: string;
  catalogoId?: string;
  descripcion: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  kardexData?: Kardex;
}

export default function NuevaOrdenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [kardexDisponibles, setKardexDisponibles] = useState<Kardex[]>([]);
  const [catalogoDisponibles, setCatalogoDisponibles] = useState<CatalogoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal para agregar items
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoItemNuevo, setTipoItemNuevo] = useState<"KARDEX" | "CATALOGO">("KARDEX");
  const [busquedaItem, setBusquedaItem] = useState("");

  // Form fields
  const [fechaPedido, setFechaPedido] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [beneficiario, setBeneficiario] = useState<TerceroSeleccionado | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [itemsOrden, setItemsOrden] = useState<ItemOrden[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [kardexData, catalogoData] = await Promise.all([
          getKardexPorPagar(session.user.coordinatorRecordId),
          getCatalogoServicios(),
        ]);

        setKardexDisponibles(kardexData);
        setCatalogoDisponibles(catalogoData);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session?.user?.coordinatorRecordId]);

  const agregarKardex = (kardex: Kardex) => {
    const municipio = kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
    const fecha = kardex.fields.fechakardex || "Sin fecha";
    const tipo = kardex.fields.TipoMovimiento || "";
    const kg = Math.abs(kardex.fields.Total || 0);

    const nuevoItem: ItemOrden = {
      id: `item-${Date.now()}`,
      tipo: "KARDEX",
      kardexId: kardex.id,
      descripcion: `Kardex ${fecha} - ${municipio} - ${tipo} (${kg.toFixed(2)} kg)`,
      formaCobro: "Por Flete",
      cantidad: kg,
      precioUnitario: 0,
      kardexData: kardex,
    };

    setItemsOrden([...itemsOrden, nuevoItem]);
    setModalAbierto(false);
    setBusquedaItem("");
  };

  const agregarCatalogo = (catalogo: CatalogoServicio) => {
    const nuevoItem: ItemOrden = {
      id: `item-${Date.now()}`,
      tipo: "CATALOGO",
      catalogoId: catalogo.id,
      descripcion: catalogo.fields.Nombre || "Sin nombre",
      formaCobro: "Por Flete",
      cantidad: 1,
      precioUnitario: catalogo.fields["Precio Unitario"] || 0,
    };

    setItemsOrden([...itemsOrden, nuevoItem]);
    setModalAbierto(false);
    setBusquedaItem("");
  };

  const eliminarItem = (itemId: string) => {
    setItemsOrden(itemsOrden.filter((item) => item.id !== itemId));
  };

  const actualizarItem = (itemId: string, campo: keyof ItemOrden, valor: any) => {
    setItemsOrden(
      itemsOrden.map((item) =>
        item.id === itemId ? { ...item, [campo]: valor } : item
      )
    );
  };

  const calcularSubtotal = (item: ItemOrden) => {
    if (item.formaCobro === "Por Kilo") {
      return item.cantidad * item.precioUnitario;
    }
    return item.precioUnitario;
  };

  const calcularTotal = () => {
    return itemsOrden.reduce((sum, item) => sum + calcularSubtotal(item), 0);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!session?.user?.coordinatorRecordId) {
      setError("No se pudo identificar el coordinador");
      return;
    }

    if (itemsOrden.length === 0) {
      setError("Debes agregar al menos un item a la orden");
      return;
    }

    if (!beneficiario) {
      setError("Debes seleccionar un beneficiario");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const items: CreateItemOrdenParams[] = itemsOrden.map((item) => {
        if (item.tipo === "KARDEX") {
          return {
            kardexRecordId: item.kardexId!,
            formaCobro: item.formaCobro,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          };
        } else {
          return {
            catalogoRecordId: item.catalogoId!,
            formaCobro: item.formaCobro,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          };
        }
      });

      await createOrdenServicio({
        coordinatorRecordId: session.user.coordinatorRecordId,
        beneficiarioRecordId: beneficiario.id,
        fechaPedido,
        observaciones: observaciones.trim() || undefined,
        items,
        estado: "Borrador",
      });

      router.push("/ordenes-servicio");
    } catch (err) {
      console.error("Error creating order:", err);
      setError("Error al crear la orden. Por favor verifica los datos e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

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

  // Filtrar items según búsqueda
  const kardexFiltrados = kardexDisponibles.filter((k) => {
    if (!busquedaItem) return true;
    const searchLower = busquedaItem.toLowerCase();
    const municipio = k.fields["mundep (from MunicipioOrigen)"]?.[0] || "";
    const fecha = k.fields.fechakardex || "";
    return (
      municipio.toLowerCase().includes(searchLower) ||
      fecha.includes(busquedaItem)
    );
  });

  const catalogoFiltrado = catalogoDisponibles.filter((c) => {
    if (!busquedaItem) return true;
    const searchLower = busquedaItem.toLowerCase();
    const nombre = c.fields.Nombre || "";
    return nombre.toLowerCase().includes(searchLower);
  });

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
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

        {/* RESUMEN DE LA ORDEN - Siempre arriba */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            📄 Resumen de la Orden
          </h2>

          {/* Datos básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de pedido *
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
                placeholder="Buscar tercero..."
              />
            </div>
          </div>

          {/* Datos del beneficiario */}
          {beneficiario && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">{beneficiario.razonSocial}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                {beneficiario.nit && <p><strong>NIT:</strong> {beneficiario.nit}</p>}
                {beneficiario.direccion && <p><strong>Dirección:</strong> {beneficiario.direccion}</p>}
                {beneficiario.movil && <p><strong>Teléfono:</strong> {beneficiario.movil}</p>}
                {beneficiario.correo && <p><strong>Email:</strong> {beneficiario.correo}</p>}
              </div>
            </div>
          )}

          {/* Items de la orden */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Items</h3>
              <button
                onClick={() => setModalAbierto(true)}
                className="px-4 py-2 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors flex items-center gap-2"
              >
                <span className="text-xl">+</span>
                Agregar Item
              </button>
            </div>

            {itemsOrden.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                No hay items agregados. Haz clic en "Agregar Item" para empezar.
              </div>
            ) : (
              <div className="space-y-2">
                {itemsOrden.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              item.tipo === "KARDEX"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {item.tipo}
                          </span>
                          <p className="text-sm font-medium text-gray-900">{item.descripcion}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Forma de cobro */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Forma de cobro</label>
                            <select
                              value={item.formaCobro}
                              onChange={(e) =>
                                actualizarItem(item.id, "formaCobro", e.target.value)
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                            >
                              <option value="Por Flete">Por Flete</option>
                              <option value="Por Kilo">Por Kilo</option>
                            </select>
                          </div>

                          {/* Precio unitario */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Precio unitario</label>
                            <input
                              type="number"
                              value={item.precioUnitario}
                              onChange={(e) =>
                                actualizarItem(item.id, "precioUnitario", Number(e.target.value))
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                              min="0"
                              step="1000"
                            />
                          </div>

                          {/* Subtotal */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Subtotal</label>
                            <div className="px-2 py-1 text-sm font-bold text-[#00d084] bg-white border border-gray-300 rounded">
                              {formatCurrency(calcularSubtotal(item))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botón eliminar */}
                      <button
                        onClick={() => eliminarItem(item.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar item"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-4 mt-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">TOTAL:</span>
              <span className="text-2xl font-bold text-[#00d084]">
                {formatCurrency(calcularTotal())}
              </span>
            </div>
          </div>

          {/* Observaciones */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              placeholder="Comentarios adicionales..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-300">
            <Link
              href="/ordenes-servicio"
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </Link>

            <button
              onClick={handleSubmit}
              disabled={submitting || itemsOrden.length === 0 || !beneficiario}
              className="px-8 py-3 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
            >
              {submitting ? "Creando..." : "Crear Orden de Servicio"}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL PARA AGREGAR ITEMS */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Agregar Item</h2>
                <button
                  onClick={() => {
                    setModalAbierto(false);
                    setBusquedaItem("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Selector de tipo */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setTipoItemNuevo("KARDEX")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    tipoItemNuevo === "KARDEX"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  📦 Kardex
                </button>
                <button
                  onClick={() => setTipoItemNuevo("CATALOGO")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    tipoItemNuevo === "CATALOGO"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  📋 Catálogo
                </button>
              </div>

              {/* Búsqueda */}
              <div className="mt-4">
                <input
                  type="text"
                  value={busquedaItem}
                  onChange={(e) => setBusquedaItem(e.target.value)}
                  placeholder={
                    tipoItemNuevo === "KARDEX"
                      ? "Buscar por municipio o fecha..."
                      : "Buscar servicio..."
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de items */}
            <div className="flex-1 overflow-y-auto p-6">
              {tipoItemNuevo === "KARDEX" ? (
                <div className="space-y-2">
                  {kardexFiltrados.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No hay Kardex disponibles
                    </p>
                  ) : (
                    kardexFiltrados.map((kardex) => {
                      const municipio = kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
                      const fecha = kardex.fields.fechakardex
                        ? new Date(kardex.fields.fechakardex).toLocaleDateString("es-CO")
                        : "Sin fecha";
                      const tipo = kardex.fields.TipoMovimiento || "N/A";
                      const kg = Math.abs(kardex.fields.Total || 0);

                      return (
                        <button
                          key={kardex.id}
                          onClick={() => agregarKardex(kardex)}
                          className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-[#00d084] hover:bg-green-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {municipio} - {fecha}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium mr-2 ${
                                    tipo === "ENTRADA"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {tipo}
                                </span>
                                {kg.toFixed(2)} kg
                              </p>
                            </div>
                            <span className="text-[#00d084] font-medium">Agregar →</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {catalogoFiltrado.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No hay servicios disponibles
                    </p>
                  ) : (
                    catalogoFiltrado.map((catalogo) => {
                      const nombre = catalogo.fields.Nombre || "Sin nombre";
                      const descripcion = catalogo.fields.Descripcion || "";
                      const precio = catalogo.fields["Precio Unitario"] || 0;

                      return (
                        <button
                          key={catalogo.id}
                          onClick={() => agregarCatalogo(catalogo)}
                          className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-[#00d084] hover:bg-purple-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{nombre}</p>
                              {descripcion && (
                                <p className="text-sm text-gray-600">{descripcion}</p>
                              )}
                              <p className="text-sm text-gray-500 mt-1">
                                Precio sugerido: {formatCurrency(precio)}
                              </p>
                            </div>
                            <span className="text-[#00d084] font-medium">Agregar →</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
