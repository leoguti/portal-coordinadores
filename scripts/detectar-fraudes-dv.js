/**
 * scripts/detectar-fraudes-dv.js
 * Detecta NITs/cédulas potencialmente FRAUDULENTOS comparando el DV
 * proporcionado contra el DV calculado con el algoritmo OFICIAL.
 *
 * Algoritmo oficial (confirmado: tiendana.com + DIAN + documentos legales):
 * - Pesos: [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
 * - Formato: 15 dígitos rellenos con ceros a la izquierda
 * - residuo = suma % 11
 * - DV: residuo=0→0, residuo=1→1, residuo>1→11-residuo
 *
 * Ver: docs/ALGORITMO_DIGITO_VERIFICACION.md
 *
 * Ejecutar: node scripts/detectar-fraudes-dv.js
 */

const XLSX = require('xlsx');
const fs = require('fs');

// Algoritmo OFICIAL confirmado
function calcularDV(numero) {
  const pesos = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
  const digitos = String(numero).replace(/[^\d]/g, '');

  if (digitos.length === 0 || digitos.length > 15) {
    return null;
  }

  const padded = digitos.padStart(15, '0');

  let suma = 0;
  for (let i = 0; i < 15; i++) {
    suma += parseInt(padded[i], 10) * pesos[i];
  }

  const residuo = suma % 11;
  if (residuo === 0) return 0;
  if (residuo === 1) return 1;
  return 11 - residuo;
}

async function main() {
  const archivoPath = 'BASE DE DATOS EXOGENA 2025 MF.xlsx';

  if (!fs.existsSync(archivoPath)) {
    console.error(`❌ Archivo no encontrado: ${archivoPath}`);
    process.exit(1);
  }

  console.log('📖 Leyendo archivo Excel...\n');

  const workbook = XLSX.readFile(archivoPath);
  const hoja = workbook.Sheets['DATOS'];

  if (!hoja) {
    console.error('❌ No se encontró la hoja "DATOS"');
    process.exit(1);
  }

  const datos = XLSX.utils.sheet_to_json(hoja);

  console.log(`Total registros: ${datos.length}\n`);
  console.log('🔍 Detectando documentos fraudulentos...\n');

  const colNIT = 'Numero de identificación del informado';
  const colDV = 'dv';
  const colTipoDoc = 'Tipo de documento';

  const fraudulentos = [];   // DV proporcionado NO coincide con calculado
  const validos = [];        // DV correcto
  const sinDV = [];          // DV faltante
  const corruptos = [];      // datos inválidos

  for (let i = 0; i < datos.length; i++) {
    const nit = datos[i][colNIT];
    const dvReal = datos[i][colDV];
    const tipoDoc = datos[i][colTipoDoc];

    if (!nit || String(nit).trim() === '') {
      continue;
    }

    const dvCalculado = calcularDV(nit);

    // El nombre depende del tipo: NIT usa "Razón Social", CC usa nombres+apellidos
    const razonSocial = (datos[i]['Razón Social'] || '').toString().trim();
    const nombrePersona = `${datos[i]['Primer Nombre'] || ''} ${datos[i]['Otros Nombres'] || ''} ${datos[i]['Primer apellido'] || ''} ${datos[i]['Segundo Apellido'] || ''}`.replace(/\s+/g, ' ').trim();
    const nombre = razonSocial || nombrePersona || '(sin nombre)';

    const registro = {
      fila: i + 2,
      tipo: tipoDoc,
      nit: String(nit).trim(),
      nombre,
      dvReal: dvReal,
      dvCalculado: dvCalculado,
    };

    if (dvCalculado === null) {
      corruptos.push(registro);
      continue;
    }

    // Parsear DV real
    const dvRealStr = dvReal !== undefined && dvReal !== null ? String(dvReal).trim() : '';
    if (dvRealStr === '') {
      sinDV.push(registro);
      continue;
    }

    const dvRealNum = parseInt(dvRealStr, 10);
    if (isNaN(dvRealNum)) {
      corruptos.push(registro);
      continue;
    }

    registro.dvReal = dvRealNum;

    if (dvRealNum === dvCalculado) {
      validos.push(registro);
    } else {
      fraudulentos.push(registro);
    }
  }

  // ═══════════ REPORTE ═══════════
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DETECCIÓN DE DOCUMENTOS FRAUDULENTOS');
  console.log('   (DV proporcionado ≠ DV oficial calculado)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Válidos (DV correcto):           ${validos.length}`);
  console.log(`🚨 FRAUDULENTOS (DV incorrecto):    ${fraudulentos.length}`);
  console.log(`⚠️  Sin DV:                          ${sinDV.length}`);
  console.log(`❌ Datos corruptos:                 ${corruptos.length}`);
  console.log(`─────────────────────────────────────────────`);
  console.log(`   Total procesados:                ${validos.length + fraudulentos.length + sinDV.length + corruptos.length}\n`);

  // Separar fraudulentos por tipo
  const fraudeCC = fraudulentos.filter(r => r.tipo === 13);
  const fraudeNIT = fraudulentos.filter(r => r.tipo === 31);
  const fraudeOtros = fraudulentos.filter(r => r.tipo !== 13 && r.tipo !== 31);

  console.log('───────────────────────────────────────────────────────────');
  console.log('   DESGLOSE DE FRAUDULENTOS POR TIPO');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Tipo 13 (CC):    ${fraudeCC.length}`);
  console.log(`   Tipo 31 (NIT):   ${fraudeNIT.length}`);
  console.log(`   Otros tipos:     ${fraudeOtros.length}\n`);

  if (fraudeNIT.length > 0) {
    console.log('\n🚨 NITs FRAUDULENTOS (Tipo 31):\n');
    fraudeNIT.forEach(r => {
      console.log(`  Fila ${r.fila}: ${r.nit}-${r.dvReal}  (debe ser: ${r.nit}-${r.dvCalculado})`);
      console.log(`    ${r.nombre}\n`);
    });
  }

  if (fraudeCC.length > 0) {
    console.log('\n🚨 CÉDULAS FRAUDULENTAS (Tipo 13) — primeras 30:\n');
    fraudeCC.slice(0, 30).forEach(r => {
      console.log(`  Fila ${r.fila}: ${r.nit}-${r.dvReal}  (debe ser: ${r.nit}-${r.dvCalculado})`);
      console.log(`    ${r.nombre}\n`);
    });
    if (fraudeCC.length > 30) {
      console.log(`  ... y ${fraudeCC.length - 30} más (ver CSV)\n`);
    }
  }

  // Exportar CSV de fraudulentos
  const csvFraudes = [
    ['Fila', 'Tipo Doc', 'Numero Identificacion', 'Nombre', 'DV Reportado', 'DV Oficial Correcto'].join(','),
    ...fraudulentos.map(r => [
      r.fila,
      r.tipo,
      r.nit,
      `"${r.nombre}"`,
      r.dvReal,
      r.dvCalculado
    ].join(','))
  ].join('\n');

  fs.writeFileSync('reporte-documentos-fraudulentos.csv', csvFraudes);

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📁 Reporte fraudulentos: reporte-documentos-fraudulentos.csv`);
  console.log(`   (${fraudulentos.length} documentos con DV incorrecto)`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
