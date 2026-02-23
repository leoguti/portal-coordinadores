import { StyleSheet } from "@react-pdf/renderer";

// Column widths must add up to 100% (landscape LETTER)
// #Orden(6) + Fecha(9) + Factura(8) + Concepto(13) + Estado(7) = 43% left side
// Subtotal(10) + IVA(9) + Ret.(9) + Total(11) + F.Pago(9) = 48% right side
// = 91% (remaining is absorbed by padding)

export const reporteStyles = StyleSheet.create({
  page: {
    padding: 25,
    paddingBottom: 45,
    fontSize: 7,
    fontFamily: "Helvetica",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "2 solid #042726",
    paddingBottom: 8,
  },
  logo: {
    width: 90,
    height: 30,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#042726",
  },
  dateText: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 2,
  },

  // Filtros
  filtrosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
    padding: 6,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
  },
  filtroTag: {
    fontSize: 6.5,
    color: "#374151",
  },
  filtroLabel: {
    fontWeight: "bold",
    color: "#042726",
  },

  // === Column widths (shared across ALL rows) ===
  colOrden: { width: "6%" },
  colFecha: { width: "9%" },
  colFactura: { width: "8%" },
  colConcepto: { width: "14%" },
  colEstado: { width: "7%", textAlign: "center" },
  colSubtotal: { width: "10%", textAlign: "right" },
  colIVA: { width: "9%", textAlign: "right" },
  colRet: { width: "9%", textAlign: "right" },
  colTotal: { width: "10%", textAlign: "right" },
  colFPago: { width: "9%", textAlign: "right" },
  // Label spanning left columns (used by subtotals, grand total)
  // = Orden+Fecha+Factura+Concepto+Estado = 44%
  colLabel: { width: "44%", textAlign: "right", paddingRight: 6 },
  // Monetary columns span for group header total = Subtotal+IVA+Ret+Total = 38%
  colMoneySpan: { width: "38%", textAlign: "right" },

  // Group header (mes + beneficiario combined)
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 8,
    borderBottom: "1 solid #d1d5db",
    minHeight: 18,
  },
  groupHeaderText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1f2937",
  },
  groupHeaderTotal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Table header
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottom: "1 solid #d1d5db",
    minHeight: 14,
  },
  tableHeaderText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },

  // Table rows
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottom: "0.5 solid #e5e7eb",
    minHeight: 14,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 6.5,
    color: "#1f2937",
  },
  tableCellBold: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1f2937",
  },
  tableCellGreen: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#00875a",
  },
  tableCellRed: {
    fontSize: 6.5,
    color: "#dc2626",
  },
  tableCellMuted: {
    fontSize: 6.5,
    color: "#9ca3af",
  },

  // Subtotal beneficiario
  subtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#ecfdf5",
    borderBottom: "1 solid #d1fae5",
    minHeight: 14,
  },
  subtotalLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#065f46",
  },
  subtotalValue: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#065f46",
  },
  subtotalValueGreen: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#059669",
  },
  subtotalValueRed: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#b91c1c",
  },

  // Grand total
  grandTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#042726",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginTop: 10,
    borderRadius: 3,
    minHeight: 20,
  },
  grandTotalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#00d084",
  },
  grandTotalValueLight: {
    fontSize: 8,
    color: "#a7f3d0",
  },
  grandTotalValueRed: {
    fontSize: 8,
    color: "#fca5a5",
  },

  // Estado subtotal rows (same grid as data rows, below grand total)
  estadoSubtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#1f2937",
    borderBottom: "0.5 solid #374151",
    minHeight: 14,
  },
  estadoSubtotalLabel: {
    fontSize: 7,
    color: "#d1d5db",
  },
  estadoSubtotalValue: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 25,
    right: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1 solid #e5e7eb",
    paddingTop: 5,
  },
  footerText: {
    fontSize: 6.5,
    color: "#9ca3af",
  },
  pageNumber: {
    fontSize: 6.5,
    color: "#9ca3af",
  },
});
