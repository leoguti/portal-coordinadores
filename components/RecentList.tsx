interface RecentItem {
  id: string;
  type: "actividad" | "certificado" | "kardex";
  title: string;
  date: string;
  description?: string;
}

interface RecentListProps {
  items: RecentItem[];
}

export default function RecentList({ items }: RecentListProps) {
  const typeConfig = {
    actividad: { icon: "📋", color: "text-blue-600", bg: "bg-blue-50" },
    certificado: { icon: "📜", color: "text-green-600", bg: "bg-green-50" },
    kardex: { icon: "📦", color: "text-purple-600", bg: "bg-purple-50" },
  };

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const config = typeConfig[item.type];
        return (
          <div
            key={item.id}
            className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center text-xl`}>
              {config.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
              {item.description && (
                <p className="text-sm text-gray-500 truncate">{item.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">{item.date}</p>
            </div>
            <span className={`text-xs font-medium ${config.color} uppercase`}>
              {item.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}
