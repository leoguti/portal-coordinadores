import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface MunicipioRecord {
  id: string;
  fields: {
    mundep?: string;
    MUNICIPIO?: string;
    DEPARTAMENTO?: string;
  };
}

interface AirtableResponse {
  records: MunicipioRecord[];
  offset?: string;
}

interface CachedMunicipio {
  id: string;
  mundep: string;
  mundepNormalized: string;
}

// Cache en memoria - se carga una vez y dura mientras el servidor esté corriendo
let municipiosCache: CachedMunicipio[] | null = null;
let cacheLoading: Promise<CachedMunicipio[]> | null = null;

/**
 * Normaliza texto: quita acentos y convierte a minúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Carga todos los municipios de Airtable con paginación
 */
async function loadAllMunicipios(): Promise<CachedMunicipio[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Airtable not configured");
  }

  const allRecords: CachedMunicipio[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      "fields[]": "mundep",
      "sort[0][field]": "mundep",
      "sort[0][direction]": "asc",
    });
    
    if (offset) {
      params.set("offset", offset);
    }

    const url = `https://api.airtable.com/v0/${baseId}/MUNICIPIOS?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data: AirtableResponse = await response.json();
    
    for (const record of data.records) {
      const mundep = record.fields.mundep || "";
      allRecords.push({
        id: record.id,
        mundep,
        mundepNormalized: normalizeText(mundep),
      });
    }

    offset = data.offset;
  } while (offset);

  console.log(`Municipios cache loaded: ${allRecords.length} records`);
  return allRecords;
}

/**
 * Obtiene el cache de municipios, cargándolo si es necesario
 */
async function getMunicipiosCache(): Promise<CachedMunicipio[]> {
  if (municipiosCache) {
    return municipiosCache;
  }

  // Evitar múltiples cargas simultáneas
  if (!cacheLoading) {
    cacheLoading = loadAllMunicipios().then((data) => {
      municipiosCache = data;
      cacheLoading = null;
      return data;
    }).catch((error) => {
      cacheLoading = null;
      throw error;
    });
  }

  return cacheLoading;
}

/**
 * GET /api/municipios?search=texto
 * Busca municipios por nombre (campo mundep)
 * Requiere mínimo 2 caracteres
 * Búsqueda insensible a mayúsculas y acentos
 */
export async function GET(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  // Require at least 2 characters
  if (search.length < 2) {
    return NextResponse.json({ municipios: [] });
  }

  try {
    const cache = await getMunicipiosCache();
    const normalizedSearch = normalizeText(search);

    // Filtrar y limitar resultados
    const municipios = cache
      .filter((m) => m.mundepNormalized.includes(normalizedSearch))
      .slice(0, 15)
      .map(({ id, mundep }) => ({ id, mundep }));

    return NextResponse.json({ municipios });
  } catch (error) {
    console.error("Error searching municipios:", error);
    return NextResponse.json(
      { error: "Failed to search municipios" },
      { status: 500 }
    );
  }
}
