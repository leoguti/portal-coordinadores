"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyTrendChartProps {
  data: Array<{ mes: string; entradas: number; salidas: number }>;
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Tendencia Mensual de Recolección (kg)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("es-CO")} />
          <Tooltip
            formatter={(value) => [Number(value).toLocaleString("es-CO") + " kg", ""]}
            labelFormatter={(label) => `Mes: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="entradas"
            stroke="#22c55e"
            strokeWidth={2}
            name="Entradas"
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="salidas"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Salidas"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
