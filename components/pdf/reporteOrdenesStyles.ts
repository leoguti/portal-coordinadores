import { StyleSheet } from "@react-pdf/renderer";

// Column widths must add up to 100%
// #Orden(8) + Fecha(12) + Factura(12) + Concepto(23) + Estado(10) = 65% left side
// Total(20) + F.Pago(15) = 35% right side

export const reporteStyles = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 50,
    fontSize: 8,
    fontFamily: "Helvetica",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottom: "2 solid #042726",
    paddingBottom: 10,
  },
  logo: {
    width: 100,
    height: 33,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#042726",
  },
  dateText: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 3,
  },

  // Filtros
  filtrosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  filtroTag: {
    fontSize: 7,
    color: "#374151",
  },
  filtroLabel: {
    fontWeight: "bold",
    color: "#042726",
  },

  // === Column widths (shared across ALL rows) ===
  colOrden: { width: "8%" },
  colFecha: { width: "12%" },
  colFactura: { width: "12%" },
  colConcepto: { width: "23%" },
  colEstado: { width: "10%", textAlign: "center" },
  colTotal: { width: "20%", textAlign: "right" },
  colFPago: { width: "15%", textAlign: "right" },
  // Label spanning left columns (used by subtotals, month totals, grand total)
  colLabel: { width: "65%", textAlign: "right", paddingRight: 8 },

  // Month header
  mesHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#042726",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 10,
    borderRadius: 3,
    minHeight: 22,
  },
  mesHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
  },
  mesHeaderTotal: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Beneficiario header
  beneficiarioHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 4,
    borderBottom: "1 solid #e5e7eb",
    minHeight: 18,
  },
  beneficiarioName: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1f2937",
  },
  beneficiarioTotal: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Table header
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottom: "1 solid #d1d5db",
    minHeight: 16,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },

  // Table rows
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottom: "0.5 solid #e5e7eb",
    minHeight: 16,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 7.5,
    color: "#1f2937",
  },
  tableCellBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1f2937",
  },
  tableCellGreen: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#00875a",
  },

  // Subtotal beneficiario
  subtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#ecfdf5",
    borderBottom: "1 solid #d1fae5",
    minHeight: 16,
  },
  subtotalLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#065f46",
  },
  subtotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#065f46",
  },

  // Subtotal mes
  mesSubtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#d1fae5",
    marginBottom: 2,
    minHeight: 18,
  },
  mesSubtotalLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#042726",
  },
  mesSubtotalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#042726",
  },

  // Grand total
  grandTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#042726",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 12,
    borderRadius: 3,
    minHeight: 24,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Estado subtotal rows (same grid as data rows, below grand total)
  estadoSubtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#1f2937",
    borderBottom: "0.5 solid #374151",
    minHeight: 16,
  },
  estadoSubtotalLabel: {
    fontSize: 8,
    color: "#d1d5db",
  },
  estadoSubtotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1 solid #e5e7eb",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
  pageNumber: {
    fontSize: 7,
    color: "#9ca3af",
  },
});
