"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Tercero {
  id: string;
  razonSocial: string;
  nit: string;
  direccion: string;
  movil: number | null;
  correo: string;
  municipioDepartamento: string;
  tipoPersona: string;
  cedulaPdf: number;
  certificadoCamaraPdf: number;
  ordenesCount: number;
  cajaMenorCount: number;
  enUso: boolean;
  completo: boolean;
  faltantes: string[];
  nitInvalido: boolean;
}

type FiltroUso = "con_os" | "con_caja" | "en_uso" | "sin_uso" | "todos";

export default function TercerosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [filtroCompletitud, setFiltroCompletitud] = useState<"incompletos" | "todos" | "completos">("incompletos");
  const [filtroUso, setFiltroUso] = useState<FiltroUso>("con_os");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/terceros?all=true")
      .then((r) => r.json())
      .then((d) => {
        setTerceros(d.terceros || []);
        setIsAdminView(!!d.isAdmin);
        // Admin: default "con_os" (filtrar ruido). Coordinador: "todos" porque ya ve solo los suyos
        if (!d.isAdmin) setFiltroUso("todos");
        setLoading(false);
      });
  }, [status]);

  const visibles = terceros.filter((t) => {
    // Filtro de uso
    if (filtroUso === "con_os" && t.ordenesCount === 0) return false;
    if (filtroUso === "con_caja" && t.cajaMenorCount === 0) return false;
    if (filtroUso === "en_uso" && !t.enUso) return false;
    if (filtroUso === "sin_uso" && t.enUso) return false;
    // Filtro de completitud
    if (filtroCompletitud === "incompletos" && t.completo) return false;
    if (filtroCompletitud === "completos" && !t.completo) return false;
    // Búsqueda
    if (search) {
      const s = search.toLowerCase();
      return (
        t.razonSocial.toLowerCase().includes(s) ||
        t.nit.includes(s) ||
        (t.correo || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Conteos del filtro de USO (aplicados sobre el universo completo)
  const totalConOs = terceros.filter((t) => t.ordenesCount > 0).length;
  const totalConCaja = terceros.filter((t) => t.cajaMenorCount > 0).length;
  const totalEnUso = terceros.filter((t) => t.enUso).length;
  const totalSinUso = terceros.filter((t) => !t.enUso).length;

  // Aplicamos el filtro de uso para el sub-universo (después filtramos completitud)
  const enUnivUso = terceros.filter((t) => {
    if (filtroUso === "con_os") return t.ordenesCount > 0;
    if (filtroUso === "con_caja") return t.cajaMenorCount > 0;
    if (filtroUso === "en_uso") return t.enUso;
    if (filtroUso === "sin_uso") return !t.enUso;
    return true;
  });
  const total = enUnivUso.length;
  const completos = enUnivUso.filter((t) => t.completo).length;
  const incompletos = total - completos;
  const pct = total > 0 ? Math.round((completos / total) * 100) : 0;

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Terceros (Proveedores)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Revisa y completa los datos de los terceros. Los incompletos bloquean la creación de Órdenes de Servicio.
          </p>
        </div>

        {/* Progreso */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {completos} de {total} terceros completos
            </span>
            <span className="text-sm font-semibold text-green-700">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Filtro de uso */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Uso</p>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm flex-wrap">
            {(["con_os", "con_caja", "en_uso", "sin_uso", "todos"] as const).map((f) => {
              const label =
                f === "con_os" ? `Con OS (${totalConOs})` :
                f === "con_caja" ? `Con Caja Menor (${totalConCaja})` :
                f === "en_uso" ? `En uso (${totalEnUso})` :
                f === "sin_uso" ? `Sin uso (${totalSinUso})` :
                `Todos (${terceros.length})`;
              return (
                <button key={f} onClick={() => setFiltroUso(f)}
                  className={`px-3 py-2 ${filtroUso === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtro completitud + búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["incompletos", "todos", "completos"] as const).map((f) => {
              const label =
                f === "incompletos" ? `Incompletos (${incompletos})` :
                f === "completos" ? `Completos (${completos})` :
                `Todos (${total})`;
              return (
                <button key={f} onClick={() => setFiltroCompletitud(f)}
                  className={`px-4 py-2 capitalize ${filtroCompletitud === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, NIT o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {visibles.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">
              {filtroCompletitud === "incompletos" ? "Todos los terceros están completos" : "Sin resultados"}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visibles.map((t) => (
                <Link
                  key={t.id}
                  href={`/terceros/${t.id}`}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${t.completo ? "text-green-500" : "text-amber-500"}`}>
                          {t.completo ? "✓" : "⚠"}
                        </span>
                        <span className="font-medium text-gray-900 text-sm truncate">{t.razonSocial}</span>
                        {t.tipoPersona && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                            {t.tipoPersona}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 ml-5 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">{t.nit || "sin NIT"}</span>
                        {t.municipioDepartamento && (
                          <span className="text-xs text-gray-400">{t.municipioDepartamento}</span>
                        )}
                        {t.correo && <span className="text-xs text-gray-400 truncate">{t.correo}</span>}
                        {t.ordenesCount > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                            {t.ordenesCount} OS
                          </span>
                        )}
                        {t.cajaMenorCount > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                            {t.cajaMenorCount} CM
                          </span>
                        )}
                      </div>
                      {!t.completo && t.faltantes.length > 0 && (
                        <div className="ml-5 mt-1 flex flex-wrap gap-1">
                          {t.faltantes.map((f) => (
                            <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Falta: {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
