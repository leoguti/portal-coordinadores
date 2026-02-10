"use client";

import { useMemo } from "react";
import { type Kardex, type CatalogoServicio } from "@/lib/airtable";
import ImageUpload, { type ImageFile } from "@/components/ImageUpload";

interface TerceroSeleccionado {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: number;
  correo?: string;
  municipioId?: string;
  municipioDepartamento?: string;
}

interface ItemCatalogo {
  catalogo: CatalogoServicio;
  cantidad: number;
}

export interface ItemOrden {
  id: string;
  tipo: "KARDEX" | "CATALOGO";
  kardexId?: string;
  catalogoId?: string;
  descripcion: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  kardexData?: Kardex;
  tipoMovimiento?: "ENTRADA" | "SALIDA";
  concepto?: string;
}

const CONCEPTOS_KARDEX = [
  "TRANSPORTE JR - CA",
  "TRANSPORTE CA - DF",
  "TRANSPORTE MUNICIPIO - DF",
  "TRANSPORTE JR - DF",
] as const;

interface PasoRevisionProps {
  kardexSeleccionados: Kardex[];
  itemsCatalogo: ItemCatalogo[];
  beneficiario: TerceroSeleccionado | null;
  fechaPedido: string;
  observaciones: string;
  itemsOrden: ItemOrden[];
  onItemsOrdenChange: (items: ItemOrden[]) => void;
  soporteBascula: ImageFile[];
  onSoporteBasculaChange: (files: ImageFile[]) => void;
  onSubmit: () => void;
  onAtras: () => void;
  submitting: boolean;
  error: string | null;
}

