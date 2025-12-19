# Portal Coordinadores - Next.js Project

## Project Overview
- **Name**: portal-coordinadores
- **Framework**: Next.js 16 with TypeScript
- **Router**: App Router
- **Styling**: Tailwind CSS 4
- **Status**: Ready for Development

## Project Structure
```
portal-coordinadores/
├── app/                    # App Router directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   └── favicon.ico        # Site favicon
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── next.config.ts         # Next.js configuration
├── tailwind.config.ts     # Tailwind configuration
└── eslint.config.mjs      # ESLint configuration
```

## Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Development Guidelines
- Use TypeScript for all new files
- Follow ESLint rules
- Use Tailwind CSS for styling
- Create components in a `/components` directory when needed
- Use App Router conventions for routing

## Mapas con Leaflet - Estrategia Establecida

### Arquitectura
- **Librería**: Leaflet puro (NO react-leaflet por problemas SSR con Next.js)
- **GeoJSON**: `/public/geo/colombia-mapa.json.geojson` - Municipios de Colombia con códigos DIVIPOLA
- **Campo clave**: `PRECIND_ID` en el GeoJSON = código DIVIPOLA de 5 dígitos (ej: "05147")

### Componente de referencia
`/components/MapaColombia.tsx` - Componente choropleth funcional

### Patrón de implementación
1. **Importar CSS estáticamente** (no dinámicamente):
   ```tsx
   import "leaflet/dist/leaflet.css";
   ```

2. **Importar Leaflet dinámicamente** dentro de useEffect:
   ```tsx
   import("leaflet").then((L) => { ... });
   ```

3. **Usar dynamic import** en la página que consume el componente:
   ```tsx
   const MapaColombia = dynamic(() => import("@/components/MapaColombia"), {
     ssr: false,
     loading: () => <LoadingSpinner />
   });
   ```

4. **Timer antes de inicializar** para asegurar DOM listo:
   ```tsx
   const timer = setTimeout(() => { /* crear mapa */ }, 50);
   ```

5. **Llamar `map.invalidateSize()`** después de montar para recalcular dimensiones

### Conversión de códigos DIVIPOLA
Airtable almacena como decimal (ej: `5.147`), convertir a string de 5 dígitos:
```tsx
const codigoStr = String(codigoRaw).replace(".", "");
const codigo = codigoStr.padStart(5, "0"); // "05147"
```

### Auto-zoom a área con datos
```tsx
const boundsGroup = L.featureGroup();
geoData.features.forEach((feature) => {
  const codigo = feature.properties.PRECIND_ID;
  if (actividadesMap.has(codigo)) {
    boundsGroup.addLayer(L.geoJSON(feature));
  }
});
if (boundsGroup.getLayers().length > 0) {
  map.fitBounds(boundsGroup.getBounds(), { padding: [50, 50], maxZoom: 10 });
}
```

### Estilos choropleth
- Sin datos: `fillOpacity: 0` (transparente, solo borde)
- Con datos: escala de colores según cantidad

## Next Steps
- Authentication implementation pending
- Additional pages to be created
- API routes configuration pending
