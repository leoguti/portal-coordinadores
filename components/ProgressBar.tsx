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
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <span className="text-sm font-bold" style={{ color }}>
          {porcentajeDisplay}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
        <div
          className="h-4 rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-500">
        <span className="font-bold text-gray-700">
          {actual.toLocaleString("es-CO")}
        </span>
        {" / "}
        {meta.toLocaleString("es-CO")} {unit}
      </p>
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
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <span className="text-xs font-bold text-gray-500">
          Meta: {meta.toLocaleString("es-CO")} {unit}
        </span>
      </div>

      {/* Barra Entradas vs Meta */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-green-700 flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500"></span>
            Entradas
          </span>
          <span className="text-xs font-bold text-green-700">
            {entradas.toLocaleString("es-CO")} {unit} ({Math.round(pctEntradas)}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3.5">
          <div
            className="h-3.5 rounded-full transition-all duration-500 bg-green-500"
            style={{ width: `${pctEntradas}%` }}
          />
        </div>
      </div>

      {/* Barra Salidas vs misma Meta */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
            Salidas
          </span>
          <span className="text-xs font-bold text-blue-700">
            {salidas.toLocaleString("es-CO")} {unit} ({Math.round(pctSalidas)}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3.5">
          <div
            className="h-3.5 rounded-full transition-all duration-500 bg-blue-500"
            style={{ width: `${pctSalidas}%` }}
          />
        </div>
      </div>

      {/* Indicador de diferencia */}
      {diferencia > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-amber-700 font-medium">
            {diferencia.toLocaleString("es-CO")} {unit} en centros de acopio sin despachar
          </p>
        </div>
      )}
    </div>
  );
}
