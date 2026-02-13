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

interface CoordinatorCollectionChartProps {
  data: Array<{ nombre: string; kg: number }>;
}

export default function CoordinatorCollectionChart({
  data,
}: CoordinatorCollectionChartProps) {
  const sorted = [...data].sort((a, b) => b.kg - a.kg);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Recolección por Coordinador (kg)
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 35)}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => v.toLocaleString("es-CO")}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={{ fontSize: 11 }}
            width={75}
          />
          <Tooltip
            formatter={(value) => [
              Number(value).toLocaleString("es-CO") + " kg",
              "Total",
            ]}
          />
          <Bar dataKey="kg" fill="#00d084" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
