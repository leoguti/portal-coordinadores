/**
 * Script para verificar el estado de las tablas de Airtable
 * Verifica qué campos existen y cuáles faltan para Órdenes de Servicio
 */

import { config } from "dotenv";
import { resolve } from "path";

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), ".env.local") });

interface TableCheck {
  tableName: string;
  exists: boolean;
  fields?: string[];
  sampleRecord?: any;
  error?: string;
}

async function checkTable(tableName: string): Promise<TableCheck> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return {
      tableName,
      exists: false,
      error: "Credenciales de Airtable no configuradas",
    };
  }

  try {
    // Obtener MÚLTIPLES registros para encontrar todos los campos posibles
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
      tableName
    )}?maxRecords=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        tableName,
        exists: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    const data = await response.json();

    // Combinar campos de TODOS los registros para encontrar todos los posibles
    const allFieldsSet = new Set<string>();
    if (data.records && data.records.length > 0) {
      data.records.forEach((record: any) => {
        Object.keys(record.fields).forEach((field) => {
          allFieldsSet.add(field);
        });
      });
    }

    const fields = Array.from(allFieldsSet).sort();

    return {
      tableName,
      exists: true,
      fields,
      sampleRecord: data.records?.[0]?.fields || null,
    };
  } catch (error) {
    return {
      tableName,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🔍 VERIFICACIÓN DE TABLAS EN AIRTABLE\n");
  console.log("=" .repeat(60));

  // Tablas a verificar
  const tablesToCheck = [
    "Kardex",
    "Ordenes",
    "ItemsOrden",
    "Terceros",
    "CatalogoServicios",
  ];

  // Campos esperados por tabla
  const expectedFields: Record<string, string[]> = {
    Kardex: [
      "idkardex",
      "fechakardex",
      "TipoMovimiento",
      "Coordinador",
      "EstadoPago", // ⚠️ CRÍTICO - Este es el que necesitamos verificar
      "Total",
    ],
    Ordenes: [
      "NumeroOrden",
      "Coordinador",
      "Beneficiario",
      "Fecha de pedido",
      "Estado",
      "ItemsOrden",
    ],
    ItemsOrden: [
      "Name",
      "Orden",
      "TipoItem",
      "Kardex",
      "Servicio",
      "FormaCobro",
      "Cantidad",
      "Precio Unitario",
      "Subtotal",
    ],
    Terceros: ["RazonSocial", "NIT", "Direccion"],
    CatalogoServicios: ["Nombre", "Descripcion", "UnidadMedida", "Activo"],
  };

  for (const tableName of tablesToCheck) {
    console.log(`\n📋 Tabla: ${tableName}`);
    console.log("-".repeat(60));

    const result = await checkTable(tableName);

    if (!result.exists) {
      console.log(`❌ NO EXISTE o ERROR`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      continue;
    }

    console.log(`✅ Existe`);
    console.log(`   Campos encontrados: ${result.fields?.length || 0}`);

    // Comparar con campos esperados
    const expected = expectedFields[tableName] || [];
    const found = result.fields || [];

    // Campos que existen
    const existing = expected.filter((field) => found.includes(field));
    // Campos que faltan
    const missing = expected.filter((field) => !found.includes(field));

    if (expected.length > 0) {
      console.log(`\n   Campos esperados (${expected.length}):`);
      expected.forEach((field) => {
        const exists = found.includes(field);
        const icon = exists ? "✓" : "✗";
        const color = exists ? "" : " ⚠️";
        console.log(`   ${icon} ${field}${color}`);
      });

      if (missing.length > 0) {
        console.log(`\n   ⚠️  FALTAN ${missing.length} campos:`);
        missing.forEach((field) => {
          console.log(`      • ${field}`);
        });
      }
    }

    // Mostrar todos los campos (incluidos los no esperados)
    console.log(`\n   Todos los campos en Airtable:`);
    found.forEach((field) => {
      const isExpected = expected.includes(field);
      const marker = isExpected ? "  " : "* ";
      console.log(`   ${marker}${field}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Verificación completada\n");
}

main().catch(console.error);
