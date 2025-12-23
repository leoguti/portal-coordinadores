/**
 * Script para ver el detalle completo de los campos de ItemsOrden
 * Incluyendo tipo de campo y a qué tabla enlaza
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function getTableDetail(tableName: string) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Credenciales no configuradas");
  }

  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const table = data.tables.find((t: any) => t.name === tableName);

  return table;
}

async function main() {
  console.log("🔍 DETALLE DE CAMPOS - ItemsOrden\n");
  console.log("=".repeat(70));

  const table = await getTableDetail("ItemsOrden");

  if (!table) {
    console.log("❌ Tabla no encontrada");
    return;
  }

  console.log(`\n📋 Tabla: ${table.name} (${table.id})`);
  console.log(`   Total de campos: ${table.fields.length}\n`);

  // Mostrar cada campo con su tipo y opciones
  table.fields.forEach((field: any) => {
    console.log(`\n📌 ${field.name}`);
    console.log(`   Tipo: ${field.type}`);

    // Si es multipleRecordLinks, mostrar a qué tabla enlaza
    if (field.type === "multipleRecordLinks" && field.options?.linkedTableId) {
      // Buscar el nombre de la tabla enlazada
      const linkedTableId = field.options.linkedTableId;
      console.log(`   Enlaza a tabla ID: ${linkedTableId}`);

      // Buscar nombre de la tabla
      const linkedTable = (global as any).allTables?.find(
        (t: any) => t.id === linkedTableId
      );
      if (linkedTable) {
        console.log(`   ➜ Tabla: ${linkedTable.name}`);
      }
    }

    // Si es singleSelect o multipleSelects, mostrar opciones
    if (
      (field.type === "singleSelect" || field.type === "multipleSelects") &&
      field.options?.choices
    ) {
      console.log(`   Opciones:`);
      field.options.choices.forEach((choice: any) => {
        console.log(`     - ${choice.name}`);
      });
    }

    // Si es fórmula, mostrar la fórmula
    if (field.type === "formula" && field.options?.formula) {
      console.log(`   Fórmula: ${field.options.formula}`);
    }
  });

  console.log("\n" + "=".repeat(70));
}

// Primero obtener todas las tablas para resolver los IDs
async function mainWithContext() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  (global as any).allTables = data.tables;

  await main();
}

mainWithContext().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
