"use client";

import { useState, useMemo } from "react";
import { type Kardex } from "@/lib/airtable";

interface PasoKardexProps {
  kardexDisponibles: Kardex[];
  kardexSeleccionados: Kardex[];
  onSeleccionChange: (kardex: Kardex[]) => void;
  onContinuar: () => void;
  onSaltar: () => void;
}

export default function PasoKardex({
  kardexDisponibles,
  kardexSeleccionados,
  onSeleccionChange,
  onContinuar,
  onSaltar,
}: PasoKardexProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");

  // Filtrar kardex por tipo y busqueda
  // Note: No date filter — "Por Pagar" records must always be available
  // for inclusion in orders, even from closed months (orphan resolution)
  const kardexFiltrados = useMemo(() => {
    return kardexDisponibles.filter((k) => {
      // Filtro por tipo
      if (filtroTipo !== "TODOS" && k.fields.TipoMovimiento !== filtroTipo) {
        return false;
      }

      // Filtro de busqueda
      if (busqueda) {
        const searchLower = busqueda.toLowerCase();
        const municipio = k.fields["mundep (from MunicipioOrigen)"]?.[0] || "";
        const fecha = k.fields.fechakardex || "";
        const numero = k.fields.idkardex?.toString() || "";
        return (
          municipio.toLowerCase().includes(searchLower) ||
          fecha.includes(busqueda) ||
          numero.includes(busqueda)
        );
      }

      return true;
    });
  }, [kardexDisponibles, filtroTipo, busqueda]);

  const contarPorTipo = (tipo: string) => {
    return kardexDisponibles.filter((k) => {
      if (tipo === "TODOS") return true;
      return k.fields.TipoMovimiento === tipo;
    }).length;
  };

  const seleccionadosIds = new Set(kardexSeleccionados.map((k) => k.id));

  const toggleKardex = (kardex: Kardex) => {
    if (seleccionadosIds.has(kardex.id)) {
      onSeleccionChange(kardexSeleccionados.filter((k) => k.id !== kardex.id));
    } else {
      onSeleccionChange([...kardexSeleccionados, kardex]);
    }
  };

  const toggleTodos = () => {
    if (kardexFiltrados.every((k) => seleccionadosIds.has(k.id))) {
      // Deseleccionar todos los filtrados
      const idsToRemove = new Set(kardexFiltrados.map((k) => k.id));
      onSeleccionChange(kardexSeleccionados.filter((k) => !idsToRemove.has(k.id)));
    } else {
      // Seleccionar todos los filtrados (merge con existentes)
      const nuevos = kardexFiltrados.filter((k) => !seleccionadosIds.has(k.id));
      onSeleccionChange([...kardexSeleccionados, ...nuevos]);
    }
  };

  const todosSeleccionados =
    kardexFiltrados.length > 0 &&
    kardexFiltrados.every((k) => seleccionadosIds.has(k.id));

  const hayKardexDisponibles = contarPorTipo("TODOS") > 0;

  if (!hayKardexDisponibles) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">
          No hay Kardex &quot;Por Pagar&quot; disponibles
        </h3>
        <p className="text-gray-500 mb-6">
          No tienes registros de Kardex pendientes de pago en el periodo actual.
          Puedes continuar y agregar items del catalogo de servicios.
        </p>
        <button
          onClick={onSaltar}
          className="px-6 py-3 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors font-semibold"
        >
          Continuar al Catalogo
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Selecciona los Kardex</strong> que deseas incluir en la orden
          de servicio. Se muestran todos los Kardex con estado &quot;Por Pagar&quot;.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Busqueda */}
        <div className="flex-1">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por numero, municipio o fecha..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
          />
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-2">
          <button
            onClick={() => setFiltroTipo("TODOS")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtroTipo === "TODOS"
                ? "bg-[#00d084] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos ({contarPorTipo("TODOS")})
          </button>
          <button
            onClick={() => setFiltroTipo("ENTRADA")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtroTipo === "ENTRADA"
                ? "bg-green-600 text-white"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            Entrada ({contarPorTipo("ENTRADA")})
          </button>
          <button
            onClick={() => setFiltroTipo("SALIDA")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtroTipo === "SALIDA"
                ? "bg-red-600 text-white"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
          >
            Salida ({contarPorTipo("SALIDA")})
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                  className="w-4 h-4 text-[#00d084] rounded focus:ring-[#00d084]"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                Municipio
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                Kg
              </th>
            </tr>
          </thead>
          <tbody>
            {kardexFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron Kardex con los filtros aplicados
                </td>
              </tr>
            ) : (
              kardexFiltrados.map((kardex, index) => {
                const seleccionado = seleccionadosIds.has(kardex.id);
                const municipio =
                  kardex.fields["mundep (from MunicipioOrigen)"]?.[0] ||
                  "Sin municipio";
                const fecha = kardex.fields.fechakardex
                  ? new Date(
                      kardex.fields.fechakardex + "T00:00:00"
                    ).toLocaleDateString("es-CO")
                  : "Sin fecha";
                const tipo = kardex.fields.TipoMovimiento || "N/A";
                const kg = Math.abs(kardex.fields.Total || 0);
                const numero = kardex.fields.idkardex || "S/N";

                return (
                  <tr
                    key={kardex.id}
                    onClick={() => toggleKardex(kardex)}
                    className={`border-b border-gray-200 cursor-pointer transition-colors ${
                      seleccionado
                        ? "bg-green-50 hover:bg-green-100"
                        : index % 2 === 0
                        ? "bg-white hover:bg-gray-50"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => toggleKardex(kardex)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-[#00d084] rounded focus:ring-[#00d084]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#00d084] text-sm">
                        #{numero}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fecha}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {municipio}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          tipo === "ENTRADA"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono">
                      {kg.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Contador flotante + botones */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 -mx-6 px-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            {kardexSeleccionados.length > 0 ? (
              <span className="text-[#00d084] font-bold">
                {kardexSeleccionados.length} kardex seleccionado
                {kardexSeleccionados.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-gray-400">
                Ninguno seleccionado
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSaltar}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Saltar - Solo catalogo
            </button>
            <button
              onClick={onContinuar}
              disabled={kardexSeleccionados.length === 0}
              className="px-6 py-2 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continuar con {kardexSeleccionados.length} kardex
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
