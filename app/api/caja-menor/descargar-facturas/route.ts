import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllGastosCajaMenor, getRubros } from "@/lib/airtable";
import JSZip from "jszip";

/**
 * GET /api/caja-menor/descargar-facturas?coordinadorId=XXX&mes=YYYY-MM
 * Genera un ZIP con todas las facturas aprobadas del mes para el coordinador
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo admin puede descargar
    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede descargar facturas" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const coordinadorId = searchParams.get("coordinadorId");
    const mes = searchParams.get("mes"); // formato YYYY-MM
    const coordinadorNombre = searchParams.get("nombre") || "coordinador";

    if (!coordinadorId || !mes) {
      return NextResponse.json({ error: "Faltan parámetros (coordinadorId, mes)" }, { status: 400 });
    }

    // Obtener todos los gastos
    const allGastos = await getAllGastosCajaMenor();

    // Filtrar: coordinador + mes + aprobado + tiene factura
    const gastosFiltrados = allGastos.filter((g) => {
      const esCoordinador = g.fields.Coordinador?.includes(coordinadorId);
      const esMes = (g.fields.Fecha || "").startsWith(mes);
      const esAprobado = g.fields.Estado === "Aprobado";
      const tieneFactura = g.fields.Factura && g.fields.Factura.length > 0;
      return esCoordinador && esMes && esAprobado && tieneFactura;
    });

    if (gastosFiltrados.length === 0) {
      return NextResponse.json({ error: "No hay facturas aprobadas para descargar en este mes" }, { status: 404 });
    }

    // Crear ZIP
    const zip = new JSZip();

    // Preparar datos para CSV
    const csvRows: string[] = [];
    csvRows.push("Numero,Fecha,Beneficiario,Rubro,Valor,Retencion,ValorNeto,Estado,Archivo");

    // Load rubro names for display
    const rubros = await getRubros();
    const rubroNameMap = new Map(rubros.map(r => [r.id, r.fields.Nombre || "Rubro"]));

    // Descargar cada factura y agregar al ZIP
    for (const gasto of gastosFiltrados) {
      const factura = gasto.fields.Factura?.[0];
      if (!factura?.url) continue;

      const numero = gasto.fields.NumeroGasto || 0;
      const fecha = gasto.fields.Fecha || "";
      const beneficiario = (gasto.fields.RazonSocial?.[0] || "sin-beneficiario")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .substring(0, 30);
      const rubroId = gasto.fields.Rubro?.[0];
      const concepto = rubroId ? rubroNameMap.get(rubroId) || "" : "";
      const valor = gasto.fields.Valor || 0;
      const retencion = gasto.fields.PorcentajeRetencion || 0;
      const valorNeto = valor - (valor * retencion);

      // Extensión del archivo original
      const originalName = factura.filename || "factura";
      const extension = originalName.split(".").pop() || "pdf";

      // Nombre del archivo en el ZIP
      const fileName = `gasto-${numero}_${fecha}_${beneficiario}.${extension}`;

      try {
        // Descargar el archivo
        const response = await fetch(factura.url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          zip.file(fileName, arrayBuffer);

          // Agregar fila al CSV
          csvRows.push(
            `${numero},"${fecha}","${gasto.fields.RazonSocial?.[0] || ""}","${concepto.replace(/"/g, '""')}",${valor},${retencion * 100}%,${valorNeto},"${gasto.fields.Estado}","${fileName}"`
          );
        }
      } catch (err) {
        console.error(`Error descargando factura del gasto ${numero}:`, err);
      }
    }

    // Agregar CSV al ZIP
    const csvContent = csvRows.join("\n");
    zip.file("resumen_gastos.csv", csvContent);

    // Generar el ZIP
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    // Formatear nombre del mes
    const [year, month] = mes.split("-");
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthName = monthNames[parseInt(month) - 1] || month;
    const nombreNormalizado = coordinadorNombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const zipFileName = `facturas_${monthName}-${year}_${nombreNormalizado}.zip`;

    // Retornar el ZIP
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generating ZIP:", error);
    return NextResponse.json({ error: "Error interno al generar el ZIP" }, { status: 500 });
  }
}
