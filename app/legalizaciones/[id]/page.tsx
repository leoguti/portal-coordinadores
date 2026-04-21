"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Legalizacion {
  id: string;
  fields: {
    nombre?: string;
    coordinador?: string[];
    mes_reporte?: string;
    estado?: string;
    rechazado_motivo?: string;
    aprobado_at?: string;
    pdf_r2_url?: string;
  };
}

interface Gasto {
  id: string;
  fields: {
    Fecha?: string;
    Rubro?: string[];
    NombreCoordinador?: string[];
    Observaciones?: string;
    Valor?: number;
    MontoIVA?: number;
    ValorRetencion?: number;
    ValorNeto?: number;
    hora?: string;
    noches?: number;
    tipo_soporte?: string;
    numero_soporte?: string;
    "mundep (from municipio)"?: string[];
    "mundep (from municipio_destino)"?: string[];
    RazonSocial?: string[];
  };
}

interface Seccion {
  tipo: string;
  gastos: Gasto[];
  total: number;
}

const ESTADOS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  pagado: "Pagado",
};
const ESTADOS_COLOR: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  pendiente_aprobacion: "bg-yellow-100 text-yellow-800",
  aprobado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
  pagado: "bg-blue-100 text-blue-700",
};

function mesLegible(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function LegalizacionDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [leg, setLeg] = useState<Legalizacion | null>(null);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [rubrosById, setRubrosById] = useState<Record<string, { nombre: string; tipo: string }>>({});
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [showRechazar, setShowRechazar] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/legalizaciones/${id}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Error"); return; }
      setLeg(d.legalizacion);
      setSecciones(d.secciones || []);
      setRubrosById(d.rubrosById || {});
      setTotalGeneral(d.totalGeneral || 0);
    } catch {
      setError("Error cargando");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchData();
  }, [status, router, fetchData]);

  const ejecutarAccion = async (accion: string, motivo?: string) => {
    setAccionando(true);
    setError(null);
    const res = await fetch(`/api/legalizaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, motivo }),
    });
    const d = await res.json();
    setAccionando(false);
    if (!res.ok) {
      setError(d.error || "Error");
      return;
    }
    setShowRechazar(false);
    setMotivoRechazo("");
    fetchData();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }
  if (!leg) {
    return (
      <AuthenticatedLayout>
        <div className="p-6 text-red-600">{error || "No encontrada"}</div>
      </AuthenticatedLayout>
    );
  }

  const estado = leg.fields.estado || "borrador";
  const rol = session?.user?.rol;
  const isAdmin = rol === "Administrador" || rol === "Supervisor";
  const esDueño = leg.fields.coordinador?.[0] === session?.user?.coordinatorRecordId;

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500">
          <Link href="/legalizaciones" className="hover:text-gray-700">← Legalizaciones</Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 capitalize">
                {mesLegible(leg.fields.mes_reporte || "")}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{leg.fields.nombre}</p>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${ESTADOS_COLOR[estado]}`}>
              {ESTADOS_LABEL[estado]}
            </span>
          </div>

          {estado === "rechazado" && leg.fields.rechazado_motivo && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <span className="font-semibold">Motivo de rechazo:</span> {leg.fields.rechazado_motivo}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 mt-4">
            {estado === "borrador" && esDueño && (
              <button onClick={() => ejecutarAccion("enviar")} disabled={accionando || totalGeneral === 0}
                className="bg-[#042726] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#032120]">
                {accionando ? "Enviando..." : "Enviar a aprobación"}
              </button>
            )}
            {estado === "rechazado" && esDueño && (
              <button onClick={() => ejecutarAccion("reabrir")} disabled={accionando}
                className="bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                Reabrir (corregir y re-enviar)
              </button>
            )}
            {estado === "pendiente_aprobacion" && isAdmin && (
              <>
                <button onClick={() => ejecutarAccion("aprobar")} disabled={accionando}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                  Aprobar
                </button>
                <button onClick={() => setShowRechazar(true)}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  Rechazar
                </button>
              </>
            )}
            {estado === "aprobado" && isAdmin && (
              <button onClick={() => ejecutarAccion("pagar")} disabled={accionando}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                Marcar como pagado
              </button>
            )}
            {leg.fields.pdf_r2_url && (
              <a href={leg.fields.pdf_r2_url} target="_blank" rel="noopener noreferrer"
                className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">
                Descargar PDF
              </a>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        {/* Modal rechazar */}
        {showRechazar && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Rechazar legalización</h3>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
              <textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Indica el motivo para que el coordinador pueda corregir..." />
              <div className="flex gap-2 mt-3">
                <button onClick={() => ejecutarAccion("rechazar", motivoRechazo)} disabled={!motivoRechazo.trim() || accionando}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  Rechazar
                </button>
                <button onClick={() => { setShowRechazar(false); setMotivoRechazo(""); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Secciones de gastos */}
        {secciones.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            No hay gastos de caja menor registrados en este mes. Crea gastos en{" "}
            <Link href="/caja-menor/nuevo" className="text-green-700 hover:underline">Caja Menor</Link>
            {" "}y aparecerán aquí automáticamente.
          </div>
        ) : (
          <>
            {secciones.map((sec) => (
              <div key={sec.tipo} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{sec.tipo}</span>
                  <span className="text-sm font-semibold text-gray-900">{fmtCOP(sec.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs">Fecha</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs">Rubro</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs">Descripción</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs">Municipio</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs">Soporte</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Valor neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sec.gastos.map((g) => {
                      const f = g.fields;
                      const rubroId = f.Rubro?.[0];
                      const rubroNombre = rubroId ? rubrosById[rubroId]?.nombre : "—";
                      const muni = f["mundep (from municipio)"]?.[0] || "";
                      const muniDest = f["mundep (from municipio_destino)"]?.[0] || "";
                      const valorNeto = (f.Valor || 0) + (f.MontoIVA || 0) - (f.ValorRetencion || 0);
                      return (
                        <tr key={g.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                            {f.Fecha
                              ? new Date(f.Fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" })
                              : "—"}
                            {f.hora && <div className="text-[10px] text-gray-400 font-mono">{f.hora}</div>}
                            {f.noches !== undefined && f.noches > 0 && (
                              <div className="text-[10px] text-gray-400">{f.noches} noche(s)</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700">{rubroNombre}</td>
                          <td className="px-4 py-2 text-xs text-gray-600 max-w-[200px]">
                            <div className="truncate" title={f.Observaciones || ""}>{f.Observaciones || "—"}</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {muni}{muniDest && <> → {muniDest}</>}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {f.tipo_soporte && (
                              <>
                                <div>{f.tipo_soporte}</div>
                                {f.numero_soporte && <div className="text-[10px] text-gray-400 font-mono">#{f.numero_soporte}</div>}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-900">{fmtCOP(valorNeto)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Total general */}
            <div className="bg-[#042726] text-white rounded-xl p-5 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide">Total general del mes</span>
              <span className="text-2xl font-bold">{fmtCOP(totalGeneral)}</span>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
