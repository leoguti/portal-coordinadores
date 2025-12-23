/**
 * Analizar la lógica de SALIDA del chatbot
 */

import fs from 'fs';

const json = JSON.parse(fs.readFileSync('orgs_export_20251223.json', 'utf8'));
const flow = json.flows[0];

console.log("🔍 ANÁLISIS DE LÓGICA DE SALIDA\n");
console.log("=".repeat(60));

// Buscar nodos que hablen de SALIDA
const salidaNodes = flow.nodes.filter((node: any) => {
  const hasText = node.actions?.some((a: any) => 
    a.text?.toLowerCase().includes('salida')
  );
  return hasText;
});

console.log(`\n📊 Encontrados ${salidaNodes.length} nodos relacionados con SALIDA\n`);

salidaNodes.forEach((node: any, i: number) => {
  console.log(`\n${i + 1}. UUID: ${node.uuid}`);
  node.actions.forEach((action: any) => {
    if (action.text) {
      console.log(`   Texto: ${action.text.substring(0, 200)}...`);
    }
    if (action.quick_replies) {
      console.log(`   Opciones: ${action.quick_replies.join(', ')}`);
    }
  });
  
  if (node.router) {
    console.log(`   Router operand: ${node.router.operand}`);
    console.log(`   Router result: ${node.router.result_name}`);
  }
});

// Buscar el punto donde se define "tiposalida"
console.log("\n\n" + "=".repeat(60));
console.log("🔎 ANÁLISIS DE 'tiposalida'");
console.log("=".repeat(60));

const tipoSalidaSetters = flow.nodes.filter((node: any) => 
  node.actions?.some((a: any) => a.name === 'tiposalida')
);

tipoSalidaSetters.forEach((node: any) => {
  console.log(`\nNodo UUID: ${node.uuid}`);
  node.actions.forEach((action: any) => {
    if (action.name === 'tiposalida') {
      console.log(`  Acción: ${action.type}`);
      console.log(`  Valor: ${action.value}`);
    }
  });
});

// Buscar el punto donde se hace el switch entre ca y other
console.log("\n\n" + "=".repeat(60));
console.log("🔀 DECISIÓN CA vs NO-CA (para SALIDA)");
console.log("=".repeat(60));

const switchNodes = flow.nodes.filter((node: any) => 
  node.router?.operand?.includes('tiposalida')
);

switchNodes.forEach((node: any, i: number) => {
  console.log(`\n${i + 1}. Switch Node UUID: ${node.uuid}`);
  console.log(`   Operand: ${node.router.operand}`);
  console.log(`   Categories:`);
  node.router.categories.forEach((cat: any) => {
    console.log(`     - ${cat.name} (${cat.uuid})`);
  });
  
  // Buscar qué pasa después de cada caso
  console.log(`\n   → Si es "Ca":`);
  const caExit = node.exits.find((e: any) => 
    node.router.categories.find((c: any) => c.name === "Ca")?.exit_uuid === e.uuid
  );
  if (caExit) {
    const destNode = flow.nodes.find((n: any) => n.uuid === caExit.destination_uuid);
    if (destNode) {
      const action = destNode.actions?.[0];
      console.log(`      Lleva a: ${destNode.uuid}`);
      if (action?.text) {
        console.log(`      Muestra: ${action.text.substring(0, 100)}...`);
      }
      if (action?.name) {
        console.log(`      Define: ${action.name} = ${action.value}`);
      }
    }
  }
  
  console.log(`\n   → Si es "Other":`);
  const otherExit = node.exits.find((e: any) => 
    node.router.categories.find((c: any) => c.name === "Other")?.exit_uuid === e.uuid
  );
  if (otherExit) {
    const destNode = flow.nodes.find((n: any) => n.uuid === otherExit.destination_uuid);
    if (destNode) {
      const action = destNode.actions?.[0];
      console.log(`      Lleva a: ${destNode.uuid}`);
      if (action?.text) {
        console.log(`      Muestra: ${action.text.substring(0, 100)}...`);
      }
      if (action?.name) {
        console.log(`      Define: ${action.name} = ${action.value}`);
      }
    }
  }
});

// Buscar el webhook final para ver qué se envía
console.log("\n\n" + "=".repeat(60));
console.log("📤 WEBHOOK FINAL - Qué se registra");
console.log("=".repeat(60));

const webhookNodes = flow.nodes.filter((node: any) => 
  node.actions?.some((a: any) => a.type === 'call_webhook' && a.url?.includes('Kardex'))
);

webhookNodes.forEach((node: any) => {
  const webhook = node.actions.find((a: any) => a.type === 'call_webhook');
  console.log(`\nBody del webhook:`);
  console.log(webhook.body);
});

console.log("\n✅ Análisis completado\n");
