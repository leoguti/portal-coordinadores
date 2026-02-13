interface ProgressBarProps {
  label: string;
  actual: number;
  meta: number;
  unit: string;
  color?: string;
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
