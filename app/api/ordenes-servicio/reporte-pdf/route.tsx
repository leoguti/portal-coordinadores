import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllOrdenes, getOrdenesCoordinador, computeConceptosOrdenes, type Orden } from "@/lib/airtable";
import { groupOrdenesByMes } from "@/lib/ordenesGrouping";
import { isAdminOrSupervisor } from "@/lib/roles";
import { renderToBuffer } from "@react-pdf/renderer";
import ReporteOrdenesPDF from "@/components/pdf/ReporteOrdenesPDF";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const viewAll = searchParams.get("viewAll") === "true";
    const filtroCoordinador = searchParams.get("filtroCoordinador") || "";
    const filtroBeneficiario = searchParams.get("filtroBeneficiario") || "";
    const filtroEstado = searchParams.get("filtroEstado") || "";
    const filtroMes = searchParams.get("filtroMes") || "";

    // Fetch ordenes based on role
    const canViewAll = isAdminOrSupervisor(session.user.rol);
    let ordenes: Orden[];
    if (canViewAll && viewAll) {
      ordenes = await getAllOrdenes();
    } else {
      ordenes = await getOrdenesCoordinador(session.user.coordinatorRecordId);
    }

    // Apply filters (same logic as page)
    const ordenesFiltradas = ordenes.filter((orden) => {
      if (filtroCoordinador && (orden.fields.NombreCoordinador?.[0] || "") !== filtroCoordinador) return false;
      if (filtroBeneficiario && (orden.fields.RazonSocial?.[0] || "") !== filtroBeneficiario) return false;
      if (filtroEstado && orden.fields.Estado !== filtroEstado) return false;
      if (filtroMes && (orden.fields["Fecha de pedido"] || "").substring(0, 7) !== filtroMes) return false;
      return true;
    });

    // Compute conceptos
    const ordenIds = ordenesFiltradas.map((o) => o.id);
    const conceptos = await computeConceptosOrdenes(ordenIds);

    // Group
    const gruposPorMes = groupOrdenesByMes(ordenesFiltradas);

    // Totals (include taxes: subtotal + IVA - retenciones)
    const grandTotal = ordenesFiltradas.reduce((sum, o) => {
      const st = o.fields.Total || 0;
      return sum + (o.fields.MontoIVA !== undefined
        ? st + (o.fields.MontoIVA || 0) - (o.fields.MontoReteFuente || 0) - (o.fields.MontoReteICA || 0) - (o.fields.MontoReteIVA || 0)
        : st);
    }, 0);
    const totalOrdenes = ordenesFiltradas.length;

    // Build filtros summary
    const filtros = {
      coordinador: filtroCoordinador || undefined,
      beneficiario: filtroBeneficiario || undefined,
      estado: filtroEstado || undefined,
      mes: filtroMes || undefined,
    };

    // Render PDF
    const buffer = await renderToBuffer(
      <ReporteOrdenesPDF
        gruposPorMes={gruposPorMes}
        conceptos={conceptos}
        filtros={filtros}
        grandTotal={grandTotal}
        totalOrdenes={totalOrdenes}
      />
    );

    const filename = `reporte-ordenes-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating reporte PDF:", error);
    return NextResponse.json(
      { error: "Error al generar el reporte PDF" },
      { status: 500 }
    );
  }
}
