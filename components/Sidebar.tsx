"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Actividades", href: "/actividades", icon: "📋" },
  { name: "Certificados", href: "/certificados", icon: "📜" },
  { name: "Kardex", href: "/kardex", icon: "📦" },
  { name: "Saldos Centros", href: "/saldos-centros", icon: "⚖️" },
  { name: "Órdenes de Servicio", href: "/ordenes-servicio", icon: "🔧" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#042726] text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <img 
          src="/logo-campolimpio-white.png" 
          alt="CampoLimpio" 
          className="h-12 w-auto mb-2"
        />
        <p className="text-sm text-gray-300 mt-1">Portal Coordinadores</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#00d084] text-white"
                      : "text-gray-300 hover:bg-[#032120]"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
