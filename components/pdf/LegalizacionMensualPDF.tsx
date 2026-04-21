import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import LOGO_BASE64 from "./logoBase64";

interface GastoRow {
  numeroGasto?: number;
  fecha?: string;
  hora?: string;
  noches?: number;
  descripcion?: string;
  rubroNombre?: string;
  beneficiario?: string;
  municipio?: string;
  municipioDestino?: string;
  valor: number;
  estado?: string;
  tipoSoporte?: string;
  numeroSoporte?: string;
}

interface ReembolsoRow {
  numero?: number;
  fecha?: string;
  monto: number;
  observaciones?: string;
}

interface Seccion {
  titulo: string;
  descripcion?: string;
  columnas: "transporte" | "alimentacion" | "hospedaje" | "otros";
  gastos: GastoRow[];
  total: number;
}

export interface LegalizacionMensualPDFProps {
  mesReporte: string;
  coordinadorNombre: string;
  secciones: Seccion[];
  reembolsos: ReembolsoRow[];
  totalReembolsos: number;
  totalGastos: number;
  saldoAnterior: number;
  saldoFinal: number;
}

const s = StyleSheet.create({
  page: { padding: 25, fontSize: 8.5, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "2 solid #042726",
    paddingBottom: 8,
  },
  logo: { width: 90, height: 30 },
  title: { fontSize: 13, fontWeight: "bold", color: "#042726" },
  subtitle: { fontSize: 10, color: "#00d084", marginTop: 2 },
  version: { fontSize: 7, color: "#666" },

  infoBox: {
    marginBottom: 10,
    backgroundColor: "#f5f7f5",
    padding: 6,
    borderRadius: 3,
  },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { fontWeight: "bold", color: "#042726", width: 110 },
  infoValue: { color: "#1a2e1a" },

  sectionHeader: {
    backgroundColor: "#042726",
    color: "white",
    padding: 5,
    marginTop: 6,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  sectionHeaderBlue: {
    backgroundColor: "#1e40af",
    color: "white",
    padding: 5,
    marginTop: 6,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  sectionDesc: {
    backgroundColor: "#f0f4f0",
    padding: 3,
    fontSize: 7,
    color: "#444",
    fontStyle: "italic",
  },

  table: { width: "100%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e6efec",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#042726",
    paddingVertical: 3,
  },
  tableHeaderCell: { fontSize: 7, fontWeight: "bold", color: "#042726", paddingHorizontal: 3 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#d0d0d0",
    paddingVertical: 3,
    minHeight: 16,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  tableCell: { fontSize: 7.5, paddingHorizontal: 3, color: "#222" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#f0f4f0",
    padding: 4,
    marginBottom: 4,
  },
  totalLabel: { fontWeight: "bold", color: "#042726", marginRight: 8 },
  totalValue: { fontWeight: "bold", color: "#00d084" },

  resumenBox: {
    marginTop: 12,
    padding: 10,
    border: "1 solid #042726",
    borderRadius: 4,
    backgroundColor: "#f5f7f5",
  },
  resumenTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#042726",
    marginBottom: 8,
    textTransform: "uppercase",
    borderBottom: "1 solid #d0d0d0",
    paddingBottom: 4,
  },
  resumenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  resumenLabel: { color: "#333" },
  resumenValue: { fontFamily: "Courier", fontWeight: "bold" },
  resumenFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #042726",
    paddingTop: 4,
    marginTop: 4,
    fontSize: 11,
  },
  resumenFinalLabel: { color: "#042726", fontWeight: "bold" },
  resumenFinalValue: { fontFamily: "Courier", fontWeight: "bold", color: "#042726" },

  footer: {
    position: "absolute",
    bottom: 15,
    left: 25,
    right: 25,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
  },
});

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const fmtFecha = (f: string | undefined) => {
  if (!f) return "";
  try {
    return new Date(f + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return f;
  }
};

const mesLegible = (ym: string) => {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};

const widths = {
  item: "4%",
  fecha: "8%",
  horaOrNoches: "6%",
  beneficiario: "16%",
  descripcion: "19%",
  ciudad: "14%",
  valor: "11%",
  tipoSoporte: "8%",
  numeroSoporte: "6%",
  estado: "8%",
} as const;

function SeccionTable({ seccion, mostrarTrayecto, ciudadHeader, horaHeader, rubroInline }: {
  seccion: Seccion;
  mostrarTrayecto: boolean;
  ciudadHeader: string;
  horaHeader: string;
  rubroInline: boolean;
}) {
  return (
    <>
      <Text style={s.sectionHeader}>{seccion.titulo}</Text>
      {seccion.descripcion && <Text style={s.sectionDesc}>{seccion.descripcion}</Text>}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: widths.item }]}>#</Text>
          <Text style={[s.tableHeaderCell, { width: widths.fecha }]}>Fecha</Text>
          <Text style={[s.tableHeaderCell, { width: widths.horaOrNoches }]}>{horaHeader}</Text>
          <Text style={[s.tableHeaderCell, { width: widths.beneficiario }]}>Beneficiario</Text>
          <Text style={[s.tableHeaderCell, { width: widths.descripcion }]}>Descripción</Text>
          <Text style={[s.tableHeaderCell, { width: widths.ciudad }]}>{ciudadHeader}</Text>
          <Text style={[s.tableHeaderCell, { width: widths.valor, textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: widths.tipoSoporte }]}>Tipo sop.</Text>
          <Text style={[s.tableHeaderCell, { width: widths.numeroSoporte }]}>N°</Text>
          <Text style={[s.tableHeaderCell, { width: widths.estado }]}>Estado</Text>
        </View>
        {seccion.gastos.map((g, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: widths.item }]}>{g.numeroGasto ?? i + 1}</Text>
            <Text style={[s.tableCell, { width: widths.fecha }]}>{fmtFecha(g.fecha)}</Text>
            <Text style={[s.tableCell, { width: widths.horaOrNoches, textAlign: "center" }]}>
              {horaHeader === "# Noches"
                ? (g.noches ?? "—")
                : horaHeader === "Hora"
                  ? (g.hora || "—")
                  : "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.beneficiario, fontSize: 7 }]}>
              {g.beneficiario || "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.descripcion, fontSize: 7 }]}>
              {rubroInline && g.rubroNombre ? `[${g.rubroNombre}] ` : ""}
              {g.descripcion || "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.ciudad, fontSize: 7 }]}>
              {g.municipio || "—"}
              {mostrarTrayecto && g.municipioDestino ? ` → ${g.municipioDestino}` : ""}
            </Text>
            <Text style={[s.tableCell, { width: widths.valor, textAlign: "right", fontFamily: "Courier" }]}>
              {fmtCOP(g.valor)}
            </Text>
            <Text style={[s.tableCell, { width: widths.tipoSoporte, fontSize: 7 }]}>
              {g.tipoSoporte || "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.numeroSoporte, fontSize: 7, fontFamily: "Courier" }]}>
              {g.numeroSoporte || "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.estado, fontSize: 7 }]}>
              {g.estado || "—"}
            </Text>
          </View>
        ))}
      </View>
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Subtotal {seccion.titulo.replace("GASTOS ASOCIADOS A ", "")}</Text>
        <Text style={[s.totalValue, { fontFamily: "Courier" }]}>{fmtCOP(seccion.total)}</Text>
      </View>
    </>
  );
}

function ReembolsosTable({ reembolsos, total }: { reembolsos: ReembolsoRow[]; total: number }) {
  if (reembolsos.length === 0) return null;
  return (
    <>
      <Text style={s.sectionHeaderBlue}>Reembolsos del mes ({reembolsos.length})</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "10%" }]}>#</Text>
          <Text style={[s.tableHeaderCell, { width: "15%" }]}>Fecha</Text>
          <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Monto</Text>
          <Text style={[s.tableHeaderCell, { width: "55%" }]}>Observaciones</Text>
        </View>
        {reembolsos.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: "10%" }]}>{r.numero ?? i + 1}</Text>
            <Text style={[s.tableCell, { width: "15%" }]}>{fmtFecha(r.fecha)}</Text>
            <Text style={[s.tableCell, { width: "20%", textAlign: "right", fontFamily: "Courier", color: "#1e40af", fontWeight: "bold" }]}>
              +{fmtCOP(r.monto)}
            </Text>
            <Text style={[s.tableCell, { width: "55%" }]}>{r.observaciones || "—"}</Text>
          </View>
        ))}
      </View>
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total reembolsos</Text>
        <Text style={[s.totalValue, { fontFamily: "Courier", color: "#1e40af" }]}>+{fmtCOP(total)}</Text>
      </View>
    </>
  );
}

