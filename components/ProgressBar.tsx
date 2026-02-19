interface ProgressBarProps {
  label: string;
  actual: number;
  meta: number;
  unit: string;
  color?: string;
  evaluadas?: number;
  actualLabel?: string;
  evaluadasLabel?: string;
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
  evaluadas,
  actualLabel = "Avance",
  evaluadasLabel = "Personas Evaluadas",
}: ProgressBarProps) {
  const pctActual = meta > 0 ? Math.min((actual / meta) * 100, 100) : 0;
  const pctEvaluadas = meta > 0 && evaluadas != null ? Math.min((evaluadas / meta) * 100, 100) : 0;
  const showEvaluadas = evaluadas != null && evaluadas > 0;

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

      {/* Barra con dos capas: azul (sensibilizadas) y verde (evaluadas) */}
      <div className="relative w-full bg-gray-200 rounded-full h-7 mb-2">
        {/* Capa 1: Sensibilizadas (azul) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pctActual, 3)}%`, backgroundColor: color }}
        />
        {/* Capa 2: Evaluadas (verde, dentro de la azul) */}
        {showEvaluadas && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-green-500"
            style={{ width: `${Math.max(pctEvaluadas, 3)}%` }}
          />
        )}
        {/* Label evaluadas (izquierda) */}
        {showEvaluadas && (
          <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold text-white drop-shadow-sm">
            {evaluadas!.toLocaleString("es-CO")}
          </span>
        )}
        {/* Label sensibilizadas (derecha de la barra azul) */}
        {pctActual >= 15 && (
          <span className="absolute inset-y-0 flex items-center text-[11px] font-bold text-white drop-shadow-sm" style={{ right: `${Math.max(100 - pctActual, 1)}%`, paddingRight: '8px' }}>
            {actual.toLocaleString("es-CO")}
          </span>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }}></span>
          <span className="text-gray-600">{actualLabel}: <strong className="text-gray-900">{actual.toLocaleString("es-CO")}</strong></span>
          <span className="font-bold" style={{ color }}>{Math.round(pctActual)}%</span>
        </span>
        {showEvaluadas && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
            <span className="text-gray-600">{evaluadasLabel}: <strong className="text-gray-900">{evaluadas!.toLocaleString("es-CO")}</strong></span>
            <span className="font-bold text-green-600">{Math.round(pctEvaluadas)}%</span>
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
