interface ProgressBarProps {
  label: string;
  actual: number;
  meta: number;
  unit: string;
  color?: string;
}

interface DualProgressBarProps {
  label: string;
  entradas: number;
  salidas: number;
  meta: number;
  unit: string;
}

export default function ProgressBar({
  label,
  actual,
  meta,
  unit,
  color = "#00d084",
}: ProgressBarProps) {
  const porcentaje = meta > 0 ? Math.min((actual / meta) * 100, 100) : 0;
  const porcentajeDisplay = Math.round(porcentaje);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      {/* Título */}
      <h3 className="text-base font-bold text-gray-800 mb-1">{label}</h3>

      {/* Meta destacada */}
      <div className="mb-4">
        <span className="text-3xl font-extrabold text-gray-900">
          {meta.toLocaleString("es-CO")}
        </span>
        <span className="text-sm font-medium text-gray-500 ml-1.5">{unit}</span>
      </div>

      {/* Barra */}
      <div className="w-full bg-gray-200 rounded-full h-5 mb-3">
        <div
          className="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${Math.max(porcentaje, 4)}%`, backgroundColor: color }}
        >
          {porcentaje >= 10 && (
            <span className="text-xs font-bold text-white">{porcentajeDisplay}%</span>
          )}
        </div>
      </div>

      {/* Progreso */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          Avance: <span className="font-bold text-gray-900">{actual.toLocaleString("es-CO")} {unit}</span>
        </span>
        {porcentaje < 10 && (
          <span className="text-sm font-bold" style={{ color }}>
            {porcentajeDisplay}%
          </span>
        )}
      </div>
    </div>
  );
}

export function DualProgressBar({
  label,
  entradas,
  salidas,
  meta,
  unit,
}: DualProgressBarProps) {
  const pctEntradas = meta > 0 ? Math.min((entradas / meta) * 100, 100) : 0;
  const pctSalidas = meta > 0 ? Math.min((salidas / meta) * 100, 100) : 0;
  const diferencia = entradas - salidas;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      {/* Título */}
      <h3 className="text-base font-bold text-gray-800 mb-1">{label}</h3>

      {/* Meta destacada */}
      <div className="mb-5">
        <span className="text-3xl font-extrabold text-gray-900">
          {meta.toLocaleString("es-CO")}
        </span>
        <span className="text-sm font-medium text-gray-500 ml-1.5">{unit}</span>
      </div>

      {/* Barra Entradas */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
            Entradas
          </span>
          <span className="text-sm font-bold text-green-700">
            {entradas.toLocaleString("es-CO")} {unit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-5">
          <div
            className="h-5 rounded-full transition-all duration-500 bg-green-500 flex items-center justify-end pr-2"
            style={{ width: `${Math.max(pctEntradas, 4)}%` }}
          >
            {pctEntradas >= 10 && (
              <span className="text-xs font-bold text-white">{Math.round(pctEntradas)}%</span>
            )}
          </div>
        </div>
        {pctEntradas < 10 && (
          <div className="text-right mt-0.5">
            <span className="text-xs font-bold text-green-700">{Math.round(pctEntradas)}%</span>
          </div>
        )}
      </div>

      {/* Barra Salidas */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-500"></span>
            Salidas
          </span>
          <span className="text-sm font-bold text-blue-700">
            {salidas.toLocaleString("es-CO")} {unit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-5">
          <div
            className="h-5 rounded-full transition-all duration-500 bg-blue-500 flex items-center justify-end pr-2"
            style={{ width: `${Math.max(pctSalidas, 4)}%` }}
          >
            {pctSalidas >= 10 && (
              <span className="text-xs font-bold text-white">{Math.round(pctSalidas)}%</span>
            )}
          </div>
        </div>
        {pctSalidas < 10 && (
          <div className="text-right mt-0.5">
            <span className="text-xs font-bold text-blue-700">{Math.round(pctSalidas)}%</span>
          </div>
        )}
      </div>

      {/* Indicador de diferencia */}
      {diferencia > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-sm text-amber-700 font-semibold">
            {diferencia.toLocaleString("es-CO")} {unit} en centros de acopio sin despachar
          </p>
        </div>
      )}
    </div>
  );
}
