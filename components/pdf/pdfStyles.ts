import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    borderBottom: "2 solid #042726",
    paddingBottom: 15,
  },
  
  logo: {
    width: 120,
    height: 40,
  },
  
  headerRight: {
    alignItems: "flex-end",
  },
  
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#042726",
  },
  
  orderNumber: {
    fontSize: 16,
    color: "#00d084",
    marginTop: 4,
  },
  
  section: {
    marginBottom: 15,
  },
  
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#042726",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  
  label: {
    width: 100,
    fontWeight: "bold",
    color: "#374151",
  },
  
  value: {
    flex: 1,
    color: "#1f2937",
  },
  
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTop: "2 solid #042726",
    borderBottom: "2 solid #042726",
    padding: 8,
    color: "#042726",
    fontWeight: "bold",
    fontSize: 9,
  },
  
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e5e7eb",
    padding: 8,
    fontSize: 9,
  },
  
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  
  col1: { width: "5%", textAlign: "center" },
  col2: { width: "45%", paddingLeft: 5 },
  col3: { width: "15%", textAlign: "right" },
  col4: { width: "15%", textAlign: "right" },
  col5: { width: "20%", textAlign: "right", paddingRight: 5 },
  
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "2 solid #042726",
  },
  
  totalRowInTable: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTop: "2 solid #042726",
    padding: 10,
    marginTop: 2,
  },
  
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 20,
    color: "#042726",
  },

  totalLabelInTable: {
    width: "80%",
    fontSize: 11,
    fontWeight: "bold",
    color: "#042726",
    textAlign: "right",
    paddingRight: 10,
  },
  
  totalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#00d084",
    minWidth: 100,
    textAlign: "right",
  },

  totalValueInTable: {
    width: "20%",
    fontSize: 13,
    fontWeight: "bold",
    color: "#042726",
    textAlign: "right",
    paddingRight: 5,
  },
  
  observaciones: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
  },
  
  observacionesTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#374151",
  },
  
  observacionesText: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
    borderTop: "1 solid #e5e7eb",
    paddingTop: 10,
  },
});
