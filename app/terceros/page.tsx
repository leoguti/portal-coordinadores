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
  completo: boolean;
  faltantes: string[];
  nitInvalido: boolean;
}

export default function TercerosPage() {
  const { status } = useSession();
  const router = useRouter();
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"incompletos" | "todos" | "completos">("incompletos");
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
        setLoading(false);
      });
  }, [status]);

  const visibles = terceros.filter((t) => {
    if (filtro === "incompletos" && t.completo) return false;
    if (filtro === "completos" && !t.completo) return false;
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

  const total = terceros.length;
  const completos = terceros.filter((t) => t.completo).length;
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

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["incompletos", "todos", "completos"] as const).map((f) => {
              const label =
                f === "incompletos" ? `Incompletos (${incompletos})` :
                f === "completos" ? `Completos (${completos})` :
                `Todos (${total})`;
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-4 py-2 capitalize ${filtro === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
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
              {filtro === "incompletos" ? "Todos los terceros están completos" : "Sin resultados"}
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
