"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  };
}

const ESTADOS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente",
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

export default function LegalizacionesListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [legalizaciones, setLegalizaciones] = useState<Legalizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevoMes, setNuevoMes] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/legalizaciones");
      const data = await res.json();
      setLegalizaciones(data.legalizaciones || []);
    } catch {
      setLegalizaciones([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchData();
  }, [status, router, fetchData]);

  const crear = async () => {
    setError(null);
    if (!/^\d{4}-\d{2}$/.test(nuevoMes)) {
      setError("Selecciona un mes válido");
      return;
    }
    setCreando(true);
    const res = await fetch("/api/legalizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes_reporte: nuevoMes }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) {
      if (res.status === 409 && data.existeId) {
        router.push(`/legalizaciones/${data.existeId}`);
        return;
      }
      setError(data.error || "Error al crear");
      return;
    }
    setShowNuevo(false);
    setNuevoMes("");
    router.push(`/legalizaciones/${data.legalizacion.id}`);
  };

  // Mes por defecto = mes pasado
  useEffect(() => {
    const hoy = new Date();
    hoy.setDate(1);
    hoy.setMonth(hoy.getMonth() - 1);
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    setNuevoMes(mes);
  }, []);

  if (status === "loading") return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Legalizaciones Mensuales</h1>
            <p className="text-sm text-gray-500 mt-1">Relación de gastos de caja menor por mes</p>
          </div>
          <button
            onClick={() => setShowNuevo(true)}
            className="bg-[#042726] hover:bg-[#032120] text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Nueva legalización
          </button>
        </div>

        {showNuevo && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Nueva legalización</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes de reporte</label>
              <input
                type="month"
                value={nuevoMes}
                onChange={(e) => setNuevoMes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={crear}
                  disabled={creando}
                  className="flex-1 bg-[#042726] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {creando ? "Creando..." : "Crear"}
                </button>
                <button
                  onClick={() => { setShowNuevo(false); setError(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        ) : legalizaciones.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No hay legalizaciones aún. Crea una para empezar.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {legalizaciones.map((l) => {
                  const mes = l.fields.mes_reporte || "";
                  const estado = l.fields.estado || "borrador";
                  return (
                    <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/legalizaciones/${l.id}`)}>
                      <td className="px-4 py-3 font-medium text-gray-900 capitalize">{mesLegible(mes)}</td>
                      <td className="px-4 py-3 text-gray-600">{l.fields.nombre || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADOS_COLOR[estado] || "bg-gray-100 text-gray-600"}`}>
                          {ESTADOS_LABEL[estado] || estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/legalizaciones/${l.id}`} className="text-xs text-green-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
