import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluarCompletitud } from "@/lib/terceros";

interface TerceroRecord {
  id: string;
  fields: {
    RazonSocial?: string;
    NIT?: string;
    Direccion?: string;
    Movil?: number;
    "Correo Electrónico"?: string;
    Municipio?: string[];
    "Municipio-Departamento"?: string[];
  };
}

interface AirtableResponse {
  records: TerceroRecord[];
  offset?: string;
}

interface CachedTercero {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
  movil?: number;
  correo?: string;
  municipioId?: string;
  municipioDepartamento?: string;
  razonSocialNormalized: string;
}

// Cache en memoria - se carga una vez y dura mientras el servidor esté corriendo
let tercerosCache: CachedTercero[] | null = null;
let cacheLoading: Promise<CachedTercero[]> | null = null;

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
 * Carga todos los terceros de Airtable con paginación
 */
async function loadAllTerceros(): Promise<CachedTercero[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Airtable not configured");
  }

  const allRecords: CachedTercero[] = [];
  let offset: string | undefined;

  do {
    const url = `https://api.airtable.com/v0/${baseId}/Terceros${
      offset ? `?offset=${offset}` : ""
    }`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Airtable error: ${response.status}`);
    }

    const data: AirtableResponse = await response.json();

    // Filtrar y transformar los registros
    for (const record of data.records) {
      const razonSocial = record.fields.RazonSocial?.trim();
      if (razonSocial) {
        allRecords.push({
          id: record.id,
          razonSocial,
          nit: record.fields.NIT,
          direccion: record.fields.Direccion,
          movil: record.fields.Movil,
          correo: record.fields["Correo Electrónico"],
          municipioId: record.fields.Municipio?.[0],
          municipioDepartamento: record.fields["Municipio-Departamento"]?.[0],
          razonSocialNormalized: normalizeText(razonSocial),
        });
      }
    }

    offset = data.offset;
  } while (offset);

  console.log(`Loaded ${allRecords.length} terceros into cache`);
  return allRecords;
}

/**
 * Obtiene el cache de terceros (carga si no existe)
 */
async function getTercerosCache(): Promise<CachedTercero[]> {
  if (tercerosCache) {
    return tercerosCache;
  }

  if (cacheLoading) {
    return cacheLoading;
  }

  cacheLoading = loadAllTerceros();
  tercerosCache = await cacheLoading;
  cacheLoading = null;

  return tercerosCache;
}

/**
 * Busca terceros por texto (insensible a acentos y mayúsculas)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const all = searchParams.get("all") === "true";

    // Modo admin: listar todos con datos de completitud
    if (all) {
      const apiKey = process.env.AIRTABLE_API_KEY!;
      const baseId = process.env.AIRTABLE_BASE_ID!;
      const records: any[] = [];
      let offset: string | undefined;
      do {
        const url = `https://api.airtable.com/v0/${baseId}/Terceros?pageSize=100${offset ? `&offset=${offset}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
        const data = await res.json();
        records.push(...(data.records || []));
        offset = data.offset;
      } while (offset);

      const terceros = records.map((r: any) => {
        const completitud = evaluarCompletitud(r.fields);
        return {
          id: r.id,
          razonSocial: r.fields.RazonSocial || "",
          nit: r.fields.NIT || "",
          direccion: r.fields.Direccion || "",
          movil: r.fields.Movil || null,
          correo: r.fields["Correo Electrónico"] || "",
          municipioId: r.fields.Municipio?.[0] || null,
          municipioDepartamento: r.fields["Municipio-Departamento"]?.[0] || "",
          tipo: r.fields.Tipo || [],
          tipoPersona: r.fields.tipo_persona || "",
          cedulaPdf: (r.fields.cedula_pdf || []).length,
          certificadoCamaraPdf: (r.fields.certificado_camara_pdf || []).length,
          rutPdf: (r.fields.rut_pdf || []).length,
          certificacionBancariaPdf: (r.fields.certificacion_bancaria_pdf || []).length,
          completo: completitud.completo,
          faltantes: completitud.faltantes,
          nitInvalido: completitud.nitInvalido,
        };
      });

      return NextResponse.json({
        terceros,
        total: terceros.length,
        completos: terceros.filter((t: any) => t.completo).length,
      });
    }

    if (!search || search.length < 2) {
      return NextResponse.json({ terceros: [] });
    }

    // Obtener cache y buscar
    const cache = await getTercerosCache();
    const searchNormalized = normalizeText(search);

    const results = cache
      .filter((tercero) =>
        tercero.razonSocialNormalized.includes(searchNormalized)
      )
      .slice(0, 15) // Máximo 15 resultados
      .map(({ razonSocialNormalized, ...tercero }) => tercero); // Remove normalized field

    return NextResponse.json({ terceros: results });
  } catch (error) {
    console.error("Error searching terceros:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
