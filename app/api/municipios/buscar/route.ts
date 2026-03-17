import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/municipios/buscar?q=<texto>
 *
 * Endpoint público (sin auth) para búsqueda de municipios desde TextIt.
 * Usa el mismo cache en memoria que /api/municipios.
 *
 * Respuesta:
 * {
 *   count: number,          // total de resultados (0-10, o >10 si hay demasiados)
 *   lista: string,          // lista numerada "1-Medellín - Antioquia\n2-..." (vacía si count=0 o >10)
 *   matches: [{id, mundep}] // array de resultados (vacío si count=0 o >10)
 * }
 */

interface CachedMunicipio {
  id: string;
  mundep: string;
  mundepNormalized: string;
}

let municipiosCache: CachedMunicipio[] | null = null;
let cacheLoading: Promise<CachedMunicipio[]> | null = null;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function loadAllMunicipios(): Promise<CachedMunicipio[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Airtable not configured");

  const allRecords: CachedMunicipio[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ "fields[]": "mundep", "sort[0][field]": "mundep", "sort[0][direction]": "asc" });
    if (offset) params.set("offset", offset);

    const res = await fetch(`https://api.airtable.com/v0/${baseId}/MUNICIPIOS?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data = await res.json();

    for (const record of data.records) {
      const mundep = record.fields.mundep || "";
      allRecords.push({ id: record.id, mundep, mundepNormalized: normalizeText(mundep) });
    }

    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function getCache(): Promise<CachedMunicipio[]> {
  if (municipiosCache) return municipiosCache;
  if (!cacheLoading) {
    cacheLoading = loadAllMunicipios().then((data) => {
      municipiosCache = data;
      cacheLoading = null;
      return data;
    }).catch((err) => {
      cacheLoading = null;
      throw err;
    });
  }
  return cacheLoading;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ count: 0, lista: "", matches: [] });
  }

  try {
    const cache = await getCache();
    const normalizedQ = normalizeText(q);

    const found = cache.filter((m) => m.mundepNormalized.includes(normalizedQ));
    const count = found.length;

    if (count === 0) {
      return NextResponse.json({ count: 0, resultado: "none", lista: "", matches: [] });
    }

    if (count > 10) {
      return NextResponse.json({ count, resultado: "toomany", lista: "", matches: [] });
    }

    const matches = found.map(({ id, mundep }) => ({ id, mundep }));
    const lista = matches.map((m, i) => `${i + 1}-${m.mundep}`).join("\n");
    const resultado = count === 1 ? "one" : "varios";

    return NextResponse.json({ count, resultado, lista, matches });
  } catch (error) {
    console.error("Error buscando municipio:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
