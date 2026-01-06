import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const CUTOFF_DATE = '2025-12-31';

interface KardexRecord {
  id: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    Total?: number;
    idcoordinador?: string[];
    'Name (from Coordinador)'?: string[];
  };
}

interface CoordinadorRecord {
  id: string;
  fields: {
    Name?: string;
    email?: string;
    Rol?: string;
  };
}

interface CoordinadorSaldo {
  id: string;
  nombre: string;
  email: string;
  totalEntradas: number;
  totalSalidas: number;
  saldo: number;
  numEntradas: number;
  numSalidas: number;
  totalRegistros: number;
}

async function fetchAllCoordinadores(): Promise<CoordinadorRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error('Missing Airtable credentials');
  }

  const allRecords: CoordinadorRecord[] = [];
  let offset: string | undefined;

  console.log('📥 Obteniendo lista de coordinadores...');

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/Coordinadores`);
    url.searchParams.append('pageSize', '100');
    url.searchParams.append('filterByFormula', '{Rol} = "Coordinador"');
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

    console.log(`  Fetched ${data.records?.length || 0} coordinadores (total: ${allRecords.length})`);
  } while (offset);

  return allRecords;
}

async function fetchKardexForCoordinator(coordinatorId: string): Promise<KardexRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error('Missing Airtable credentials');
  }

  const allRecords: KardexRecord[] = [];
  let offset: string | undefined;

  do {
    const filterFormula = `AND(FIND("${coordinatorId}", ARRAYJOIN({idcoordinador})), {fechakardex} <= "${CUTOFF_DATE}")`;
    const url = new URL(`https://api.airtable.com/v0/${baseId}/Kardex`);
    url.searchParams.append('filterByFormula', filterFormula);
    url.searchParams.append('pageSize', '100');
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
  } while (offset);

  return allRecords;
}

function calculateBalance(records: KardexRecord[]): CoordinadorSaldo {
  const entradas = records.filter(r => r.fields.TipoMovimiento === 'ENTRADA');
  const salidas = records.filter(r => r.fields.TipoMovimiento === 'SALIDA');

  const totalEntradas = entradas.reduce((sum, r) => sum + Math.abs(r.fields.Total || 0), 0);
  const totalSalidas = salidas.reduce((sum, r) => sum + Math.abs(r.fields.Total || 0), 0);

  return {
    id: '',
    nombre: '',
    email: '',
    totalEntradas,
    totalSalidas,
    saldo: totalEntradas - totalSalidas,
    numEntradas: entradas.length,
    numSalidas: salidas.length,
    totalRegistros: records.length,
  };
}

