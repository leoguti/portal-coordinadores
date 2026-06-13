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
  listoCajaMenor: boolean;
  listoOrdenServicio: boolean;
  faltantesDatos: string[];
  faltantesDocumentos: string[];
}

type FiltroUso = "con_os" | "con_caja" | "en_uso" | "sin_uso" | "todos";

type CheckStatus = "ok" | "missing" | "warn";
interface CheckItem {
  label: string;
  status: CheckStatus;
  detail?: string;
}

// Convierte los faltantes en un checklist visual de pocos ítems, separando
// datos básicos (Caja Menor) de documentos (Órdenes de Servicio).
function buildChecklist(t: Tercero): CheckItem[] {
  const datos = new Set(t.faltantesDatos || []);
  const docs = new Set(t.faltantesDocumentos || []);
  const items: CheckItem[] = [];

  // 1) Datos básicos (presencia + formato correo/móvil/dirección) en un ítem.
  items.push({
    label: "Datos",
    status: datos.size === 0 ? "ok" : "missing",
    detail: datos.size ? `Revisar: ${[...datos].join(", ")}` : undefined,
  });

  // 2) Documento de identidad según tipo de persona.
  if (t.tipoPersona === "Jurídica") {
    items.push({
      label: "Cám. Comercio",
      status: docs.has("Certificado Cámara de Comercio") ? "missing" : "ok",
    });
  } else if (t.tipoPersona === "Natural") {
    items.push({
      label: "Cédula",
      status: docs.has("Cédula escaneada") ? "missing" : "ok",
    });
  }

  // 3) Documentos obligatorios para todos.
  items.push({ label: "RUT", status: docs.has("RUT") ? "missing" : "ok" });
  items.push({
    label: "Bancaria",
    status: docs.has("Certificación bancaria") ? "missing" : "ok",
  });

  // 4) NIT con dígito inválido: solo se muestra cuando hay problema (ámbar).
  if (t.nitInvalido) {
    items.push({
      label: "NIT",
      status: "warn",
      detail: "El dígito de verificación no es válido",
    });
  }

  return items;
}

