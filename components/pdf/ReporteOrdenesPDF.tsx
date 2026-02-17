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

const ReporteOrdenesPDF: React.FC<ReporteOrdenesPDFProps> = ({
  gruposPorMes,
  conceptos,
  filtros,
  grandTotal,
  totalOrdenes,
}) => {
  const hasFiltros =
    filtros.coordinador || filtros.beneficiario || filtros.estado || filtros.mes;

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
          <View key={mesKey} wrap={false}>
            {/* Month header */}
            <View style={s.mesHeader}>
              <Text style={s.mesHeaderText}>
                {formatMesLabel(mesKey)} — {mesGrupo.count}{" "}
                {mesGrupo.count === 1 ? "orden" : "ordenes"}
              </Text>
              <Text style={s.mesHeaderTotal}>
                {formatCurrency(mesGrupo.total)}
              </Text>
            </View>

            {/* Beneficiarios */}
            {mesGrupo.beneficiarios.map(([beneficiario, benGrupo]) => (
              <View key={`${mesKey}|${beneficiario}`}>
                {/* Beneficiario header */}
                <View style={s.beneficiarioHeader}>
                  <Text style={s.beneficiarioName}>{beneficiario}</Text>
                  <Text style={s.beneficiarioTotal}>
                    {benGrupo.ordenes.length}{" "}
                    {benGrupo.ordenes.length === 1 ? "orden" : "ordenes"}
                  </Text>
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
                        {formatCurrency(orden.fields.Total || 0)}
                      </Text>
                      <Text style={[s.tableCell, s.colFPago]}>
                        {orden.fields.FechaPago
                          ? formatDate(orden.fields.FechaPago)
                          : "-"}
                      </Text>
                    </View>
                  );
                })}

                {/* Subtotal beneficiario */}
                <View style={s.subtotalRow}>
                  <Text style={s.subtotalLabel}>
                    Subtotal {beneficiario}:
                  </Text>
                  <Text style={s.subtotalValue}>
                    {formatCurrency(benGrupo.total)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Subtotal mes */}
            <View style={s.mesSubtotalRow}>
              <Text style={s.mesSubtotalLabel}>
                Total {formatMesLabel(mesKey)}:
              </Text>
              <Text style={s.mesSubtotalValue}>
                {formatCurrency(mesGrupo.total)}
              </Text>
            </View>
          </View>
        ))}

        {/* Grand total */}
        <View style={s.grandTotalRow}>
          <Text style={s.grandTotalLabel}>
            Total General ({totalOrdenes}{" "}
            {totalOrdenes === 1 ? "orden" : "ordenes"})
          </Text>
          <Text style={s.grandTotalValue}>
            {formatCurrency(grandTotal)}
          </Text>
        </View>

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
