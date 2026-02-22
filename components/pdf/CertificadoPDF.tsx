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
    nombre: "TRANSFORMACIONES GIRASOL SAS",
    nit: "900636048-8",
    resolucion:
      "Resolución No. 112-3986 del 03 de octubre de 2013 Resolución 112 4731 del 13 de Noviembre de 2013.",
    autoridad: "CORNARE",
    proceso: "RECICLAJE",
  },
  {
    nombre: "Maderas Plásticas Ecológicas -German Valencia",
    nit: "10,136,661",
    resolucion: "0100 N° 0150-0161 del 11 marzo 2015",
    autoridad: "CVC",
    proceso: "RECICLAJE",
  },
  {
    nombre: "HOLCIM COLOMBIA S.A. - ECO PROCESAMIENTO LTDA",
    nit: "860.009.808-5",
    resolucion: "Res. 005 de 2033 del Min. Ambiente",
    autoridad: "CORPOBOYACA",
    proceso: "COPROCESAMIENTO",
  },
  {
    nombre: "OPERADORES DE SERVICIOS DE LA SIERRA S.A.S E.S.P.",
    nit: "819003805-7",
    resolucion:
      "RESOLUCIÓN LICENCIA AMBIENTAL:4395 de 03 de octubre de 2019",
    autoridad: "CORPAMAG",
    proceso: "CELDA DE SEGURIDAD",
  },
  {
    nombre: "INDUSTRIA AMBIENTAL SAS",
    nit: "900916121-1",
    resolucion: "374 DE 2016",
    autoridad: "EPA",
    proceso: "INCINERACIÓN CON APROVECHAMIENTO ENERGÉTICO",
  },
  {
    nombre: "INDUSTRIA AMBIENTAL SAS",
    nit: "900916121-1",
    resolucion: "0345 DE 2018",
    autoridad: "CVC",
    proceso: "INCINERACION",
  },
  {
    nombre: "ECOLOGÍA Y ENTORNO SA ESP",
    nit: "80019344-6",
    resolucion: "00491 DE 2020",
    autoridad: "CAR",
    proceso: "APROVECHAMIENTO ENERGÉTICO",
  },
  {
    nombre: "TECNOLOGÍAS AMBIENTALES DE COLOMBIA S.A. E.S.P. TECNIAMSA",
    nit: "805.001.538-5",
    resolucion: "Res. No. 462 del 26 de Agosto de 2009.",
    autoridad: "CRA",
    proceso: "INCINERACIÓN / CELDA DE SEGURIDAD",
  },
  {
    nombre: "TECNOLOGÍAS AMBIENTALES DE COLOMBIA S.A. E.S.P. TECNIAMSA",
    nit: "805001538-5",
    resolucion: "Res 141 del 4 febrero de 2013.",
    autoridad: "CAR",
    proceso: "CELDA DE SEGURIDAD",
  },
  {
    nombre: "TECNOLOGÍAS AMBIENTALES DE COLOMBIA S.A. E.S.P. TECNIAMSA",
    nit: "900.229.776-6",
    resolucion:
      "Res 455 del 26 marzo de 2013 y Res. No. 2469 del 19 de Octubre de 2009",
    autoridad: "CAR",
    proceso: "INCINERACIÓN",
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
  gestorCol1: { width: "22%", padding: 2, borderRight: "1 solid #000" },
  gestorCol2: { width: "12%", padding: 2, borderRight: "1 solid #000", alignItems: "center" as const },
  gestorCol3: { width: "26%", padding: 2, borderRight: "1 solid #000" },
  gestorCol4: { width: "16%", padding: 2, borderRight: "1 solid #000", alignItems: "center" as const },
  gestorCol5: { width: "24%", padding: 2, alignItems: "center" as const },
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
  } = props;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <View style={s.headerLogoCell}>
            <Image src={LOGO_BASE64} style={s.headerLogo} />
          </View>
          <View style={s.headerTitleCell}>
            <Text style={s.headerTitle}>CERTIFICADO DEVOLUCIÓN DE ENVASES</Text>
            <Text style={s.headerSubtitle}>
              EMPAQUES Y EMBALAJES DE PLAGUICIDAS
            </Text>
            <Text style={s.headerNit}>NIT .900.235.428-2</Text>
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

        {/* Row 3: Direccion + Cultivo */}
        <View style={s.genRow}>
          <View style={[s.cell, { width: "16%" }]}>
            <Text style={s.labelText}>Dirección/Finca</Text>
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
            <Text style={s.labelText}>Municipio/Depto</Text>
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
            <Text style={s.gestorHeaderText}>NIT</Text>
          </View>
          <View style={[s.gestorCol3, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>RESOLUCIÓN LICENCIA AMBIENTAL</Text>
          </View>
          <View style={[s.gestorCol4, { justifyContent: "center" }]}>
            <Text style={s.gestorHeaderText}>
              AUTOR AMBIENTAL QUE EMITIÓ LA LICENCIA
            </Text>
          </View>
          <View style={[s.gestorCol5, { justifyContent: "center" }]}>
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
              <Text style={s.gestorText}>{g.nit}</Text>
            </View>
            <View style={[s.gestorCol3, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.resolucion}</Text>
            </View>
            <View style={[s.gestorCol4, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.autoridad}</Text>
            </View>
            <View style={[s.gestorCol5, { justifyContent: "center" }]}>
              <Text style={s.gestorText}>{g.proceso}</Text>
            </View>
          </View>
        ))}

        {/* ============ LEGAL TEXT (with bold fragments) ============ */}
        <View style={s.legalBlock}>
          <Text>
            <Text style={s.legalNormal}>En cumplimiento de la Resolución 1675 de Diciembre de 2013 la </Text>
            <Text style={s.legalBold}>Corporación Campo Limpio</Text>
            <Text style={s.legalNormal}> ejecuta el Plan de Devolución de Productos Postconsumo de plaguicidas en representación de las empresas.</Text>
          </Text>
        </View>

        <View style={s.legalBlock}>
          <Text>
            <Text style={s.legalBold}>AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES POR PARTE DE CORPORACIÓN CAMPO LIMPIO, </Text>
            <Text style={s.legalNormal}>sus filiales, subordinadas y quien represente sus derechos. Con el propósito de dar un adecuado tratamiento a sus datos personales de acuerdo al Régimen General de Protección de Datos Personales reglamentado por la Constitución Política Nacional, la Ley 1581 de 2012 y el Decreto 1377 de 2013, que desarrolla los derechos constitucionales que tienen las personas de </Text>
            <Text style={s.legalBold}>conocer, actualizar y rectificar </Text>
            <Text style={s.legalNormal}>todo tipo de información que de ellas sea objeto de tratamiento en bases de datos de entidades públicas y/o privadas, y siendo primordial para </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPO LIMPIO </Text>
            <Text style={s.legalNormal}>contar con su consentimiento previo, expreso y escrito, para el mencionado tratamiento, le informamos que </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPO LIMPIO </Text>
            <Text style={s.legalNormal}>pone a su disposición una </Text>
            <Text style={s.legalBold}>Política de Tratamiento de Datos</Text>
            <Text style={s.legalNormal}>, por medio de la cual se establecen los parámetros para tratar la información contenida en los Bancos y Bases de Datos de la Compañía, que usted podrá consultar en la página web: www.campolimpio.org </Text>
            <Text style={s.legalBold}>a) </Text>
            <Text style={s.legalNormal}>El tratamiento que se dará a sus datos personales consistirá en la recolección, el almacenamiento y el uso de los mismos, entre otros contenidos en el Artículo 1) de nuestra Política de Tratamiento de Datos. </Text>
            <Text style={s.legalBold}>b) </Text>
            <Text style={s.legalNormal}>La finalidad con la que serán tratados sus datos se encuentran contenidas en el artículo 3) de nuestra Política. </Text>
            <Text style={s.legalBold}>c) </Text>
            <Text style={s.legalNormal}>Usted, como titular de sus datos personales, tiene todo el derecho de conocer, corregir, actualizar, rectificar o suprimir los datos personales que suministra a </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPO LIMPIO</Text>
            <Text style={s.legalNormal}>, entre otros más contenidos en el artículo 5) de la Política de Tratamiento de Datos. </Text>
            <Text style={s.legalBold}>d) </Text>
            <Text style={s.legalNormal}>Usted podrá ejercer sus derechos, de conformidad con el Artículo 10) de nuestra Política, enviando su petición, queja o reclamo, al área administrativa al correo electrónico administrativa@campolimpio.org, o a la dirección Av. Cra 9 # 113 – 52 of 607 en la Ciudad de Bogotá, Colombia. </Text>
            <Text style={s.legalBold}>e) </Text>
            <Text style={s.legalNormal}>Usted se encuentra facultado para no dar información respecto de datos sensibles o aquellos de los niños, niñas y adolescentes. </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPO LIMPIO </Text>
            <Text style={s.legalNormal}>de acuerdo a lo reglamentado por el artículo 10 del Decreto 1377 de 2013, queda autorizada de manera inequívoca y expresa para tratar sus datos personales. Sin embargo, usted podrá revocar la presente autorización manifestándolo al correo electrónico administrativa@campolimpio.org o enviando comunicación a la dirección Av. Cra 9 # 113 – 52 of 607 en la Ciudad de Bogotá, Colombia. Para </Text>
            <Text style={s.legalBold}>CORPORACIÓN CAMPO LIMPIO </Text>
            <Text style={s.legalNormal}>es muy grato contar con su colaboración.</Text>
          </Text>
        </View>

        {/* Authorization line */}
        <View style={s.authLine}>
          <Text>
            <Text style={s.authLineBold}>
              Autoriza a la CORPORACIÓN CAMPO LIMPIO para el tratamiento de datos
              de acuerdo a la política (
            </Text>
            <Text style={[s.authLineBold, { color: "#006400" }]}> SI </Text>
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
