"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import TerceroSearch from "@/components/TerceroSearch";
import {
  getKardexPorPagar,
  createOrdenServicio,
  type Kardex,
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
  direccion?: string;
  movil?: string;
  correo?: string;
}

export default function NuevaOrdenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [kardexList, setKardexList] = useState<KardexSeleccionado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // Load Kardex
  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const kardexData = await getKardexPorPagar(session.user.coordinatorRecordId);

        // Initialize Kardex with default values
        const kardexConDefaults = kardexData
          .sort((a, b) => {
            const dateA = new Date(a.fields.fechakardex || "").getTime();
            const dateB = new Date(b.fields.fechakardex || "").getTime();
            return dateA - dateB;
          })
          .map((k) => ({
            ...k,
            selected: false,
            formaCobro: "Por Flete" as const,
            cantidad: Math.abs(k.fields.Total || 0),
            precioUnitario: 0,
          }));

        setKardexList(kardexConDefaults);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session?.user?.coordinatorRecordId]);

  const toggleKardex = (kardexId: string) => {
    setKardexList((prev) =>
      prev.map((k) =>
        k.id === kardexId ? { ...k, selected: !k.selected } : k
      )
    );
  };

  const updateKardexField = (
    kardexId: string,
    field: "formaCobro" | "precioUnitario",
    value: string | number
  ) => {
    setKardexList((prev) =>
      prev.map((k) =>
        k.id === kardexId ? { ...k, [field]: value } : k
      )
    );
  };

  const selectedKardex = kardexList.filter((k) => k.selected);

  const calcularSubtotal = (kardex: KardexSeleccionado) => {
    if (kardex.formaCobro === "Por Kilo") {
      return kardex.cantidad * kardex.precioUnitario;
    }
    return kardex.precioUnitario;
  };

  const calcularTotal = () => {
    return selectedKardex.reduce((sum, k) => sum + calcularSubtotal(k), 0);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!session?.user?.coordinatorRecordId) {
      setError("No se pudo identificar el coordinador");
      return;
    }

    if (selectedKardex.length === 0) {
      setError("Debes seleccionar al menos un Kardex");
      return;
    }

    if (!beneficiario) {
      setError("Debes seleccionar un beneficiario");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const items: CreateItemOrdenParams[] = selectedKardex.map((k) => ({
        kardexRecordId: k.id,
        formaCobro: k.formaCobro,
        cantidad: k.cantidad,
        precioUnitario: k.precioUnitario,
      }));

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

        {/* Formulario tipo Factura */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          {/* Encabezado de la orden */}
          <div className="border-b border-gray-300 pb-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de pedido *
                </label>
                <input
                  type="date"
                  value={fechaPedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  required
                />
              </div>

              {/* Beneficiario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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

            {/* Mostrar datos del beneficiario seleccionado */}
            {beneficiario && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{beneficiario.razonSocial}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                  {beneficiario.nit && <p><strong>NIT:</strong> {beneficiario.nit}</p>}
                  {beneficiario.direccion && <p><strong>Dirección:</strong> {beneficiario.direccion}</p>}
                  {beneficiario.movil && <p><strong>Teléfono:</strong> {beneficiario.movil}</p>}
                  {beneficiario.correo && <p><strong>Email:</strong> {beneficiario.correo}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Items de la orden - Lista de Kardex */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Items de la Orden
            </h2>

            {kardexList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay Kardex disponibles con estado "Por Pagar"
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setKardexList((prev) =>
                              prev.map((k) => ({ ...k, selected: checked }))
                            );
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fecha</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Municipio</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Kg</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cobro</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Precio Unit.</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexList.map((kardex, index) => {
                      const municipio = kardex.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio";
                      const fecha = kardex.fields.fechakardex
                        ? new Date(kardex.fields.fechakardex).toLocaleDateString("es-CO")
                        : "Sin fecha";
                      const tipo = kardex.fields.TipoMovimiento || "N/A";
                      const kg = Math.abs(kardex.fields.Total || 0);
                      const subtotal = kardex.selected ? calcularSubtotal(kardex) : 0;

                      return (
                        <tr
                          key={kardex.id}
                          className={`border-b border-gray-200 ${
                            kardex.selected ? "bg-green-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={kardex.selected}
                              onChange={() => toggleKardex(kardex.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">{fecha}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{municipio}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                tipo === "ENTRADA"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {tipo}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-700 font-mono">{kg.toFixed(2)}</td>
                          <td className="px-3 py-3">
                            {kardex.selected ? (
                              <select
                                value={kardex.formaCobro}
                                onChange={(e) =>
                                  updateKardexField(kardex.id, "formaCobro", e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                              >
                                <option value="Por Flete">Por Flete</option>
                                <option value="Por Kilo">Por Kilo</option>
                              </select>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {kardex.selected ? (
                              <input
                                type="number"
                                value={kardex.precioUnitario}
                                onChange={(e) =>
                                  updateKardexField(kardex.id, "precioUnitario", Number(e.target.value))
                                }
                                className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-[#00d084] focus:border-transparent font-mono"
                                min="0"
                                step="1000"
                              />
                            ) : (
                              <span className="text-sm text-gray-400 text-right block">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-right font-mono font-semibold text-gray-900">
                            {kardex.selected ? formatCurrency(subtotal) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                      <td colSpan={7} className="px-3 py-4 text-right font-bold text-gray-900">
                        TOTAL:
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-lg text-[#00d084] font-mono">
                        {formatCurrency(calcularTotal())}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="mb-6 border-t border-gray-300 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              placeholder="Comentarios adicionales sobre la orden..."
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-between border-t border-gray-300 pt-6">
            <Link
              href="/ordenes-servicio"
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </Link>

            <button
              onClick={handleSubmit}
              disabled={submitting || selectedKardex.length === 0 || !beneficiario}
              className="px-8 py-3 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
            >
              {submitting ? "Creando..." : "Crear Orden de Servicio"}
            </button>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
