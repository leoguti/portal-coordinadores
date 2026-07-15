import React from "react";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { reporteStyles as s } from "./reporteOrdenesStyles";
import LOGO_BASE64 from "./logoBase64";
import type { MesGrupo } from "@/lib/ordenesGrouping";

interface Filtros {
  coordinador?: string;
  beneficiario?: string;
  estado?: string;
  mes?: string;
}

interface ReporteOrdenesPDFProps {
  gruposPorMes: [string, MesGrupo][];
  conceptos: Record<string, string[]>;
  filtros: Filtros;
  grandTotal: number;
  totalOrdenes: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO");

const formatMesLabel = (mesKey: string) => {
  if (mesKey === "sin-fecha") return "Sin fecha";
  const [year, month] = mesKey.split("-");
  const nombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${nombres[parseInt(month) - 1]} ${year}`;
};

// Ordered estado list for consistent display
const ESTADO_ORDER = ["Enviada", "Facturada", "Pagada", "Rechazada"];

const sortEstados = (entries: [string, number][]) =>
  entries.sort((a, b) => {
    const ia = ESTADO_ORDER.indexOf(a[0]);
    const ib = ESTADO_ORDER.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

// Tax helpers
type OrdenLike = { fields: { Total?: number; MontoIVA?: number; MontoReteFuente?: number; MontoReteICA?: number; MontoReteIVA?: number } };

const getRetenciones = (o: OrdenLike) =>
  (o.fields.MontoReteFuente || 0) + (o.fields.MontoReteICA || 0) + (o.fields.MontoReteIVA || 0);

const calcTotalOrden = (o: OrdenLike) => {
  const st = o.fields.Total || 0;
  return o.fields.MontoIVA !== undefined
    ? st + (o.fields.MontoIVA || 0) - getRetenciones(o)
    : st;
};

const sumTax = (ordenes: OrdenLike[]) =>
  ordenes.reduce(
    (acc, o) => {
      acc.subtotal += o.fields.Total || 0;
      acc.iva += o.fields.MontoIVA || 0;
      acc.ret += getRetenciones(o);
      acc.total += calcTotalOrden(o);
      return acc;
    },
    { subtotal: 0, iva: 0, ret: 0, total: 0 }
  );

const ReporteOrdenesPDF: React.FC<ReporteOrdenesPDFProps> = ({
  gruposPorMes,
  conceptos,
  filtros,
  grandTotal,
  totalOrdenes,
}) => {
  const hasFiltros =
    filtros.coordinador || filtros.beneficiario || filtros.estado || filtros.mes;

  // Compute grand estado breakdown
  const grandEstadoCounts: Record<string, number> = {};
  const grandEstadoTotals: Record<string, number> = {};
  gruposPorMes.forEach(([, mesGrupo]) => {
    Object.entries(mesGrupo.estadoCounts).forEach(([estado, count]) => {
      grandEstadoCounts[estado] = (grandEstadoCounts[estado] || 0) + count;
    });
    Object.entries(mesGrupo.estadoTotals).forEach(([estado, total]) => {
      grandEstadoTotals[estado] = (grandEstadoTotals[estado] || 0) + total;
    });
  });

  // Grand tax totals
  const allOrdenes = gruposPorMes.flatMap(([, mg]) => mg.beneficiarios.flatMap(([, bg]) => bg.ordenes));
  const grandTax = sumTax(allOrdenes);
  const hasTaxGlobal = grandTax.iva > 0 || grandTax.ret > 0;

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Image src={LOGO_BASE64} style={s.logo} />
          <View style={s.headerRight}>
            <Text style={s.title}>REPORTE DE ORDENES DE SERVICIO</Text>
            <Text style={s.dateText}>
              Generado el {new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Filtros aplicados */}
        {hasFiltros && (
          <View style={s.filtrosContainer}>
            <Text style={s.filtroTag}>
              <Text style={s.filtroLabel}>Filtros: </Text>
              {filtros.coordinador && `Coordinador: ${filtros.coordinador}  `}
              {filtros.beneficiario && `Beneficiario: ${filtros.beneficiario}  `}
              {filtros.estado && `Estado: ${filtros.estado}  `}
              {filtros.mes && `Mes: ${formatMesLabel(filtros.mes)}`}
            </Text>
          </View>
        )}

        {/* Groups */}
        {gruposPorMes.map(([mesKey, mesGrupo]) => (
          <View key={mesKey}>
            {mesGrupo.beneficiarios.map(([beneficiario, benGrupo]) => {
              const tax = sumTax(benGrupo.ordenes);
              const hasTax = tax.iva > 0 || tax.ret > 0;

              return (
                <View key={`${mesKey}|${beneficiario}`}>
                  {/* Combined header + table header kept together */}
                  <View wrap={false}>
                    <View style={s.groupHeader}>
                      <Text style={[s.groupHeaderText, s.colLabel]}>
                        {formatMesLabel(mesKey)} {"\u00B7"} {beneficiario} {"\u00B7"} {benGrupo.ordenes.length}{" "}
                        {benGrupo.ordenes.length === 1 ? "orden" : "ordenes"}
                      </Text>
                      <Text style={[s.groupHeaderTotal, s.colMoneySpan]}>
                        {formatCurrency(benGrupo.total)}
                      </Text>
                      <View style={s.colFPago} />
                    </View>

                    {/* Table header */}
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderText, s.colOrden]}>#</Text>
                      <Text style={[s.tableHeaderText, s.colFecha]}>Fecha</Text>
                      <Text style={[s.tableHeaderText, s.colFactura]}>Factura</Text>
                      <Text style={[s.tableHeaderText, s.colConcepto]}>Concepto</Text>
                      <Text style={[s.tableHeaderText, s.colEstado]}>Estado</Text>
                      <Text style={[s.tableHeaderText, s.colSubtotal]}>Subtotal</Text>
                      <Text style={[s.tableHeaderText, s.colIVA]}>IVA</Text>
                      <Text style={[s.tableHeaderText, s.colRet]}>Ret.</Text>
                      <Text style={[s.tableHeaderText, s.colTotal]}>Total</Text>
                      <Text style={[s.tableHeaderText, s.colFPago]}>F. Pago</Text>
                    </View>
                  </View>

                  {/* Rows */}
                  {benGrupo.ordenes.map((orden, idx) => {
                    const tags = conceptos[orden.id] || [];
                    const subtotal = orden.fields.Total || 0;
                    const iva = orden.fields.MontoIVA || 0;
                    const ret = getRetenciones(orden);
                    const total = calcTotalOrden(orden);
                    const hasTaxRow = orden.fields.MontoIVA !== undefined;

                    return (
                      <View
                        key={orden.id}
                        style={[
                          s.tableRow,
                          idx % 2 === 1 ? s.tableRowAlt : {},
                        ]}
                      >
                        <Text style={[s.tableCellBold, s.colOrden]}>
                          #{orden.fields.NumeroOrden || "S/N"}
                        </Text>
                        <Text style={[s.tableCell, s.colFecha]}>
                          {orden.fields["Fecha de pedido"]
                            ? formatDate(orden.fields["Fecha de pedido"])
                            : "-"}
                        </Text>
                        <Text style={[s.tableCell, s.colFactura]}>
                          {orden.fields.NumeroFactura || "-"}
                        </Text>
                        <Text style={[s.tableCell, s.colConcepto]}>
                          {tags.length > 0 ? tags.join(", ") : "-"}
                        </Text>
                        <Text style={[s.tableCell, s.colEstado]}>
                          {orden.fields.Estado || "-"}
                        </Text>
                        <Text style={[s.tableCell, s.colSubtotal]}>
                          {formatCurrency(subtotal)}
                        </Text>
                        <Text style={[hasTaxRow && iva > 0 ? s.tableCellGreen : s.tableCellMuted, s.colIVA]}>
                          {hasTaxRow && iva > 0 ? `+${formatCurrency(iva)}` : "-"}
                        </Text>
                        <Text style={[hasTaxRow && ret > 0 ? s.tableCellRed : s.tableCellMuted, s.colRet]}>
                          {hasTaxRow && ret > 0 ? `-${formatCurrency(ret)}` : "-"}
                        </Text>
                        <Text style={[s.tableCellGreen, s.colTotal]}>
                          {formatCurrency(total)}
                        </Text>
                        <Text style={[s.tableCell, s.colFPago]}>
                          {orden.fields.FechaPago
                            ? formatDate(orden.fields.FechaPago)
                            : "-"}
                        </Text>
                      </View>
                    );
                  })}

                  {/* Subtotal row with tax columns */}
                  <View style={s.subtotalRow}>
                    <Text style={[s.subtotalLabel, s.colLabel]}>
                      Subtotal {beneficiario}:
                    </Text>
                    <Text style={[s.subtotalValue, s.colSubtotal]}>
                      {formatCurrency(tax.subtotal)}
                    </Text>
                    <Text style={[hasTax && tax.iva > 0 ? s.subtotalValueGreen : s.subtotalValue, s.colIVA]}>
                      {hasTax && tax.iva > 0 ? `+${formatCurrency(tax.iva)}` : "-"}
                    </Text>
                    <Text style={[hasTax && tax.ret > 0 ? s.subtotalValueRed : s.subtotalValue, s.colRet]}>
                      {hasTax && tax.ret > 0 ? `-${formatCurrency(tax.ret)}` : "-"}
                    </Text>
                    <Text style={[s.subtotalValue, s.colTotal]}>
                      {formatCurrency(tax.total)}
                    </Text>
                    <View style={s.colFPago} />
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Grand total */}
        <View style={s.grandTotalRow}>
          <Text style={[s.grandTotalLabel, s.colLabel]}>
            TOTAL GENERAL ({totalOrdenes}{" "}
            {totalOrdenes === 1 ? "orden" : "ordenes"})
          </Text>
          <Text style={[s.grandTotalValue, s.colSubtotal]}>
            {formatCurrency(grandTax.subtotal)}
          </Text>
          <Text style={[hasTaxGlobal && grandTax.iva > 0 ? s.grandTotalValueLight : s.grandTotalValue, s.colIVA]}>
            {hasTaxGlobal && grandTax.iva > 0 ? `+${formatCurrency(grandTax.iva)}` : "-"}
          </Text>
          <Text style={[hasTaxGlobal && grandTax.ret > 0 ? s.grandTotalValueRed : s.grandTotalValue, s.colRet]}>
            {hasTaxGlobal && grandTax.ret > 0 ? `-${formatCurrency(grandTax.ret)}` : "-"}
          </Text>
          <Text style={[s.grandTotalValue, s.colTotal]}>
            {formatCurrency(grandTotal)}
          </Text>
          <View style={s.colFPago} />
        </View>

        {/* Estado breakdown */}
        {sortEstados(Object.entries(grandEstadoTotals)).map(([estado, monto]) => (
          <View key={estado} style={s.estadoSubtotalRow}>
            <Text style={[s.estadoSubtotalLabel, s.colLabel]}>
              {estado} ({grandEstadoCounts[estado]})
            </Text>
            <View style={s.colSubtotal} />
            <View style={s.colIVA} />
            <View style={s.colRet} />
            <Text style={[s.estadoSubtotalValue, s.colTotal]}>
              {formatCurrency(monto)}
            </Text>
            <View style={s.colFPago} />
          </View>
        ))}

        {/* Footer with page numbers */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            CampoLimpio - Programa de Manejo de Envases Vacios
          </Text>
          <Text
            style={s.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

export default ReporteOrdenesPDF;
