"use client";

import { useState, useMemo } from "react";
import { type Kardex, type CatalogoServicio } from "@/lib/airtable";

interface ItemCatalogo {
  catalogo: CatalogoServicio;
  cantidad: number;
  precioUnitario: number;
}

interface PasoCatalogoProps {
  catalogoDisponibles: CatalogoServicio[];
  kardexSeleccionados: Kardex[];
  itemsCatalogo: ItemCatalogo[];
  onItemsChange: (items: ItemCatalogo[]) => void;
  onContinuar: () => void;
  onSaltar: () => void;
  onAtras: () => void;
}

export default function PasoCatalogo({
  catalogoDisponibles,
  kardexSeleccionados,
  itemsCatalogo,
  onItemsChange,
  onContinuar,
  onSaltar,
  onAtras,
}: PasoCatalogoProps) {
  const [busqueda, setBusqueda] = useState("");

  const catalogoFiltrado = useMemo(() => {
    if (!busqueda) return catalogoDisponibles;
    const searchLower = busqueda.toLowerCase();
    return catalogoDisponibles.filter((c) => {
      const nombre = c.fields.Nombre || "";
      const desc = c.fields.Descripcion || "";
      return (
        nombre.toLowerCase().includes(searchLower) ||
        desc.toLowerCase().includes(searchLower)
      );
    });
  }, [catalogoDisponibles, busqueda]);

  const itemsAgregadosIds = new Set(itemsCatalogo.map((i) => i.catalogo.id));

  const agregarItem = (catalogo: CatalogoServicio) => {
    if (!itemsAgregadosIds.has(catalogo.id)) {
      onItemsChange([...itemsCatalogo, { catalogo, cantidad: 1, precioUnitario: 0 }]);
    }
  };

  const quitarItem = (catalogoId: string) => {
    onItemsChange(itemsCatalogo.filter((i) => i.catalogo.id !== catalogoId));
  };

  const actualizarCantidad = (catalogoId: string, cantidad: number) => {
    onItemsChange(
      itemsCatalogo.map((i) =>
        i.catalogo.id === catalogoId ? { ...i, cantidad: Math.max(1, cantidad) } : i
      )
    );
  };

  const actualizarPrecio = (catalogoId: string, precio: number) => {
    onItemsChange(
      itemsCatalogo.map((i) =>
        i.catalogo.id === catalogoId ? { ...i, precioUnitario: precio } : i
      )
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalItems = kardexSeleccionados.length + itemsCatalogo.length;
  const puedeAvanzar = totalItems > 0;

  return (
    <div>
      {/* Resumen de kardex seleccionados */}
      {kardexSeleccionados.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">
            {kardexSeleccionados.length} Kardex seleccionado
            {kardexSeleccionados.length !== 1 ? "s" : ""} en el paso anterior
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {kardexSeleccionados.map((k) => (
              <span
                key={k.id}
                className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
              >
                #{k.fields.idkardex} -{" "}
                {k.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-sm text-purple-800">
          <strong>Agrega servicios del catalogo</strong> como arriendos,
          servicios publicos, etc. Este paso es opcional si ya seleccionaste
          Kardex.
        </p>
      </div>

      {/* Items ya agregados */}
      {itemsCatalogo.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-700 mb-2">
            Items agregados ({itemsCatalogo.length})
          </h4>
          <div className="space-y-2">
            {itemsCatalogo.map((item) => (
              <div
                key={item.catalogo.id}
                className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {item.catalogo.fields.Nombre}
                    {item.catalogo.fields["Requiere Documentos"] === true && (
                      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded text-[10px] font-bold align-middle" title="Requiere soporte de bascula">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Req. soporte
                      </span>
                    )}
                  </p>
                  {item.catalogo.fields.Descripcion && (
                    <p className="text-xs text-gray-500">
                      {item.catalogo.fields.Descripcion}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-600">Cant:</label>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarCantidad(
                          item.catalogo.id,
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-16 px-2 py-1 text-xs text-center border border-gray-300 rounded focus:ring-2 focus:ring-purple-400"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-600">Valor:</label>
                    <input
                      type="number"
                      value={item.precioUnitario || ""}
                      onChange={(e) =>
                        actualizarPrecio(
                          item.catalogo.id,
                          Number(e.target.value)
                        )
                      }
                      placeholder="$0"
                      className="w-28 px-2 py-1 text-xs text-right border-2 border-blue-400 rounded bg-blue-50 font-mono font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#00d084] min-w-[80px] text-right">
                    {formatCurrency(item.precioUnitario * item.cantidad)}
                  </span>
                  <button
                    onClick={() => quitarItem(item.catalogo.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                    title="Quitar"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busqueda */}
      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar servicio del catalogo..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
        />
      </div>

      {/* Lista de catalogo */}
      <div className="space-y-2 mb-4">
        {catalogoFiltrado.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay servicios disponibles
          </p>
        ) : (
          catalogoFiltrado.map((catalogo) => {
            const yaAgregado = itemsAgregadosIds.has(catalogo.id);
            const nombre = catalogo.fields.Nombre || "Sin nombre";
            const descripcion = catalogo.fields.Descripcion || "";
            const precio = catalogo.fields["Precio Unitario"] || 0;
            const requiereDoc = catalogo.fields["Requiere Documentos"] === true;

            return (
              <div
                key={catalogo.id}
                className={`p-4 border rounded-lg transition-colors ${
                  yaAgregado
                    ? "border-purple-300 bg-purple-50 opacity-60"
                    : "border-gray-200 hover:border-[#00d084] hover:bg-green-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {nombre}
                      {requiereDoc && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded text-[10px] font-bold align-middle" title="Requiere soporte de bascula">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Req. soporte
                        </span>
                      )}
                    </p>
                    {descripcion && (
                      <p className="text-sm text-gray-600">{descripcion}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      Precio: {formatCurrency(precio)}
                    </p>
                  </div>
                  {yaAgregado ? (
                    <span className="text-purple-600 text-sm font-medium ml-4">
                      Agregado
                    </span>
                  ) : (
                    <button
                      onClick={() => agregarItem(catalogo)}
                      className="ml-4 px-3 py-1.5 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors text-sm font-medium"
                    >
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Botones */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 -mx-6 px-6 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onAtras}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Atras
          </button>
          <div className="text-sm text-gray-600">
            Total items:{" "}
            <span className="font-bold text-gray-900">{totalItems}</span>
          </div>
          <div className="flex gap-3">
            {kardexSeleccionados.length > 0 && itemsCatalogo.length === 0 && (
              <button
                onClick={onSaltar}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Saltar - No necesito catalogo
              </button>
            )}
            <button
              onClick={onContinuar}
              disabled={!puedeAvanzar}
              className="px-6 py-2 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        </div>
        {!puedeAvanzar && (
          <p className="text-xs text-red-500 text-right mt-1">
            Debes tener al menos 1 item (kardex o catalogo) para continuar
          </p>
        )}
      </div>
    </div>
  );
}
