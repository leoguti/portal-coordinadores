/**
 * Script para verificar el schema de Airtable usando el API de metadata
 * Esto es más confiable que leer registros individuales
 */

import { config } from "dotenv";
import { resolve } from "path";

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), ".env.local") });

async function getAirtableSchema() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Credenciales de Airtable no configuradas");
  }

  // API de metadata de Airtable
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function main() {
  console.log("🔍 VERIFICACIÓN DE SCHEMA EN AIRTABLE\n");
  console.log("=".repeat(60));

  const schema = await getAirtableSchema();

  // Tablas que necesitamos verificar
  const tablasRequeridas = [
    "Kardex",
    "Ordenes",
    "ItemsOrden",
    "Terceros",
    "CatalogoServicios",
  ];

  // Campos esperados por tabla
  const camposEsperados: Record<string, string[]> = {
    Kardex: [
      "idkardex",
      "fechakardex",
      "TipoMovimiento",
      "Coordinador",
      "EstadoPago",
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

  // Verificar cada tabla
  for (const nombreTabla of tablasRequeridas) {
    console.log(`\n📋 Tabla: ${nombreTabla}`);
    console.log("-".repeat(60));

    const tabla = schema.tables.find(
      (t: any) => t.name === nombreTabla
    );

    if (!tabla) {
      console.log(`❌ NO EXISTE en Airtable`);
      continue;
    }

    console.log(`✅ Existe (ID: ${tabla.id})`);
    console.log(`   Total de campos: ${tabla.fields.length}`);

    // Obtener nombres de campos
    const camposEnTabla = tabla.fields.map((f: any) => f.name);
    const esperados = camposEsperados[nombreTabla] || [];

    // Comparar
    const existentes = esperados.filter((campo) =>
      camposEnTabla.includes(campo)
    );
    const faltantes = esperados.filter(
      (campo) => !camposEnTabla.includes(campo)
    );

    console.log(`\n   Campos esperados (${esperados.length}):`);
    esperados.forEach((campo) => {
      const existe = camposEnTabla.includes(campo);
      const icono = existe ? "✓" : "✗";
      const alerta = existe ? "" : " ⚠️";
      console.log(`   ${icono} ${campo}${alerta}`);
    });

    if (faltantes.length > 0) {
      console.log(`\n   ⚠️  FALTAN ${faltantes.length} campos:`);
      faltantes.forEach((campo) => {
        console.log(`      • ${campo}`);
      });
    } else if (esperados.length > 0) {
      console.log(`\n   ✅ Todos los campos esperados existen`);
    }

    // Mostrar TODOS los campos
    console.log(`\n   Todos los campos en Airtable:`);
    camposEnTabla.forEach((campo: string) => {
      const esEsperado = esperados.includes(campo);
      const marcador = esEsperado ? "  " : "* ";
      console.log(`   ${marcador}${campo}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Verificación completada\n");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
