"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { name: "Dashboard", href: "/dashboard-ejecutivo", icon: "📊", roles: ["Administrador", "Supervisor"] },
  { name: "Dashboard", href: "/dashboard", icon: "📊", roles: ["Coordinador"] },
  { name: "Actividades", href: "/actividades", icon: "📋", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Kardex", href: "/kardex", icon: "📦", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Órdenes de Servicio", href: "/ordenes-servicio", icon: "🔧", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Saldos Centros", href: "/saldos-centros", icon: "⚖️", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Saldos Coordinador", href: "/saldos-coordinador", icon: "👤", roles: ["Administrador", "Supervisor"] },
  { name: "Caja Menor", href: "/caja-menor", icon: "💰", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Terceros", href: "/terceros", icon: "🏢", roles: ["Coordinador", "Administrador", "Supervisor"] },
  // "Revisión Fincas" oculto en el Sidebar (2026-05-19): la completitud
  // ahora se exige al momento de generar el certificado (panel rojo +
  // bloqueo). El código de /revisiones/fincas se conserva en disco por si
  // se vuelve a habilitar.
  // { name: "Revisión Fincas", href: "/revisiones/fincas", icon: "✅", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Resumen Gastos", href: "/resumen-gastos", icon: "📈", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Generación de Certificados", href: "/certificados", icon: "📜", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Histórico Certificados", href: "/certificados-historicos", icon: "🗂️", roles: ["Coordinador"] },
  { name: "Histórico Certificados", href: "/admin/certificados-historicos", icon: "🗂️", roles: ["Administrador", "Supervisor"] },
  { name: "Listar Certificados", href: "/certificados/listar", icon: "📜", roles: ["Coordinador", "Administrador", "Supervisor"] },
  { name: "Admin: Coordinadores", href: "/admin/coordinadores", icon: "👥", roles: ["Administrador"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRol = session?.user?.rol || "Coordinador";

  return (
    <aside className="w-64 bg-[#042726] text-white h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-700">
        <img 
          src="/logo-campolimpio-white.png" 
          alt="CampoLimpio" 
          className="h-12 w-auto mb-2"
        />
        <p className="text-sm text-gray-300 mt-1">Portal Coordinadores</p>
        {/* DEBUG: Mostrar rol del usuario */}
        <p className="text-xs text-yellow-300 mt-2 bg-yellow-900/30 px-2 py-1 rounded">
          Rol: {userRol}
        </p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems
            .filter((item) => item.roles.includes(userRol))
            .map((item) => {
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
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
