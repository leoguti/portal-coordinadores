"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MaterialDistributionChartProps {
  data: Record<string, number>;
}

const MATERIAL_COLORS: Record<string, string> = {
  Reciclaje: "#22c55e",
  Incineracion: "#ef4444",
  Flexibles: "#f59e0b",
  PlasticoContaminado: "#8b5cf6",
  Lonas: "#06b6d4",
  Carton: "#d97706",
  Metal: "#6b7280",
};

const MATERIAL_LABELS: Record<string, string> = {
  Reciclaje: "Reciclaje",
  Incineracion: "Incineración",
  Flexibles: "Flexibles",
  PlasticoContaminado: "Plást. Contam.",
  Lonas: "Lonas",
  Carton: "Cartón",
  Metal: "Metal",
};

export default function MaterialDistributionChart({
  data,
}: MaterialDistributionChartProps) {
  const chartData = Object.entries(data)
    .map(([key, value]) => ({
      material: MATERIAL_LABELS[key] || key,
      kg: value,
      fill: MATERIAL_COLORS[key] || "#94a3b8",
    }))
    .filter((d) => d.kg > 0)
    .sort((a, b) => b.kg - a.kg);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Distribución por Material (kg)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="material" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("es-CO")} />
          <Tooltip
            formatter={(value) => [
              Number(value).toLocaleString("es-CO") + " kg",
              "Total",
            ]}
          />
          <Bar dataKey="kg" radius={[4, 4, 0, 0]} fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
