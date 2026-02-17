import { StyleSheet } from "@react-pdf/renderer";

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

  // Month header
  mesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#042726",
    padding: 6,
    paddingHorizontal: 8,
    marginTop: 10,
    borderRadius: 3,
    minHeight: 22,
  },
  mesHeaderText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
  },
  mesHeaderTotal: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#00d084",
  },

  // Beneficiario header
  beneficiarioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 5,
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

  // Table
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    padding: 4,
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
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
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

  // Column widths
  colOrden: { width: "8%" },
  colFecha: { width: "12%" },
  colFactura: { width: "12%" },
  colConcepto: { width: "25%" },
  colEstado: { width: "11%", textAlign: "center" },
  colTotal: { width: "17%", textAlign: "right" },
  colFPago: { width: "15%", textAlign: "right" },

  // Subtotal beneficiario
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 4,
    paddingHorizontal: 8,
    backgroundColor: "#ecfdf5",
    borderBottom: "1 solid #d1fae5",
    minHeight: 16,
  },
  subtotalLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#065f46",
    marginRight: 8,
  },
  subtotalValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#065f46",
    width: "17%",
    textAlign: "right",
  },

  // Subtotal mes
  mesSubtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 5,
    paddingHorizontal: 8,
    backgroundColor: "#d1fae5",
    marginBottom: 2,
    minHeight: 18,
  },
  mesSubtotalLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#042726",
    marginRight: 8,
  },
  mesSubtotalValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#042726",
    width: "17%",
    textAlign: "right",
  },

  // Grand total
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#042726",
    padding: 8,
    paddingHorizontal: 10,
    marginTop: 12,
    borderRadius: 3,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  grandTotalValue: {
    fontSize: 12,
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