const LegalizacionMensualPDF: React.FC<LegalizacionMensualPDFProps> = ({
  mesReporte,
  coordinadorNombre,
  secciones,
  reembolsos,
  totalReembolsos,
  totalGastos,
  saldoAnterior,
  saldoFinal,
}) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Image src={LOGO_BASE64} style={s.logo} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>FORMATO PARA LEGALIZACIÓN DE CAJA MENOR</Text>
            <Text style={s.subtitle}>{mesLegible(mesReporte).toUpperCase()}</Text>
            <Text style={s.version}>Versión 1</Text>
          </View>
        </View>

        <View style={s.infoBox}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Nombre Coordinador:</Text>
            <Text style={s.infoValue}>{coordinadorNombre}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Mes de Reporte:</Text>
            <Text style={s.infoValue}>{mesLegible(mesReporte)}</Text>
          </View>
        </View>

        {/* Reembolsos primero */}
        <ReembolsosTable reembolsos={reembolsos} total={totalReembolsos} />

        {/* Gastos por sección */}
        {secciones.map((sec, i) => {
          if (sec.gastos.length === 0) return null;
          if (sec.columnas === "transporte") {
            return (
              <SeccionTable
                key={i}
                seccion={sec}
                mostrarTrayecto={true}
                ciudadHeader="Ciudad / Trayecto"
                horaHeader="Hora"
                rubroInline={true}
              />
            );
          }
          if (sec.columnas === "hospedaje") {
            return (
              <SeccionTable
                key={i}
                seccion={sec}
                mostrarTrayecto={false}
                ciudadHeader="Ciudad"
                horaHeader="# Noches"
                rubroInline={false}
              />
            );
          }
          return (
            <SeccionTable
              key={i}
              seccion={sec}
              mostrarTrayecto={false}
              ciudadHeader="Ciudad"
              horaHeader="Hora"
              rubroInline={sec.columnas === "otros"}
            />
          );
        })}

        {/* Resumen del mes */}
        <View style={s.resumenBox}>
          <Text style={s.resumenTitle}>Resumen del mes</Text>
          <View style={s.resumenRow}>
            <Text style={s.resumenLabel}>Saldo anterior:</Text>
            <Text style={s.resumenValue}>{fmtCOP(saldoAnterior)}</Text>
          </View>
          <View style={s.resumenRow}>
            <Text style={s.resumenLabel}>+ Reembolsos del mes:</Text>
            <Text style={[s.resumenValue, { color: "#1e40af" }]}>+{fmtCOP(totalReembolsos)}</Text>
          </View>
          <View style={s.resumenRow}>
            <Text style={s.resumenLabel}>- Gastos aprobados:</Text>
            <Text style={[s.resumenValue, { color: "#b91c1c" }]}>-{fmtCOP(totalGastos)}</Text>
          </View>
          <View style={s.resumenFinalRow}>
            <Text style={s.resumenFinalLabel}>= SALDO FINAL:</Text>
            <Text style={[s.resumenFinalValue, { color: saldoFinal >= 0 ? "#047857" : "#b91c1c" }]}>
              {fmtCOP(saldoFinal)}
            </Text>
          </View>
        </View>

        <Text style={s.footer}>
          Generado automáticamente por Portal CampoLimpio — {new Date().toLocaleDateString("es-CO")}
        </Text>
      </Page>
    </Document>
  );
};

export default LegalizacionMensualPDF;
