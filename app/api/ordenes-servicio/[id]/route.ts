import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteOrdenServicio, updateEstadoOrden, uploadFacturaOrden, getOrdenById, regenerarPDFOrden, getItemsOrden, getKardexByIds } from "@/lib/airtable";
import { puedeModificarFecha, getMensajeErrorFecha } from "@/lib/dateValidations";

// Allow up to 60 seconds for PDF regeneration (fetches images, generates PDF, uploads)
export const maxDuration = 60;

/**
 * DELETE /api/ordenes-servicio/[id]
 * Elimina una orden de servicio
 * Validaciones:
 * - No se puede eliminar si estado es "Facturada" o "Pagada"
 * - Regla de 7 días: solo se elimina si la fecha está en período modificable
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: ordenId } = await params;

    // Verificar que la orden existe
    const orden = await getOrdenById(ordenId);
    if (!orden) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // No se puede eliminar si está Facturada o Pagada
    const estado = orden.fields.Estado;
    if (estado === "Facturada" || estado === "Pagada") {
      return NextResponse.json(
        { error: `No se puede eliminar una orden en estado "${estado}"` },
        { status: 403 }
      );
    }

    // Validar restricción de fecha (regla de 7 días)
    const fechaPedido = orden.fields["Fecha de pedido"];
    if (fechaPedido && !puedeModificarFecha(fechaPedido)) {
      return NextResponse.json(
        { error: getMensajeErrorFecha() },
        { status: 403 }
      );
    }

    // Validar que los Kardex vinculados no quedarían fuera de fecha
    const items = await getItemsOrden(ordenId);
    const kardexIds = items
      .filter(item => item.fields.Kardex && item.fields.Kardex.length > 0)
      .map(item => item.fields.Kardex![0]);

    if (kardexIds.length > 0) {
      const kardexRecords = await getKardexByIds(kardexIds);
      const kardexFueraFecha = kardexRecords.filter(
        k => k.fields.fechakardex && !puedeModificarFecha(k.fields.fechakardex)
      );

      if (kardexFueraFecha.length > 0) {
        const detalles = kardexFueraFecha
          .map(k => {
            const id = k.fields.idkardex || k.id;
            const fecha = k.fields.fechakardex || "sin fecha";
            return `#${id} del ${fecha}`;
          })
          .join(", ");

        return NextResponse.json(
          {
            error: `No se puede eliminar esta orden porque contiene Kardex con fecha fuera del periodo permitido (${detalles}). Si se elimina, estos registros no podrán ser reasignados a una nueva orden.`,
          },
          { status: 400 }
        );
      }
    }

    console.log(`Deleting orden ${ordenId}...`);

    const success = await deleteOrdenServicio(ordenId);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar la orden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Orden eliminada correctamente" });
  } catch (error) {
    console.error("Error in DELETE /api/ordenes-servicio/[id]:", error);
    return NextResponse.json(
      { error: "Error al eliminar la orden" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ordenes-servicio/[id]
 * Actualizar estado o subir factura de una orden de servicio
 * Solo para administradores
 *
 * Body (JSON): { action: "cambiar-estado", estado: "Pagada" | "Rechazada" }
 * Body (FormData): action="subir-factura", factura=File
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo administradores pueden cambiar estado y subir facturas
    if (session.user.rol !== "Administrador") {
      return NextResponse.json(
        { error: "Solo los administradores pueden realizar esta acción" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;

    // Check content type to determine if it's JSON or FormData
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload (subir factura)
      const formData = await request.formData();
      const action = formData.get("action") as string;

      if (action !== "subir-factura") {
        return NextResponse.json(
          { error: "Acción no válida" },
          { status: 400 }
        );
      }

      const file = formData.get("factura") as File;
      if (!file) {
        return NextResponse.json(
          { error: "No se proporcionó archivo de factura" },
          { status: 400 }
        );
      }

      const numeroFactura = (formData.get("numeroFactura") as string || "").trim();
      if (!numeroFactura) {
        return NextResponse.json(
          { error: "El número de factura es obligatorio" },
          { status: 400 }
        );
      }

      // Parse tax fields from FormData
      const fechaFactura = (formData.get("fechaFactura") as string || "").trim();
      const porcentajeIVA = parseFloat(formData.get("porcentajeIVA") as string || "0");
      const montoIVA = parseFloat(formData.get("montoIVA") as string || "0");
      const porcentajeReteFuente = parseFloat(formData.get("porcentajeReteFuente") as string || "0");
      const montoReteFuente = parseFloat(formData.get("montoReteFuente") as string || "0");
      const porcentajeReteICA = parseFloat(formData.get("porcentajeReteICA") as string || "0");
      const montoReteICA = parseFloat(formData.get("montoReteICA") as string || "0");
      const porcentajeReteIVA = parseFloat(formData.get("porcentajeReteIVA") as string || "0");
      const montoReteIVA = parseFloat(formData.get("montoReteIVA") as string || "0");

      // Validate file type
      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: "El archivo debe ser un PDF" },
          { status: 400 }
        );
      }

      // Verify orden exists and is in valid state for factura upload
      const orden = await getOrdenById(ordenId);
      if (!orden) {
        return NextResponse.json(
          { error: "Orden no encontrada" },
          { status: 404 }
        );
      }

      if (orden.fields.Estado !== "Enviada") {
        return NextResponse.json(
          { error: "Solo se puede subir factura a órdenes en estado 'Enviada'" },
          { status: 400 }
        );
      }

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const success = await uploadFacturaOrden(ordenId, buffer, file.name, numeroFactura, {
        fechaFactura: fechaFactura || undefined,
        porcentajeIVA,
        montoIVA,
        porcentajeReteFuente,
        montoReteFuente,
        porcentajeReteICA,
        montoReteICA,
        porcentajeReteIVA,
        montoReteIVA,
      });

      if (!success) {
        return NextResponse.json(
          { error: "Error al subir la factura" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Factura subida y orden marcada como Facturada",
      });
    } else {
      // Handle JSON body (cambiar estado or regenerar PDF)
      const body = await request.json();
      const { action, estado, fechaPago } = body;

      // Handle regenerar-pdf action
      if (action === "regenerar-pdf") {
        try {
          const pdfUrl = await regenerarPDFOrden(ordenId);
          return NextResponse.json({ success: true, pdfUrl });
        } catch (err) {
          console.error("Error regenerating PDF:", err);
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Error al regenerar el PDF" },
            { status: 500 }
          );
        }
      }

      if (action !== "cambiar-estado") {
        return NextResponse.json(
          { error: "Acción no válida" },
          { status: 400 }
        );
      }

      // Verify orden exists
      const orden = await getOrdenById(ordenId);
      if (!orden) {
        return NextResponse.json(
          { error: "Orden no encontrada" },
          { status: 404 }
        );
      }

      const estadoActual = orden.fields.Estado;

      // Validate state transitions
      if (estado === "Pagada") {
        if (estadoActual !== "Facturada") {
          return NextResponse.json(
            { error: "Solo se puede marcar como Pagada una orden Facturada" },
            { status: 400 }
          );
        }
        if (!fechaPago || typeof fechaPago !== "string" || !fechaPago.trim()) {
          return NextResponse.json(
            { error: "La fecha de pago es obligatoria" },
            { status: 400 }
          );
        }
      } else if (estado === "Rechazada") {
        if (estadoActual !== "Enviada") {
          return NextResponse.json(
            { error: "Solo se puede rechazar una orden en estado Enviada" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Estado no válido. Opciones: Pagada, Rechazada" },
          { status: 400 }
        );
      }

      const extraFields = estado === "Pagada" ? { FechaPago: fechaPago } : undefined;
      const success = await updateEstadoOrden(ordenId, estado, extraFields);

      if (!success) {
        return NextResponse.json(
          { error: "Error al actualizar el estado" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Orden marcada como ${estado}`,
      });
    }
  } catch (error) {
    console.error("Error in PATCH /api/ordenes-servicio/[id]:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
