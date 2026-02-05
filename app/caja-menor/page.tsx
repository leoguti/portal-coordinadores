"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import {
  getGastosCajaMenorCoordinador,
  getAllGastosCajaMenor,
  type GastoCajaMenor,
  type ReembolsoCajaMenor,
} from "@/lib/airtable";
import { puedeModificarFecha, getFechaMinimaPermitida, getFechaMaximaPermitida } from "@/lib/dateValidations";

interface CoordinadorConSaldo {
  id: string;
  nombre: string;
  saldoInicial: number;
}

export default function CajaMenorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gastos, setGastos] = useState<GastoCajaMenor[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");

  // Admin: coordinadores con saldo
  const [coordinadoresConSaldo, setCoordinadoresConSaldo] = useState<CoordinadorConSaldo[]>([]);

  // Reembolsos
  const [reembolsos, setReembolsos] = useState<ReembolsoCajaMenor[]>([]);

  // Modal crear reembolso (admin)
  const [mostrarModalReembolso, setMostrarModalReembolso] = useState(false);
  const [nuevoReembolsoMonto, setNuevoReembolsoMonto] = useState("");
  const [nuevoReembolsoFecha, setNuevoReembolsoFecha] = useState("");
  const [nuevoReembolsoObs, setNuevoReembolsoObs] = useState("");
  const [creandoReembolso, setCreandoReembolso] = useState(false);

  // Meses expandidos en la vista agrupada (gastos y reembolsos)
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(new Set());
  const [mesesReembolsosExpandidos, setMesesReembolsosExpandidos] = useState<Set<string>>(new Set());

  const isAdmin = session?.user?.rol === "Administrador";

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

        let data: GastoCajaMenor[];
        if (isAdmin) {
          data = await getAllGastosCajaMenor();
        } else {
          data = await getGastosCajaMenorCoordinador(session.user.coordinatorRecordId);
        }
        setGastos(data);

        // Cargar saldos iniciales
        try {
          if (isAdmin) {
            // Admin: cargar todos los coordinadores con saldo
            const res = await fetch("/api/caja-menor/asignaciones");
            if (res.ok) {
              const { coordinadores } = await res.json();
              setCoordinadoresConSaldo(coordinadores || []);
            }
          } else {
            // Coordinador: obtener su saldo inicial
            const res = await fetch(`/api/caja-menor/asignaciones?coordinadorId=${session.user.coordinatorRecordId}`);
            if (res.ok) {
              const { saldoInicial: si } = await res.json();
              setSaldoInicial(si || 0);
            }
          }
        } catch {
          // No es critico si falla
        }

        // Cargar reembolsos
        try {
          const resReemb = await fetch("/api/caja-menor/reembolsos");
          if (resReemb.ok) {
            const { reembolsos: reembData } = await resReemb.json();
            setReembolsos(reembData || []);
          }
        } catch {
          // No es critico si falla
        }
      } catch (err) {
        console.error("Error loading gastos:", err);
        setError("Error al cargar los gastos. Por favor intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user?.coordinatorRecordId) {
      loadData();
    }
  }, [session?.user?.coordinatorRecordId, isAdmin]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Calcular valor neto
  const calcValorNeto = (g: GastoCajaMenor) => {
    const valor = g.fields.Valor || 0;
    const pct = g.fields.PorcentajeRetencion || 0;
    return valor - (valor * pct);
  };

  const estadoColors: Record<string, string> = {
    Pendiente: "bg-yellow-100 text-yellow-800",
    Aprobado: "bg-green-100 text-green-800",
    Rechazado: "bg-red-100 text-red-800",
  };

  const puedeEliminarGasto = (fecha: string, estado: string): boolean => {
    if (!fecha) return false;
    if (estado !== "Pendiente") return false;
    return puedeModificarFecha(fecha);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Listas unicas para filtros
  const estadosUnicos = [...new Set(gastos.map((g) => g.fields.Estado || "").filter(Boolean))].sort();
  const mesesUnicos = [...new Set(gastos.map((g) => (g.fields.Fecha || "").substring(0, 7)).filter(Boolean))]
    .sort()
    .reverse();

  // Aplicar filtros
  const gastosFiltrados = gastos.filter((gasto) => {
    if (filtroCoordinador && !gasto.fields.Coordinador?.includes(filtroCoordinador)) return false;
    if (filtroEstado && gasto.fields.Estado !== filtroEstado) return false;
    if (filtroMes && (gasto.fields.Fecha || "").substring(0, 7) !== filtroMes) return false;
    return true;
  });

  // Reembolsos filtrados
  const reembolsosFiltrados = filtroCoordinador
    ? reembolsos.filter((r) => r.fields.Coordinador?.includes(filtroCoordinador))
    : isAdmin ? [] : reembolsos;

  // Calcular totales para coordinador actual o seleccionado
  const getCoordinadorId = () => {
    if (isAdmin) return filtroCoordinador;
    return session?.user?.coordinatorRecordId || "";
  };

  const coordId = getCoordinadorId();
  const gastosCoord = coordId ? gastos.filter((g) => g.fields.Coordinador?.includes(coordId)) : [];
  const reembolsosCoord = coordId ? reembolsos.filter((r) => r.fields.Coordinador?.includes(coordId)) : [];

  const totalFacturasAprobadas = gastosCoord
    .filter((g) => g.fields.Estado === "Aprobado")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const totalFacturasPendientes = gastosCoord
    .filter((g) => g.fields.Estado === "Pendiente")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const totalFacturasRechazadas = gastosCoord
    .filter((g) => g.fields.Estado === "Rechazado")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const totalReembolsos = reembolsosCoord.reduce((sum, r) => sum + (r.fields.Monto || 0), 0);

  // Saldo: Saldo Inicial + Reembolsos - Facturas Aprobadas
  const saldoInicialCoord = isAdmin
    ? (coordinadoresConSaldo.find((c) => c.id === filtroCoordinador)?.saldoInicial || 0)
    : saldoInicial;
  const saldoActual = saldoInicialCoord + totalReembolsos - totalFacturasAprobadas;

  const cantAprobados = gastosCoord.filter((g) => g.fields.Estado === "Aprobado").length;
  const cantPendientes = gastosCoord.filter((g) => g.fields.Estado === "Pendiente").length;
  const cantRechazados = gastosCoord.filter((g) => g.fields.Estado === "Rechazado").length;

  const coordNombre = isAdmin
    ? (coordinadoresConSaldo.find((c) => c.id === filtroCoordinador)?.nombre || "")
    : (session?.user?.name || "");

  // Tipo unificado para movimientos (gastos y reembolsos)
  type MovimientoUnificado =
    | { tipo: "gasto"; data: GastoCajaMenor; fecha: string }
    | { tipo: "reembolso"; data: ReembolsoCajaMenor; fecha: string };

  // Agrupar movimientos (gastos + reembolsos) por mes
  const movimientosPorMes = (() => {
    const grupos = new Map<string, MovimientoUnificado[]>();

    // Agregar gastos filtrados
    gastosFiltrados.forEach((gasto) => {
      const fecha = gasto.fields.Fecha || "";
      const mes = fecha.substring(0, 7) || "sin-fecha";
      if (!grupos.has(mes)) grupos.set(mes, []);
      grupos.get(mes)!.push({ tipo: "gasto", data: gasto, fecha });
    });

    // Agregar reembolsos filtrados
    reembolsosFiltrados.forEach((reembolso) => {
      const fecha = reembolso.fields.Fecha || "";
      const mes = fecha.substring(0, 7) || "sin-fecha";
      if (!grupos.has(mes)) grupos.set(mes, []);
      grupos.get(mes)!.push({ tipo: "reembolso", data: reembolso, fecha });
    });

    // Ordenar cada grupo por fecha descendente
    grupos.forEach((movimientos) => {
      movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    });

    return Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  const formatMesNombre = (mesStr: string) => {
    if (mesStr === "sin-fecha") return "Sin fecha";
    const [year, month] = mesStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  };

  const toggleMes = (mes: string) => {
    setMesesExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(mes)) next.delete(mes);
      else next.add(mes);
      return next;
    });
  };

  // Calcular saldo acumulado por mes (todos los meses ordenados cronologicamente)
  const calcularSaldosMensuales = () => {
    const mesesSet = new Set<string>();
    gastosCoord.forEach((g) => {
      const mes = (g.fields.Fecha || "").substring(0, 7);
      if (mes) mesesSet.add(mes);
    });
    reembolsosCoord.forEach((r) => {
      const mes = (r.fields.Fecha || "").substring(0, 7);
      if (mes) mesesSet.add(mes);
    });

    const mesesOrdenados = Array.from(mesesSet).sort();
    const saldosPorMes: Record<string, {
      saldoAnterior: number;
      reembolsosMes: number;
      facturasAprobadasMes: number;
      saldoFinal: number;
    }> = {};

    let saldoAcumulado = saldoInicialCoord;

    mesesOrdenados.forEach((mes) => {
      const saldoAnterior = saldoAcumulado;

      const reembolsosMes = reembolsosCoord
        .filter((r) => (r.fields.Fecha || "").substring(0, 7) === mes)
        .reduce((sum, r) => sum + (r.fields.Monto || 0), 0);

      const facturasAprobadasMes = gastosCoord
        .filter((g) => g.fields.Estado === "Aprobado" && (g.fields.Fecha || "").substring(0, 7) === mes)
        .reduce((sum, g) => sum + calcValorNeto(g), 0);

      saldoAcumulado = saldoAnterior + reembolsosMes - facturasAprobadasMes;

      saldosPorMes[mes] = {
        saldoAnterior,
        reembolsosMes,
        facturasAprobadasMes,
        saldoFinal: saldoAcumulado,
      };
    });

    return saldosPorMes;
  };

  const saldosMensuales = coordId ? calcularSaldosMensuales() : {};

  const calcResumenGrupo = (movimientos: MovimientoUnificado[]) => {
    const gastos = movimientos.filter((m) => m.tipo === "gasto").map((m) => m.data as GastoCajaMenor);
    const reembolsosGrupo = movimientos.filter((m) => m.tipo === "reembolso").map((m) => m.data as ReembolsoCajaMenor);

    const pendiente = gastos.filter((g) => g.fields.Estado === "Pendiente").reduce((s, g) => s + calcValorNeto(g), 0);
    const aprobado = gastos.filter((g) => g.fields.Estado === "Aprobado").reduce((s, g) => s + calcValorNeto(g), 0);
    const rechazado = gastos.filter((g) => g.fields.Estado === "Rechazado").reduce((s, g) => s + calcValorNeto(g), 0);
    const totalReembolsosGrupo = reembolsosGrupo.reduce((s, r) => s + (r.fields.Monto || 0), 0);

    return {
      pendiente,
      aprobado,
      rechazado,
      totalReembolsos: totalReembolsosGrupo,
      cantPend: gastos.filter((g) => g.fields.Estado === "Pendiente").length,
      cantAprob: gastos.filter((g) => g.fields.Estado === "Aprobado").length,
      cantRech: gastos.filter((g) => g.fields.Estado === "Rechazado").length,
      cantReemb: reembolsosGrupo.length,
      totalGastos: gastos.length,
      totalMovimientos: movimientos.length,
    };
  };

  const handleEliminar = async (gastoId: string, numero: number) => {
    if (!confirm(`Estas seguro de eliminar el gasto #${numero}?\n\nEsta accion no se puede deshacer.`)) return;

    try {
      const response = await fetch(`/api/caja-menor/${gastoId}`, { method: "DELETE" });
      if (response.ok) {
        setGastos((prev) => prev.filter((g) => g.id !== gastoId));
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || "No se pudo eliminar el gasto"}`);
      }
    } catch (err) {
      console.error("Error eliminando gasto:", err);
      alert("Error al eliminar el gasto");
    }
  };

  const handleCrearReembolso = async () => {
    if (!filtroCoordinador || !nuevoReembolsoMonto || !nuevoReembolsoFecha) return;
    const monto = parseFloat(nuevoReembolsoMonto);
    if (isNaN(monto) || monto <= 0) {
      alert("Ingresa un monto valido");
      return;
    }

    setCreandoReembolso(true);
    try {
      const res = await fetch("/api/caja-menor/reembolsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinadorId: filtroCoordinador,
          monto,
          fecha: nuevoReembolsoFecha,
          observaciones: nuevoReembolsoObs.trim() || undefined,
        }),
      });
      if (res.ok) {
        const { reembolso } = await res.json();
        setReembolsos((prev) => [reembolso, ...prev]);
        setMostrarModalReembolso(false);
        setNuevoReembolsoMonto("");
        setNuevoReembolsoFecha(getFechaMaximaPermitida());
        setNuevoReembolsoObs("");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "No se pudo crear el reembolso"}`);
      }
    } catch {
      alert("Error al crear el reembolso");
    } finally {
      setCreandoReembolso(false);
    }
  };

  const tieneSaldoInicial = saldoInicialCoord > 0 || totalReembolsos > 0 || totalFacturasAprobadas > 0;

  const puedeEliminarReembolso = (fecha: string): boolean => {
    if (!fecha) return false;
    return puedeModificarFecha(fecha);
  };

  const handleEliminarReembolso = async (reembolsoId: string, numero: number) => {
    if (!confirm(`Estas seguro de eliminar el reembolso #${numero}?\n\nEsta accion no se puede deshacer.`)) return;

    try {
      const response = await fetch(`/api/caja-menor/reembolsos/${reembolsoId}`, { method: "DELETE" });
      if (response.ok) {
        setReembolsos((prev) => prev.filter((r) => r.id !== reembolsoId));
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || "No se pudo eliminar el reembolso"}`);
      }
    } catch (err) {
      console.error("Error eliminando reembolso:", err);
      alert("Error al eliminar el reembolso");
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Caja Menor</h1>
            <p className="text-gray-600 mt-1">
              {isAdmin ? "Vista de administrador - Todos los gastos" : "Registra y consulta tus gastos de caja menor"}
            </p>
          </div>
          {!isAdmin && (
            <Link
              href="/caja-menor/nuevo"
              className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
            >
              + Nuevo Gasto
            </Link>
          )}
        </div>

        {/* Filtros Admin */}
        {isAdmin && !loading && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador</label>
                <select
                  value={filtroCoordinador}
                  onChange={(e) => setFiltroCoordinador(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Seleccionar coordinador...</option>
                  {coordinadoresConSaldo.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                <select
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {mesesUnicos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {estadosUnicos.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Panel de Saldo - Coordinador o Admin con filtro */}
        {!loading && (isAdmin ? filtroCoordinador : true) && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                {isAdmin ? `Caja Menor - ${coordNombre}` : "Mi Caja Menor"}
              </h2>
              {isAdmin && filtroCoordinador && (
                <button
                  onClick={() => {
                    setNuevoReembolsoFecha(getFechaMaximaPermitida());
                    setMostrarModalReembolso(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                >
                  + Nuevo Reembolso
                </button>
              )}
            </div>

            {/* Tarjeta de Saldo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Saldo Inicial</p>
                <p className="text-xl font-bold text-gray-900 font-mono">{formatCurrency(saldoInicialCoord)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-600 mb-1">Total Reembolsos</p>
                <p className="text-xl font-bold text-blue-700 font-mono">+{formatCurrency(totalReembolsos)}</p>
                <p className="text-xs text-blue-500">{reembolsosCoord.length} reembolsos</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-600 mb-1">Facturas Aprobadas</p>
                <p className="text-xl font-bold text-green-700 font-mono">-{formatCurrency(totalFacturasAprobadas)}</p>
                <p className="text-xs text-green-500">{cantAprobados} facturas</p>
              </div>
              <div className={`border rounded-lg p-4 ${saldoActual >= 0 ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}`}>
                <p className={`text-xs mb-1 font-bold ${saldoActual >= 0 ? "text-emerald-600" : "text-red-600"}`}>SALDO ACTUAL</p>
                <p className={`text-2xl font-bold font-mono ${saldoActual >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(saldoActual)}
                </p>
              </div>
            </div>

            {/* Resumen por estado */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Pendiente</p>
                <p className="text-lg font-bold text-yellow-800 font-mono">{formatCurrency(totalFacturasPendientes)}</p>
                <p className="text-xs text-yellow-600">{cantPendientes} gastos</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-bold text-green-700 uppercase mb-1">Aprobado</p>
                <p className="text-lg font-bold text-green-800 font-mono">{formatCurrency(totalFacturasAprobadas)}</p>
                <p className="text-xs text-green-600">{cantAprobados} gastos</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-700 uppercase mb-1">Rechazado</p>
                <p className="text-lg font-bold text-red-800 font-mono">{formatCurrency(totalFacturasRechazadas)}</p>
                <p className="text-xs text-red-600">{cantRechazados} gastos</p>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje seleccionar coordinador (admin sin filtro) */}
        {isAdmin && !filtroCoordinador && !loading && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">👆</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona un coordinador</h3>
            <p className="text-gray-600">Usa el filtro de arriba para ver los gastos de un coordinador específico.</p>
          </div>
        )}

        {/* Filtros (solo coordinador) */}
        {!isAdmin && !loading && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {estadosUnicos.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                <select
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {mesesUnicos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando movimientos...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Contador */}
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Total: {gastosFiltrados.length} gastos, {reembolsosFiltrados.length} reembolsos
              </p>
            </div>

            {/* Empty State */}
            {movimientosPorMes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay movimientos registrados</h3>
                <p className="text-gray-600 mb-6">
                  Aun no hay gastos ni reembolsos registrados.
                </p>
                {!isAdmin && (
                  <Link
                    href="/caja-menor/nuevo"
                    className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
                  >
                    Registrar primer gasto
                  </Link>
                )}
              </div>
            ) : (
              /* Vista unificada por mes con subgrupos */
              <div className="space-y-4">
                {movimientosPorMes.map(([mes, movimientos]) => {
                  const resumen = calcResumenGrupo(movimientos);
                  const expandido = mesesExpandidos.has(mes);
                  const saldoMes = saldosMensuales[mes];

                  // Separar en subgrupos
                  const reembolsosMes = movimientos
                    .filter((m) => m.tipo === "reembolso")
                    .map((m) => m.data as ReembolsoCajaMenor);
                  const gastosMes = movimientos
                    .filter((m) => m.tipo === "gasto")
                    .map((m) => m.data as GastoCajaMenor);

                  return (
                    <div key={mes} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                      {/* Header del mes */}
                      <button
                        onClick={() => toggleMes(mes)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors border-b border-gray-300"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-5 h-5 text-gray-600 transition-transform ${expandido ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-bold text-gray-900 capitalize text-lg">{formatMesNombre(mes)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {resumen.cantReemb > 0 && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium font-mono">
                              +{formatCurrency(resumen.totalReembolsos)}
                            </span>
                          )}
                          {resumen.cantAprob > 0 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded font-medium font-mono">
                              -{formatCurrency(resumen.aprobado)}
                            </span>
                          )}
                          {saldoMes && (
                            <span className={`px-3 py-1 rounded font-bold font-mono ${saldoMes.saldoFinal >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              Saldo: {formatCurrency(saldoMes.saldoFinal)}
                            </span>
                          )}
                        </div>
                      </button>

                      {expandido && (
                        <div className="p-4 space-y-4">
                          {/* Subgrupo: Reembolsos */}
                          {reembolsosMes.length > 0 && (
                            <div className="border border-blue-200 rounded-lg overflow-hidden">
                              <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                <h4 className="font-bold text-blue-800 text-sm uppercase flex items-center gap-2">
                                  <span className="text-lg">💵</span> Reembolsos ({reembolsosMes.length})
                                  <span className="ml-auto font-mono">+{formatCurrency(resumen.totalReembolsos)}</span>
                                </h4>
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-blue-50/50">
                                  <tr>
                                    <th className="text-left py-2 px-3 text-xs font-bold text-blue-700 uppercase w-16">#</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold text-blue-700 uppercase w-24">Fecha</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold text-blue-700 uppercase w-36">Monto</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold text-blue-700 uppercase">Observaciones</th>
                                    {isAdmin && <th className="text-right py-2 px-3 text-xs font-bold text-blue-700 uppercase w-20"></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {reembolsosMes.map((r, index) => {
                                    const fecha = r.fields.Fecha || "";
                                    const puedeEliminar = isAdmin && puedeEliminarReembolso(fecha);
                                    return (
                                      <tr key={r.id} className={`border-t border-blue-100 ${index % 2 === 0 ? "bg-white" : "bg-blue-50/30"}`}>
                                        <td className="py-2 px-3 font-bold text-blue-600 w-16">#{r.fields.NumeroReembolso || "-"}</td>
                                        <td className="py-2 px-3 text-gray-700 w-24">
                                          {fecha ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "-"}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 w-36">
                                          +{formatCurrency(r.fields.Monto || 0)}
                                        </td>
                                        <td className="py-2 px-3 text-gray-600 truncate">
                                          {r.fields.Observaciones || "-"}
                                        </td>
                                        {isAdmin && (
                                          <td className="py-2 px-3 text-right w-20">
                                            {puedeEliminar && (
                                              <button
                                                onClick={() => handleEliminarReembolso(r.id, r.fields.NumeroReembolso || 0)}
                                                className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                                              >
                                                Eliminar
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Subgrupo: Gastos */}
                          {gastosMes.length > 0 && (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <h4 className="font-bold text-gray-700 text-sm uppercase flex items-center gap-2">
                                  <span className="text-lg">🧾</span> Gastos ({gastosMes.length})
                                  <span className="ml-auto flex gap-2">
                                    {resumen.cantPend > 0 && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-mono">
                                        Pend: {formatCurrency(resumen.pendiente)}
                                      </span>
                                    )}
                                    {resumen.cantAprob > 0 && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-mono">
                                        Aprob: -{formatCurrency(resumen.aprobado)}
                                      </span>
                                    )}
                                  </span>
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50/50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase w-16">#</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase w-24">Fecha</th>
                                      {isAdmin && !filtroCoordinador && (
                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Coord.</th>
                                      )}
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Beneficiario</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Concepto</th>
                                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase w-36">Neto</th>
                                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase w-24">Estado</th>
                                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase w-20"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {gastosMes.map((gasto, index) => {
                                      const numero = gasto.fields.NumeroGasto || 0;
                                      const fecha = gasto.fields.Fecha || "";
                                      const beneficiario = gasto.fields.RazonSocial?.[0] || "Sin beneficiario";
                                      const coordinador = gasto.fields.NombreCoordinador?.[0] || "";
                                      const concepto = gasto.fields.Concepto || "";
                                      const valorNeto = calcValorNeto(gasto);
                                      const estado = gasto.fields.Estado || "Pendiente";
                                      const puedeEliminar = puedeEliminarGasto(fecha, estado);

                                      return (
                                        <tr
                                          key={gasto.id}
                                          className={`border-t border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50 transition-colors`}
                                        >
                                          <td className="px-3 py-2 w-16">
                                            <span className="font-bold text-[#00d084]">#{numero}</span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-700 w-24">
                                            {fecha ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "-"}
                                          </td>
                                          {isAdmin && !filtroCoordinador && (
                                            <td className="px-3 py-2 text-gray-700 text-xs">{coordinador}</td>
                                          )}
                                          <td className="px-3 py-2 text-gray-900 font-medium">{beneficiario}</td>
                                          <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{concepto}</td>
                                          <td className="px-3 py-2 text-right w-36">
                                            <span className="font-bold text-gray-900 font-mono">{formatCurrency(valorNeto)}</span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${estadoColors[estado] || "bg-gray-100 text-gray-800"}`}>
                                              {estado}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                              <Link
                                                href={`/caja-menor/${gasto.id}`}
                                                className="px-2 py-1 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors"
                                              >
                                                Ver
                                              </Link>
                                              {puedeEliminar && !isAdmin && (
                                                <button
                                                  onClick={() => handleEliminar(gasto.id, numero)}
                                                  className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                                                >
                                                  Eliminar
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Resumen de saldos del mes */}
                          {saldoMes && (
                            <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
                              <div className="bg-gray-200 px-4 py-2 border-b border-gray-300">
                                <h4 className="font-bold text-gray-700 text-sm uppercase">Resumen del Mes</h4>
                              </div>
                              <div className="p-4">
                                <table className="w-full text-sm">
                                  <tbody>
                                    <tr>
                                      <td className="py-1 text-gray-600">Saldo anterior:</td>
                                      <td className="py-1 text-right font-mono font-bold text-gray-700 w-36">
                                        {formatCurrency(saldoMes.saldoAnterior)}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="py-1 text-blue-600">+ Reembolsos del mes:</td>
                                      <td className="py-1 text-right font-mono font-bold text-blue-700 w-36">
                                        +{formatCurrency(saldoMes.reembolsosMes)}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="py-1 text-orange-600">- Gastos aprobados:</td>
                                      <td className="py-1 text-right font-mono font-bold text-orange-700 w-36">
                                        -{formatCurrency(saldoMes.facturasAprobadasMes)}
                                      </td>
                                    </tr>
                                    <tr className="border-t-2 border-gray-400">
                                      <td className={`py-2 font-bold ${saldoMes.saldoFinal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        = SALDO FINAL:
                                      </td>
                                      <td className={`py-2 text-right font-mono font-bold text-lg w-36 ${saldoMes.saldoFinal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {formatCurrency(saldoMes.saldoFinal)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Crear Reembolso */}
      {mostrarModalReembolso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nuevo Reembolso</h3>
            <p className="text-sm text-gray-600 mb-4">
              Coordinador: <strong>{coordNombre}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={nuevoReembolsoFecha}
                onChange={(e) => setNuevoReembolsoFecha(e.target.value)}
                min={getFechaMinimaPermitida()}
                max={getFechaMaximaPermitida()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Regla de 7 dias aplicada</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input
                type="number"
                value={nuevoReembolsoMonto}
                onChange={(e) => setNuevoReembolsoMonto(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
              <textarea
                value={nuevoReembolsoObs}
                onChange={(e) => setNuevoReembolsoObs(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMostrarModalReembolso(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearReembolso}
                disabled={creandoReembolso || !nuevoReembolsoMonto || !nuevoReembolsoFecha}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {creandoReembolso ? "Creando..." : "Crear Reembolso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
