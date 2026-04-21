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
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottom: "2 solid #042726",
    paddingBottom: 8,
  },
  logo: { width: 100, height: 34 },
  title: { fontSize: 14, fontWeight: "bold", color: "#042726" },
  subtitle: { fontSize: 11, color: "#00d084", marginTop: 2 },
  version: { fontSize: 8, color: "#666" },

  infoBox: {
    marginBottom: 12,
    backgroundColor: "#f5f7f5",
    padding: 8,
    borderRadius: 4,
  },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { fontWeight: "bold", color: "#042726", width: 110 },
  infoValue: { color: "#1a2e1a" },

  sectionHeader: {
    backgroundColor: "#042726",
    color: "white",
    padding: 5,
    marginTop: 8,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  sectionDesc: {
    backgroundColor: "#f0f4f0",
    padding: 4,
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
  tableHeaderCell: { fontSize: 7.5, fontWeight: "bold", color: "#042726", paddingHorizontal: 3 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#d0d0d0",
    paddingVertical: 3,
    minHeight: 18,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  tableCell: { fontSize: 8, paddingHorizontal: 3, color: "#222" },

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
    marginTop: 15,
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
    bottom: 20,
    left: 30,
    right: 30,
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

function SeccionTransporte({ seccion }: { seccion: Seccion }) {
  return (
    <>
      <Text style={s.sectionHeader}>{seccion.titulo}</Text>
      {seccion.descripcion && <Text style={s.sectionDesc}>{seccion.descripcion}</Text>}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "5%" }]}>#</Text>
          <Text style={[s.tableHeaderCell, { width: "10%" }]}>Fecha</Text>
          <Text style={[s.tableHeaderCell, { width: "8%" }]}>Hora</Text>
          <Text style={[s.tableHeaderCell, { width: "17%" }]}>Rubro</Text>
          <Text style={[s.tableHeaderCell, { width: "19%" }]}>Descripción</Text>
          <Text style={[s.tableHeaderCell, { width: "16%" }]}>Trayecto</Text>
          <Text style={[s.tableHeaderCell, { width: "13%", textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: "12%" }]}>Soporte</Text>
        </View>
        {seccion.gastos.map((g, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: "5%" }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: "10%" }]}>{fmtFecha(g.fecha)}</Text>
            <Text style={[s.tableCell, { width: "8%" }]}>{g.hora || "—"}</Text>
            <Text style={[s.tableCell, { width: "17%" }]}>{g.rubroNombre || "—"}</Text>
            <Text style={[s.tableCell, { width: "19%" }]}>{g.descripcion || "—"}</Text>
            <Text style={[s.tableCell, { width: "16%" }]}>
              {g.municipio || "—"}
              {g.municipioDestino ? ` → ${g.municipioDestino}` : ""}
            </Text>
            <Text style={[s.tableCell, { width: "13%", textAlign: "right", fontFamily: "Courier" }]}>
              {fmtCOP(g.valor)}
            </Text>
            <Text style={[s.tableCell, { width: "12%", fontSize: 7 }]}>
              {g.tipoSoporte || ""}{g.numeroSoporte ? `\n#${g.numeroSoporte}` : ""}
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

function SeccionHospedaje({ seccion }: { seccion: Seccion }) {
  return (
    <>
      <Text style={s.sectionHeader}>{seccion.titulo}</Text>
      {seccion.descripcion && <Text style={s.sectionDesc}>{seccion.descripcion}</Text>}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "5%" }]}>#</Text>
          <Text style={[s.tableHeaderCell, { width: "11%" }]}>Fecha</Text>
          <Text style={[s.tableHeaderCell, { width: "8%" }]}>Noches</Text>
          <Text style={[s.tableHeaderCell, { width: "16%" }]}>Rubro</Text>
          <Text style={[s.tableHeaderCell, { width: "22%" }]}>Descripción</Text>
          <Text style={[s.tableHeaderCell, { width: "13%" }]}>Municipio</Text>
          <Text style={[s.tableHeaderCell, { width: "13%", textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: "12%" }]}>Soporte</Text>
        </View>
        {seccion.gastos.map((g, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: "5%" }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: "11%" }]}>{fmtFecha(g.fecha)}</Text>
            <Text style={[s.tableCell, { width: "8%", textAlign: "center" }]}>{g.noches ?? "—"}</Text>
            <Text style={[s.tableCell, { width: "16%" }]}>{g.rubroNombre || "—"}</Text>
            <Text style={[s.tableCell, { width: "22%" }]}>{g.descripcion || "—"}</Text>
            <Text style={[s.tableCell, { width: "13%" }]}>{g.municipio || "—"}</Text>
            <Text style={[s.tableCell, { width: "13%", textAlign: "right", fontFamily: "Courier" }]}>
              {fmtCOP(g.valor)}
            </Text>
            <Text style={[s.tableCell, { width: "12%", fontSize: 7 }]}>
              {g.tipoSoporte || ""}{g.numeroSoporte ? `\n#${g.numeroSoporte}` : ""}
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

function SeccionSimple({ seccion }: { seccion: Seccion }) {
  // Para alimentación, otros: sin hora/noches/trayecto
  return (
    <>
      <Text style={s.sectionHeader}>{seccion.titulo}</Text>
      {seccion.descripcion && <Text style={s.sectionDesc}>{seccion.descripcion}</Text>}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "5%" }]}>#</Text>
          <Text style={[s.tableHeaderCell, { width: "10%" }]}>Fecha</Text>
          <Text style={[s.tableHeaderCell, { width: "18%" }]}>Rubro</Text>
          <Text style={[s.tableHeaderCell, { width: "28%" }]}>Descripción</Text>
          <Text style={[s.tableHeaderCell, { width: "15%" }]}>Municipio</Text>
          <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: "12%" }]}>Soporte</Text>
        </View>
        {seccion.gastos.map((g, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, { width: "5%" }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: "10%" }]}>{fmtFecha(g.fecha)}</Text>
            <Text style={[s.tableCell, { width: "18%" }]}>{g.rubroNombre || "—"}</Text>
            <Text style={[s.tableCell, { width: "28%" }]}>{g.descripcion || "—"}</Text>
            <Text style={[s.tableCell, { width: "15%" }]}>{g.municipio || "—"}</Text>
            <Text style={[s.tableCell, { width: "12%", textAlign: "right", fontFamily: "Courier" }]}>
              {fmtCOP(g.valor)}
            </Text>
            <Text style={[s.tableCell, { width: "12%", fontSize: 7 }]}>
              {g.tipoSoporte || ""}{g.numeroSoporte ? `\n#${g.numeroSoporte}` : ""}
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
            <Text style={s.title}>FORMATO PARA LEGALIZACIÓN DE GASTOS</Text>
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
          if (sec.columnas === "transporte") return <SeccionTransporte key={i} seccion={sec} />;
          if (sec.columnas === "hospedaje") return <SeccionHospedaje key={i} seccion={sec} />;
          return <SeccionSimple key={i} seccion={sec} />;
        })}

        <View style={s.totalGeneral}>
          <Text style={s.totalGeneralLabel}>Total viaje / mes</Text>
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
