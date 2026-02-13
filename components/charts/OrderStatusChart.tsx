"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface OrderStatusChartProps {
  data: Array<{ estado: string; count: number; total: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  Borrador: "#9ca3af",
  Enviada: "#3b82f6",
  Facturada: "#f59e0b",
  Pagada: "#22c55e",
  Rechazada: "#ef4444",
};

export default function OrderStatusChart({ data }: OrderStatusChartProps) {
  const chartData = data.filter((d) => d.count > 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Órdenes por Estado
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="estado"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            label={({ name, value }) => `${name} (${value})`}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.estado}
                fill={STATUS_COLORS[entry.estado] || "#94a3b8"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value} órdenes`,
              String(name),
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
