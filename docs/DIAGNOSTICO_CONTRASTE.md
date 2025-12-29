# Diagnóstico de Problema de Contraste

## Problema Reportado
El cliente reporta problemas de contraste en su navegador, mientras que en el computador de desarrollo se ve perfectamente.

## Posibles Causas

### 1. Modo Oscuro del Sistema Operativo
- **Síntoma**: El navegador detecta `prefers-color-scheme: dark` y activa estilos de modo oscuro
- **Solución aplicada**: Forzar modo claro en todos los casos

### 2. Configuraciones del Navegador
Pedir al cliente verificar:

#### Chrome/Edge
1. Abrir `chrome://settings/appearance`
2. En "Tema" seleccionar **"Claro"** o **"Predeterminado"**
3. Verificar que no haya extensiones de modo oscuro activas

#### Firefox
1. Abrir `about:preferences`
2. Buscar "Tema" en la barra lateral
3. Seleccionar tema **"Claro"**
4. Verificar extensiones de modo oscuro

#### Safari
1. Safari > Preferencias > Apariencia
2. Seleccionar **"Claro"**

### 3. Extensiones de Navegador
Extensiones que pueden causar problemas:
- Dark Reader
- Night Eye
- Dark Mode
- Stylus con estilos personalizados

**Solución**: Desactivar temporalmente TODAS las extensiones para probar

### 4. Zoom del Navegador
- Verificar que el zoom esté al 100%
- Usar `Ctrl/Cmd + 0` para resetear

### 5. Configuración de Accesibilidad del Sistema
En Windows:
1. Configuración > Accesibilidad > Contraste
2. Verificar que "Contraste alto" esté desactivado

En macOS:
1. Preferencias del Sistema > Accesibilidad > Pantalla
2. Verificar "Aumentar contraste"

### 6. Monitor y Calibración de Pantalla
- Verificar brillo de la pantalla
- Verificar configuración de contraste del monitor
- Calibrar la pantalla si es necesario

## Cambios Aplicados al Portal

### v2.0 - Mejoras de Contraste (2025-12-29)

1. **Forzar Modo Claro**
   ```css
   html.light
   color-scheme: light
   ```

2. **Colores con Mayor Contraste**
   - `text-gray-500` → `#374151` (gray-700)
   - `text-gray-600` → `#1f2937` (gray-800)
   - `text-gray-700` → `#111827` (gray-900)
   - `text-gray-900` → `#000000` (negro puro)

3. **Font-weight Aumentado**
   - Badges: `font-weight: 600`
   - Tablas: `font-weight: 500`
   - Headers: `font-weight: 700`

4. **Backgrounds Forzados**
   ```css
   html, body { background: #ffffff !important; }
   ```

5. **Desactivar Modo Oscuro Completamente**
   ```css
   @media (prefers-color-scheme: dark) {
     :root {
       --background: #ffffff;
       --foreground: #111827;
       color-scheme: light;
     }
   }
   ```

## Checklist de Diagnóstico para el Cliente

- [ ] 1. ¿Qué navegador estás usando? (Chrome, Firefox, Safari, Edge)
- [ ] 2. ¿Qué versión del navegador?
- [ ] 3. ¿Qué sistema operativo? (Windows, macOS, Linux)
- [ ] 4. ¿Está en modo oscuro el sistema operativo?
- [ ] 5. ¿Tienes extensiones de modo oscuro instaladas?
- [ ] 6. ¿El zoom del navegador está al 100%?
- [ ] 7. ¿Puedes tomar un screenshot de la página con problemas?
- [ ] 8. ¿Tienes configuraciones de accesibilidad activas?
- [ ] 9. ¿El problema ocurre en todos los navegadores?
- [ ] 10. ¿El problema ocurre en modo incógnito/privado?

## Prueba en Modo Incógnito

**Instrucción para el cliente:**
1. Abrir ventana de incógnito: `Ctrl + Shift + N` (Chrome) o `Ctrl + Shift + P` (Firefox)
2. Acceder al portal: https://portal-campolimpio.vercel.app
3. **¿Se ve mejor?** 
   - **SÍ** → El problema es una extensión o configuración del navegador
   - **NO** → El problema es del sistema operativo o monitor

## Herramienta de Diagnóstico en Navegador

Pedir al cliente que abra la Consola de Desarrollo (F12) y ejecute:

```javascript
console.log('=== DIAGNÓSTICO DE CONTRASTE ===');
console.log('Color Scheme:', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT');
console.log('User Agent:', navigator.userAgent);
console.log('Screen:', window.screen.width + 'x' + window.screen.height);
console.log('Zoom:', Math.round(window.devicePixelRatio * 100) + '%');
console.log('Computed bg-color:', getComputedStyle(document.body).backgroundColor);
console.log('Computed color:', getComputedStyle(document.body).color);
```

## Ratio de Contraste WCAG 2.1

Estándares aplicados:
- **Texto normal (< 18pt)**: Mínimo 4.5:1 ✅
- **Texto grande (≥ 18pt)**: Mínimo 3:1 ✅
- **Elementos UI**: Mínimo 3:1 ✅

Colores usados:
- Negro `#000000` sobre blanco `#ffffff` = **21:1** (Excelente)
- Gray-900 `#111827` sobre blanco `#ffffff` = **19.6:1** (Excelente)
- Gray-800 `#1f2937` sobre blanco `#ffffff` = **15.5:1** (Excelente)
- Gray-700 `#374151` sobre blanco `#ffffff` = **10.7:1** (Excelente)

## Contacto de Soporte

Si después de todas las verificaciones el problema persiste:
1. Tomar screenshots del problema
2. Enviar resultados del script de diagnóstico
3. Indicar navegador y sistema operativo exacto
