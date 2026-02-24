#!/bin/bash
# Test end-to-end de generación de certificado
# Uso: ./test-certificado.sh

API_URL="https://portal.campolimpio.org/api/certificados/generar"
API_KEY="${CERTIFICADOS_API_KEY:-}"

echo "=== Test Certificado End-to-End ==="
echo "URL: $API_URL"
echo ""

curl -s -w "\n\nHTTP Status: %{http_code}\nTiempo total: %{time_total}s\n" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "ubicacionId": "recnin0YCgOoF33n1",
    "coordinadorId": "recLcrL8iaUboSV6B",
    "municipioDevolucionId": "rectGXQHlaO6DylD8",
    "rigidos": 10,
    "flexibles": 5,
    "metalicos": 3,
    "embalaje": 2,
    "triplelavado": "SI",
    "lugardevolucion": "Bodega Municipal",
    "fechadevolucion": "2026-02-23",
    "observaciones": "Prueba end-to-end desde portal"
  }' | head -c 2000

echo ""
echo ""
echo "=== Verificaciones pendientes ==="
echo "1. Revisar registro en Airtable (tabla Certificados)"
echo "2. Abrir PDF adjunto y verificar formato"
echo "3. Verificar backup en R2 y Neon"