async function calcularSaldosTodosCoordinadores() {
  console.log('🔍 CALCULANDO SALDOS DE KARDEX PARA TODOS LOS COORDINADORES');
  console.log('=' .repeat(120));
  console.log(`Fecha de corte: ${CUTOFF_DATE}`);
  console.log('=' .repeat(120));
  console.log('');

  // Obtener todos los coordinadores
  const coordinadores = await fetchAllCoordinadores();
  console.log(`\n✅ Total coordinadores encontrados: ${coordinadores.length}\n`);

  const resultados: CoordinadorSaldo[] = [];

  // Procesar cada coordinador
  for (let i = 0; i < coordinadores.length; i++) {
    const coord = coordinadores[i];
    const nombre = coord.fields.Name || 'Sin nombre';
    const email = coord.fields.email || 'Sin email';
    
    process.stdout.write(`\r📊 Procesando ${i + 1}/${coordinadores.length}: ${nombre.substring(0, 40).padEnd(40)}...`);

    try {
      const kardexRecords = await fetchKardexForCoordinator(coord.id);
      
      if (kardexRecords.length > 0) {
        const balance = calculateBalance(kardexRecords);
        resultados.push({
          ...balance,
          id: coord.id,
          nombre,
          email,
        });
      }
    } catch (error) {
      console.error(`\n⚠️  Error procesando ${nombre}: ${error}`);
    }
  }

  console.log('\n\n✅ Procesamiento completado\n');

  // Ordenar por saldo (mayor a menor)
  resultados.sort((a, b) => b.saldo - a.saldo);

  // Generar tabla
  console.log('=' .repeat(165));
  console.log('📊 RESUMEN DE SALDOS DE KARDEX POR COORDINADOR (CIERRE 2025)');
  console.log('=' .repeat(165));
  console.log('');

  // Header
  const header = [
    '#'.padStart(3),
    'Coordinador'.padEnd(40),
    'Email'.padEnd(35),
    'Entradas'.padStart(12),
    'Salidas'.padStart(12),
    'Saldo (kg)'.padStart(14),
    'Movs'.padStart(6),
  ].join(' | ');

  console.log(header);
  console.log('='.repeat(165));

  // Rows
  let totalEntradasGlobal = 0;
  let totalSalidasGlobal = 0;
  let totalMovimientos = 0;

  resultados.forEach((r, index) => {
    totalEntradasGlobal += r.totalEntradas;
    totalSalidasGlobal += r.totalSalidas;
    totalMovimientos += r.totalRegistros;

    const saldoIndicator = r.saldo >= 0 ? '✅' : '⚠️ ';
    
    const row = [
      `${index + 1}`.padStart(3),
      r.nombre.substring(0, 40).padEnd(40),
      r.email.substring(0, 35).padEnd(35),
      r.totalEntradas.toFixed(0).padStart(12),
      r.totalSalidas.toFixed(0).padStart(12),
      `${saldoIndicator} ${r.saldo.toFixed(0)}`.padStart(14),
      r.totalRegistros.toString().padStart(6),
    ].join(' | ');

    console.log(row);
  });

  console.log('='.repeat(165));

  // Totales
  const saldoGlobal = totalEntradasGlobal - totalSalidasGlobal;
  console.log('');
  console.log('💰 TOTALES GLOBALES:');
  console.log(`   Total Entradas:  ${totalEntradasGlobal.toFixed(2).padStart(15)} kg`);
  console.log(`   Total Salidas:   ${totalSalidasGlobal.toFixed(2).padStart(15)} kg`);
  console.log(`   Saldo Global:    ${saldoGlobal.toFixed(2).padStart(15)} kg`);
  console.log(`   Movimientos:     ${totalMovimientos.toString().padStart(15)}`);
  console.log(`   Coordinadores:   ${resultados.length.toString().padStart(15)}`);
  console.log('');

  // Estadísticas
  const coordinadoresConSaldoPositivo = resultados.filter(r => r.saldo >= 0).length;
  const coordinadoresConSaldoNegativo = resultados.filter(r => r.saldo < 0).length;

  console.log('📈 ESTADÍSTICAS:');
  console.log(`   Coordinadores con saldo positivo: ${coordinadoresConSaldoPositivo}`);
  console.log(`   Coordinadores con saldo negativo: ${coordinadoresConSaldoNegativo}`);
  console.log(`   Promedio entradas por coord:      ${(totalEntradasGlobal / resultados.length).toFixed(2)} kg`);
  console.log(`   Promedio salidas por coord:       ${(totalSalidasGlobal / resultados.length).toFixed(2)} kg`);
  console.log('');

  // Top 5 con mayor saldo positivo
  console.log('🏆 TOP 5 - MAYOR SALDO POSITIVO:');
  resultados.slice(0, 5).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.nombre.padEnd(40)} ${r.saldo.toFixed(2).padStart(12)} kg`);
  });

  console.log('');

  // Top 5 con mayor déficit
  const deficit = [...resultados].sort((a, b) => a.saldo - b.saldo).slice(0, 5);
  console.log('⚠️  TOP 5 - MAYOR DÉFICIT:');
  deficit.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.nombre.padEnd(40)} ${r.saldo.toFixed(2).padStart(12)} kg`);
  });

  console.log('');
  console.log('=' .repeat(165));
  console.log('✅ Reporte generado exitosamente');
  console.log('=' .repeat(165));
}

calcularSaldosTodosCoordinadores().catch(console.error);
