# Portal Coordinadores

Portal de gestión para coordinadores desarrollado con Next.js, TypeScript y Tailwind CSS.

## 📋 Descripción

Este proyecto es un portal web construido con las últimas tecnologías de Next.js utilizando el App Router. Está diseñado para proporcionar una plataforma de gestión para coordinadores.

## 🚀 Tecnologías

- **Next.js 16** - Framework de React con App Router
- **TypeScript** - Tipado estático para JavaScript
- **Tailwind CSS 4** - Framework de CSS utility-first
- **React 19** - Biblioteca de interfaz de usuario
- **ESLint** - Linter para mantener calidad de código

## 📦 Requisitos Previos

- Node.js >= 20.9.0 (recomendado)
- npm (incluido con Node.js)

**Nota:** El proyecto fue creado con Node.js 18.20.5 pero Next.js 16 requiere Node.js >= 20.9.0 para funcionar correctamente. Se recomienda actualizar Node.js.

## 🛠️ Instalación

Las dependencias ya están instaladas. Si necesitas reinstalarlas:

```bash
npm install
```

## 🎯 Scripts Disponibles

### Modo Desarrollo

Ejecuta el servidor de desarrollo con hot-reload:

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

### Build de Producción

Compila la aplicación para producción:

```bash
npm run build
```

### Ejecutar en Producción

Inicia el servidor de producción (requiere build previo):

```bash
npm run start
```

### Linting

Ejecuta ESLint para verificar la calidad del código:

```bash
npm run lint
```

### Tests

Ejecuta tests automatizados con Vitest:

```bash
# Ejecutar tests en modo watch (recomendado durante desarrollo)
npm test

# Ejecutar tests una vez
npm run test:run

# Ejecutar tests con interfaz visual
npm run test:ui

# Ejecutar tests con reporte de cobertura
npm run test:coverage
```

Los tests están ubicados en:
- `lib/__tests__/` - Tests de utilidades y funciones
- `components/__tests__/` - Tests de componentes React
- `app/api/**/__tests__/` - Tests de API routes (próximamente)

## 📁 Estructura del Proyecto

```
portal-coordinadores/
├── app/                    # Directorio principal del App Router
│   ├── favicon.ico        # Favicon del sitio
│   ├── globals.css        # Estilos globales con Tailwind
│   ├── layout.tsx         # Layout raíz de la aplicación
│   └── page.tsx           # Página de inicio
├── public/                # Archivos estáticos
├── node_modules/          # Dependencias (no versionar)
├── .gitignore            # Archivos ignorados por Git
├── eslint.config.mjs     # Configuración de ESLint
├── next.config.ts        # Configuración de Next.js
├── next-env.d.ts         # Tipos de TypeScript para Next.js
├── package.json          # Dependencias y scripts
├── postcss.config.mjs    # Configuración de PostCSS
├── README.md             # Este archivo
└── tsconfig.json         # Configuración de TypeScript
```

## 🏗️ Desarrollo

### Crear Nuevas Páginas

Con el App Router, las páginas se crean en el directorio `app/`:

```bash
# Ejemplo: Crear página "about"
mkdir app/about
touch app/about/page.tsx
```

### Crear Componentes

Se recomienda crear una carpeta `components/` en la raíz:

```bash
mkdir components
touch components/Header.tsx
```

### Variables de Entorno

Para configurar variables de entorno, crea un archivo `.env.local`:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
```

## 🎨 Tailwind CSS

El proyecto usa Tailwind CSS 4. Los estilos se aplican mediante clases utility:

```tsx
<div className="flex items-center justify-center p-4">
  <h1 className="text-2xl font-bold">Título</h1>
</div>
```

## 📝 Próximos Pasos

- [ ] Implementar autenticación
- [ ] Crear páginas adicionales
- [ ] Configurar API routes
- [ ] Añadir base de datos
- [ ] Implementar gestión de estado (si es necesario)

## 🗄️ Notas Técnicas

### Cache de Municipios

El endpoint `/api/municipios` usa un **cache en memoria** para la búsqueda de municipios:

- **Ubicación**: `/app/api/municipios/route.ts`
- **Comportamiento**: 
  - La primera búsqueda carga TODOS los municipios de Airtable (con paginación completa)
  - Se guarda en memoria con versión normalizada (sin acentos, minúsculas) para búsquedas
  - Las búsquedas siguientes son instantáneas
- **Actualización**: El cache se recarga automáticamente cuando:
  - El servidor se reinicia
  - En desarrollo: cada vez que guardas cambios (hot reload)
  - En producción: cada deploy
- **Búsqueda**: Insensible a mayúsculas y acentos (ej: "medellin" encuentra "Medellín")

> ⚠️ Si se agregan nuevos municipios en Airtable, reiniciar el servidor para actualizar el cache.

## 🤝 Contribución

Este proyecto está en desarrollo activo. Para contribuir:

1. Crea una rama para tu feature: `git checkout -b feature/nueva-funcionalidad`
2. Realiza tus cambios y commits: `git commit -m 'Añade nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Crea un Pull Request

## 📄 Licencia

Este proyecto es privado y está en desarrollo.

## 🆘 Soporte

Si encuentras problemas:

1. Verifica que estés usando Node.js >= 20.9.0
2. Elimina `node_modules` y `package-lock.json`, luego ejecuta `npm install`
3. Verifica que el puerto 3000 no esté en uso

Para más información, consulta la [documentación de Next.js](https://nextjs.org/docs).
