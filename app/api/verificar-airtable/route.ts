import { NextResponse } from "next/server";

interface TableCheck {
  tableName: string;
  exists: boolean;
  fields?: string[];
  recordCount?: number;
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
    // Intentar obtener 1 registro de la tabla
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
      tableName
    )}?maxRecords=1`;

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
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    // Extraer campos del primer registro (si existe)
    const fields =
      data.records && data.records.length > 0
        ? Object.keys(data.records[0].fields).sort()
        : [];

    return {
      tableName,
      exists: true,
      fields,
      recordCount: data.records?.length || 0,
    };
  } catch (error) {
    return {
      tableName,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
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
      "EstadoPago", // ⚠️ CRÍTICO
      "Total",
      "MunicipioOrigen",
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

  const results: Array<
    TableCheck & { expected: string[]; missing: string[]; extra: string[] }
  > = [];

  for (const tableName of tablesToCheck) {
    const result = await checkTable(tableName);
    const expected = expectedFields[tableName] || [];
    const found = result.fields || [];

    const missing = expected.filter((field) => !found.includes(field));
    const extra = found.filter((field) => !expected.includes(field));

    results.push({
      ...result,
      expected,
      missing,
      extra,
    });
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    baseId: process.env.AIRTABLE_BASE_ID,
    results,
  });
}
