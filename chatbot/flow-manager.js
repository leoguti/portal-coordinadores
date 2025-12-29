#!/usr/bin/env node

/**
 * TextIt Flow Manager
 * Gestiona flujos de chatbot desde la línea de comandos
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_TOKEN = 'bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0';
const API_BASE = 'textit.com';

// Helper para hacer requests a la API
function apiRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      path: `/api/v2${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Comandos disponibles
const commands = {
  // Listar todos los flujos
  async list() {
    console.log('📋 Listando flujos...\n');
    const response = await apiRequest('/flows.json');
    
    if (!response.results || response.results.length === 0) {
      console.log('⚠️  No se encontraron flujos o hubo un error en la API');
      console.log('Response:', response);
      return;
    }
    
    response.results.forEach((flow, i) => {
      console.log(`${i + 1}. ${flow.name}`);
      console.log(`   UUID: ${flow.uuid}`);
      console.log(`   Tipo: ${flow.type}`);
      console.log(`   Archivado: ${flow.archived ? 'Sí' : 'No'}`);
      console.log(`   Ejecuciones completadas: ${flow.runs.completed}`);
      console.log('');
    });
  },

  // Descargar definición de un flujo
  async download(uuid) {
    if (!uuid) {
      console.error('❌ Error: Debes proporcionar el UUID del flujo');
      console.log('Uso: node flow-manager.js download <UUID>');
      return;
    }

    console.log(`📥 Descargando flujo ${uuid}...`);
    const response = await apiRequest(`/flow_definitions.json?uuid=${uuid}`);
    
    if (response.results && response.results.length > 0) {
      const flow = response.results[0];
      const filename = `${flow.name.replace(/[^a-z0-9]/gi, '_')}_${uuid.substring(0, 8)}.json`;
      const filepath = path.join(__dirname, 'flows', filename);
      
      // Crear directorio flows si no existe
      if (!fs.existsSync(path.join(__dirname, 'flows'))) {
        fs.mkdirSync(path.join(__dirname, 'flows'));
      }
      
      fs.writeFileSync(filepath, JSON.stringify(flow, null, 2));
      console.log(`✅ Flujo guardado en: flows/${filename}`);
    } else {
      console.error('❌ No se encontró el flujo');
    }
  },

  // Subir/actualizar un flujo
  async upload(filepath) {
    if (!filepath) {
      console.error('❌ Error: Debes proporcionar la ruta al archivo JSON');
      console.log('Uso: node flow-manager.js upload <archivo.json>');
      return;
    }

    console.log(`📤 Subiendo flujo desde ${filepath}...`);
    
    const flowData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const response = await apiRequest('/flow_definitions.json', 'POST', flowData);
    
    if (response.uuid) {
      console.log(`✅ Flujo actualizado exitosamente`);
      console.log(`   UUID: ${response.uuid}`);
      console.log(`   Nombre: ${response.name}`);
    } else {
      console.error('❌ Error al subir el flujo:', response);
    }
  },

  // Buscar texto en flujos locales
  async search(text) {
    if (!text) {
      console.error('❌ Error: Debes proporcionar el texto a buscar');
      console.log('Uso: node flow-manager.js search <texto>');
      return;
    }

    console.log(`🔍 Buscando "${text}" en flujos locales...\n`);
    
    const flowsDir = path.join(__dirname, 'flows');
    if (!fs.existsSync(flowsDir)) {
      console.log('⚠️  No hay flujos descargados. Usa: node flow-manager.js download <UUID>');
      return;
    }

    const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.json'));
    let found = 0;

    files.forEach(file => {
      const content = fs.readFileSync(path.join(flowsDir, file), 'utf8');
      if (content.toLowerCase().includes(text.toLowerCase())) {
        found++;
        console.log(`📄 ${file}`);
        
        // Mostrar contexto
        const flow = JSON.parse(content);
        flow.nodes?.forEach((node, i) => {
          node.actions?.forEach(action => {
            if (action.text?.toLowerCase().includes(text.toLowerCase())) {
              console.log(`   Nodo ${i}: "${action.text.substring(0, 80)}..."`);
            }
          });
        });
        console.log('');
      }
    });

    if (found === 0) {
      console.log('❌ No se encontraron coincidencias');
    } else {
      console.log(`✅ Encontrado en ${found} archivo(s)`);
    }
  },

  // Ayuda
  help() {
    console.log(`
📚 TextIt Flow Manager - Comandos disponibles:

  list                    Lista todos los flujos disponibles
  download <UUID>         Descarga un flujo específico
  upload <archivo.json>   Sube/actualiza un flujo
  search <texto>          Busca texto en flujos locales
  help                    Muestra esta ayuda

Ejemplos:
  node flow-manager.js list
  node flow-manager.js download e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13
  node flow-manager.js upload flows/mi_flujo.json
  node flow-manager.js search "Registro Exitoso"
    `);
  }
};

// Ejecutar comando
const [,, command, ...args] = process.argv;

if (!command || !commands[command]) {
  commands.help();
} else {
  commands[command](...args).catch(console.error);
}
