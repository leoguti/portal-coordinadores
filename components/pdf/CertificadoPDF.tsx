import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import LOGO_BASE64 from "./logoBase64";

// ---------- Types ----------
export interface CertificadoPDFProps {
  consecutivo: number;
  // Generador
  nombregenerador: string;
  cedulagenerador: string;
  movilgenerador: string;
  direcciongenerador: string;
  cultivogenerador: string;
  emailgenerador: string;
  municipiogenerador: string;
  tipogenerador: string;
  // Finca (esquema nuevo GENERADORES + FINCAS). En la vía legacy
  // (`link_ubicacion`) puede llegar vacío y el PDF lo omite.
  nombrefinca?: string;
  // Materiales
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  total: number;
  triplelavado: string;
  // Devolucion
  lugardevolucion: string;
  municipiodevolucion: string;
  fechadevolucion: string;
  // Coordinador
  nombrecoordinador: string;
  movilcoordinador: string;
  emailcoordinador: string;
  // Otros
  observaciones: string;
}

// ---------- Gestores data (static, same for every certificate) ----------
const GESTORES = [
  {
    nombre: "Holcim Colombia SA",
    resolucion: "Res. 620 de 1994 / Res.704 de 2002 / Res. 005 de 2033 del Min. Ambiente",
    autoridad: "Corpoboyacá",
    direccion: "Km 15 vía Duitama-Belencito",
    departamento: "Boyacá",
    proceso: "Coprocesamiento",
  },
  {
    nombre: "German Valencia / Maderas Plásticas Ecológicas",
    resolucion: "0150-0161 marzo 11 del 2015",
    autoridad: "CVC",
    direccion: "Carrera 13 18A-10",
    departamento: "Valle del Cauca",
    proceso: "Reciclaje transformación",
  },
  {
    nombre: "Operadores de Servicios de la Sierra SAS ESP",
    resolucion: "Resolución No 4395 del 03 de octubre del año 2019",
    autoridad: "Corporación Autónoma Regional del Magdalena",
    direccion: "Avenida el Libertador 32-201",
    departamento: "Magdalena",
    proceso: "Celda de seguridad",
  },
  {
    nombre: "Transformaciones Girasol SAS",
    resolucion: "Resolución No. 112-3986 del 03 de octubre de 2013 y la Resolución 112 4731 del 13 de noviembre de 2013.",
    autoridad: "Cornare",
    direccion: "Km 36 Autopista Medellín-Bogotá Vereda La Ceja",
    departamento: "Antioquia",
    proceso: "Reciclaje transformación",
  },
  {
    nombre: "Industria Ambiental SAS",
    resolucion: "Resolución 0191 de 2018 y Resolución 0374 de 2016. Resolución 0100 No. 0150-0968 de 2023, Resolución 0100 No. 0150 - 0628 de 2023 y Resolución 0100 No. 0150 – 0345 de 2018",
    autoridad: "CVC",
    direccion: "Carrera 56 5-33, Palmira",
    departamento: "Valle del Cauca",
    proceso: "Aprovechamiento energético",
  },
  {
    nombre: "Ecología y Entorno SA ESP",
    resolucion: "Resolución 491 de 28 de febrero de 2020",
    autoridad: "CAR",
    direccion: "Vereda Balsillas",
    departamento: "Cundinamarca",
    proceso: "Aprovechamiento energético",
  },
  {
    nombre: "Ática IA4 SAS",
    resolucion: "Resolución 0100 No. 0150-1020 de 2024 (CVC) - cesión total de derechos de Res. 0150-0968/2023, Res. 0150-0628/2023 y Res. 0150-0345/2018",
    autoridad: "CVC",
    direccion: "Carrera 56 5-33, Palmira",
    departamento: "Valle del Cauca",
    proceso: "Aprovechamiento energético",
  },
  {
    nombre: "Recotransforma de Urabá SAS Zomac",
    resolucion: "Resolución No. 200-03-20-01-001590 del 23 de septiembre del 2008",
    autoridad: "Corpourabá",
    direccion: "Km 2 Vía Zungo embarcadero",
    departamento: "Antioquia",
    proceso: "Reciclaje transformación",
  },
  {
    nombre: "Veolia Servicios Industriales Colombia SAS ESP",
    resolucion: "Resolución No. 858 de 2011, cedida parcialmente por Res. 1741/2018, modificada por Res. 877/2015, 053/2022, 070/2023 y 604/2023",
    autoridad: "Corpocesar",
    direccion: "5 km del mpio. de Aguachica, vía corregimiento Puerto Mosquito (Vda. Las Bateas)",
    departamento: "Cesar",
    proceso: "Celda de seguridad",
  },
];

