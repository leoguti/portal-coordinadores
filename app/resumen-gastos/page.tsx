"use client";

import { Fragment, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { isAdminOrSupervisor } from "@/lib/roles";

interface GastoUnificado {
  id: string;
  fuente: "caja-menor" | "orden";
  fecha: string;
  mes: string;
  coordinadorId: string;
  coordinadorNombre: string;
  beneficiarioId: string;
  beneficiarioNombre: string;
  rubroId: string;
  rubroNombre: string;
  valor: number;
  estado: string;
  refId?: string;
  ordenId?: string;
}

interface FiltroOption {
  id: string;
  nombre: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

export default function ResumenGastosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [gastos, setGastos] = useState<GastoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options from API
  const [rubrosOpciones, setRubrosOpciones] = useState<FiltroOption[]>([]);
  const [mesesOpciones, setMesesOpciones] = useState<string[]>([]);
  const [beneficiariosOpciones, setBeneficiariosOpciones] = useState<FiltroOption[]>([]);
  const [coordinadoresOpciones, setCoordinadoresOpciones] = useState<FiltroOption[]>([]);

  // Active filters
  const [filtroRubro, setFiltroRubro] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState("");
  const [filtroCoordinador, setFiltroCoordinador] = useState("");

  // Expanded rubros in table
  const [rubrosExpandidos, setRubrosExpandidos] = useState<Set<string>>(new Set());

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadData() {
      if (!session?.user?.coordinatorRecordId) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/resumen-gastos");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}`);
        }

        const data = await res.json();
        setGastos(data.gastos || []);
        setRubrosOpciones(data.filtros?.rubros || []);
        setMesesOpciones(data.filtros?.meses || []);
        setBeneficiariosOpciones(data.filtros?.beneficiarios || []);
        setCoordinadoresOpciones(data.filtros?.coordinadores || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadData();
    }
  }, [session]);

  // Apply client-side filters
  const gastosFiltrados = gastos.filter((g) => {
    if (filtroRubro && g.rubroId !== filtroRubro) return false;
    if (filtroMes && g.mes !== filtroMes) return false;
    if (filtroBeneficiario && g.beneficiarioId !== filtroBeneficiario) return false;
    if (filtroCoordinador && g.coordinadorId !== filtroCoordinador) return false;
    return true;
  });

  // Aggregate by rubro
  const resumenPorRubro = (() => {
    const map = new Map<string, { rubroId: string; rubroNombre: string; totalCM: number; totalOS: number; items: GastoUnificado[] }>();
    for (const g of gastosFiltrados) {
      const key = g.rubroId || "sin-rubro";
      if (!map.has(key)) {
        map.set(key, { rubroId: key, rubroNombre: g.rubroNombre, totalCM: 0, totalOS: 0, items: [] });
      }
      const entry = map.get(key)!;
      if (g.fuente === "caja-menor") {
        entry.totalCM += g.valor;
      } else {
        entry.totalOS += g.valor;
      }
      entry.items.push(g);
    }
    return [...map.values()].sort((a, b) => (b.totalCM + b.totalOS) - (a.totalCM + a.totalOS));
  })();

  // Totals
  const totalCM = resumenPorRubro.reduce((sum, r) => sum + r.totalCM, 0);
  const totalOS = resumenPorRubro.reduce((sum, r) => sum + r.totalOS, 0);
  const totalGeneral = totalCM + totalOS;

  const toggleRubro = (rubroId: string) => {
    setRubrosExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(rubroId)) {
        next.delete(rubroId);
      } else {
        next.add(rubroId);
      }
      return next;
    });
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Resumen de Gastos</h1>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rubro</label>
              <select
                value={filtroRubro}
                onChange={(e) => setFiltroRubro(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {rubrosOpciones.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {mesesOpciones.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiario</label>
              <select
                value={filtroBeneficiario}
                onChange={(e) => setFiltroBeneficiario(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {beneficiariosOpciones.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
            {canViewAll && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coordinador</label>
                <select
                  value={filtroCoordinador}
                  onChange={(e) => setFiltroCoordinador(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {coordinadoresOpciones.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Cargando datos...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Total General</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalGeneral)}</p>
                <p className="text-xs text-gray-400 mt-1">{gastosFiltrados.length} registros</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Caja Menor</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalCM)}</p>
                <p className="text-xs text-gray-400 mt-1">{gastosFiltrados.filter((g) => g.fuente === "caja-menor").length} gastos</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Ordenes de Servicio</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalOS)}</p>
                <p className="text-xs text-gray-400 mt-1">{gastosFiltrados.filter((g) => g.fuente === "orden").length} items</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Rubros Activos</p>
                <p className="text-2xl font-bold text-green-600">{resumenPorRubro.length}</p>
                <p className="text-xs text-gray-400 mt-1">con gastos en periodo</p>
              </div>
            </div>

            {/* Tabla resumen por rubro */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubro</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Caja Menor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ordenes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resumenPorRubro.map((rubro) => (
                    <Fragment key={rubro.rubroId}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRubro(rubro.rubroId)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                          <span className="mr-2 text-gray-400">{rubrosExpandidos.has(rubro.rubroId) ? "▼" : "▶"}</span>
                          {rubro.rubroNombre}
                          <span className="ml-2 text-xs text-gray-400">({rubro.items.length})</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600 font-medium">{formatCurrency(rubro.totalCM)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">{formatCurrency(rubro.totalOS)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-800 font-bold">{formatCurrency(rubro.totalCM + rubro.totalOS)}</td>
                      </tr>
                      {rubrosExpandidos.has(rubro.rubroId) && rubro.items
                        .sort((a, b) => b.fecha.localeCompare(a.fecha))
                        .map((item) => (
                          <tr key={item.id} className="bg-gray-50/50">
                            <td className="pl-10 pr-4 py-2 text-xs text-gray-600">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                  item.fuente === "caja-menor"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {item.fuente === "caja-menor" ? "CM" : "OS"}
                              </span>
                              {item.refId && <span className="text-gray-400 mr-2">{item.refId}</span>}
                              {item.beneficiarioNombre}
                              {canViewAll && <span className="text-gray-400 ml-2">- {item.coordinadorNombre}</span>}
                            </td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">
                              {item.fuente === "caja-menor" ? formatCurrency(item.valor) : ""}
                            </td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">
                              {item.fuente === "orden" ? formatCurrency(item.valor) : ""}
                            </td>
                            <td className="px-4 py-2 text-xs text-right text-gray-600 font-medium">
                              {formatCurrency(item.valor)}
                              <span className="ml-2 text-gray-400">{item.fecha}</span>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-4 py-3 text-sm text-gray-800">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700">{formatCurrency(totalCM)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-700">{formatCurrency(totalOS)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(totalGeneral)}</td>
                  </tr>
                </tbody>
              </table>

              {resumenPorRubro.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay gastos para los filtros seleccionados
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
