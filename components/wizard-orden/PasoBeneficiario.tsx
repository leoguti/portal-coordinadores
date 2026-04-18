"use client";

import TerceroSearch from "@/components/TerceroSearch";
import BeneficiarioForm from "@/components/BeneficiarioForm";
import TerceroCompletitudWarning from "@/components/TerceroCompletitudWarning";
import {
  getFechaMinimaPermitida,
  getFechaMaximaPermitida,
} from "@/lib/dateValidations";

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

interface PasoBeneficiarioProps {
  beneficiario: TerceroSeleccionado | null;
  onBeneficiarioChange: (beneficiario: TerceroSeleccionado | null) => void;
  fechaPedido: string;
  onFechaPedidoChange: (fecha: string) => void;
  observaciones: string;
  onObservacionesChange: (obs: string) => void;
  onContinuar: () => void;
  onAtras: () => void;
}

export default function PasoBeneficiario({
  beneficiario,
  onBeneficiarioChange,
  fechaPedido,
  onFechaPedidoChange,
  observaciones,
  onObservacionesChange,
  onContinuar,
  onAtras,
}: PasoBeneficiarioProps) {
  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  // Validaciones
  const errores: string[] = [];
  if (!beneficiario) {
    errores.push("Selecciona un beneficiario");
  } else {
    if (!beneficiario.direccion || beneficiario.direccion.length < 8) {
      errores.push("Direccion del beneficiario (min 8 caracteres)");
    }
    if (!beneficiario.movil) {
      errores.push("Telefono del beneficiario");
    }
    if (!beneficiario.correo || !validateEmail(beneficiario.correo)) {
      errores.push("Correo electronico valido");
    }
    if (!beneficiario.municipioId) {
      errores.push("Municipio del beneficiario");
    }
  }
  if (!fechaPedido) {
    errores.push("Fecha de pedido");
  }

  const puedeAvanzar = errores.length === 0;

  return (
    <div>
      {/* Fecha de pedido */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha de pedido *
        </label>
        <input
          type="date"
          value={fechaPedido}
          onChange={(e) => onFechaPedidoChange(e.target.value)}
          max={getFechaMaximaPermitida()}
          min={getFechaMinimaPermitida()}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Solo fechas desde{" "}
          {new Date(
            getFechaMinimaPermitida() + "T00:00:00"
          ).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}{" "}
          hasta hoy
        </p>
      </div>

      {/* Beneficiario */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Beneficiario *
        </label>
        <TerceroSearch
          value={beneficiario}
          onChange={onBeneficiarioChange}
          required
          placeholder="Buscar tercero..."
        />
        {beneficiario && (
          <TerceroCompletitudWarning
            terceroId={beneficiario.id}
            mode="error"
            fechaReferencia={fechaPedido}
          />
        )}
      </div>

      {/* Datos del beneficiario */}
      {beneficiario && (
        <BeneficiarioForm
          beneficiario={beneficiario}
          onUpdate={(data) => {
            onBeneficiarioChange({ ...beneficiario, ...data });
          }}
        />
      )}

      {/* Observaciones */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones (opcional)
        </label>
        <textarea
          value={observaciones}
          onChange={(e) => onObservacionesChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
          placeholder="Comentarios adicionales..."
        />
      </div>

      {/* Validaciones */}
      {errores.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
          <p className="text-yellow-900 text-sm font-bold mb-1">
            Falta completar:
          </p>
          <ul className="space-y-1">
            {errores.map((error, idx) => (
              <li key={idx} className="text-yellow-800 text-xs">
                - {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Botones */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 -mx-6 px-6 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onAtras}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Atras
          </button>
          <button
            onClick={onContinuar}
            disabled={!puedeAvanzar}
            className="px-6 py-2 bg-[#00d084] text-white rounded-lg hover:bg-[#00b872] transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continuar a revision
          </button>
        </div>
      </div>
    </div>
  );
}