// ---------- Styles ----------
const s = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 25,
    fontSize: 8,
    fontFamily: "Helvetica",
  },

  // ---- Header table ----
  headerRow: {
    flexDirection: "row",
    borderBottom: "1 solid #000",
    marginBottom: 6,
  },
  headerLogoCell: {
    width: "30%",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogo: {
    width: 130,
    height: 52,
  },
  headerTitleCell: {
    width: "45%",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  headerNit: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 2,
  },
  headerCertCell: {
    width: "25%",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCertLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#cc0000",
  },
  headerCertNumber: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#cc0000",
    marginTop: 2,
  },

  // ---- Section header ----
  sectionHeader: {
    backgroundColor: "#d9d9d9",
    padding: 3,
    borderTop: "1 solid #000",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
  },
  sectionHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  // ---- Generator table row (no interior borders) ----
  genRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "0.5 solid #ccc",
    minHeight: 16,
  },
  genRowLast: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 16,
  },
  cell: {
    padding: 3,
    justifyContent: "center",
  },
  cellBorderRight: {
    borderRight: "1 solid #000",
  },
  labelText: {
    fontSize: 7,
    fontFamily: "Helvetica-Oblique",
    color: "#666666",
  },
  valueText: {
    fontSize: 8,
  },
  valueBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },

  // ---- Generic table row (with borders, for other tables) ----
  tableRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 16,
  },

  // ---- Materials table ----
  materialRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 15,
  },
  materialDescCell: {
    width: "83%",
    padding: 3,
    borderRight: "1 solid #000",
    justifyContent: "center",
  },
  materialKgCell: {
    width: "17%",
    padding: 3,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  // ---- Gestores table ----
  gestorHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#d9d9d9",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 14,
  },
  gestorRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 13,
  },
  gestorCol1: { width: "18%", padding: 2, borderRight: "1 solid #000" },
  gestorCol2: { width: "24%", padding: 2, borderRight: "1 solid #000" },
  gestorCol3: { width: "14%", padding: 2, borderRight: "1 solid #000", alignItems: "center" as const },
  gestorCol4: { width: "16%", padding: 2, borderRight: "1 solid #000" },
  gestorCol5: { width: "12%", padding: 2, borderRight: "1 solid #000", alignItems: "center" as const },
  gestorCol6: { width: "16%", padding: 2, alignItems: "center" as const },
  gestorHeaderText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  gestorText: {
    fontSize: 5.5,
  },

  // ---- Legal text ----
  legalBlock: {
    marginTop: 3,
  },
  legalNormal: {
    fontSize: 5.5,
  },
  legalBold: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
  },

  // ---- Devolution section ----
  devRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 16,
  },

  // ---- Footer/coordinator ----
  footerRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    minHeight: 16,
  },

  // ---- Disclaimer ----
  disclaimerRow: {
    flexDirection: "row",
    borderLeft: "1 solid #000",
    borderRight: "1 solid #000",
    borderBottom: "1 solid #000",
    backgroundColor: "#d9d9d9",
    padding: 3,
    justifyContent: "center",
  },
  disclaimerText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  spacer: {
    height: 4,
  },

  // Triple lavado highlight
  triplelavadoText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#006400",
  },

  // Authorization line
  authLine: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: 7,
  },
  authLineBold: {
    fontFamily: "Helvetica-Bold",
  },
});

