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
  type AsignacionCajaMenor,
  type ReembolsoCajaMenor,
} from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";

export default function CajaMenorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gastos, setGastos] = useState<GastoCajaMenor[]>([]);
  const [asignacion, setAsignacion] = useState<AsignacionCajaMenor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [filtroCoordinador, setFiltroCoordinador] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");

  // Admin: asignaciones y coordinadores
  const [allAsignaciones, setAllAsignaciones] = useState<AsignacionCajaMenor[]>([]);
  const [coordinadoresList, setCoordinadoresList] = useState<{ id: string; name: string }[]>([]);
  const [showAsignarForm, setShowAsignarForm] = useState(false);
  const [nuevoCoordinadorId, setNuevoCoordinadorId] = useState("");
  const [nuevoMonto, setNuevoMonto] = useState("");
  const [creandoAsignacion, setCreandoAsignacion] = useState(false);

  // Admin: edit asignacion inline
  const [editingAsignacionId, setEditingAsignacionId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState("");
  const [updatingAsignacion, setUpdatingAsignacion] = useState(false);

  // Admin: batch reembolso selection
  const [selectedGastos, setSelectedGastos] = useState<Set<string>>(new Set());
  const [creandoReembolso, setCreandoReembolso] = useState(false);
  const [observacionesReembolso, setObservacionesReembolso] = useState("");

  // Reembolsos history
  const [reembolsos, setReembolsos] = useState<ReembolsoCajaMenor[]>([]);

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

        // Cargar asignaciones (sin filtro de mes — el anticipo es un tope fijo)
        try {
          if (isAdmin) {
            // Admin: cargar TODAS las asignaciones + lista de coordinadores
            const [resAsig, resCoord] = await Promise.all([
              fetch("/api/caja-menor/asignaciones"),
              fetch("/api/coordinadores"),
            ]);
            if (resAsig.ok) {
              const { asignaciones } = await resAsig.json();
              setAllAsignaciones(asignaciones);
            }
            if (resCoord.ok) {
              const { coordinadores } = await resCoord.json();
              setCoordinadoresList(coordinadores);
            }
          } else {
            // Coordinador: buscar su asignacion (tope fijo, sin mes)
            const res = await fetch("/api/caja-menor/asignaciones");
            if (res.ok) {
              const { asignaciones } = await res.json();
              const miAsignacion = asignaciones.find(
                (a: AsignacionCajaMenor) =>
                  a.fields.Coordinador?.includes(session.user.coordinatorRecordId!)
              );
              setAsignacion(miAsignacion || null);
            }
          }
        } catch {
          // No es critico si falla la carga de asignaciones
        }

        // Cargar reembolsos
        try {
          const resReemb = await fetch("/api/caja-menor/reembolsos");
          if (resReemb.ok) {
            const { reembolsos: reembData } = await resReemb.json();
            setReembolsos(reembData);
          }
        } catch {
          // No es critico si falla la carga de reembolsos
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

  // Calcular valores en frontend (Airtable formula+currency puede retornar null)
  const calcValorNeto = (g: GastoCajaMenor) => {
    const valor = g.fields.Valor || 0;
    const pct = g.fields.PorcentajeRetencion || 0; // Airtable Percent: 0.03 = 3%
    return valor - (valor * pct);
  };

  const estadoColors: Record<string, string> = {
    Pendiente: "bg-yellow-100 text-yellow-800",
    Aprobado: "bg-green-100 text-green-800",
    Rechazado: "bg-red-100 text-red-800",
    Reembolsado: "bg-blue-100 text-blue-800",
  };

  const puedeEliminarGasto = (fecha: string, estado: string): boolean => {
    if (!fecha) return false;
    if (estado !== "Pendiente") return false;
    return puedeModificarFecha(fecha);
  };

  // Listas unicas para filtros
  const estadosUnicos = [
    ...new Set(gastos.map((g) => g.fields.Estado || "").filter(Boolean)),
  ].sort();
  const mesesUnicos = [
    ...new Set(gastos.map((g) => (g.fields.Fecha || "").substring(0, 7)).filter(Boolean)),
  ]
    .sort()
    .reverse();

  // Aplicar filtros (admin usa ID de coordinador, non-admin no filtra por coordinador)
  const gastosFiltrados = gastos.filter((gasto) => {
    if (filtroCoordinador && !gasto.fields.Coordinador?.includes(filtroCoordinador))
      return false;
    if (filtroEstado && gasto.fields.Estado !== filtroEstado) return false;
    if (filtroMes && (gasto.fields.Fecha || "").substring(0, 7) !== filtroMes) return false;
    return true;
  });

  // Calcular resumen del mes filtrado (o mes actual)
  const mesActualStr = new Date().toISOString().substring(0, 7);
  const mesFiltro = filtroMes || mesActualStr;
  const gastosDelMes = gastos.filter(
    (g) => (g.fields.Fecha || "").substring(0, 7) === mesFiltro
  );
  const totalAprobadoMes = gastosDelMes
    .filter((g) => g.fields.Estado === "Aprobado")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const totalPendienteMes = gastosDelMes
    .filter((g) => g.fields.Estado === "Pendiente")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const gastosRechazadosMes = gastosDelMes.filter((g) => g.fields.Estado === "Rechazado");
  const totalRechazadoMes = gastosRechazadosMes.reduce((sum, g) => sum + calcValorNeto(g), 0);
  const cantRechazados = gastosRechazadosMes.length;
  const cantAprobados = gastosDelMes.filter((g) => g.fields.Estado === "Aprobado").length;
  const cantPendientes = gastosDelMes.filter((g) => g.fields.Estado === "Pendiente").length;

  // Saldo GLOBAL = Anticipo - Aprobados (sin reembolsar). Pendientes/rechazados no afectan.
  const anticipoMonto = asignacion?.fields.MontoAsignado || 0;
  const totalAprobadoSinReembolsar = gastos
    .filter((g) => g.fields.Estado === "Aprobado")
    .reduce((sum, g) => sum + calcValorNeto(g), 0);
  const saldoGlobal = anticipoMonto - totalAprobadoSinReembolsar;
  const porcentajeUsado = anticipoMonto > 0 ? Math.min((totalAprobadoSinReembolsar / anticipoMonto) * 100, 100) : 0;

  // Nombre del mes en español
  const nombreMes = (() => {
    const [year, month] = mesFiltro.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  })();

  const tieneAsignacion = asignacion !== null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Admin: resumen por coordinador (agrupar asignaciones por coordinador para evitar duplicados)
  const resumenAdmin = (() => {
    // Agrupar asignaciones por coordinador (quedarse con el anticipo más reciente)
    const porCoord = new Map<string, { nombre: string; anticipo: number }>();
    allAsignaciones.forEach((asig) => {
      const coordId = asig.fields.Coordinador?.[0] || "";
      if (!coordId) return;
      const existing = porCoord.get(coordId);
      const monto = asig.fields.MontoAsignado || 0;
      if (!existing || monto > existing.anticipo) {
        porCoord.set(coordId, {
          nombre: asig.fields.NombreCoordinador?.[0] || "Sin nombre",
          anticipo: monto,
        });
      }
    });

    return Array.from(porCoord.entries()).map(([coordId, { nombre, anticipo }]) => {
      // Saldo global: Anticipo - Aprobados sin reembolsar
      const aprobadoSinReembolsarCoord = gastos
        .filter((g) => g.fields.Coordinador?.includes(coordId) && g.fields.Estado === "Aprobado")
        .reduce((s, g) => s + calcValorNeto(g), 0);
      // Stats del mes filtrado
      const gastosCoordMes = gastosDelMes.filter((g) =>
        g.fields.Coordinador?.includes(coordId)
      );
      const aprobado = gastosCoordMes
        .filter((g) => g.fields.Estado === "Aprobado")
        .reduce((s, g) => s + calcValorNeto(g), 0);
      const pendiente = gastosCoordMes
        .filter((g) => g.fields.Estado === "Pendiente")
        .reduce((s, g) => s + calcValorNeto(g), 0);
      const rechazado = gastosCoordMes
        .filter((g) => g.fields.Estado === "Rechazado")
        .reduce((s, g) => s + calcValorNeto(g), 0);
      return { coordId, nombre, anticipo, aprobado, pendiente, rechazado, saldo: anticipo - aprobadoSinReembolsarCoord };
    });
  })();
  const totalesAdmin = resumenAdmin.reduce(
    (acc, r) => ({
      anticipo: acc.anticipo + r.anticipo,
      aprobado: acc.aprobado + r.aprobado,
      pendiente: acc.pendiente + r.pendiente,
      rechazado: acc.rechazado + r.rechazado,
      saldo: acc.saldo + r.saldo,
    }),
    { anticipo: 0, aprobado: 0, pendiente: 0, rechazado: 0, saldo: 0 }
  );

  // Admin: detalle del coordinador seleccionado
  const adminCoordAsignacion = filtroCoordinador
    ? allAsignaciones.find((a) => a.fields.Coordinador?.includes(filtroCoordinador))
    : null;
  const adminCoordNombre = filtroCoordinador
    ? coordinadoresList.find((c) => c.id === filtroCoordinador)?.name || ""
    : "";
  // Stats del mes filtrado (para las tarjetas mensuales)
  const adminCoordGastosMes = filtroCoordinador
    ? gastosDelMes.filter((g) => g.fields.Coordinador?.includes(filtroCoordinador))
    : [];
  const adminCoordAprobadoMes = adminCoordGastosMes
    .filter((g) => g.fields.Estado === "Aprobado")
    .reduce((s, g) => s + calcValorNeto(g), 0);
  const adminCoordPendienteMes = adminCoordGastosMes
    .filter((g) => g.fields.Estado === "Pendiente")
    .reduce((s, g) => s + calcValorNeto(g), 0);
  const adminCoordRechazadoMes = adminCoordGastosMes
    .filter((g) => g.fields.Estado === "Rechazado")
    .reduce((s, g) => s + calcValorNeto(g), 0);
  const adminCoordCantAprobados = adminCoordGastosMes.filter((g) => g.fields.Estado === "Aprobado").length;
  const adminCoordCantPendientes = adminCoordGastosMes.filter((g) => g.fields.Estado === "Pendiente").length;
  const adminCoordCantRechazados = adminCoordGastosMes.filter((g) => g.fields.Estado === "Rechazado").length;
  // Saldo global: Anticipo - Aprobados sin reembolsar (todos los meses)
  const adminCoordAnticipo = adminCoordAsignacion?.fields.MontoAsignado || 0;
  const adminCoordAprobadoGlobal = filtroCoordinador
    ? gastos
        .filter((g) => g.fields.Coordinador?.includes(filtroCoordinador) && g.fields.Estado === "Aprobado")
        .reduce((s, g) => s + calcValorNeto(g), 0)
    : 0;
  const adminCoordSaldo = adminCoordAnticipo - adminCoordAprobadoGlobal;
  const adminCoordPctUsado = adminCoordAnticipo > 0 ? Math.min((adminCoordAprobadoGlobal / adminCoordAnticipo) * 100, 100) : 0;

  const handleCrearAsignacion = async () => {
    if (!nuevoCoordinadorId || !nuevoMonto) return;
    setCreandoAsignacion(true);
    try {
      const res = await fetch("/api/caja-menor/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinadorId: nuevoCoordinadorId,
          monto: parseFloat(nuevoMonto),
        }),
      });
      if (res.ok) {
        const { asignacion: nueva } = await res.json();
        setAllAsignaciones((prev) => [...prev, nueva]);
        setShowAsignarForm(false);
        setNuevoCoordinadorId("");
        setNuevoMonto("");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "No se pudo crear la asignación"}`);
      }
    } catch {
      alert("Error al crear la asignación");
    } finally {
      setCreandoAsignacion(false);
    }
  };

  const handleUpdateAsignacion = async (asignacionId: string) => {
    if (!editMonto) return;
    setUpdatingAsignacion(true);
    try {
      const res = await fetch("/api/caja-menor/asignaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asignacionId, monto: parseFloat(editMonto) }),
      });
      if (res.ok) {
        setAllAsignaciones((prev) =>
          prev.map((a) =>
            a.id === asignacionId
              ? { ...a, fields: { ...a.fields, MontoAsignado: parseFloat(editMonto) } }
              : a
          )
        );
        setEditingAsignacionId(null);
        setEditMonto("");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || "No se pudo actualizar"}`);
      }
    } catch {
      alert("Error al actualizar la asignación");
    } finally {
      setUpdatingAsignacion(false);
    }
  };

  const handleToggleGasto = (gastoId: string) => {
    setSelectedGastos((prev) => {
      const next = new Set(prev);
      if (next.has(gastoId)) next.delete(gastoId);
      else next.add(gastoId);
      return next;
    });
  };

  const handleSelectAllAprobados = () => {
    const aprobadosFiltrados = gastosFiltrados.filter((g) => g.fields.Estado === "Aprobado");
    const allSelected = aprobadosFiltrados.every((g) => selectedGastos.has(g.id));
    if (allSelected) {
      setSelectedGastos(new Set());
    } else {
      setSelectedGastos(new Set(aprobadosFiltrados.map((g) => g.id)));
    }
  };

  const handleCrearReembolso = async () => {
    if (selectedGastos.size === 0 || !filtroCoordinador) return;
    if (!confirm(`¿Crear reembolso con ${selectedGastos.size} gasto(s)?`)) return;

    setCreandoReembolso(true);
    try {
      const res = await fetch("/api/caja-menor/reembolsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinadorId: filtroCoordinador,
          gastoIds: Array.from(selectedGastos),
          observaciones: observacionesReembolso.trim() || undefined,
        }),
      });
      if (res.ok) {
        const { reembolso } = await res.json();
        // Update local state: mark gastos as Reembolsado
        setGastos((prev) =>
          prev.map((g) =>
            selectedGastos.has(g.id)
              ? { ...g, fields: { ...g.fields, Estado: "Reembolsado", Reembolso: [reembolso.id] } }
              : g
          )
        );
        setReembolsos((prev) => [reembolso, ...prev]);
        setSelectedGastos(new Set());
        setObservacionesReembolso("");
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

  // Coordinadores sin asignación (para el form de nueva asignación)
  const coordsSinAsignacion = coordinadoresList.filter(
    (c) => !allAsignaciones.some((a) => a.fields.Coordinador?.includes(c.id))
  );

  // Selected gastos totals
  const selectedGastosTotal = gastosFiltrados
    .filter((g) => selectedGastos.has(g.id))
    .reduce((sum, g) => sum + calcValorNeto(g), 0);

  // Reembolsos for the current coordinator filter (admin) or the coordinator (non-admin)
  const reembolsosFiltrados = filtroCoordinador
    ? reembolsos.filter((r) => r.fields.Coordinador?.includes(filtroCoordinador))
    : reembolsos;

  const handleEliminar = async (gastoId: string, numero: number) => {
    if (
      !confirm(
        `Estas seguro de eliminar el gasto #${numero}?\n\nEsta accion no se puede deshacer.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/caja-menor/${gastoId}`, {
        method: "DELETE",
      });

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

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Caja Menor</h1>
            <p className="text-gray-600 mt-1">
              {isAdmin
                ? "Vista de administrador - Todos los gastos"
                : "Registra y consulta tus gastos de caja menor"}
            </p>
          </div>
          {!isAdmin && tieneAsignacion && (
            <Link
              href="/caja-menor/nuevo"
              className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
            >
              + Nuevo Gasto
            </Link>
          )}
        </div>

        {/* Dashboard coordinador */}
        {!isAdmin && !loading && (
          <>
            {!tieneAsignacion ? (
              /* Alerta sin asignación */
              <div className="mb-6 bg-orange-50 border border-orange-300 rounded-lg p-5 flex items-start gap-3">
                <svg className="w-6 h-6 text-orange-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div>
                  <p className="font-bold text-orange-800">No tienes anticipo asignado</p>
                  <p className="text-orange-700 text-sm mt-1">Contacta al administrador para que te asigne un fondo de caja menor.</p>
                </div>
              </div>
            ) : (
              /* Panel Fondo de Caja Menor */
              <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
                {/* Saldo global (siempre visible) */}
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                    Mi Fondo de Caja Menor
                  </h2>
                </div>
                <div className="flex items-baseline gap-6 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Anticipo</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(anticipoMonto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-bold">Saldo disponible</p>
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(saldoGlobal)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${porcentajeUsado}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  {porcentajeUsado.toFixed(0)}% comprometido (aprobado sin reembolsar)
                </p>

                {/* Tarjetas mensuales */}
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                  Gastos de <span className="capitalize">{nombreMes}</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Pendiente</p>
                    <p className="text-xl font-bold text-yellow-800 font-mono">{formatCurrency(totalPendienteMes)}</p>
                    <p className="text-xs text-yellow-600 mt-1">{cantPendientes} {cantPendientes === 1 ? "gasto" : "gastos"}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-green-700 uppercase mb-1">Aprobado</p>
                    <p className="text-xl font-bold text-green-800 font-mono">{formatCurrency(totalAprobadoMes)}</p>
                    <p className="text-xs text-green-600 mt-1">{cantAprobados} {cantAprobados === 1 ? "gasto" : "gastos"}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-red-700 uppercase mb-1">Rechazado</p>
                    <p className="text-xl font-bold text-red-800 font-mono">{formatCurrency(totalRechazadoMes)}</p>
                    <p className="text-xs text-red-600 mt-1">{cantRechazados} {cantRechazados === 1 ? "gasto" : "gastos"}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Admin: filtros globales + contenido */}
        {isAdmin && !loading && (
          <>
            {/* Barra de filtros globales */}
            <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador</label>
                  <select
                    value={filtroCoordinador}
                    onChange={(e) => {
                      setFiltroCoordinador(e.target.value);
                      setSelectedGastos(new Set());
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  >
                    <option value="">Todos (resumen)</option>
                    {coordinadoresList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                  <select
                    value={filtroMes}
                    onChange={(e) => {
                      setFiltroMes(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  >
                    <option value="">Mes actual</option>
                    {mesesUnicos.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => {
                      setFiltroEstado(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {estadosUnicos.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(filtroCoordinador || filtroEstado || filtroMes) && (
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setFiltroCoordinador("");
                      setFiltroEstado("");
                      setFiltroMes("");
                      setSelectedGastos(new Set());
                      setCurrentPage(1);
                    }}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Contenido: resumen general o detalle de coordinador */}
            {!filtroCoordinador ? (
              /* Vista resumen: tabla de todos los coordinadores */
              <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                    Fondos de Caja Menor
                  </h2>
                  <button
                    onClick={() => setShowAsignarForm(!showAsignarForm)}
                    className="px-3 py-1.5 bg-[#00d084] hover:bg-[#00a868] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {showAsignarForm ? "Cancelar" : "+ Asignar Anticipo"}
                  </button>
                </div>

                {/* Formulario de asignación */}
                {showAsignarForm && (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Nueva Asignación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Coordinador</label>
                        <select
                          value={nuevoCoordinadorId}
                          onChange={(e) => setNuevoCoordinadorId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                        >
                          <option value="">Seleccionar...</option>
                          {coordsSinAsignacion.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {coordsSinAsignacion.length === 0 && (
                          <p className="text-xs text-gray-500 mt-1">Todos los coordinadores ya tienen anticipo asignado.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Monto (COP)</label>
                        <input
                          type="number"
                          value={nuevoMonto}
                          onChange={(e) => setNuevoMonto(e.target.value)}
                          placeholder="0"
                          min="1"
                          step="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={handleCrearAsignacion}
                        disabled={creandoAsignacion || !nuevoCoordinadorId || !nuevoMonto}
                        className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creandoAsignacion ? "Creando..." : "Asignar"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla resumen por coordinador */}
                {allAsignaciones.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No hay anticipos asignados.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-2 px-2 text-xs font-bold text-gray-600 uppercase">Coordinador</th>
                          <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase">Anticipo</th>
                          <th className="text-right py-2 px-2 text-xs font-bold text-blue-700 uppercase">Saldo</th>
                          <th className="text-center py-2 px-2 text-xs font-bold text-gray-600 uppercase w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenAdmin.map((r) => {
                          const asig = allAsignaciones.find((a) => a.fields.Coordinador?.includes(r.coordId));
                          const comprometido = r.anticipo - r.saldo;
                          const pctUsado = r.anticipo > 0 ? (comprometido / r.anticipo) * 100 : 0;
                          const isEditing = editingAsignacionId === asig?.id;
                          return (
                            <tr
                              key={r.coordId}
                              className="border-b border-gray-200 hover:bg-gray-50"
                            >
                              <td
                                className="py-2 px-2 font-medium text-gray-900 cursor-pointer"
                                onClick={() => {
                                  setFiltroCoordinador(r.coordId);
                                  setSelectedGastos(new Set());
                                  setCurrentPage(1);
                                }}
                              >
                                <span className="text-[#00d084] hover:underline">{r.nombre}</span>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                  <div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{ width: `${Math.min(pctUsado, 100)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-gray-900">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      value={editMonto}
                                      onChange={(e) => setEditMonto(e.target.value)}
                                      min="1"
                                      step="1"
                                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm font-mono text-right focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleUpdateAsignacion(asig!.id); }}
                                      disabled={updatingAsignacion || !editMonto}
                                      className="px-2 py-1 bg-[#00d084] text-white text-xs rounded hover:bg-[#00a868] disabled:opacity-50"
                                    >
                                      {updatingAsignacion ? "..." : "OK"}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditingAsignacionId(null); }}
                                      className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
                                    >
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  formatCurrency(r.anticipo)
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-blue-700">{formatCurrency(r.saldo)}</td>
                              <td className="py-2 px-2 text-center">
                                {!isEditing && asig && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAsignacionId(asig.id);
                                      setEditMonto(String(r.anticipo));
                                    }}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                                    title="Editar anticipo"
                                  >
                                    Editar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
                          <td className="py-2 px-2 text-gray-900 uppercase text-xs">Totales</td>
                          <td className="py-2 px-2 text-right font-mono text-gray-900">{formatCurrency(totalesAdmin.anticipo)}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-blue-700">{formatCurrency(totalesAdmin.saldo)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Vista detalle: fondo del coordinador seleccionado */
              <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                    Fondo — {adminCoordNombre}
                  </h2>
                </div>

                {adminCoordAsignacion ? (
                  <>
                    {/* Saldo global */}
                    <div className="flex items-baseline gap-6 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Anticipo</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(adminCoordAnticipo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-bold">Saldo disponible</p>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(adminCoordSaldo)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${adminCoordPctUsado}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mb-5">
                      {adminCoordPctUsado.toFixed(0)}% comprometido (aprobado sin reembolsar)
                    </p>

                    {/* Tarjetas mensuales */}
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                      Gastos de <span className="capitalize">{nombreMes}</span>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Pendiente</p>
                        <p className="text-xl font-bold text-yellow-800 font-mono">{formatCurrency(adminCoordPendienteMes)}</p>
                        <p className="text-xs text-yellow-600 mt-1">{adminCoordCantPendientes} {adminCoordCantPendientes === 1 ? "gasto" : "gastos"}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-green-700 uppercase mb-1">Aprobado</p>
                        <p className="text-xl font-bold text-green-800 font-mono">{formatCurrency(adminCoordAprobadoMes)}</p>
                        <p className="text-xs text-green-600 mt-1">{adminCoordCantAprobados} {adminCoordCantAprobados === 1 ? "gasto" : "gastos"}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-700 uppercase mb-1">Rechazado</p>
                        <p className="text-xl font-bold text-red-800 font-mono">{formatCurrency(adminCoordRechazadoMes)}</p>
                        <p className="text-xs text-red-600 mt-1">{adminCoordCantRechazados} {adminCoordCantRechazados === 1 ? "gasto" : "gastos"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-gray-500 mb-3">Sin anticipo asignado.</p>
                    <button
                      onClick={() => {
                        setNuevoCoordinadorId(filtroCoordinador);
                        setFiltroCoordinador("");
                        setShowAsignarForm(true);
                        setCurrentPage(1);
                      }}
                      className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      + Asignar Anticipo
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Filtros (solo coordinador, no admin) */}
        {!isAdmin && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onChange={(e) => {
                    setFiltroMes(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {mesesUnicos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            {(filtroEstado || filtroMes) && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setFiltroEstado("");
                    setFiltroMes("");
                    setCurrentPage(1);
                  }}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
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
              <p className="mt-4 text-gray-600">Cargando gastos...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Contador */}
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Total: {gastosFiltrados.length}{" "}
                {gastosFiltrados.length === 1 ? "gasto" : "gastos"}
                {gastosFiltrados.length !== gastos.length && (
                  <span className="ml-1 text-gray-400">(de {gastos.length})</span>
                )}
                {gastosFiltrados.length > ITEMS_PER_PAGE && (
                  <span className="ml-2">
                    (Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, gastosFiltrados.length)})
                  </span>
                )}
              </p>
            </div>

            {/* Empty State */}
            {gastosFiltrados.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {gastos.length === 0
                    ? "No hay gastos registrados"
                    : "No hay gastos con estos filtros"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {gastos.length === 0
                    ? "Aun no has registrado ningun gasto de caja menor."
                    : "Intenta cambiar los filtros de busqueda."}
                </p>
                {gastos.length === 0 && !isAdmin && tieneAsignacion && (
                  <Link
                    href="/caja-menor/nuevo"
                    className="inline-block px-6 py-3 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium"
                  >
                    Registrar primer gasto
                  </Link>
                )}
              </div>
            ) : (
              /* Tabla de gastos */
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      {isAdmin && filtroCoordinador && (
                        <th className="px-2 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              gastosFiltrados.filter((g) => g.fields.Estado === "Aprobado").length > 0 &&
                              gastosFiltrados
                                .filter((g) => g.fields.Estado === "Aprobado")
                                .every((g) => selectedGastos.has(g.id))
                            }
                            onChange={handleSelectAllAprobados}
                            className="h-4 w-4 rounded border-gray-300 text-[#00d084] focus:ring-[#00d084]"
                            title="Seleccionar todos los aprobados"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Fecha
                      </th>
                      {isAdmin && !filtroCoordinador && (
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                          Coordinador
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Beneficiario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                        Concepto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Neto
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                      const endIndex = startIndex + ITEMS_PER_PAGE;
                      const gastosPaginados = gastosFiltrados.slice(startIndex, endIndex);

                      return gastosPaginados.map((gasto, index) => {
                        const numero = gasto.fields.NumeroGasto || 0;
                        const fecha = gasto.fields.Fecha || "";
                        const beneficiario = gasto.fields.RazonSocial?.[0] || "Sin beneficiario";
                        const coordinador = gasto.fields.NombreCoordinador?.[0] || "";
                        const concepto = gasto.fields.Concepto || "";
                        const valor = gasto.fields.Valor || 0;
                        const valorNeto = calcValorNeto(gasto);
                        const estado = gasto.fields.Estado || "Pendiente";
                        const puedeEliminar = puedeEliminarGasto(fecha, estado);

                        return (
                          <tr
                            key={gasto.id}
                            className={`border-b border-gray-200 ${
                              selectedGastos.has(gasto.id) ? "bg-blue-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-blue-50 transition-colors`}
                          >
                            {isAdmin && filtroCoordinador && (
                              <td className="px-2 py-3 text-center">
                                {estado === "Aprobado" && (
                                  <input
                                    type="checkbox"
                                    checked={selectedGastos.has(gasto.id)}
                                    onChange={() => handleToggleGasto(gasto.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#00d084] focus:ring-[#00d084]"
                                  />
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <span className="font-bold text-[#00d084]">#{numero}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {fecha
                                ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO")
                                : "Sin fecha"}
                            </td>
                            {isAdmin && !filtroCoordinador && (
                              <td className="px-4 py-3 text-sm text-gray-700">{coordinador}</td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {beneficiario}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                              {concepto}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-mono text-gray-900">
                                {formatCurrency(valor)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-[#00d084] font-mono">
                                {formatCurrency(valorNeto)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                                  estadoColors[estado] || "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {estado}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/caja-menor/${gasto.id}`}
                                  className="px-3 py-1.5 bg-[#00d084] text-white text-xs font-medium rounded hover:bg-[#00b872] transition-colors whitespace-nowrap"
                                >
                                  Ver
                                </Link>
                                {puedeEliminar && !isAdmin && (
                                  <button
                                    onClick={() => handleEliminar(gasto.id, numero)}
                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginacion */}
            {gastosFiltrados.length > ITEMS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Pagina {currentPage} de{" "}
                  {Math.ceil(gastosFiltrados.length / ITEMS_PER_PAGE)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={
                      currentPage >= Math.ceil(gastosFiltrados.length / ITEMS_PER_PAGE)
                    }
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}

            {/* Historial de Reembolsos */}
            {(isAdmin ? filtroCoordinador : true) && reembolsosFiltrados.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                  Historial de Reembolsos
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 px-2 text-xs font-bold text-gray-600 uppercase">#</th>
                        <th className="text-left py-2 px-2 text-xs font-bold text-gray-600 uppercase">Fecha</th>
                        {isAdmin && !filtroCoordinador && (
                          <th className="text-left py-2 px-2 text-xs font-bold text-gray-600 uppercase">Coordinador</th>
                        )}
                        <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase">Monto Total</th>
                        <th className="text-center py-2 px-2 text-xs font-bold text-gray-600 uppercase">Gastos</th>
                        <th className="text-right py-2 px-2 text-xs font-bold text-gray-600 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reembolsosFiltrados.map((r, index) => {
                        const montoTotal = r.fields.MontoTotal ||
                          (r.fields.GastosCajaMenor || []).reduce((sum, gId) => {
                            const g = gastos.find((x) => x.id === gId);
                            return sum + (g ? calcValorNeto(g) : 0);
                          }, 0);
                        return (
                          <tr
                            key={r.id}
                            className={`border-b border-gray-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50`}
                          >
                            <td className="py-2 px-2 font-bold text-blue-600">
                              #{r.fields.NumeroReembolso || "-"}
                            </td>
                            <td className="py-2 px-2 text-gray-700">
                              {r.fields.Fecha
                                ? new Date(r.fields.Fecha + "T00:00:00").toLocaleDateString("es-CO")
                                : "-"}
                            </td>
                            {isAdmin && !filtroCoordinador && (
                              <td className="py-2 px-2 text-gray-700">
                                {r.fields.NombreCoordinador?.[0] || "-"}
                              </td>
                            )}
                            <td className="py-2 px-2 text-right font-mono font-bold text-blue-700">
                              {formatCurrency(montoTotal)}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-600">
                              {r.fields.GastosCajaMenor?.length || 0}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <Link
                                href={`/caja-menor/reembolsos/${r.id}`}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                              >
                                Ver
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating bar for batch reembolso */}
      {isAdmin && selectedGastos.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-700 text-white shadow-lg z-40 border-t border-blue-800">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">
                {selectedGastos.size} {selectedGastos.size === 1 ? "gasto" : "gastos"} seleccionado{selectedGastos.size !== 1 ? "s" : ""}
              </span>
              <span className="font-mono text-lg">{formatCurrency(selectedGastosTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={observacionesReembolso}
                onChange={(e) => setObservacionesReembolso(e.target.value)}
                placeholder="Observaciones (opcional)"
                className="px-3 py-1.5 rounded text-sm text-gray-900 border-0 focus:ring-2 focus:ring-white w-56"
              />
              <button
                onClick={() => { setSelectedGastos(new Set()); setObservacionesReembolso(""); }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearReembolso}
                disabled={creandoReembolso}
                className="px-4 py-1.5 bg-white text-blue-700 font-bold text-sm rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
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
