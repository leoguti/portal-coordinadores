import React from "react";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { styles } from "./pdfStyles";
import LOGO_BASE64 from "./logoBase64";

interface ItemOrden {
  id: string;
  tipo: "KARDEX" | "CATALOGO";
  descripcion: string;
  rubroNombre?: string;
  kardexId?: string;
  catalogoId?: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fotoBasculaUrl?: string;
  fotoBasculaEsPdf?: boolean;
}

interface OrdenServicioPDFProps {
  numeroOrden: number;
  coordinador: {
    nombre: string;
    email: string;
  };
  beneficiario: {
    razonSocial: string;
    nit: string;
    direccion: string;
  };
  fechaPedido: string;
  estado: string;
  items: ItemOrden[];
  total: number;
  observaciones?: string;
  soportesOrden?: Array<{ url: string; filename: string }>;
}

const OrdenServicioPDF: React.FC<OrdenServicioPDFProps> = ({
  numeroOrden,
  coordinador,
  beneficiario,
  fechaPedido,
  estado,
  items,
  total,
  observaciones,
  soportesOrden,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image src={LOGO_BASE64} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>ORDEN DE SERVICIO</Text>
            <Text style={styles.orderNumber}>N° {numeroOrden}</Text>
          </View>
        </View>

        {/* Beneficiario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beneficiario</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Razón Social:</Text>
            <Text style={styles.value}>{beneficiario.razonSocial}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>NIT:</Text>
            <Text style={styles.value}>{beneficiario.nit}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Dirección:</Text>
            <Text style={styles.value}>{beneficiario.direccion}</Text>
          </View>
        </View>

        {/* Coordinador */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coordinador</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nombre:</Text>
            <Text style={styles.value}>{coordinador.nombre}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{coordinador.email}</Text>
          </View>
        </View>

        {/* Información de la Orden */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>{formatDate(fechaPedido)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Estado:</Text>
            <Text style={styles.value}>{estado}</Text>
          </View>
        </View>

        {/* Tabla de Items */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>Items de la Orden</Text>
          
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>#</Text>
            <Text style={styles.col2}>Descripción</Text>
            <Text style={styles.col3}>Cantidad</Text>
            <Text style={styles.col4}>Precio Unit.</Text>
            <Text style={styles.col5}>Subtotal</Text>
          </View>

          {/* Rows */}
          {items.map((item, index) => (
            <View
              key={item.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={styles.col1}>{index + 1}</Text>
              <Text style={styles.col2}>
                {item.descripcion}
                {"\n"}
                {item.rubroNombre && (
                  <Text style={{ fontSize: 7, color: "#9ca3af" }}>
                    Rubro: {item.rubroNombre}{"  "}
                  </Text>
                )}
                <Text style={{ fontSize: 8, color: "#6b7280" }}>
                  ({item.formaCobro})
                </Text>
              </Text>
              <Text style={styles.col3}>
                {item.cantidad} {item.formaCobro === "Por Kilo" ? "kg" : "flete"}
              </Text>
              <Text style={styles.col4}>{formatCurrency(item.precioUnitario)}</Text>
              <Text style={styles.col5}>{formatCurrency(item.subtotal)}</Text>
            </View>
          ))}

          {/* Total Row inside table */}
          <View style={styles.totalRowInTable}>
            <Text style={styles.totalLabelInTable}>TOTAL:</Text>
            <Text style={styles.totalValueInTable}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Observaciones */}
        {observaciones && (
          <View style={styles.observaciones}>
            <Text style={styles.observacionesTitle}>OBSERVACIONES:</Text>
            <Text style={styles.observacionesText}>{observaciones}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          CampoLimpio - Programa de Manejo de Envases Vacíos
          {"\n"}
          Documento generado automáticamente el {new Date().toLocaleString("es-CO")}
        </Text>
      </Page>

      {/* Anexo 1: Soportes de Báscula (Kardex) */}
      {items.some(item => item.tipo === "KARDEX") && (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.annexTitle}>
            Anexo 1 - Soportes de Báscula (Kardex)
          </Text>
          <Text style={styles.annexSubtitle}>
            Orden de Servicio N° {numeroOrden}
          </Text>

          <View style={styles.photoGrid}>
            {items
              .filter(item => item.tipo === "KARDEX" && item.fotoBasculaUrl)
              .map((item) => (
                <View key={item.id} style={styles.photoItem}>
                  <Image src={item.fotoBasculaUrl} style={styles.photoImage} />
                  <Text style={styles.photoCaption}>{item.descripcion}</Text>
                </View>
              ))}
          </View>

          {items.some(item => item.tipo === "KARDEX" && !item.fotoBasculaUrl && item.fotoBasculaEsPdf) && (
            <View style={styles.pdfAnexoBox}>
              <Text style={styles.pdfAnexoTitle}>
                Soportes en formato PDF — anexados como páginas al final de este documento:
              </Text>
              {items
                .filter(item => item.tipo === "KARDEX" && !item.fotoBasculaUrl && item.fotoBasculaEsPdf)
                .map((item) => (
                  <Text key={item.id} style={styles.pdfAnexoRow}>• {item.descripcion}</Text>
                ))}
            </View>
          )}

          {items.some(item => item.tipo === "KARDEX" && !item.fotoBasculaUrl && !item.fotoBasculaEsPdf) && (
            <View style={styles.sinSoporteBox}>
              <Text style={styles.pdfAnexoTitle}>Sin soporte de báscula:</Text>
              {items
                .filter(item => item.tipo === "KARDEX" && !item.fotoBasculaUrl && !item.fotoBasculaEsPdf)
                .map((item) => (
                  <Text key={item.id} style={styles.pdfAnexoRow}>• {item.descripcion}</Text>
                ))}
            </View>
          )}

          <Text style={styles.footer}>
            CampoLimpio - Programa de Manejo de Envases Vacíos
            {"\n"}
            Documento generado automáticamente el {new Date().toLocaleString("es-CO")}
          </Text>
        </Page>
      )}

      {/* Anexo 2: Soportes de Báscula (Orden) */}
      {soportesOrden && soportesOrden.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.annexTitle}>
            Anexo 2 - Soportes de Báscula (Orden)
          </Text>
          <Text style={styles.annexSubtitle}>
            Orden de Servicio N° {numeroOrden}
          </Text>

          <View style={styles.photoGrid}>
            {soportesOrden.map((soporte, index) => (
              <View key={`soporte-${index}`} style={styles.photoItem}>
                <Image src={soporte.url} style={styles.photoImage} />
                <Text style={styles.photoCaption}>{soporte.filename}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>
            CampoLimpio - Programa de Manejo de Envases Vacíos
            {"\n"}
            Documento generado automáticamente el {new Date().toLocaleString("es-CO")}
          </Text>
        </Page>
      )}
    </Document>
  );
};

export default OrdenServicioPDF;
