# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Portal Coordinadores** - Next.js 16 application for managing field activities and coordinator operations. Built with TypeScript, Tailwind CSS 4, and Airtable as the backend database.

## Commands

### Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server (requires build)
npm run lint         # Run ESLint
```

### Testing
```bash
npm test             # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:ui      # Run tests with visual UI
npm run test:coverage # Run tests with coverage report
```

Test files are colocated in `__tests__/` directories next to the code they test.

## Architecture

### App Router Structure
- Uses Next.js 16 App Router with TypeScript
- Server Components by default, Client Components marked with `"use client"`
- API routes in `app/api/`
- Pages in `app/[route]/page.tsx`

### Authentication (NextAuth.js)
- **Strategy**: Email magic links (passwordless)
- **Session**: JWT-based (no database required)
- **Authorization**: Users validated against Airtable `Coordinadores` table
- **Session Data**: Includes `coordinatorRecordId` (Airtable record ID)
- **Configuration**: `app/api/auth/[...nextauth]/route.ts`
- **Provider Wrapper**: `app/providers.tsx` wraps app with `SessionProvider`
- **Type Extensions**: `types/next-auth.d.ts` extends session with `coordinatorRecordId`

#### Authentication Flow
```
1. User enters email at /login
2. NextAuth validates email exists in Airtable Coordinadores table
3. Magic link sent via SMTP (Nodemailer)
4. User clicks link → JWT session created with coordinatorRecordId
5. Redirect to protected route
```

#### Memory Adapter
Uses custom in-memory adapter (`lib/memory-adapter.ts`) for verification tokens - no database needed. Sessions reset on server restart.

### Airtable Integration

**Base**: `appniHwKiUMS0imXD`

#### Main Tables
1. **Coordinadores**: User accounts (Name, Email, linked Actividades)
2. **Actividades**: Field activities with photos, documents, dates, participants
3. **MUNICIPIOS**: Colombian municipalities with DIVIPOLA codes

#### Key Functions (`lib/airtable.ts`)
- `getCoordinatorByEmail(email)` - Auth validation
- `listActividadesForCoordinator(recordId)` - Get coordinator's activities
- `listAllActividades()` - Get all activities (for map visualization)
- `createActividad(params)` - Create new activity with linked coordinator

All functions are server-side only (`"use server"`).

#### Field Naming Convention
Airtable uses Spanish field names with spaces:
- `"Nombre de la Actividad"` (activity name)
- `"Cantidad de Participantes"` (participant count)
- `"mundep"` (Municipio - Departamento format)

Linked records are arrays of IDs: `Coordinador: [recordId]`

### Municipios Search System

**Critical Implementation Pattern**

#### In-Memory Cache (`/api/municipios`)
- Loads ALL municipalities once at startup with pagination
- Stores normalized version (lowercase, no accents) for fast searching
- Search is case/accent insensitive
- Returns max 15 results
- Cache refreshes only on server restart

#### Standard Component (`components/MunicipioSearch.tsx`)
**Always use this component** for municipality selection in forms:

```tsx
import MunicipioSearch from "@/components/MunicipioSearch";

const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);

<MunicipioSearch
  value={municipio}
  onChange={setMunicipio}
  placeholder="Buscar municipio..."
/>

// When submitting to Airtable:
municipioId: municipio?.id  // Sent as linked record array
```

**Never** implement custom municipality search - always use `MunicipioSearch`.

### Maps with Leaflet

**Architecture Decision**: Use Leaflet directly, NOT react-leaflet (SSR issues with Next.js)

#### Reference Implementation
`components/MapaColombia.tsx` - Functional choropleth map

#### Required Pattern
```tsx
// 1. Import CSS statically (NOT dynamic)
import "leaflet/dist/leaflet.css";

// 2. Dynamic import Leaflet in useEffect
useEffect(() => {
  import("leaflet").then((L) => {
    // Initialize map
  });
}, []);

// 3. Use dynamic import in consuming page
import dynamic from "next/dynamic";
const MapaColombia = dynamic(() => import("@/components/MapaColombia"), {
  ssr: false,
  loading: () => <div>Cargando mapa...</div>
});

// 4. Add timer before initialization (ensures DOM ready)
const timer = setTimeout(() => { /* create map */ }, 50);

// 5. Call map.invalidateSize() after mounting
map.invalidateSize();
```

#### GeoJSON Data
- **File**: `/public/geo/colombia-mapa.json.geojson`
- **Key Field**: `PRECIND_ID` = 5-digit DIVIPOLA code (e.g., "05147")

#### DIVIPOLA Code Conversion
Airtable stores as decimal (e.g., `5.147`), convert to string:
```tsx
const codigoStr = String(codigoRaw).replace(".", "");
const codigo = codigoStr.padStart(5, "0"); // "05147"
```

#### Auto-zoom to Data
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

### Key Components

- **`Sidebar.tsx`**: Navigation sidebar for authenticated users
- **`ActividadForm.tsx`**: Reusable form for creating/editing activities
- **`ImageUpload.tsx`**: Multi-image upload with preview and delete
- **`MunicipioSearch.tsx`**: Searchable municipality selector with API integration
- **`MapaColombia.tsx`**: Leaflet-based choropleth map of Colombia
- **`AuthenticatedLayout.tsx`**: Layout wrapper requiring authentication

### Environment Variables

Required in `.env.local`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# SMTP (for magic links)
EMAIL_SERVER_HOST=smtp.example.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=noreply@example.com

# Airtable
AIRTABLE_API_KEY=<your-api-key>
AIRTABLE_BASE_ID=appniHwKiUMS0imXD
```

See `.env.example` for detailed configuration options.

## Important Patterns

### Server Actions
Airtable functions use `"use server"` directive and run server-side only.

### Session Access
```tsx
// Client component
import { useSession } from "next-auth/react";
const { data: session } = useSession();
const coordinatorId = session?.user?.coordinatorRecordId;

// Server component
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
const session = await getServerSession(authOptions);
```

### Protected Routes
Client components should check session and redirect:
```tsx
const { data: session, status } = useSession();
if (status === "loading") return <LoadingSpinner />;
if (!session) { redirect("/login"); }
```

### File Uploads
Use `/api/upload` endpoint which returns Airtable attachment objects. See `ImageUpload.tsx` for implementation.

### Path Aliases
`@/` maps to project root (configured in `tsconfig.json` and `vitest.config.mts`)

## Documentation

- **`docs/AIRTABLE_SCHEMA.md`**: Complete Airtable schema and field reference
- **`docs/Orden de Servicio.md`**: Business logic for service orders
- **`docs/IMPLEMENTACION_PARTE1_AIRTABLE_SIMPLE.md`**: Implementation guides
- **`AUTH_SETUP.md`**: Authentication setup instructions

## Node.js Version

Requires Node.js >= 20.9.0 (Next.js 16 requirement)
