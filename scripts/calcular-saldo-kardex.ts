import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const COORDINATOR_ID = 'recAyIGnWii8xNSYn';
const CUTOFF_DATE = '2025-12-31';

interface KardexRecord {
  id: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    Total?: number;
    Reciclaje?: number;
    Incineracion?: number;
    Flexibles?: number;
    PlasticoContaminado?: number;
    Lonas?: number;
    Carton?: number;
    Metal?: number;
  };
}

async function fetchAllKardex(): Promise<KardexRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error('Missing Airtable credentials');
  }

  const allRecords: KardexRecord[] = [];
  let offset: string | undefined;

  do {
    const filterFormula = `AND(FIND("${COORDINATOR_ID}", ARRAYJOIN({idcoordinador})), {fechakardex} <= "${CUTOFF_DATE}")`;
    const url = new URL(`https://api.airtable.com/v0/${baseId}/Kardex`);
    url.searchParams.append('filterByFormula', filterFormula);
    url.searchParams.append('pageSize', '100');
    url.searchParams.append('sort[0][field]', 'fechakardex');
    url.searchParams.append('sort[0][direction]', 'asc');
    if (offset) url.searchParams.append('offset', offset);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;

    console.log(`Fetched ${data.records?.length || 0} records (total: ${allRecords.length})`);
  } while (offset);

  return allRecords;
}

async function calculateKardexBalance() {
  console.log('🔍 CALCULANDO SALDO HISTÓRICO DE KARDEX');
  console.log('=' .repeat(70));
  console.log(`Coordinador: recAyIGnWii8xNSYn (Andrea Villarraga - Boyaca)`);
  console.log(`Fecha de corte: ${CUTOFF_DATE}`);
  console.log('=' .repeat(70));
  console.log('');

  const records = await fetchAllKardex();

  console.log(`\n📊 TOTAL DE REGISTROS: ${records.length}\n`);

  // Separar por tipo de movimiento
  const entradas = records.filter(r => r.fields.TipoMovimiento === 'ENTRADA');
  const salidas = records.filter(r => r.fields.TipoMovimiento === 'SALIDA');

  console.log(`📥 ENTRADAS: ${entradas.length} registros`);
  console.log(`📤 SALIDAS: ${salidas.length} registros\n`);

  // Calcular totales
  const totalEntradas = entradas.reduce((sum, r) => sum + Math.abs(r.fields.Total || 0), 0);
  const totalSalidas = salidas.reduce((sum, r) => sum + Math.abs(r.fields.Total || 0), 0);
  const saldo = totalEntradas - totalSalidas;

  console.log('=' .repeat(70));
  console.log('💰 RESUMEN FINANCIERO (Campo Total)');
  console.log('=' .repeat(70));
  console.log(`Total ENTRADAS:  ${totalEntradas.toFixed(2).padStart(15)} kg`);
  console.log(`Total SALIDAS:   ${totalSalidas.toFixed(2).padStart(15)} kg`);
  console.log('-'.repeat(70));
  console.log(`SALDO FINAL:     ${saldo.toFixed(2).padStart(15)} kg`);
  console.log('=' .repeat(70));

  // Calcular por categoría de material
  console.log('\n📦 DETALLE POR CATEGORÍA DE MATERIAL\n');
  
  const categorias = ['Reciclaje', 'Incineracion', 'Flexibles', 'PlasticoContaminado', 'Lonas', 'Carton', 'Metal'];
  const totalesPorCategoria: Record<string, { entradas: number; salidas: number; saldo: number }> = {};

  for (const categoria of categorias) {
    const entradasCat = entradas.reduce((sum, r) => sum + Math.abs((r.fields as any)[categoria] || 0), 0);
    const salidasCat = salidas.reduce((sum, r) => sum + Math.abs((r.fields as any)[categoria] || 0), 0);
    
    totalesPorCategoria[categoria] = {
      entradas: entradasCat,
      salidas: salidasCat,
      saldo: entradasCat - salidasCat,
    };

    if (entradasCat > 0 || salidasCat > 0) {
      console.log(`${categoria.padEnd(25)} | E: ${entradasCat.toFixed(2).padStart(10)} | S: ${salidasCat.toFixed(2).padStart(10)} | Saldo: ${totalesPorCategoria[categoria].saldo.toFixed(2).padStart(10)} kg`);
    }
  }

  // Rango de fechas
  const fechas = records
    .map(r => r.fields.fechakardex)
    .filter(Boolean)
    .sort();

  if (fechas.length > 0) {
    console.log('\n📅 RANGO DE FECHAS');
    console.log('=' .repeat(70));
    console.log(`Primera transacción: ${fechas[0]}`);
    console.log(`Última transacción:  ${fechas[fechas.length - 1]}`);
    console.log('=' .repeat(70));
  }

  // Ultimos 10 registros
  console.log('\n📋 ÚLTIMOS 10 MOVIMIENTOS (cronológico)');
  console.log('=' .repeat(70));
  const ultimos = records.slice(-10);
  for (const record of ultimos) {
    const tipo = record.fields.TipoMovimiento === 'ENTRADA' ? '📥' : '📤';
    const fecha = record.fields.fechakardex || 'N/A';
    const total = record.fields.Total || 0;
    const idkardex = record.fields.idkardex || 'N/A';
    console.log(`${tipo} ${fecha} | ID: ${idkardex} | ${total.toFixed(2)} kg`);
  }

  console.log('\n✅ Cálculo completado\n');
}

calculateKardexBalance().catch(console.error);