export default function PasoRevision({
  kardexSeleccionados,
  itemsCatalogo,
  beneficiario,
  fechaPedido,
  observaciones,
  itemsOrden,
  onItemsOrdenChange,
  soporteBascula,
  onSoporteBasculaChange,
  onSubmit,
  onAtras,
  submitting,
  error,
}: PasoRevisionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calcularSubtotal = (item: ItemOrden) => {
    if (item.tipo === "CATALOGO") {
      return item.precioUnitario * item.cantidad;
    }
    if (item.formaCobro === "Por Kilo") {
      return item.cantidad * item.precioUnitario;
    }
    return item.precioUnitario;
  };

  const total = useMemo(() => {
    return itemsOrden.reduce((sum, item) => sum + calcularSubtotal(item), 0);
  }, [itemsOrden]);

  const requiereDocumentos = useMemo(() => {
    return itemsCatalogo.some(
      (ic) => ic.catalogo.fields["Requiere Documentos"] === true
    );
  }, [itemsCatalogo]);

  const actualizarItem = (
    itemId: string,
    campo: keyof ItemOrden,
    valor: string | number
  ) => {
    onItemsOrdenChange(
      itemsOrden.map((item) => {
        if (item.id === itemId) {
          const itemActualizado = { ...item, [campo]: valor };
          if (campo === "formaCobro" && valor === "Por Flete") {
            itemActualizado.cantidad = 1;
          }
          if (
            campo === "formaCobro" &&
            valor === "Por Kilo" &&
            item.tipo === "KARDEX" &&
            item.kardexData
          ) {
            itemActualizado.cantidad = Math.abs(
              item.kardexData.fields.Total || 0
            );
          }
          return itemActualizado;
        }
        return item;
      })
    );
  };

  // Validations checklist
  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validaciones = useMemo(() => {
    const checks: { label: string; ok: boolean }[] = [];

    checks.push({ label: "Fecha de pedido", ok: !!fechaPedido });
    checks.push({ label: "Beneficiario seleccionado", ok: !!beneficiario });
    if (beneficiario) {
      checks.push({
        label: "Direccion del beneficiario",
        ok: !!beneficiario.direccion && beneficiario.direccion.length >= 8,
      });
      checks.push({ label: "Telefono del beneficiario", ok: !!beneficiario.movil });
      checks.push({
        label: "Correo del beneficiario",
        ok: !!beneficiario.correo && validateEmail(beneficiario.correo),
      });
      checks.push({
        label: "Municipio del beneficiario",
        ok: !!beneficiario.municipioId,
      });
    }
    checks.push({
      label: "Al menos 1 item en la orden",
      ok: itemsOrden.length > 0,
    });
    const sinPrecio = itemsOrden.filter(
      (i) => !i.precioUnitario || i.precioUnitario <= 0
    );
    checks.push({
      label: "Todos los items con precio",
      ok: sinPrecio.length === 0,
    });
    const kardexSinConcepto = itemsOrden.filter(
      (i) => i.tipo === "KARDEX" && !i.concepto
    );
    checks.push({
      label: "Todos los items Kardex con concepto",
      ok: kardexSinConcepto.length === 0,
    });
    if (requiereDocumentos) {
      checks.push({
        label: "Soporte de Bascula adjunto",
        ok: soporteBascula.length > 0,
      });
    }

    return checks;
  }, [fechaPedido, beneficiario, itemsOrden, soporteBascula, requiereDocumentos]);

  const todoOk = validaciones.every((v) => v.ok);

  return (
    <div>
      {/* Datos del beneficiario */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase">
          Datos de la orden
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Fecha:</span>{" "}
            <span className="font-medium">
              {fechaPedido
                ? new Date(fechaPedido + "T00:00:00").toLocaleDateString(
                    "es-CO",
                    { day: "2-digit", month: "long", year: "numeric" }
                  )
                : "-"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Beneficiario:</span>{" "}
            <span className="font-medium">
              {beneficiario?.razonSocial || "-"}
            </span>
          </div>
          {beneficiario?.nit && (
            <div>
              <span className="text-gray-500">NIT:</span>{" "}
              <span className="font-medium">{beneficiario.nit}</span>
            </div>
          )}
          {beneficiario?.direccion && (
            <div>
              <span className="text-gray-500">Direccion:</span>{" "}
              <span className="font-medium">{beneficiario.direccion}</span>
            </div>
          )}
          {beneficiario?.movil && (
            <div>
              <span className="text-gray-500">Telefono:</span>{" "}
              <span className="font-medium">{beneficiario.movil}</span>
            </div>
          )}
          {beneficiario?.correo && (
            <div>
              <span className="text-gray-500">Correo:</span>{" "}
              <span className="font-medium">{beneficiario.correo}</span>
            </div>
          )}
          {beneficiario?.municipioDepartamento && (
            <div>
              <span className="text-gray-500">Municipio:</span>{" "}
              <span className="font-medium">
                {beneficiario.municipioDepartamento}
              </span>
            </div>
          )}
          {observaciones && (
            <div className="md:col-span-2">
              <span className="text-gray-500">Observaciones:</span>{" "}
              <span className="font-medium">{observaciones}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de items */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase">
          Items de la orden ({itemsOrden.length})
        </h3>

        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "120px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Tipo
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Concepto
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Descripcion
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Cantidad
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Forma Cobro
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Precio Unit.
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {itemsOrden.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-200 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {/* Tipo */}
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`px-1.5 py-1 text-[10px] font-bold rounded text-center leading-tight ${
                          item.tipo === "KARDEX"
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : "bg-purple-100 text-purple-700 border border-purple-300"
                        }`}
                      >
                        {item.tipo}
                      </span>
                      {item.tipo === "KARDEX" && item.tipoMovimiento && (
                        <span
                          className={`px-1.5 py-1 text-[10px] font-bold rounded text-center leading-tight ${
                            item.tipoMovimiento === "ENTRADA"
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : "bg-red-100 text-red-700 border border-red-300"
                          }`}
                        >
                          {item.tipoMovimiento}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Concepto */}
                  <td className="px-3 py-3">
                    {item.tipo === "KARDEX" ? (
                      <select
                        value={item.concepto || ""}
                        onChange={(e) =>
                          actualizarItem(item.id, "concepto", e.target.value)
                        }
                        className={`w-full px-2 py-1.5 text-xs border-2 rounded font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 ${
                          item.concepto
                            ? "border-blue-400 bg-blue-50"
                            : "border-red-400 bg-red-50"
                        }`}
                      >
                        <option value="">Seleccionar...</option>
                        {CONCEPTOS_KARDEX.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Descripcion */}
                  <td className="px-3 py-3">
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {item.descripcion}
                    </p>
                  </td>

                  {/* Cantidad */}
                  <td className="px-3 py-3 text-right">
                    {item.tipo === "CATALOGO" ? (
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarItem(
                            item.id,
                            "cantidad",
                            Number(e.target.value) || 1
                          )
                        }
                        className="w-16 px-2 py-1 text-xs text-right border-2 border-blue-400 rounded bg-blue-50 font-mono font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        step="1"
                      />
                    ) : (
                      <span
                        className={`text-sm font-mono font-semibold ${
                          item.formaCobro === "Por Flete"
                            ? "text-gray-400"
                            : "text-gray-900"
                        }`}
                      >
                        {item.formaCobro === "Por Flete"
                          ? "1"
                          : item.cantidad.toFixed(2)}
                      </span>
                    )}
                  </td>

                  {/* Forma de cobro */}
                  <td className="px-3 py-3">
                    {item.tipo === "CATALOGO" ? (
                      <div className="px-2 py-1.5 text-xs rounded bg-gray-100 font-semibold text-gray-600 text-center border border-gray-300">
                        Precio Fijo
                      </div>
                    ) : (
                      <select
                        value={item.formaCobro}
                        onChange={(e) =>
                          actualizarItem(item.id, "formaCobro", e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-xs border-2 border-blue-400 rounded bg-blue-50 font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Por Flete">Por Flete</option>
                        <option value="Por Kilo">Por Kilo</option>
                      </select>
                    )}
                  </td>

                  {/* Precio unitario */}
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={item.precioUnitario || ""}
                      onChange={(e) =>
                        actualizarItem(
                          item.id,
                          "precioUnitario",
                          Number(e.target.value)
                        )
                      }
                      placeholder="$0"
                      className="w-full px-2 py-1.5 text-xs text-right border-2 border-blue-400 rounded bg-blue-50 font-mono font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1000"
                    />
                  </td>

                  {/* Subtotal */}
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-mono font-bold text-[#00d084]">
                      {formatCurrency(calcularSubtotal(item))}
                    </span>
                  </td>
                </tr>
              ))}

              {/* Total */}
              <tr className="bg-gray-100 border-t-2 border-gray-400">
                <td colSpan={6} className="px-3 py-4 text-right">
                  <span className="text-xl font-bold text-gray-900">
                    TOTAL:
                  </span>
                </td>
                <td className="px-3 py-4 text-right">
                  <span className="text-2xl font-bold text-[#00d084]">
                    {formatCurrency(total)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Soporte de Bascula (solo cuando algun item de catalogo lo requiere) */}
      {requiereDocumentos && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase">
            Soporte de Bascula (proporcionado por el gestor) <span className="text-red-500">*</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Adjunta las imagenes o PDFs del soporte de bascula proporcionado por el gestor. Este campo es obligatorio.
          </p>
          <ImageUpload
            images={soporteBascula}
            onChange={onSoporteBasculaChange}
            acceptPdf
            maxFiles={5}
            disabled={submitting}
          />
        </div>
      )}

      {/* Checklist de validaciones */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-bold text-gray-700 mb-2">
          Checklist de validaciones
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {validaciones.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className={v.ok ? "text-green-600" : "text-red-500"}>
                {v.ok ? "✅" : "❌"}
              </span>
              <span className={v.ok ? "text-gray-700" : "text-red-700 font-medium"}>
                {v.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Botones */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 -mx-6 px-6 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onAtras}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Volver a editar
          </button>
          <button
            onClick={onSubmit}
            disabled={!todoOk || submitting}
            className="px-8 py-3 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed text-lg"
          >
            {submitting ? "Creando orden..." : "Crear Orden de Servicio"}
          </button>
        </div>
      </div>
    </div>
  );
}
