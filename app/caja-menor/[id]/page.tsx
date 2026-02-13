"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import TerceroSearch from "@/components/TerceroSearch";
import { getGastoCajaMenorById, type GastoCajaMenor } from "@/lib/airtable";
import { getFechaMinimaPermitida, getFechaMaximaPermitida } from "@/lib/dateValidations";

interface Tercero {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
}

interface KardexVinculado {
  id: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    "mundep (from MunicipioOrigen)"?: string[];
    Total?: number;
  };
}

export default function GastoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const gastoId = params.id as string;

  const [gasto, setGasto] = useState<GastoCajaMenor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [observaciones, setObservaciones] = useState("");

  // Coordinator correction states (for rejected gastos)
  const [editMode, setEditMode] = useState(false);
  const [editFecha, setEditFecha] = useState("");
  const [editBeneficiario, setEditBeneficiario] = useState<Tercero | null>(null);
  const [editConcepto, setEditConcepto] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editPorcentajeRetencion, setEditPorcentajeRetencion] = useState("");
  const [editFactura, setEditFactura] = useState<File | null>(null);
  const editFacturaRef = useRef<HTMLInputElement>(null);

  // Kardex vinculados
  const [kardexVinculados, setKardexVinculados] = useState<KardexVinculado[]>([]);

  // Lightbox for factura
  const [showFactura, setShowFactura] = useState(false);

  const isAdmin = session?.user?.rol === "Administrador";

  useEffect(() => {
    loadGasto();
  }, [gastoId]);

  // Cargar Kardex vinculados cuando el gasto se carga
  useEffect(() => {
    async function fetchKardexVinculados() {
      if (!gasto?.fields.Kardex || gasto.fields.Kardex.length === 0) {
        setKardexVinculados([]);
        return;
      }
      try {
        const ids = gasto.fields.Kardex.join(",");
        const res = await fetch(`/api/kardex/por-ids?ids=${encodeURIComponent(ids)}`);
        if (res.ok) {
          const data = await res.json();
          setKardexVinculados(data.kardex || []);
        }
      } catch {
        // Si falla, simplemente no mostrar la sección
      }
    }
    fetchKardexVinculados();
  }, [gasto]);

  async function loadGasto() {
    try {
      setLoading(true);
      setError(null);

      const data = await getGastoCajaMenorById(gastoId);

      if (!data) {
        setError("Gasto no encontrado");
        return;
      }

      setGasto(data);
    } catch (err) {
      console.error("Error loading gasto:", err);
      setError("Error al cargar el gasto");
    } finally {
      setLoading(false);
    }
  }


  function enterEditMode() {
    if (!gasto) return;
    setEditFecha(gasto.fields.Fecha || "");
    setEditBeneficiario(
      gasto.fields.Beneficiario?.[0]
        ? {
            id: gasto.fields.Beneficiario[0],
            razonSocial: gasto.fields.RazonSocial?.[0] || "",
            nit: gasto.fields.NIT?.[0] || "",
          }
        : null
    );
    setEditConcepto(gasto.fields.Concepto || "");
    setEditValor(String(gasto.fields.Valor || ""));
    setEditPorcentajeRetencion(String((gasto.fields.PorcentajeRetencion || 0) * 100));
    setEditFactura(null);
    setEditMode(true);
    setActionMessage(null);
  }

  async function handleCorregir(e: React.FormEvent) {
    e.preventDefault();
    if (!gasto) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      // 1. Corregir el gasto primero
      const response = await fetch(`/api/caja-menor/${gastoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "corregir",
          fecha: editFecha,
          beneficiarioId: editBeneficiario?.id,
          concepto: editConcepto.trim(),
          valor: parseFloat(editValor) || 0,
          porcentajeRetencion: parseFloat(editPorcentajeRetencion) || 0,
        }),
      });

      if (response.ok) {
        // 2. Si hay nueva factura, subirla al registro existente
        if (editFactura) {
          const formData = new FormData();
          formData.append("file", editFactura);
          formData.append("recordId", gastoId);
          formData.append("fieldName", "Factura");
          await fetch("/api/upload", { method: "POST", body: formData });
        }

        setActionMessage({
          type: "success",
          text: "Gasto corregido y reenviado para revision",
        });
        setEditMode(false);
        await loadGasto();
      } else {
        const data = await response.json();
        setActionMessage({ type: "error", text: data.error || "Error al corregir el gasto" });
      }
    } catch (err) {
      console.error("Error corrigiendo gasto:", err);
      setActionMessage({ type: "error", text: "Error al corregir el gasto" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdminAction(action: "aprobar" | "rechazar") {
    const confirmMsg =
      action === "aprobar"
        ? "Aprobar este gasto?"
        : "Rechazar este gasto? El coordinador podra corregirlo.";

    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/caja-menor/${gastoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          observaciones: observaciones.trim() || undefined,
        }),
      });

      if (response.ok) {
        const estado = action === "aprobar" ? "Aprobado" : "Rechazado";
        setActionMessage({ type: "success", text: `Gasto ${estado.toLowerCase()}` });
        setObservaciones("");
        await loadGasto();
      } else {
        const data = await response.json();
        setActionMessage({
          type: "error",
          text: data.error || "Error al cambiar el estado",
        });
      }
    } catch (err) {
      console.error("Error cambiando estado:", err);
      setActionMessage({ type: "error", text: "Error al cambiar el estado" });
    } finally {
      setActionLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const estadoColors: Record<string, string> = {
    Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
    Aprobado: "bg-green-100 text-green-800 border-green-300",
    Rechazado: "bg-red-100 text-red-800 border-red-300",
    Reembolsado: "bg-blue-100 text-blue-800 border-blue-300",
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando gasto...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error || !gasto) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || "Gasto no encontrado"}</p>
            <Link
              href="/caja-menor"
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Volver a Caja Menor
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const numero = gasto.fields.NumeroGasto || 0;
  const fecha = gasto.fields.Fecha || "";
  const beneficiario = gasto.fields.RazonSocial?.[0] || "Sin beneficiario";
  const nit = gasto.fields.NIT?.[0] || "";
  const coordinador = gasto.fields.NombreCoordinador?.[0] || "Sin coordinador";
  const concepto = gasto.fields.Concepto || "";
  const valor = gasto.fields.Valor || 0;
  const porcentajeRetencion = gasto.fields.PorcentajeRetencion || 0; // Airtable Percent: 0.03 = 3%
  const valorRetencion = valor * porcentajeRetencion;
  const valorNeto = valor - valorRetencion;
  const estado = gasto.fields.Estado || "Pendiente";
  const observacionesAdmin = gasto.fields.ObservacionesAdmin || "";
  const factura = gasto.fields.Factura?.[0] || null;

  const isOwner = gasto.fields.Coordinador?.includes(
    session?.user?.coordinatorRecordId || ""
  );
  const canCorrect = !isAdmin && isOwner && estado === "Rechazado";

  // Edit mode values for calculations
  const editValorNum = parseFloat(editValor) || 0;
  const editRetencionNum = parseFloat(editPorcentajeRetencion) || 0;
  const editValorRetencion = editValorNum * editRetencionNum / 100; // editRetencionNum is user-entered (e.g. 3 for 3%)
  const editValorNeto = editValorNum - editValorRetencion; // API conversion (/100) happens in lib/airtable.ts

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link href="/caja-menor" className="hover:text-[#00d084] transition-colors">
              Caja Menor
            </Link>
            <span>&rsaquo;</span>
            <span>Gasto #{numero}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">Gasto #{numero}</h1>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold rounded border ${
                  estadoColors[estado] || "bg-gray-100 text-gray-800 border-gray-300"
                }`}
              >
                {estado}
              </span>
            </div>
            {factura && (
              <button
                onClick={() => setShowFactura(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Ver Factura
              </button>
            )}
          </div>
        </div>

        {/* Action messages */}
        {actionMessage && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              actionMessage.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <p>{actionMessage.text}</p>
          </div>
        )}

        {/* Observaciones del admin (visible para todos si hay) */}
        {observacionesAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-sm font-bold text-amber-800 mb-1">
              Observaciones del Administrador
            </h3>
            <p className="text-amber-700">{observacionesAdmin}</p>
          </div>
        )}

        {/* Admin Actions Panel */}
        {isAdmin && estado === "Pendiente" && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">
              Acciones de Administrador
            </h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Agregar observaciones al aprobar o rechazar..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleAdminAction("aprobar")}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Procesando..." : "Aprobar Gasto"}
              </button>
              <button
                onClick={() => handleAdminAction("rechazar")}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Procesando..." : "Rechazar Gasto"}
              </button>
            </div>
          </div>
        )}

        {/* Admin: gasto aprobado - reembolso se hace en lote */}
        {isAdmin && estado === "Aprobado" && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Los reembolsos se realizan en lote desde la{" "}
              <Link href="/caja-menor" className="font-bold underline hover:text-blue-900">vista principal</Link>.
              Selecciona los gastos aprobados de un coordinador para crear un reembolso.
            </p>
          </div>
        )}

        {/* Reembolsado: show link to reembolso or legacy label */}
        {estado === "Reembolsado" && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            {gasto.fields.Reembolso?.[0] ? (
              <p className="text-sm text-blue-800">
                Este gasto fue incluido en el{" "}
                <Link
                  href={`/caja-menor/reembolsos/${gasto.fields.Reembolso[0]}`}
                  className="font-bold underline hover:text-blue-900"
                >
                  reembolso correspondiente
                </Link>.
              </p>
            ) : (
              <p className="text-sm text-blue-700 italic">
                Reembolsado (legacy) — Este gasto fue reembolsado antes de la implementacion del sistema de reembolsos en lote.
              </p>
            )}
          </div>
        )}

        {/* Admin: no actions for Rechazado state */}
        {isAdmin && estado === "Rechazado" && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">
              Acciones de Administrador
            </h3>
            <p className="text-sm text-gray-500 italic">
              Este gasto fue rechazado. El coordinador puede corregirlo y reenviarlo.
            </p>
          </div>
        )}

        {/* Coordinator: correction button for rejected */}
        {canCorrect && !editMode && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 mb-3">
              Este gasto fue rechazado. Puedes corregirlo y reenviarlo para revision.
            </p>
            <button
              onClick={enterEditMode}
              className="px-4 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium text-sm"
            >
              Corregir y Reenviar
            </button>
          </div>
        )}

        {/* Edit Mode Form (coordinator correcting rejected gasto) */}
        {editMode && (
          <form
            onSubmit={handleCorregir}
            className="mb-6 bg-white rounded-lg shadow-lg border-2 border-[#00d084] p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Corregir Gasto</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  min={getFechaMinimaPermitida()}
                  max={getFechaMaximaPermitida()}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beneficiario
                </label>
                <TerceroSearch
                  value={editBeneficiario}
                  onChange={setEditBeneficiario}
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
              <input
                type="text"
                value={editConcepto}
                onChange={(e) => setEditConcepto(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor (COP)
                </label>
                <input
                  type="number"
                  value={editValor}
                  onChange={(e) => setEditValor(e.target.value)}
                  min="1"
                  step="1"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  % Retencion
                </label>
                <input
                  type="number"
                  value={editPorcentajeRetencion}
                  onChange={(e) => setEditPorcentajeRetencion(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent font-mono"
                />
              </div>
            </div>

            {/* Edit calc summary */}
            {editValorNum > 0 && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Valor bruto</p>
                    <p className="font-mono font-bold text-gray-900">
                      {formatCurrency(editValorNum)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Retencion ({editRetencionNum}%)</p>
                    <p className="font-mono font-bold text-red-600">
                      -{formatCurrency(editValorRetencion)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valor neto</p>
                    <p className="font-mono font-bold text-[#00d084] text-lg">
                      {formatCurrency(editValorNeto)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* New factura upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva factura (opcional)
              </label>
              <input
                ref={editFacturaRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setEditFactura(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => editFacturaRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm border border-gray-300"
                >
                  {editFactura ? "Cambiar archivo" : "Seleccionar archivo"}
                </button>
                {editFactura && (
                  <span className="text-sm text-gray-700">{editFactura.name}</span>
                )}
                {!editFactura && (
                  <span className="text-sm text-gray-400">
                    Dejar vacio para mantener la factura actual
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-300">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Guardando..." : "Corregir y Reenviar"}
              </button>
            </div>
          </form>
        )}

        {/* Detail view (read-only) */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Informacion del Gasto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {fecha
                  ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO")
                  : "Sin fecha"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beneficiario
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-medium">
                {beneficiario}
                {nit && (
                  <span className="text-gray-500 text-sm ml-2">NIT: {nit}</span>
                )}
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordinador
                </label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                  {coordinador}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {concepto}
              </div>
            </div>
          </div>

          {/* Valores */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase">Valores</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Valor bruto</p>
                <p className="text-lg font-mono font-bold text-gray-900">
                  {formatCurrency(valor)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">% Retencion</p>
                <p className="text-lg font-mono font-bold text-gray-900">
                  {(porcentajeRetencion * 100).toFixed(1).replace(/\.0$/, "")}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Valor retencion</p>
                <p className="text-lg font-mono font-bold text-red-600">
                  -{formatCurrency(valorRetencion)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Valor neto</p>
                <p className="text-xl font-mono font-bold text-[#00d084]">
                  {formatCurrency(valorNeto)}
                </p>
              </div>
            </div>
          </div>

          {/* Factura info */}
          {factura && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-800">Factura / Soporte</h3>
                  <p className="text-xs text-amber-600 mt-1">
                    Archivo: {factura.filename}
                  </p>
                </div>
                <a
                  href={factura.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors"
                >
                  Descargar
                </a>
              </div>
            </div>
          )}

          {!factura && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500 italic">No se adjunto factura/soporte</p>
            </div>
          )}

          {/* Kardex vinculados */}
          {kardexVinculados.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase">Kardex vinculados</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">#</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Municipio</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">Kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexVinculados.map((k) => (
                      <tr key={k.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono font-bold text-gray-900">
                          {k.fields.idkardex}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {k.fields.fechakardex
                            ? new Date(k.fields.fechakardex + "T00:00:00").toLocaleDateString("es-CO")
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${
                              k.fields.TipoMovimiento === "SALIDA"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {k.fields.TipoMovimiento}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {k.fields["mundep (from MunicipioOrigen)"]?.[0] || "-"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">
                          {(k.fields.Total || 0).toLocaleString("es-CO")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Boton volver */}
          <div className="mt-6 pt-6 border-t border-gray-300">
            <Link
              href="/caja-menor"
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Volver a Caja Menor
            </Link>
          </div>
        </div>
      </div>

      {/* Lightbox para factura (imagenes) */}
      {showFactura && factura && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFactura(false)}
        >
          <button
            onClick={() => setShowFactura(false)}
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
          >
            &times;
          </button>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-white text-sm font-medium">{factura.filename}</div>
            {factura.filename?.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={factura.url}
                className="w-[90vw] h-[85vh] bg-white rounded-lg"
                title="Factura PDF"
              />
            ) : (
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(factura.url)}`}
                alt={factura.filename}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
