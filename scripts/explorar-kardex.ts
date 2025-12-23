/**
 * Script para explorar la estructura de datos de Kardex
 * Analiza: Municipios, Centros de Acopio, relación con ENTRADA/SALIDA
 */

import { config } from "dotenv";

config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_TOKEN || !BASE_ID) {
  console.error("❌ Faltan credenciales de Airtable");
  process.exit(1);
}

interface KardexRecord {
  id: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    MunicipioOrigen?: string[];
    "mundep (from MunicipioOrigen)"?: string[];
    CentrodeAcopio?: string[];
    NombreCentrodeAcopio?: string[];
    Total?: number;
    Descripción?: string;
  };
}

async function explorarKardex() {
  console.log("🔍 Explorando datos de Kardex...\n");

  try {
    // Obtener primeros 100 registros de Kardex
    const url = `https://api.airtable.com/v0/${BASE_ID}/Kardex?maxRecords=100&sort[0][field]=fechakardex&sort[0][direction]=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const records: KardexRecord[] = data.records || [];

    console.log(`📊 Total de registros analizados: ${records.length}\n`);

    // Análisis por tipo de movimiento
    const entradas = records.filter(r => r.fields.TipoMovimiento === "ENTRADA");
    const salidas = records.filter(r => r.fields.TipoMovimiento === "SALIDA");

    console.log("═══════════════════════════════════════════════════");
    console.log("ANÁLISIS POR TIPO DE MOVIMIENTO");
    console.log("═══════════════════════════════════════════════════");
    console.log(`ENTRADA: ${entradas.length} registros`);
    console.log(`SALIDA:  ${salidas.length} registros\n`);

    // Análisis de ENTRADAS
    console.log("─────────────────────────────────────────────────");
    console.log("📥 ENTRADAS - Primeros 5 ejemplos:");
    console.log("─────────────────────────────────────────────────");
    entradas.slice(0, 5).forEach((r, i) => {
      console.log(`\n${i + 1}. Kardex #${r.fields.idkardex || "S/N"}`);
      console.log(`   Fecha: ${r.fields.fechakardex || "Sin fecha"}`);
      console.log(`   Municipio: ${r.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio"}`);
      console.log(`   Centro Acopio: ${r.fields.NombreCentrodeAcopio?.[0] || "❌ SIN CENTRO"}`);
      console.log(`   Total kg: ${r.fields.Total || 0}`);
      if (r.fields.Descripción) {
        console.log(`   Descripción: ${r.fields.Descripción}`);
      }
    });

    // Análisis de SALIDAS
    console.log("\n─────────────────────────────────────────────────");
    console.log("📤 SALIDAS - Primeros 5 ejemplos:");
    console.log("─────────────────────────────────────────────────");
    salidas.slice(0, 5).forEach((r, i) => {
      console.log(`\n${i + 1}. Kardex #${r.fields.idkardex || "S/N"}`);
      console.log(`   Fecha: ${r.fields.fechakardex || "Sin fecha"}`);
      console.log(`   Municipio: ${r.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio"}`);
      console.log(`   Centro Acopio: ${r.fields.NombreCentrodeAcopio?.[0] || "❌ SIN CENTRO"}`);
      console.log(`   Total kg: ${Math.abs(r.fields.Total || 0)}`);
      if (r.fields.Descripción) {
        console.log(`   Descripción: ${r.fields.Descripción}`);
      }
    });

    // Estadísticas de Centros de Acopio
    console.log("\n═══════════════════════════════════════════════════");
    console.log("ESTADÍSTICAS DE CENTROS DE ACOPIO");
    console.log("═══════════════════════════════════════════════════");
    
    const entradasConCentro = entradas.filter(r => r.fields.CentrodeAcopio && r.fields.CentrodeAcopio.length > 0);
    const entradasSinCentro = entradas.filter(r => !r.fields.CentrodeAcopio || r.fields.CentrodeAcopio.length === 0);
    
    const salidasConCentro = salidas.filter(r => r.fields.CentrodeAcopio && r.fields.CentrodeAcopio.length > 0);
    const salidasSinCentro = salidas.filter(r => !r.fields.CentrodeAcopio || r.fields.CentrodeAcopio.length === 0);

    console.log(`\nENTRADAS:`);
    console.log(`  ✅ Con Centro: ${entradasConCentro.length} (${((entradasConCentro.length / entradas.length) * 100).toFixed(1)}%)`);
    console.log(`  ❌ Sin Centro: ${entradasSinCentro.length} (${((entradasSinCentro.length / entradas.length) * 100).toFixed(1)}%)`);

    console.log(`\nSALIDAS:`);
    console.log(`  ✅ Con Centro: ${salidasConCentro.length} (${((salidasConCentro.length / salidas.length) * 100).toFixed(1)}%)`);
    console.log(`  ❌ Sin Centro: ${salidasSinCentro.length} (${((salidasSinCentro.length / salidas.length) * 100).toFixed(1)}%)`);

    // Listado de centros únicos
    console.log("\n═══════════════════════════════════════════════════");
    console.log("CENTROS DE ACOPIO ÚNICOS");
    console.log("═══════════════════════════════════════════════════");
    
    const centrosUnicos = new Set<string>();
    records.forEach(r => {
      const nombreCentro = r.fields.NombreCentrodeAcopio?.[0];
      if (nombreCentro) {
        centrosUnicos.add(nombreCentro);
      }
    });

    console.log(`\nTotal de centros únicos: ${centrosUnicos.size}`);
    Array.from(centrosUnicos).sort().forEach((centro, i) => {
      console.log(`  ${i + 1}. ${centro}`);
    });

    console.log("\n✅ Análisis completado");

  } catch (error) {
    console.error("❌ Error explorando Kardex:", error);
  }
}

explorarKardex();
