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

// Calculate total with taxes for a single order
const calcTotalOrden = (orden: { fields: { Total?: number; MontoIVA?: number; MontoReteFuente?: number; MontoReteICA?: number; MontoReteIVA?: number } }) => {
  const st = orden.fields.Total || 0;
  return orden.fields.MontoIVA !== undefined
    ? st + (orden.fields.MontoIVA || 0) - (orden.fields.MontoReteFuente || 0) - (orden.fields.MontoReteICA || 0) - (orden.fields.MontoReteIVA || 0)
    : st;
};

// Ordered estado list for consistent display
const ESTADO_ORDER = ["Enviada", "Facturada", "Pagada", "Rechazada"];

const sortEstados = (entries: [string, number][]) =>
  entries.sort((a, b) => {
    const ia = ESTADO_ORDER.indexOf(a[0]);
    const ib = ESTADO_ORDER.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

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
            {mesGrupo.beneficiarios.map(([beneficiario, benGrupo]) => (
              <View key={`${mesKey}|${beneficiario}`}>
                {/* Combined header (mes + beneficiario) + table header kept together */}
                <View wrap={false}>
                  <View style={s.groupHeader}>
                    <Text style={[s.groupHeaderText, s.colLabel]}>
                      {formatMesLabel(mesKey)} {"\u00B7"} {beneficiario} {"\u00B7"} {benGrupo.ordenes.length}{" "}
                      {benGrupo.ordenes.length === 1 ? "orden" : "ordenes"}
                    </Text>
                    <Text style={[s.groupHeaderTotal, s.colTotal]}>
                      {formatCurrency(benGrupo.total)}
                    </Text>
                    <View style={s.colFPago} />
                  </View>

                  {/* Table header */}
                  <View style={s.tableHeader}>
                    <Text style={[s.tableHeaderText, s.colOrden]}># Orden</Text>
                    <Text style={[s.tableHeaderText, s.colFecha]}>Fecha</Text>
                    <Text style={[s.tableHeaderText, s.colFactura]}>N. Factura</Text>
                    <Text style={[s.tableHeaderText, s.colConcepto]}>Concepto</Text>
                    <Text style={[s.tableHeaderText, s.colEstado]}>Estado</Text>
                    <Text style={[s.tableHeaderText, s.colTotal]}>Total</Text>
                    <Text style={[s.tableHeaderText, s.colFPago]}>F. Pago</Text>
                  </View>
                </View>

                {/* Rows */}
                {benGrupo.ordenes.map((orden, idx) => {
                  const tags = conceptos[orden.id] || [];
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
                      <Text style={[s.tableCellGreen, s.colTotal]}>
                        {formatCurrency(calcTotalOrden(orden))}
                      </Text>
                      <Text style={[s.tableCell, s.colFPago]}>
                        {orden.fields.FechaPago
                          ? formatDate(orden.fields.FechaPago)
                          : "-"}
                      </Text>
                    </View>
                  );
                })}

                {/* Tax breakdown + subtotal */}
                {(() => {
                  const tax = benGrupo.ordenes.reduce((acc, o) => {
                    acc.subtotal += o.fields.Total || 0;
                    acc.iva += o.fields.MontoIVA || 0;
                    acc.reteFuente += o.fields.MontoReteFuente || 0;
                    acc.reteICA += o.fields.MontoReteICA || 0;
                    acc.reteIVA += o.fields.MontoReteIVA || 0;
                    return acc;
                  }, { subtotal: 0, iva: 0, reteFuente: 0, reteICA: 0, reteIVA: 0 });
                  const hasTax = tax.iva > 0 || tax.reteFuente > 0 || tax.reteICA > 0 || tax.reteIVA > 0;

                  return (
                    <>
                      {hasTax && (
                        <>
                          <View style={s.taxBreakdownRow}>
                            <Text style={[s.taxBreakdownLabel, s.colLabel]}>Subtotal ítems:</Text>
                            <Text style={[s.taxBreakdownValue, s.colTotal]}>{formatCurrency(tax.subtotal)}</Text>
                            <View style={s.colFPago} />
                          </View>
                          {tax.iva > 0 && (
                            <View style={s.taxBreakdownRow}>
                              <Text style={[s.taxBreakdownLabel, s.colLabel]}>+ IVA:</Text>
                              <Text style={[s.taxBreakdownValueGreen, s.colTotal]}>+{formatCurrency(tax.iva)}</Text>
                              <View style={s.colFPago} />
                            </View>
                          )}
                          {tax.reteFuente > 0 && (
                            <View style={s.taxBreakdownRow}>
                              <Text style={[s.taxBreakdownLabel, s.colLabel]}>- ReteFuente:</Text>
                              <Text style={[s.taxBreakdownValueRed, s.colTotal]}>-{formatCurrency(tax.reteFuente)}</Text>
                              <View style={s.colFPago} />
                            </View>
                          )}
                          {tax.reteICA > 0 && (
                            <View style={s.taxBreakdownRow}>
                              <Text style={[s.taxBreakdownLabel, s.colLabel]}>- ReteICA:</Text>
                              <Text style={[s.taxBreakdownValueRed, s.colTotal]}>-{formatCurrency(tax.reteICA)}</Text>
                              <View style={s.colFPago} />
                            </View>
                          )}
                          {tax.reteIVA > 0 && (
                            <View style={s.taxBreakdownRow}>
                              <Text style={[s.taxBreakdownLabel, s.colLabel]}>- ReteIVA:</Text>
                              <Text style={[s.taxBreakdownValueRed, s.colTotal]}>-{formatCurrency(tax.reteIVA)}</Text>
                              <View style={s.colFPago} />
                            </View>
                          )}
                        </>
                      )}
                      <View style={s.subtotalRow}>
                        <Text style={[s.subtotalLabel, s.colLabel]}>
                          {hasTax ? "Total a Pagar" : "Subtotal"} {formatMesLabel(mesKey)}:
                        </Text>
                        <Text style={[s.subtotalValue, s.colTotal]}>
                          {formatCurrency(benGrupo.total)}
                        </Text>
                        <View style={s.colFPago} />
                      </View>
                    </>
                  );
                })()}
              </View>
            ))}
          </View>
        ))}

        {/* Grand total - same grid */}
        <View style={s.grandTotalRow}>
          <Text style={[s.grandTotalLabel, s.colLabel]}>
            TOTAL GENERAL ({totalOrdenes}{" "}
            {totalOrdenes === 1 ? "orden" : "ordenes"})
          </Text>
          <Text style={[s.grandTotalValue, s.colTotal]}>
            {formatCurrency(grandTotal)}
          </Text>
          <View style={s.colFPago} />
        </View>

        {/* Estado breakdown as subtotal rows in same grid */}
        {sortEstados(Object.entries(grandEstadoTotals)).map(([estado, monto]) => (
          <View key={estado} style={s.estadoSubtotalRow}>
            <Text style={[s.estadoSubtotalLabel, s.colLabel]}>
              {estado} ({grandEstadoCounts[estado]})
            </Text>
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
