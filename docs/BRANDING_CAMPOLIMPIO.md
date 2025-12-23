# Branding CampoLimpio - Guía de Estilo

Extraído del sitio oficial: https://campolimpio.org/

## 🎨 Paleta de Colores

### Colores Principales
```css
/* Verde CampoLimpio - Principal */
--verde-campolimpio: #00d084;
--verde-claro: #7bdcb5;

/* Azul oscuro - Header/Footer */
--azul-oscuro: #042726;
--gris-oscuro: #32373c;

/* Acentos */
--naranja: #ff6900;
--naranja-suave: #fcb900;
--rojo: #cf2e2e;
--morado: #9b51e0;
```

### Colores de Texto
```css
--texto-oscuro: #111;
--texto-gris: #767676;
--texto-gris-claro: #999999;
--texto-blanco: #fff;
```

### Colores de Fondo
```css
--fondo-claro: #fff;
--fondo-gris: #abb8c3;
--fondo-azul-claro: #8ed1fc;
```

## 🏷️ Logos Descargados

### Logo Principal
- **Archivo**: `/public/logo-campolimpio-white.png`
- **URL Original**: https://campolimpio.org/wp-content/uploads/2021/11/LOGO-CAMPOLIMPIO-WEB-WHITE-1024x443.png
- **Dimensiones**: 1024x443px
- **Uso**: Logo blanco para fondos oscuros (header, footer)

### Favicon
- **Archivo**: `/public/favicon-campolimpio.png`
- **URL Original**: https://campolimpio.org/wp-content/uploads/2023/05/cropped-FAVICON-CAMPOLIMPIO-192x192.png
- **Dimensiones**: 192x192px
- **Uso**: Ícono de la pestaña del navegador

## 🎯 Aplicación Recomendada al Portal

### Sidebar
```tsx
// Actual: Fondo naranja #f97316
// Cambiar a: Verde CampoLimpio
background: #00d084
```

### Botones Primarios
```tsx
// Actual: bg-orange-600 hover:bg-orange-700
// Cambiar a: Verde CampoLimpio
bg-[#00d084] hover:bg-[#038f5d]
```

### Acentos
```tsx
// Mantener naranja para acciones secundarias
// Usar verde para acciones principales
// Azul oscuro (#042726) para headers/footers
```

### Header del Portal
```tsx
// Agregar logo blanco
<img src="/logo-campolimpio-white.png" alt="CampoLimpio" />

// Fondo azul oscuro o verde
background: #042726 o #00d084
```

## 📐 Tipografía del Sitio

No se pudo extraer la tipografía exacta del sitio, pero se recomienda usar:
- **Títulos**: System fonts (San Francisco, Segoe UI, etc.)
- **Texto**: System fonts para consistencia con Next.js

## 🔧 Implementación en Tailwind

Actualizar `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      'campolimpio': {
        'verde': '#00d084',
        'verde-claro': '#7bdcb5',
        'azul-oscuro': '#042726',
        'gris-oscuro': '#32373c',
      },
    },
  },
}
```

Uso:
```tsx
<div className="bg-campolimpio-verde text-white">
<button className="bg-campolimpio-azul-oscuro hover:bg-campolimpio-gris-oscuro">
```

## 📝 Próximos Pasos

1. ✅ Logos descargados en `/public`
2. ⏳ Actualizar Sidebar con verde CampoLimpio
3. ⏳ Cambiar botones naranjas a verdes
4. ⏳ Agregar logo en header del portal
5. ⏳ Actualizar favicon del proyecto
6. ⏳ Configurar colores en Tailwind config

## 🌐 Referencias

- Sitio oficial: https://campolimpio.org/
- Facebook: https://www.facebook.com/CampoLimpioOficial
- Instagram: https://www.instagram.com/CampoLimpioColombia/
- YouTube: https://www.youtube.com/@campolimpiocolombia71
