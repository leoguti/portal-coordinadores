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
  municipio?: string;
  municipioDestino?: string;
  valor: number;
  tipoSoporte?: string;
  numeroSoporte?: string;
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
  totalGeneral: number;
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

  totalGeneral: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#042726",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalGeneralLabel: { color: "white", fontSize: 11, fontWeight: "bold", textTransform: "uppercase" },
  totalGeneralValue: { color: "#00d084", fontSize: 13, fontWeight: "bold" },

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

// Widths: 8 columnas iguales al Excel para Transporte/Alimentacion/Otros
// 4% | 9% | 7% | 32% | 17% | 12% | 10% | 9% = 100%
// Para Hospedaje, la columna 3 pasa de "Hora" a "# Noches"
const widths = {
  item: "4%",
  fecha: "9%",
  horaOrNoches: "7%",
  descripcion: "32%",
  ciudad: "17%",
  valor: "12%",
  tipoSoporte: "10%",
  numeroSoporte: "9%",
} as const;

function SeccionTable({ seccion, mostrarTrayecto, ciudadHeader, horaHeader, rubroInline }: {
  seccion: Seccion;
  mostrarTrayecto: boolean;
  ciudadHeader: string;
  horaHeader: string;   // "Hora" o "# Noches" o "—"
  rubroInline: boolean; // muestra rubro como prefijo en la descripción
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
          <Text style={[s.tableHeaderCell, { width: widths.descripcion }]}>Descripción detallada</Text>
          <Text style={[s.tableHeaderCell, { width: widths.ciudad }]}>{ciudadHeader}</Text>
          <Text style={[s.tableHeaderCell, { width: widths.valor, textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: widths.tipoSoporte }]}>Tipo soporte</Text>
          <Text style={[s.tableHeaderCell, { width: widths.numeroSoporte }]}>N° soporte</Text>
        </View>
        {seccion.gastos.map((g, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: widths.item }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: widths.fecha }]}>{fmtFecha(g.fecha)}</Text>
            <Text style={[s.tableCell, { width: widths.horaOrNoches, textAlign: "center" }]}>
              {horaHeader === "# Noches"
                ? (g.noches ?? "—")
                : horaHeader === "Hora"
                  ? (g.hora || "—")
                  : "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.descripcion }]}>
              {rubroInline && g.rubroNombre ? `[${g.rubroNombre}] ` : ""}
              {g.descripcion || "—"}
            </Text>
            <Text style={[s.tableCell, { width: widths.ciudad }]}>
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
          </View>
        ))}
      </View>
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={[s.totalValue, { fontFamily: "Courier" }]}>{fmtCOP(seccion.total)}</Text>
      </View>
    </>
  );
}

const LegalizacionMensualPDF: React.FC<LegalizacionMensualPDFProps> = ({
  mesReporte,
  coordinadorNombre,
  secciones,
  totalGeneral,
}) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Image src={LOGO_BASE64} style={s.logo} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>FORMATO PARA LEGALIZACIÓN DE VIAJES</Text>
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

        {secciones.map((sec, i) => {
          if (sec.gastos.length === 0) return null;
          if (sec.columnas === "transporte") {
            return (
              <SeccionTable
                key={i}
                seccion={sec}
                mostrarTrayecto={true}
                ciudadHeader="Ciudad o municipio / trayecto"
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
                ciudadHeader="Ciudad o municipio"
                horaHeader="# Noches"
                rubroInline={false}
              />
            );
          }
          // alimentación / otros
          return (
            <SeccionTable
              key={i}
              seccion={sec}
              mostrarTrayecto={false}
              ciudadHeader="Ciudad o municipio"
              horaHeader="Hora"
              rubroInline={sec.columnas === "otros"}
            />
          );
        })}

        <View style={s.totalGeneral}>
          <Text style={s.totalGeneralLabel}>Total viaje</Text>
          <Text style={s.totalGeneralValue}>{fmtCOP(totalGeneral)}</Text>
        </View>

        <Text style={s.footer}>
          Generado automáticamente por Portal CampoLimpio — {new Date().toLocaleDateString("es-CO")}
        </Text>
      </Page>
    </Document>
  );
};

export default LegalizacionMensualPDF;
