"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getOrdenById, getItemsOrden, getKardexByIds, getRubrosByIds, type Orden, type ItemOrden, type Kardex, type Rubro } from "@/lib/airtable";
import { isAdminOrSupervisor, isAdmin } from "@/lib/roles";
import { useVolverAlListado } from "@/lib/listadoFiltrosNav";
import { estaReabierta, puedeReabrirse, DIAS_REAPERTURA } from "@/lib/ordenesReapertura";

export default function OrdenDetallePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const volverHref = useVolverAlListado("/ordenes-servicio");
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<Orden | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [kardexMap, setKardexMap] = useState<Map<string, Kardex>>(new Map());
  const [rubroMap, setRubroMap] = useState<Map<string, Rubro>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; filename: string; kardexId: number } | null>(null);

  const [regeneratingPDF, setRegeneratingPDF] = useState(false);

  // Inline form states
  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [fechaPagoInput, setFechaPagoInput] = useState("");

  // Tax fields for factura form
  const [fechaFactura, setFechaFactura] = useState("");
  const [pctIVA, setPctIVA] = useState("19");
  const [pctReteFuente, setPctReteFuente] = useState("4");
  const [pctReteICA, setPctReteICA] = useState("0.414");
  const [pctReteIVA, setPctReteIVA] = useState("15");

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);
  const canWrite = isAdmin(session?.user?.rol);

  useEffect(() => {
    loadOrden();
  }, [ordenId]);

  async function loadOrden() {
    try {
      setLoading(true);
      setError(null);

      const ordenData = await getOrdenById(ordenId);

      if (!ordenData) {
        setError("Orden no encontrada");
        return;
      }

      setOrden(ordenData);

      const itemsData = await getItemsOrden(ordenId);
      setItems(itemsData);

      const kardexIds = itemsData
        .filter(item => item.fields.Kardex && item.fields.Kardex.length > 0)
        .map(item => item.fields.Kardex![0]);

      if (kardexIds.length > 0) {
        const kardexData = await getKardexByIds(kardexIds);
        const kardexMapTemp = new Map<string, Kardex>();
        kardexData.forEach(k => kardexMapTemp.set(k.id, k));
        setKardexMap(kardexMapTemp);
      }

      // Load Rubro names
      const rubroIds = itemsData
        .filter(item => item.fields.Rubro && item.fields.Rubro.length > 0)
        .map(item => item.fields.Rubro![0]);

      if (rubroIds.length > 0) {
        const rubroData = await getRubrosByIds(rubroIds);
        const rubroMapTemp = new Map<string, Rubro>();
        rubroData.forEach(r => rubroMapTemp.set(r.id, r));
        setRubroMap(rubroMapTemp);
      }

    } catch (err) {
      console.error("Error loading orden:", err);
      setError("Error al cargar la orden");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Admin actions
  // Computed tax amounts for the factura form
  const facturaSubtotal = orden?.fields.Total || 0;
  const facturaMontoIVA = facturaSubtotal * (parseFloat(pctIVA) || 0) / 100;
  const facturaMontoReteFuente = facturaSubtotal * (parseFloat(pctReteFuente) || 0) / 100;
  const facturaMontoReteICA = facturaSubtotal * (parseFloat(pctReteICA) || 0) / 100;
  const facturaMontoReteIVA = facturaMontoIVA * (parseFloat(pctReteIVA) || 0) / 100;
  const facturaTotalNeto = facturaSubtotal + facturaMontoIVA - facturaMontoReteFuente - facturaMontoReteICA - facturaMontoReteIVA;

  async function handleSubirFactura() {
    if (!facturaFile || !numeroFactura.trim()) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const formData = new FormData();
      formData.append("action", "subir-factura");
      formData.append("factura", facturaFile);
      formData.append("numeroFactura", numeroFactura.trim());
      formData.append("fechaFactura", fechaFactura);
      formData.append("porcentajeIVA", String(parseFloat(pctIVA) || 0));
      formData.append("montoIVA", String(Math.round(facturaMontoIVA)));
      formData.append("porcentajeReteFuente", String(parseFloat(pctReteFuente) || 0));
      formData.append("montoReteFuente", String(Math.round(facturaMontoReteFuente)));
      formData.append("porcentajeReteICA", String(parseFloat(pctReteICA) || 0));
      formData.append("montoReteICA", String(Math.round(facturaMontoReteICA)));
      formData.append("porcentajeReteIVA", String(parseFloat(pctReteIVA) || 0));
      formData.append("montoReteIVA", String(Math.round(facturaMontoReteIVA)));
      // TotalNeto is calculated client-side, not stored in Airtable

      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: "Factura subida correctamente. La orden ahora esta en estado Facturada." });
        setShowFacturaForm(false);
        setNumeroFactura("");
        setFacturaFile(null);
        setFechaFactura("");
        setPctIVA("19");
        setPctReteFuente("4");
        setPctReteICA("0.414");
        setPctReteIVA("15");
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al subir la factura" });
      }
    } catch (err) {
      console.error("Error subiendo factura:", err);
      setActionMessage({ type: "error", text: "Error al subir la factura" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCambiarEstado(nuevoEstado: "Pagada" | "Rechazada") {
    let motivoRechazo = "";
    if (nuevoEstado === "Rechazada") {
      const motivo = window.prompt(
        "Rechazar esta orden:\n\nLos kardex vinculados volverán a \"Por Pagar\" y el coordinador recibirá un correo con el motivo para rehacer la orden con los valores correctos. La orden rechazada queda como registro.\n\nEscribe el motivo del rechazo:"
      );
      if (motivo === null) return;
      if (!motivo.trim()) {
        setActionMessage({ type: "error", text: "El motivo del rechazo es obligatorio" });
        return;
      }
      motivoRechazo = motivo.trim();
    }

    if (nuevoEstado === "Pagada" && !fechaPagoInput) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const bodyData: Record<string, string> = { action: "cambiar-estado", estado: nuevoEstado };
      if (nuevoEstado === "Pagada") {
        bodyData.fechaPago = fechaPagoInput;
      }
      if (nuevoEstado === "Rechazada") {
        bodyData.motivo = motivoRechazo;
      }

      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: data.message || `Orden marcada como ${nuevoEstado}` });
        setShowPagoForm(false);
        setFechaPagoInput("");
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al cambiar el estado" });
      }
    } catch (err) {
      console.error("Error cambiando estado:", err);
      setActionMessage({ type: "error", text: "Error al cambiar el estado" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDevolverEnviada() {
    const motivo = window.prompt(
      "Devolver esta orden Facturada a Enviada (caso excepcional):\n\nSe retira la factura adjunta (queda anotada en Observaciones con su número) y la orden vuelve a Enviada para poder reabrirla, eliminarla y rehacerla. La factura se vuelve a subir a la orden corregida.\n\nEscribe el motivo:"
    );
    if (motivo === null) return;
    if (!motivo.trim()) {
      setActionMessage({ type: "error", text: "El motivo es obligatorio" });
      return;
    }
    try {
      setActionLoading(true);
      setActionMessage(null);
      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "devolver-enviada", motivo: motivo.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setActionMessage({ type: "success", text: data.message });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al devolver la orden a Enviada" });
      }
    } catch {
      setActionMessage({ type: "error", text: "Error al devolver la orden a Enviada" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReabrir() {
    const motivo = window.prompt(
      `Reabrir esta orden para corrección:\n\nDurante ${DIAS_REAPERTURA} días el coordinador podrá eliminarla y rehacerla aunque el mes esté cerrado (los kardex vuelven a "Por Pagar").\n\nEscribe el motivo de la reapertura:`
    );
    if (motivo === null) return;
    if (!motivo.trim()) {
      setActionMessage({ type: "error", text: "El motivo de la reapertura es obligatorio" });
      return;
    }
    try {
      setActionLoading(true);
      setActionMessage(null);
      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reabrir", motivo: motivo.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setActionMessage({ type: "success", text: data.message });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al reabrir la orden" });
      }
    } catch {
      setActionMessage({ type: "error", text: "Error al reabrir la orden" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCerrarReapertura() {
    try {
      setActionLoading(true);
      setActionMessage(null);
      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cerrar-reapertura" }),
      });
      const data = await response.json();
      if (response.ok) {
        setActionMessage({ type: "success", text: data.message });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al cerrar la reapertura" });
      }
    } catch {
      setActionMessage({ type: "error", text: "Error al cerrar la reapertura" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerarPDF() {
    setRegeneratingPDF(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/ordenes-servicio/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerar-pdf" }),
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: "PDF regenerado correctamente con fotos de bascula." });
        await loadOrden();
      } else {
        setActionMessage({ type: "error", text: data.error || "Error al regenerar el PDF" });
      }
    } catch (err) {
      console.error("Error regenerando PDF:", err);
      setActionMessage({ type: "error", text: "Error al regenerar el PDF" });
    } finally {
      setRegeneratingPDF(false);
    }
  }

  const estadoColors: Record<string, string> = {
    Enviada: "bg-blue-100 text-blue-800 border-blue-300",
    Facturada: "bg-amber-100 text-amber-800 border-amber-300",
    Pagada: "bg-green-700 text-white border-green-800",
    Rechazada: "bg-red-100 text-red-800 border-red-300",
  };

  // Etiquetas globales de concepto (calculadas desde los items cargados)
  const conceptoTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of items) {
      const rubroId = item.fields.Rubro?.[0];
      if (rubroId) {
        const rubro = rubroMap.get(rubroId);
        if (rubro?.fields.Nombre) tags.add(rubro.fields.Nombre);
      }
    }
    return [...tags];
  }, [items, rubroMap]);

  const conceptoColorPalette = [
    "bg-blue-100 text-blue-800",
    "bg-emerald-100 text-emerald-800",
    "bg-purple-100 text-purple-800",
    "bg-orange-100 text-orange-800",
    "bg-pink-100 text-pink-800",
    "bg-cyan-100 text-cyan-800",
    "bg-yellow-100 text-yellow-800",
    "bg-rose-100 text-rose-800",
  ];

  const getConceptoColor = (concepto: string) => {
    if (concepto === "Transporte") return "bg-blue-100 text-blue-800";
    let hash = 0;
    for (let i = 0; i < concepto.length; i++) {
      hash = concepto.charCodeAt(i) + ((hash << 5) - hash);
    }
    return conceptoColorPalette[Math.abs(hash) % conceptoColorPalette.length];
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando orden...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error || !orden) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || "Orden no encontrada"}</p>
            <Link
              href={volverHref}
              className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Volver a ordenes
            </Link>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  const numeroOrden = orden.fields.NumeroOrden || "S/N";
  const fechaPedido = orden.fields["Fecha de pedido"] || "";
  const beneficiario = orden.fields.RazonSocial?.[0] || "Sin beneficiario";
  const coordinador = orden.fields.NombreCoordinador?.[0] || "Sin coordinador";
  const estado = orden.fields.Estado || "Sin estado";
  const reabierta = estaReabierta(orden.fields);
  const observaciones = orden.fields.Observaciones || "";
  const total = orden.fields.Total || 0;
  const itemsCount = orden.fields.ItemsOrden?.length || 0;
  const facturaUrl = orden.fields.Factura?.[0]?.url || null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Link
              href={volverHref}
              className="hover:text-[#00d084] transition-colors"
            >
              Ordenes de Servicio
            </Link>
            <span>&rsaquo;</span>
            <span>Orden #{numeroOrden}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">
                Detalle de Orden #{numeroOrden}
              </h1>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold rounded border ${
                  estadoColors[estado] || "bg-gray-100 text-gray-800 border-gray-300"
                }`}
              >
                {estado}
              </span>
              {conceptoTags.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {conceptoTags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${getConceptoColor(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Boton Ver PDF de la orden */}
              {orden.fields.PDF && orden.fields.PDF[0]?.url && (
                <a
                  href={orden.fields.PDF[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Ver PDF Orden
                </a>
              )}
              {/* Boton Regenerar PDF - solo admins */}
              {canWrite && (
                <button
                  onClick={handleRegenerarPDF}
                  disabled={regeneratingPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regeneratingPDF && (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {regeneratingPDF ? "Regenerando PDF..." : "Regenerar PDF"}
                </button>
              )}
              {/* Boton Descargar Factura */}
              {facturaUrl && (
                <a
                  href={facturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Ver Factura
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Regenerating PDF banner */}
        {regeneratingPDF && (
          <div className="mb-4 p-4 rounded-lg border bg-indigo-50 border-indigo-200 text-indigo-800">
            <div className="flex items-center gap-3">
              <span className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
              <div>
                <p className="font-medium">Regenerando PDF con fotos de bascula...</p>
                <p className="text-sm text-indigo-600">Este proceso puede tardar entre 10 y 30 segundos. No cierre esta pagina.</p>
              </div>
            </div>
          </div>
        )}

        {/* Banner de orden rechazada: registro solo informativo */}
        {estado === "Rechazada" && (
          <div className="mb-4 p-4 rounded-lg border-2 bg-red-50 border-red-300">
            <p className="font-bold text-red-800 mb-1">
              ❌ Esta orden fue rechazada{orden.fields.rechazo_en ? ` el ${new Date(orden.fields.rechazo_en).toLocaleDateString("es-CO")}` : ""}{orden.fields.rechazo_por ? ` por ${orden.fields.rechazo_por}` : " por administración"}
            </p>
            {orden.fields.rechazo_motivo && (
              <p className="text-sm text-red-800">Motivo: {orden.fields.rechazo_motivo}</p>
            )}
            <p className="text-sm text-red-700 mt-1">
              Sus registros de kardex fueron <strong>liberados en el momento del rechazo</strong> (volvieron a &quot;Por Pagar&quot;). Esta orden es <strong>solo informativa</strong> — no se puede editar ni eliminar.
            </p>
            <p className="text-sm text-red-900 font-bold mt-2">
              📋 Para arreglar el problema debes crear una orden NUEVA: selecciona esos mismos kardex y esta vez ingresa los valores corregidos.
            </p>
            <Link
              href="/ordenes-servicio-v2/nueva"
              className="inline-block mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              + Crear la orden nueva con los kardex liberados →
            </Link>
          </div>
        )}

        {/* Banner de reapertura para corrección */}
        {reabierta && (
          <div className="mb-4 p-4 rounded-lg border-2 bg-orange-50 border-orange-300">
            <p className="font-bold text-orange-800 mb-1">
              🔓 Orden reabierta para corrección hasta el {orden.fields.reabierta_hasta?.slice(0, 10)}
            </p>
            <p className="text-sm text-orange-800">
              {orden.fields.reapertura_por ? `Reabierta por ${orden.fields.reapertura_por}. ` : ""}
              Motivo: {orden.fields.reapertura_motivo || "—"}
            </p>
            <p className="text-sm text-orange-700 mt-1">
              Mientras esté reabierta, la orden puede <strong>eliminarse aunque el mes esté cerrado</strong> — sus kardex vuelven a &quot;Por Pagar&quot; y podrás usarlos en la orden corregida. La marca se apaga sola al vencer.
            </p>
          </div>
        )}

        {/* Action messages */}
        {actionMessage && (
          <div className={`mb-4 p-4 rounded-lg border ${
            actionMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <p>{actionMessage.text}</p>
          </div>
        )}

        {/* Admin Actions Panel */}
        {canWrite && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">Acciones de Administrador</h3>
            <div className="flex flex-wrap gap-3">
              {/* Subir Factura - solo si estado es "Enviada" */}
              {estado === "Enviada" && !showFacturaForm && (
                <button
                  onClick={() => setShowFacturaForm(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Subir Factura (PDF)
                </button>
              )}

              {/* Devolver a Enviada - caso excepcional para corregir una
                  orden Facturada con valores errados */}
              {estado === "Facturada" && (
                <button
                  onClick={handleDevolverEnviada}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Retira la factura (queda anotada en Observaciones) y devuelve la orden a Enviada para poder corregirla"
                >
                  ↩️ Retirar factura y devolver a Enviada
                </button>
              )}

              {/* Marcar como Pagada - solo si estado es "Facturada" */}
              {estado === "Facturada" && !showPagoForm && (
                <button
                  onClick={() => setShowPagoForm(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Marcar como Pagada
                </button>
              )}

              {/* Rechazar - solo si estado es "Enviada" */}
              {estado === "Enviada" && (
                <button
                  onClick={() => handleCambiarEstado("Rechazada")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Procesando..." : "Rechazar Orden"}
                </button>
              )}

              {/* Reabrir para corrección - Enviada/Borrador con mes cerrado */}
              {puedeReabrirse(orden.fields) && !reabierta && (
                <button
                  onClick={handleReabrir}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Permite al coordinador eliminar y rehacer esta orden durante ${DIAS_REAPERTURA} días aunque el mes esté cerrado`}
                >
                  🔓 Reabrir para corrección
                </button>
              )}
              {reabierta && (
                <button
                  onClick={handleCerrarReapertura}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cerrar reapertura
                </button>
              )}

              {/* Message when no actions available */}
              {estado !== "Enviada" && estado !== "Facturada" && (
                <p className="text-sm text-gray-500 italic">
                  No hay acciones disponibles para ordenes en estado &quot;{estado}&quot;
                </p>
              )}
            </div>

            {/* Inline Factura Form */}
            {showFacturaForm && estado === "Enviada" && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-bold text-amber-800 mb-3">Subir Factura e Impuestos</h4>
                <div className="space-y-4">
                  {/* Row 1: Numero factura + Fecha factura + Archivo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        N.° de factura <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={numeroFactura}
                        onChange={(e) => setNumeroFactura(e.target.value)}
                        placeholder="Ej: FAC-001234"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de factura
                      </label>
                      <input
                        type="date"
                        value={fechaFactura}
                        onChange={(e) => setFechaFactura(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Archivo PDF <span className="text-red-500">*</span>
                      </label>
                      <input
                        ref={facturaInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setFacturaFile(file);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => facturaInputRef.current?.click()}
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          Seleccionar PDF
                        </button>
                        {facturaFile && (
                          <span className="text-sm text-gray-600 truncate">{facturaFile.name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tax breakdown */}
                  <div className="bg-white border border-amber-200 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-gray-600 uppercase mb-3">Desglose de Impuestos</h5>
                    <div className="text-sm text-gray-700 mb-3">
                      Base gravable (Subtotal): <span className="font-bold text-gray-900">{formatCurrency(facturaSubtotal)}</span>
                    </div>

                    <div className="space-y-2">
                      {/* IVA */}
                      <div className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-700 font-medium">+ IVA</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={pctIVA}
                            onChange={(e) => setPctIVA(e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            step="0.01"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-green-700 ml-auto">
                          +{formatCurrency(Math.round(facturaMontoIVA))}
                        </span>
                      </div>

                      {/* ReteFuente */}
                      <div className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-700 font-medium">- ReteFuente</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={pctReteFuente}
                            onChange={(e) => setPctReteFuente(e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            step="0.01"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-red-700 ml-auto">
                          -{formatCurrency(Math.round(facturaMontoReteFuente))}
                        </span>
                      </div>

                      {/* ReteICA */}
                      <div className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-700 font-medium">- ReteICA</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={pctReteICA}
                            onChange={(e) => setPctReteICA(e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            step="0.001"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-red-700 ml-auto">
                          -{formatCurrency(Math.round(facturaMontoReteICA))}
                        </span>
                      </div>

                      {/* ReteIVA */}
                      <div className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-700 font-medium">- ReteIVA</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={pctReteIVA}
                            onChange={(e) => setPctReteIVA(e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            step="0.01"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">% del IVA</span>
                        </div>
                        <span className="text-sm font-mono font-semibold text-red-700 ml-auto">
                          -{formatCurrency(Math.round(facturaMontoReteIVA))}
                        </span>
                      </div>

                      {/* Total */}
                      <div className="border-t-2 border-gray-300 pt-2 mt-2 flex items-center justify-between">
                        <span className="text-base font-bold text-gray-900">TOTAL A PAGAR</span>
                        <span className="text-xl font-bold font-mono text-[#00d084]">
                          {formatCurrency(Math.round(facturaTotalNeto))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSubirFactura}
                      disabled={actionLoading || !numeroFactura.trim() || !facturaFile}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? "Subiendo..." : "Subir Factura"}
                    </button>
                    <button
                      onClick={() => { setShowFacturaForm(false); setNumeroFactura(""); setFacturaFile(null); setFechaFactura(""); }}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Pago Form */}
            {showPagoForm && estado === "Facturada" && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-bold text-green-800 mb-3">Confirmar Pago</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de pago <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={fechaPagoInput}
                      onChange={(e) => setFechaPagoInput(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleCambiarEstado("Pagada")}
                      disabled={actionLoading || !fechaPagoInput}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? "Procesando..." : "Confirmar Pago"}
                    </button>
                    <button
                      onClick={() => { setShowPagoForm(false); setFechaPagoInput(""); }}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenido de la orden - Solo lectura */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
            Informacion de la Orden
          </h2>

          {/* Datos basicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de pedido
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {fechaPedido
                  ? new Date(fechaPedido + 'T00:00:00').toLocaleDateString("es-CO")
                  : "Sin fecha"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beneficiario
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-medium">
                {beneficiario}
              </div>
            </div>

            {canViewAll && (
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero de items
              </label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                {itemsCount} {itemsCount === 1 ? "item" : "items"}
              </div>
            </div>

            {estado === "Pagada" && orden.fields.FechaPago && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pago
                </label>
                <div className="px-4 py-2 bg-green-50 border border-green-300 rounded-lg text-green-800 font-medium">
                  {new Date(orden.fields.FechaPago + 'T00:00:00').toLocaleDateString("es-CO")}
                </div>
              </div>
            )}
          </div>

          {/* Factura info */}
          {facturaUrl && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-amber-800">Factura del proveedor</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {orden.fields.NumeroFactura && (
                      <p className="text-sm text-amber-800">
                        N.° Factura: <span className="font-semibold">{orden.fields.NumeroFactura}</span>
                      </p>
                    )}
                    {orden.fields.FechaFactura && (
                      <p className="text-sm text-amber-800">
                        Fecha: <span className="font-semibold">{new Date(orden.fields.FechaFactura + 'T00:00:00').toLocaleDateString("es-CO")}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Archivo: {orden.fields.Factura?.[0]?.filename || "factura.pdf"}
                  </p>
                </div>
                <a
                  href={facturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors shrink-0"
                >
                  Descargar Factura
                </a>
              </div>

              {/* Tax breakdown (only if tax data exists — check MontoIVA presence) */}
              {orden.fields.MontoIVA !== undefined && orden.fields.MontoIVA !== null && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Desglose de Impuestos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Base gravable (Subtotal)</span>
                      <span className="font-mono font-semibold">{formatCurrency(total)}</span>
                    </div>
                    {(orden.fields.MontoIVA ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-700">+ IVA ({(orden.fields.PorcentajeIVA || 0).toFixed(1)}%)</span>
                        <span className="font-mono font-semibold text-green-700">+{formatCurrency(orden.fields.MontoIVA || 0)}</span>
                      </div>
                    )}
                    {(orden.fields.MontoReteFuente ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-700">- ReteFuente ({(orden.fields.PorcentajeReteFuente || 0).toFixed(1)}%)</span>
                        <span className="font-mono font-semibold text-red-700">-{formatCurrency(orden.fields.MontoReteFuente || 0)}</span>
                      </div>
                    )}
                    {(orden.fields.MontoReteICA ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-700">- ReteICA ({(orden.fields.PorcentajeReteICA || 0).toFixed(3)}%)</span>
                        <span className="font-mono font-semibold text-red-700">-{formatCurrency(orden.fields.MontoReteICA || 0)}</span>
                      </div>
                    )}
                    {(orden.fields.MontoReteIVA ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-700">- ReteIVA ({(orden.fields.PorcentajeReteIVA || 0).toFixed(1)}% del IVA)</span>
                        <span className="font-mono font-semibold text-red-700">-{formatCurrency(orden.fields.MontoReteIVA || 0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-300 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total a Pagar</span>
                    <span className="text-lg font-bold font-mono text-[#00d084]">{formatCurrency(total + (orden.fields.MontoIVA || 0) - (orden.fields.MontoReteFuente || 0) - (orden.fields.MontoReteICA || 0) - (orden.fields.MontoReteIVA || 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Soportes de Bascula de la Orden */}
          {orden.fields["Soporte de Bascula"] && orden.fields["Soporte de Bascula"].length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-bold text-blue-800 mb-3">
                Soportes de Bascula ({orden.fields["Soporte de Bascula"].length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {orden.fields["Soporte de Bascula"].map((soporte, index) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(soporte.filename);
                  return (
                    <div key={soporte.id || index} className="relative group">
                      {isImage ? (
                        <button
                          onClick={() => setSelectedPhoto({
                            url: soporte.url,
                            filename: soporte.filename,
                            kardexId: 0,
                          })}
                          className="block w-full"
                        >
                          <img
                            src={`/api/image-proxy?url=${encodeURIComponent(soporte.url)}`}
                            alt={soporte.filename}
                            className="w-full h-28 object-cover rounded border border-blue-300 group-hover:border-blue-500 group-hover:shadow-md transition-all"
                          />
                        </button>
                      ) : (
                        <a
                          href={soporte.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative flex items-center justify-center w-full h-28 bg-white rounded border border-blue-300 hover:border-blue-500 hover:shadow-md transition-all overflow-hidden"
                        >
                          {soporte.thumbnails?.large?.url ? (
                            <img
                              src={`/api/image-proxy?url=${encodeURIComponent(soporte.thumbnails.large.url)}`}
                              alt={soporte.filename}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <div className="text-center px-2">
                              <span className="block text-2xl mb-1">&#128196;</span>
                              <span className="text-xs text-blue-700 break-all">{soporte.filename}</span>
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1 rounded">
                            PDF
                          </span>
                        </a>
                      )}
                      <p className="text-xs text-blue-600 mt-1 truncate text-center">{soporte.filename}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Items de la Orden</h3>

            {items.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                No hay items en esta orden
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Descripcion</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rubro</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Bascula</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Forma Cobro</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const tipoItem = item.fields.TipoItem || "";
                      const formaCobro = item.fields.FormaCobro || "";
                      const cantidad = item.fields.Cantidad || 0;
                      const precioUnitario = item.fields.PrecioUnitario || 0;
                      const subtotal = item.fields["Cálculo"] || (cantidad * precioUnitario);
                      const nombre = item.fields.Name || "Sin nombre";

                      const kardexId = item.fields.Kardex?.[0];
                      const kardex = kardexId ? kardexMap.get(kardexId) : undefined;
                      const tipoMovimiento = kardex?.fields.TipoMovimiento;
                      const fotoBascula = kardex?.fields.soportebascula?.[0];

                      // For CATALOGO items, use the rubro name instead of auto-number Name field
                      const rubroId = item.fields.Rubro?.[0];
                      const rubroForName = rubroId ? rubroMap.get(rubroId) : undefined;
                      const displayName = tipoItem === "CON Kardex" && kardex
                        ? `Kardex #${kardex.fields.idkardex}`
                        : rubroForName?.fields.Nombre || nombre;

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-200 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          {/* Tipo */}
                          <td className="px-4 py-3">
                            <div className="mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-bold rounded ${
                                  tipoItem === "CON Kardex"
                                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                                    : "bg-purple-100 text-purple-700 border border-purple-300"
                                }`}
                              >
                                {tipoItem === "CON Kardex" ? "KARDEX" : "CATALOGO"}
                              </span>
                            </div>
                            {tipoMovimiento && (
                              <div>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  tipoMovimiento === "ENTRADA"
                                    ? "bg-green-100 text-green-700 border border-green-300"
                                    : "bg-red-100 text-red-700 border border-red-300"
                                }`}>
                                  {tipoMovimiento}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Descripcion/Nombre */}
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {displayName}
                            {item.fields.Descripcion && (
                              <p className="text-xs text-gray-500 mt-0.5">{item.fields.Descripcion}</p>
                            )}
                          </td>

                          {/* Rubro */}
                          <td className="px-4 py-3 text-sm">
                            {(() => {
                              const rubroId = item.fields.Rubro?.[0];
                              if (rubroId) {
                                const rubro = rubroMap.get(rubroId);
                                const rubroNombre = rubro?.fields.Nombre || "Rubro";
                                return (
                                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getConceptoColor(rubroNombre)}`}>
                                    {rubroNombre}
                                  </span>
                                );
                              }
                              return <span className="text-gray-400">—</span>;
                            })()}
                          </td>

                          {/* Foto Bascula */}
                          <td className="px-4 py-3 text-center">
                            {fotoBascula ? (() => {
                              const esPdf =
                                fotoBascula.type === "application/pdf" ||
                                /\.pdf$/i.test(fotoBascula.filename || "");
                              if (esPdf) {
                                const thumb = fotoBascula.thumbnails?.large?.url;
                                return (
                                  <a
                                    href={fotoBascula.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block group relative"
                                    title={`Abrir soporte PDF - Kardex #${kardex?.fields.idkardex}`}
                                  >
                                    {thumb ? (
                                      <img
                                        src={`/api/image-proxy?url=${encodeURIComponent(thumb)}`}
                                        alt={`Soporte PDF - Kardex #${kardex?.fields.idkardex}`}
                                        className="w-12 h-12 object-cover rounded border border-gray-300 group-hover:border-[#00d084] group-hover:shadow-md transition-all"
                                      />
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-12 h-12 rounded border border-gray-300 bg-gray-50 text-lg">
                                        📄
                                      </span>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[8px] font-bold px-1 rounded leading-3">
                                      PDF
                                    </span>
                                  </a>
                                );
                              }
                              return (
                                <button
                                  onClick={() => setSelectedPhoto({
                                    url: fotoBascula.url,
                                    filename: fotoBascula.filename,
                                    kardexId: kardex?.fields.idkardex || 0,
                                  })}
                                  className="inline-block group relative"
                                  title={`Ver foto - Kardex #${kardex?.fields.idkardex}`}
                                >
                                  <img
                                    src={`/api/image-proxy?url=${encodeURIComponent(fotoBascula.url)}`}
                                    alt={`Bascula - Kardex #${kardex?.fields.idkardex}`}
                                    className="w-12 h-12 object-cover rounded border border-gray-300 group-hover:border-[#00d084] group-hover:shadow-md transition-all"
                                  />
                                </button>
                              );
                            })() : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Cantidad */}
                          <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">
                            {cantidad.toFixed(2)}
                          </td>

                          {/* Forma de Cobro */}
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formaCobro}
                          </td>

                          {/* Precio Unitario */}
                          <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">
                            {formatCurrency(precioUnitario)}
                          </td>

                          {/* Subtotal */}
                          <td className="px-4 py-3 text-right text-sm font-mono font-bold text-[#00d084]">
                            {formatCurrency(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">
                {orden.fields.MontoIVA !== undefined && orden.fields.MontoIVA !== null ? "SUBTOTAL:" : "TOTAL:"}
              </span>
              <span className={`text-2xl font-bold ${orden.fields.MontoIVA !== undefined && orden.fields.MontoIVA !== null ? "text-gray-600" : "text-[#00d084]"}`}>
                {formatCurrency(total)}
              </span>
            </div>
            {orden.fields.MontoIVA !== undefined && orden.fields.MontoIVA !== null && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-xl font-bold text-gray-900">TOTAL A PAGAR:</span>
                <span className="text-2xl font-bold text-[#00d084]">
                  {formatCurrency(total + (orden.fields.MontoIVA || 0) - (orden.fields.MontoReteFuente || 0) - (orden.fields.MontoReteICA || 0) - (orden.fields.MontoReteIVA || 0))}
                </span>
              </div>
            )}
          </div>

          {/* Observaciones */}
          {observaciones && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                {observaciones}
              </div>
            </div>
          )}

          {/* Boton volver */}
          <div className="mt-6 pt-6 border-t border-gray-300">
            <Link
              href={volverHref}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Volver a ordenes
            </Link>
          </div>
        </div>
      </div>

      {/* Lightbox para fotos de bascula */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
          >
            &times;
          </button>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-white text-sm font-medium">
              Kardex #{selectedPhoto.kardexId} — {selectedPhoto.filename}
            </div>
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(selectedPhoto.url)}`}
              alt={selectedPhoto.filename}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
