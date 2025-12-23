interface KpiCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: string;
  color?: "blue" | "green" | "purple" | "campolimpio";
}

export default function KpiCard({ title, value, description, icon, color = "blue" }: KpiCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    green: "bg-green-50 border-green-200 text-green-600",
    purple: "bg-purple-50 border-purple-200 text-purple-600",
    campolimpio: "bg-[#e6f9f3] border-[#7bdcb5] text-[#00d084]",
  };

  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
