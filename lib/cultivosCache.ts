/**
 * Cache en memoria del mapping cultivoId → nombre.
 * Usado por endpoints que devuelven certificados (los registros guardan
 * cultivos_certificado como linked record y Airtable retorna IDs).
 */

const TTL_MS = 60 * 60 * 1000;

let cachedMap: Map<string, string> | null = null;
let cachedAt = 0;
let loading: Promise<Map<string, string>> | null = null;

async function loadCultivos(): Promise<Map<string, string>> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Airtable no configurado");

  const map = new Map<string, string>();
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    params.append("fields[]", "nombre");
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/CULTIVOS?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable error ${res.status}: ${text}`);
    }
    const data = await res.json();
    for (const rec of data.records || []) {
      const nombre = String(rec.fields?.nombre || "").trim();
      if (nombre) map.set(rec.id, nombre);
    }
    offset = data.offset;
  } while (offset);
  return map;
}

export async function getCultivosMap(): Promise<Map<string, string>> {
  if (cachedMap && Date.now() - cachedAt < TTL_MS) return cachedMap;
  if (!loading) {
    loading = loadCultivos()
      .then((m) => {
        cachedMap = m;
        cachedAt = Date.now();
        loading = null;
        return m;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}
