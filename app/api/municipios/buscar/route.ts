import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/municipios/buscar?q=<texto>[&pick=<N>]
 *
 * Endpoint público (sin auth) para búsqueda de municipios desde TextIt.
 *
 * Sin pick:
 * { count, resultado, lista, first_id, first_mundep, matches }
 * resultado: "none" | "one" | "varios" | "toomany"
 *
 * Con pick=N (1-indexed):
 * { resultado: "selected", id, mundep }
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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function wordFuzzyMatch(queryWord: string, municipioWords: string[]): boolean {
  const threshold = queryWord.length > 5 ? 2 : 1;
  return municipioWords.some((word) => {
    if (Math.abs(word.length - queryWord.length) > threshold + 1) return false;
    return levenshtein(queryWord, word) <= threshold;
  });
}

function fuzzyMatch(query: string, municipio: CachedMunicipio): boolean {
  const queryWords = query.split(/[\s\-]+/).filter((w) => w.length >= 3);
  const municipioWords = municipio.mundepNormalized.split(/[\s\-]+/);
  // Todas las palabras del query deben tener match en el municipio
  return queryWords.every((qw) => wordFuzzyMatch(qw, municipioWords));
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
  const pick = req.nextUrl.searchParams.get("pick");

  if (q.length < 2) {
    return NextResponse.json({ resultado: "none", count: 0, lista: "", first_id: "", first_mundep: "", matches: [] });
  }

  try {
    const cache = await getCache();
    const normalizedQ = normalizeText(q);
    let found = cache.filter((m) => m.mundepNormalized.includes(normalizedQ));
    // Fallback fuzzy si no hay resultados exactos (mínimo 4 caracteres para evitar falsos positivos)
    if (found.length === 0 && normalizedQ.length >= 4) {
      found = cache.filter((m) => fuzzyMatch(normalizedQ, m));
    }
    const count = found.length;

    // Modo pick: devuelve solo el municipio seleccionado (1-indexed)
    if (pick !== null) {
      const idx = parseInt(pick) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < count) {
        return NextResponse.json({
          resultado: "selected",
          id: found[idx].id,
          mundep: found[idx].mundep,
        });
      }
      return NextResponse.json({ resultado: "none", id: "", mundep: "" });
    }

    if (count === 0) {
      return NextResponse.json({ resultado: "none", count: 0, lista: "", first_id: "", first_mundep: "", matches: [] });
    }

    if (count > 10) {
      return NextResponse.json({ resultado: "toomany", count, lista: "", first_id: "", first_mundep: "", matches: [] });
    }

    const matches = found.map(({ id, mundep }) => ({ id, mundep }));
    const lista = matches.map((m, i) => `${i + 1}-${m.mundep}`).join("\n");
    const resultado = count === 1 ? "one" : "varios";

    return NextResponse.json({
      resultado,
      count,
      lista,
      first_id: matches[0].id,
      first_mundep: matches[0].mundep,
      matches,
    });
  } catch (error) {
    console.error("Error buscando municipio:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