// ---------- Component ----------
const CertificadoPDF: React.FC<CertificadoPDFProps> = (props) => {
  const {
    consecutivo,
    nombregenerador,
    cedulagenerador,
    movilgenerador,
    direcciongenerador,
    cultivogenerador,
    emailgenerador,
    municipiogenerador,
    tipogenerador,
    rigidos,
    flexibles,
    metalicos,
    embalaje,
    total,
    triplelavado,
    lugardevolucion,
    municipiodevolucion,
    fechadevolucion,
    nombrecoordinador,
    movilcoordinador,
    emailcoordinador,
    observaciones,
    nombrefinca,
  } = props;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <View style={s.headerLogoCell}>
            <Image src={LOGO_BASE64} style={s.headerLogo} />
            <Text style={s.headerNit}>NIT 900.235.428-2</Text>
          </View>
          <View style={s.headerTitleCell}>
            <Text style={s.headerTitle}>CERTIFICADO DEVOLUCIÓN DE ENVASES</Text>
            <Text style={s.headerSubtitle}>
              EMPAQUES Y EMBALAJES DE PLAGUICIDAS
            </Text>
          </View>
          <View style={s.headerCertCell}>
            <Text style={s.headerCertLabel}>CERTIFICADO</Text>
            <Text style={s.headerCertNumber}>No. {consecutivo}</Text>
          </View>
        </View>

        {/* ============ DATOS DEL GENERADOR ============ */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionHeaderText}>DATOS DEL GENERADOR</Text>
        </View>

        {/* Row 1: Nombre + Tipo */}
        <View style={s.genRow}>
          <View style={[s.cell, { width: "16%" }]}>
            <Text style={s.labelText}>Nombre/Razón Social</Text>
          </View>
          <View style={[s.cell, { width: "42%" }]}>
            <Text style={s.valueBold}>{nombregenerador}</Text>
          </View>
          <View style={[s.cell, { width: "12%" }]}>
            <Text style={s.labelText}>Tipo:</Text>
          </View>
          <View style={[s.cell, { width: "30%" }]}>
            <Text style={s.valueText}>{tipogenerador}</Text>
          </View>
        </View>

        {/* Row 2: Cedula + Telefono */}
        <View style={s.genRow}>
          <View style={[s.cell, { width: "16%" }]}>
            <Text style={s.labelText}>Cédula/NIT</Text>
          </View>
          <View style={[s.cell, { width: "42%" }]}>
            <Text style={s.valueText}>{cedulagenerador}</Text>
          </View>
          <View style={[s.cell, { width: "12%" }]}>
            <Text style={s.labelText}>Teléfono Móvil:</Text>
          </View>
          <View style={[s.cell, { width: "30%" }]}>
            <Text style={s.valueText}>{movilgenerador}</Text>
          </View>
        </View>

        {/* Row 3 (NUEVA): Nombre de la finca. Esquema GENERADORES+FINCAS — un
            generador puede tener varias fincas y el cert se emite contra una
            específica. Si llega vacío (legacy via ubicaciones), se oculta. */}
        {nombrefinca ? (
          <View style={s.genRow}>
            <View style={[s.cell, { width: "16%" }]}>
              <Text style={s.labelText}>Finca</Text>
            </View>
            <View style={[s.cell, { width: "84%" }]}>
              <Text style={s.valueBold}>{nombrefinca}</Text>
            </View>
          </View>
        ) : null}

        {/* Row 4: Dirección sede + Cultivo */}
        <View style={s.genRow}>
          <View style={[s.cell, { width: "16%" }]}>
            <Text style={s.labelText}>Dirección sede</Text>
          </View>
          <View style={[s.cell, { width: "42%" }]}>
            <Text style={s.valueText}>{direcciongenerador}</Text>
          </View>
          <View style={[s.cell, { width: "12%" }]}>
            <Text style={s.labelText}>Cultivo:</Text>
          </View>
          <View style={[s.cell, { width: "30%" }]}>
            <Text style={s.valueText}>{cultivogenerador}</Text>
          </View>
        </View>

        {/* Row 4: Email + Municipio (last row, full border bottom) */}
        <View style={s.genRowLast}>
          <View style={[s.cell, { width: "16%" }]}>
            <Text style={s.labelText}>Correo Electrónico</Text>
          </View>
          <View style={[s.cell, { width: "42%" }]}>
            <Text style={s.valueText}>{emailgenerador}</Text>
          </View>
          <View style={[s.cell, { width: "12%" }]}>
            <Text style={s.labelText}>Municipio finca</Text>
          </View>
          <View style={[s.cell, { width: "30%" }]}>
            <Text style={s.valueText}>{municipiogenerador}</Text>
          </View>
        </View>

        <View style={s.spacer} />

        {/* ============ MATERIALES ============ */}
        <View
          style={[
            s.sectionHeader,
            { borderBottom: "1 solid #000" },
          ]}
        >
          <View style={{ flexDirection: "row" }}>
            <View
              style={[
                s.cell,
                s.cellBorderRight,
                { width: "83%", padding: 3 },
              ]}
            >
              <Text style={s.sectionHeaderText}>
                DESCRIPCIÓN DEL MATERIAL DEVUELTO POR EL GENERADOR
              </Text>
            </View>
            <View style={[s.cell, { width: "17%", padding: 3 }]}>
              <Text style={s.sectionHeaderText}>Kilos</Text>
            </View>
          </View>
        </View>

        {/* Rigidos */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Tapas y envases plásticos Rígidos</Text>
          </View>
          <View style={s.materialKgCell}>
            <Text style={s.valueText}>{rigidos} kg</Text>
          </View>
        </View>

        {/* Flexibles */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Flexibles</Text>
          </View>
          <View style={s.materialKgCell}>
            <Text style={s.valueText}>{flexibles} kg</Text>
          </View>
        </View>

        {/* Metalicos */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Envases Metálicos</Text>
          </View>
          <View style={s.materialKgCell}>
            <Text style={s.valueText}>{metalicos} kg</Text>
          </View>
        </View>

        {/* Embalaje */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Embalaje</Text>
          </View>
          <View style={s.materialKgCell}>
            <Text style={s.valueText}>{embalaje} kg</Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Total Entregado</Text>
          </View>
          <View style={s.materialKgCell}>
            <Text style={s.valueBold}>{total} kg</Text>
          </View>
        </View>

        {/* Triple lavado */}
        <View style={s.materialRow}>
          <View style={s.materialDescCell}>
            <Text style={s.valueText}>Triple Lavado</Text>
          </View>
          <View
            style={[s.materialKgCell, { alignItems: "center" }]}
          >
            <Text style={s.triplelavadoText}>{triplelavado}</Text>
          </View>
        </View>

        <View style={s.spacer} />

        {/* ============ GESTORES ============ */}
        {/* Title row */}
        <View
          style={[
            s.gestorHeaderRow,
            { borderTop: "1 solid #000" },
          ]}
        >
          <View style={{ width: "100%", padding: 2 }}>
            <Text style={[s.gestorHeaderText, { fontSize: 7 }]}>
              GESTORES RESIDUOS POSCONSUMO
            </Text>
          </View>
        </View>

        {/* Column headers */}
        <View style={s.gestorHeaderRow}>
          <View style={[s.gestorCol1, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>GESTOR</Text>
          </View>
          <View style={[s.gestorCol2, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>LICENCIA AMBIENTAL</Text>
          </View>
          <View style={[s.gestorCol3, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>AUTORIDAD AMBIENTAL</Text>
          </View>
          <View style={[s.gestorCol4, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>DIRECCIÓN</Text>
          </View>
          <View style={[s.gestorCol5, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>DEPARTAMENTO</Text>
          </View>
          <View style={[s.gestorCol6, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>PROCESO</Text>
          </View>
        </View>

        {/* Gestor rows */}
        {GESTORES.map((g, i) => (
          <View style={s.gestorRow} key={i}>
            <View style={[s.gestorCol1, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.nombre}</Text>
            </View>
            <View style={[s.gestorCol2, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.resolucion}</Text>
            </View>
            <View style={[s.gestorCol3, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.autoridad}</Text>
            </View>
            <View style={[s.gestorCol4, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.direccion}</Text>
            </View>
            <View style={[s.gestorCol5, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.departamento}</Text>
            </View>
            <View style={[s.gestorCol6, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.proceso}</Text>
            </View>
          </View>
        ))}

        {/* ============ LEGAL TEXT (with bold fragments) ============ */}
        <View style={s.legalBlock}>
          <Text>
            <Text style={s.legalBold}>En cumplimiento de la Resolución 1675 de Diciembre de 2013 la Corporación CampoLimpio ejecuta el Plan de Devolución de Productos Postconsumo de plaguicidas en representación de las empresas.</Text>
          </Text>
        </View>

        <View style={s.legalBlock}>
          <Text>
            <Text style={s.legalNormal}>AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES POR PARTE DE </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO, </Text>
            <Text style={s.legalNormal}>sus filiales, subordinadas y quien represente sus derechos. Con el propósito de dar un adecuado tratamiento a sus datos personales de acuerdo al Régimen General de Protección de Datos Personales reglamentado por la Constitución Política Nacional, la Ley 1581 de 2012 y el Decreto 1377 de 2013, que desarrolla los derechos constitucionales que tienen las personas de </Text>
            <Text style={s.legalBold}>conocer, actualizar y rectificar </Text>
            <Text style={s.legalNormal}>todo tipo de información que de ellas sea objeto de tratamiento en bases de datos de entidades públicas y/o privadas, y siendo primordial para </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO </Text>
            <Text style={s.legalNormal}>contar con su consentimiento previo, expreso y escrito, para el mencionado tratamiento, le informamos que </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO </Text>
            <Text style={s.legalNormal}>pone a su disposición una </Text>
            <Text style={s.legalBold}>Política de Tratamiento de Datos</Text>
            <Text style={s.legalNormal}>, por medio de la cual se establecen los parámetros para tratar la información contenida en los Bancos y Bases de Datos de la Compañía, que usted podrá consultar en la página web: www.campolimpio.org </Text>
            <Text style={s.legalBold}>a) </Text>
            <Text style={s.legalNormal}>El tratamiento que se dará a sus datos personales consistirá en la recolección, el almacenamiento y el uso de los mismos, entre otros contenidos en el Artículo 1) de nuestra Política de Tratamiento de Datos. </Text>
            <Text style={s.legalBold}>b) </Text>
            <Text style={s.legalNormal}>La finalidad con la que serán tratados sus datos se encuentran contenidas en el artículo 3) de nuestra Política. </Text>
            <Text style={s.legalBold}>c) </Text>
            <Text style={s.legalNormal}>Usted, como titular de sus datos personales, tiene todo el derecho de conocer, corregir, actualizar, rectificar o suprimir los datos personales que suministra a </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO</Text>
            <Text style={s.legalNormal}>, entre otros más contenidos en el artículo 5) de la Política de Tratamiento de Datos. </Text>
            <Text style={s.legalBold}>d) </Text>
            <Text style={s.legalNormal}>Usted podrá ejercer sus derechos, de conformidad con el Artículo 10) de nuestra Política, enviando su petición, queja o reclamo, al área administrativa al correo electrónico administrativa@campolimpio.org, o a la dirección Calle 98a# 51 - 37 oficina 202 Bogotá, Colombia. </Text>
            <Text style={s.legalBold}>e) </Text>
            <Text style={s.legalNormal}>Usted se encuentra facultado para no dar información respecto de datos sensibles o aquellos de los niños, niñas y adolescentes. </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO </Text>
            <Text style={s.legalNormal}>de acuerdo a lo reglamentado por el artículo 10 del Decreto 1377 de 2013, queda autorizada de manera inequívoca y expresa para tratar sus datos personales. Sin embargo, usted podrá revocar la presente autorización manifestándolo al correo electrónico administrativa@campolimpio.org o enviando comunicación a la dirección Calle 98a# 51 - 37 oficina 202 Bogotá, Colombia. Para </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPOLIMPIO </Text>
            <Text style={s.legalNormal}>es muy grato contar con su colaboración.</Text>
          </Text>
        </View>

        {/* Authorization line */}
        <View style={s.authLine}>
          <Text>
            <Text style={s.authLineBold}>
              Autoriza a la CORPORACIÓN CAMPOLIMPIO para el tratamiento de datos
              de acuerdo a la política (
            </Text>
            <Text style={[s.authLineBold, { color: "#008000", fontSize: 9 }]}> SI </Text>
            <Text style={s.authLineBold}> )</Text>
          </Text>
        </View>

        {/* ============ LUGAR DE DEVOLUCION ============ */}
        <View style={[s.devRow, { borderTop: "1 solid #000" }]}>
          <View style={[s.cell, s.cellBorderRight, { width: "20%" }]}>
            <Text style={s.labelText}>Lugar de Devolución :</Text>
          </View>
          <View style={[s.cell, { width: "80%" }]}>
            <Text style={s.valueBold}>{lugardevolucion}</Text>
          </View>
        </View>

        {/* Municipio + Fecha */}
        <View style={s.devRow}>
          <View style={[s.cell, s.cellBorderRight, { width: "20%" }]}>
            <Text style={s.labelText}>Municipio / Depto :</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "40%" }]}>
            <Text style={s.valueBold}>{municipiodevolucion}</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "10%" }]}>
            <Text style={s.labelText}>Fecha</Text>
          </View>
          <View style={[s.cell, { width: "30%" }]}>
            <Text style={s.valueText}>{fechadevolucion}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimerRow}>
          <Text style={s.disclaimerText}>
            ESTE DOCUMENTO EN NINGÚN CASO REEMPLAZA LOS CERTIFICADOS DE
            DISPOSICIÓN FINAL
          </Text>
        </View>

        <View style={s.spacer} />

        {/* ============ OBSERVACIONES + COORDINADOR ============ */}
        <View style={[s.footerRow, { borderTop: "1 solid #000" }]}>
          <View style={[s.cell, s.cellBorderRight, { width: "14%" }]}>
            <Text style={s.labelText}>Observaciones</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "36%" }]}>
            <Text style={s.valueText}>{observaciones}</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "10%" }]}>
            <Text style={s.labelText}>email:</Text>
          </View>
          <View style={[s.cell, { width: "40%" }]}>
            <Text style={s.valueText}>{emailcoordinador}</Text>
          </View>
        </View>

        <View style={s.footerRow}>
          <View style={[s.cell, s.cellBorderRight, { width: "14%" }]}>
            <Text style={s.labelText}>Nombre Coordinador :</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "36%" }]}>
            <Text style={s.valueText}>{nombrecoordinador}</Text>
          </View>
          <View style={[s.cell, s.cellBorderRight, { width: "10%" }]}>
            <Text style={s.labelText}>Celular Contacto</Text>
          </View>
          <View style={[s.cell, { width: "40%" }]}>
            <Text style={s.valueText}>{movilcoordinador}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CertificadoPDF;
