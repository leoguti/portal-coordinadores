"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer cuando se navega (el coordinador toca un menú).
  // Sincronizar con cambio de ruta es un side-effect legítimo aquí.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Backdrop sólo en móvil cuando el drawer está abierto */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 md:ml-64 min-w-0">
        {/* Top bar sólo móvil — con el botón hamburguesa */}
        <header className="md:hidden sticky top-0 z-20 bg-[#042726] text-white flex items-center gap-3 px-4 py-3 shadow">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="text-2xl leading-none w-9 h-9 flex items-center justify-center rounded hover:bg-white/10"
          >
            ☰
          </button>
          <span className="font-semibold text-sm">Portal CampoLimpio</span>
        </header>

        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