function ChecklistPill({ item }: { item: CheckItem }) {
  const cfg =
    item.status === "ok"
      ? { cls: "bg-green-50 text-green-700", icon: "✓" }
      : item.status === "warn"
        ? { cls: "bg-amber-100 text-amber-800", icon: "⚠" }
        : { cls: "bg-red-50 text-red-700", icon: "✗" };
  return (
    <span
      title={item.detail || `${item.label}: ${item.status === "ok" ? "completo" : "pendiente"}`}
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${cfg.cls}`}
    >
      <span className="font-bold leading-none">{cfg.icon}</span>
      {item.label}
    </span>
  );
}

export default function TercerosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [filtroCompletitud, setFiltroCompletitud] = useState<"incompletos" | "todos" | "completos">("incompletos");
  const [filtroUso, setFiltroUso] = useState<FiltroUso>("con_os");
  const [search, setSearch] = useState("");
  const [showUso, setShowUso] = useState(false);

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

  // Orden por urgencia: incompletos primero, luego los más usados (más OS →
  // más bloqueos potenciales), después por caja menor.
  const visiblesSorted = [...visibles].sort((a, b) => {
    if (a.completo !== b.completo) return a.completo ? 1 : -1;
    if (b.ordenesCount !== a.ordenesCount) return b.ordenesCount - a.ordenesCount;
    return b.cajaMenorCount - a.cajaMenorCount;
  });

  const usoLabel: Record<FiltroUso, string> = {
    con_os: "Con Órdenes de Servicio",
    con_caja: "Con Caja Menor",
    en_uso: "En uso",
    sin_uso: "Sin uso",
    todos: "Todos",
  };

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
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Terceros (Proveedores)</h1>
            <p className="text-sm text-gray-500 mt-1">
              Completa los datos y documentos de cada tercero. Mientras estén
              incompletos, no podrás crear Órdenes de Servicio con ellos.
            </p>
          </div>
          <Link
            href="/terceros/nuevo"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <span className="text-base leading-none">+</span> Agregar tercero
          </Link>
        </div>

        {/* Encabezado accionable */}
        {incompletos > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  {incompletos}{" "}
                  {incompletos === 1
                    ? "tercero incompleto bloquea"
                    : "terceros incompletos bloquean"}{" "}
                  la creación de Órdenes de Servicio.
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Complétalos para poder facturar. {completos} de {total} listos.
                </p>
                <div className="w-full bg-amber-100 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <span className="text-xl leading-none">✅</span>
            <p className="text-sm font-semibold text-green-800">
              ¡Todo en orden! Los {total} terceros{" "}
              {filtroUso !== "todos" ? `(${usoLabel[filtroUso].toLowerCase()})` : ""} están completos.
            </p>
          </div>
        )}

        {/* Filtro principal (completitud) + búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["incompletos", "completos", "todos"] as const).map((f) => {
              const label =
                f === "incompletos" ? `Por completar (${incompletos})` :
                f === "completos" ? `Completos (${completos})` :
                `Todos (${total})`;
              return (
                <button key={f} onClick={() => setFiltroCompletitud(f)}
                  className={`px-4 py-2 ${filtroCompletitud === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
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

        {/* Filtro de uso (secundario, plegable) */}
        <div className="text-sm">
          <button
            onClick={() => setShowUso((v) => !v)}
            className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <span className="text-xs">{showUso ? "▾" : "▸"}</span>
            Mostrando: <span className="font-medium text-gray-700">{usoLabel[filtroUso]}</span>
            <span className="text-xs text-gray-400">· cambiar</span>
          </button>
          {showUso && (
            <div className="mt-2 flex rounded-lg border border-gray-200 overflow-hidden text-sm flex-wrap w-fit">
              {(["con_os", "con_caja", "en_uso", "sin_uso", "todos"] as const).map((f) => {
                const count =
                  f === "con_os" ? totalConOs :
                  f === "con_caja" ? totalConCaja :
                  f === "en_uso" ? totalEnUso :
                  f === "sin_uso" ? totalSinUso :
                  terceros.length;
                return (
                  <button key={f} onClick={() => setFiltroUso(f)}
                    className={`px-3 py-1.5 ${filtroUso === f ? "bg-[#042726] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                    {usoLabel[f]} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {visiblesSorted.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">
              {filtroCompletitud === "incompletos" ? "No hay terceros por completar 🎉" : "Sin resultados"}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visiblesSorted.map((t) => (
                <Link
                  key={t.id}
                  href={`/terceros/${t.id}`}
                  className="group block px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${t.completo ? "text-green-500" : "text-amber-500"}`}>
                          {t.completo ? "✓" : "⚠"}
                        </span>
                        <span className="font-medium text-gray-900 text-sm truncate">{t.razonSocial}</span>
                        {t.tipoPersona && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                            {t.tipoPersona}
                          </span>
                        )}
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
                      <div className="flex items-center gap-3 mt-0.5 ml-5 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">{t.nit || "sin NIT"}</span>
                        {t.municipioDepartamento && (
                          <span className="text-xs text-gray-400">{t.municipioDepartamento}</span>
                        )}
                        {t.correo && <span className="text-xs text-gray-400 truncate">{t.correo}</span>}
                      </div>
                      {/* Estado por propósito + checklist (solo si incompleto para OS) */}
                      {!t.completo && (
                        <div className="ml-5 mt-1.5 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <span className={t.listoCajaMenor ? "text-green-700" : "text-red-600"}>
                              {t.listoCajaMenor ? "🟢 Listo para Caja Menor" : "⚠ Faltan datos básicos"}
                            </span>
                            <span className="text-gray-400">
                              🔵 Órdenes de Servicio:{" "}
                              {t.listoCajaMenor ? "faltan documentos" : "faltan datos y documentos"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {buildChecklist(t).map((item) => (
                              <ChecklistPill key={item.label} item={item} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 group-hover:text-green-600 flex-shrink-0 whitespace-nowrap mt-0.5">
                      {t.completo ? "→" : "Completar →"}
                    </span>
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
