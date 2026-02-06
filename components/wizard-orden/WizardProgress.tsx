"use client";

const pasos = [
  { numero: 1, nombre: "Kardex" },
  { numero: 2, nombre: "Catalogo" },
  { numero: 3, nombre: "Beneficiario" },
  { numero: 4, nombre: "Revision" },
];

interface WizardProgressProps {
  pasoActual: number;
  onPasoClick: (paso: number) => void;
  pasosCompletados: Set<number>;
}

export default function WizardProgress({
  pasoActual,
  onPasoClick,
  pasosCompletados,
}: WizardProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {pasos.map((paso, index) => {
          const completado = pasosCompletados.has(paso.numero);
          const activo = pasoActual === paso.numero;
          const clickeable = completado || paso.numero < pasoActual;

          return (
            <div key={paso.numero} className="flex items-center flex-1">
              {/* Circulo + label */}
              <button
                onClick={() => clickeable && onPasoClick(paso.numero)}
                disabled={!clickeable}
                className={`flex flex-col items-center gap-1 ${
                  clickeable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    activo
                      ? "bg-[#00d084] text-white ring-4 ring-[#00d084]/30"
                      : completado
                      ? "bg-[#00d084] text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {completado && !activo ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    paso.numero
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    activo
                      ? "text-[#00d084]"
                      : completado
                      ? "text-gray-700"
                      : "text-gray-400"
                  }`}
                >
                  {paso.nombre}
                </span>
              </button>

              {/* Linea conectora */}
              {index < pasos.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    pasosCompletados.has(paso.numero)
                      ? "bg-[#00d084]"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
