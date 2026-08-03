import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluarCompletitud, validarCamposEscritura } from "@/lib/terceros";
import { isAdminOrSupervisor } from "@/lib/roles";
import { validarNitJuridica, calcularDigitoVerificador } from "@/lib/nit";

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

      const isAdmin = isAdminOrSupervisor(session.user.rol);
      const coordinadorId = session.user.coordinatorRecordId;
      // Filtro: coordinador ve solo los suyos (via lookup coordinador_responsable_id), admin ve todo
      const filter = isAdmin
        ? ""
        : `&filterByFormula=${encodeURIComponent(`FIND('${coordinadorId}', ARRAYJOIN({coordinador_responsable_id}, ',')) > 0`)}`;

      const records: any[] = [];
      let offset: string | undefined;
      do {
        const url = `https://api.airtable.com/v0/${baseId}/Terceros?pageSize=100${filter}${offset ? `&offset=${offset}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
        const data = await res.json();
        records.push(...(data.records || []));
        offset = data.offset;
      } while (offset);

      const terceros = records.map((r: any) => {
        const completitud = evaluarCompletitud(r.fields);
        const ordenesCount = (r.fields.Ordenes || []).length;
        const cajaMenorCount = (r.fields.GastosCajaMenor || []).length;
        return {
          id: r.id,
          razonSocial: r.fields.RazonSocial || "",
          nit: r.fields.NIT || "",
          direccion: r.fields.Direccion || "",
          movil: r.fields.Movil || null,
          correo: r.fields["Correo Electrónico"] || "",
          municipioId: r.fields.Municipio?.[0] || null,
          municipioDepartamento: r.fields["Municipio-Departamento"]?.[0] || "",
          tipoPersona: r.fields.tipo_persona || "",
          cedulaPdf: (r.fields.cedula_pdf || []).length,
          certificadoCamaraPdf: (r.fields.certificado_camara_pdf || []).length,
          rutPdf: (r.fields.rut_pdf || []).length,
          certificacionBancariaPdf: (r.fields.certificacion_bancaria_pdf || []).length,
          coordinadorResponsableId: r.fields.coordinador_responsable?.[0] || null,
          ordenesCount,
          cajaMenorCount,
          enUso: ordenesCount > 0 || cajaMenorCount > 0,
          completo: completitud.completo,
          faltantes: completitud.faltantes,
          nitInvalido: completitud.nitInvalido,
          listoCajaMenor: completitud.listoCajaMenor,
          listoOrdenServicio: completitud.listoOrdenServicio,
          faltantesDatos: completitud.faltantesDatos,
          faltantesDocumentos: completitud.faltantesDocumentos,
        };
      });

      return NextResponse.json({
        terceros,
        total: terceros.length,
        completos: terceros.filter((t: any) => t.completo).length,
        isAdmin,
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

/**
 * Crea un nuevo tercero. Lo puede hacer cualquier coordinador autenticado; el
 * coordinador queda como responsable. Solo exige identidad mínima (razón social,
 * NIT/cédula y tipo de persona); el resto se puede completar después. Valida el
 * formato de dirección (DIAN), correo y móvil cuando vienen con valor.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.AIRTABLE_API_KEY!;
    const baseId = process.env.AIRTABLE_BASE_ID!;
    const body = await request.json();

    const razonSocial = String(body.razonSocial ?? "").trim();
    const nit = String(body.nit ?? "").trim();
    const tipoPersona = body.tipoPersona;

    // Identidad mínima para poder crear.
    if (!razonSocial) {
      return NextResponse.json(
        { error: "Falta la razón social / nombre" },
        { status: 400 }
      );
    }
    if (!nit) {
      return NextResponse.json({ error: "Falta el NIT / cédula" }, { status: 400 });
    }
    if (tipoPersona !== "Natural" && tipoPersona !== "Jurídica") {
      return NextResponse.json(
        { error: "Indica el tipo de persona (Natural o Jurídica)" },
        { status: 400 }
      );
    }
    if (!body.municipioId) {
      return NextResponse.json(
        { error: "Falta el municipio" },
        { status: 400 }
      );
    }

    // NIT de jurídicas debe traer dígito de verificación válido.
    if (tipoPersona === "Jurídica" && !validarNitJuridica(nit)) {
      const limpio = nit.replace(/[^\d]/g, "");
      const base = nit.includes("-")
        ? nit.split("-")[0].replace(/[^\d]/g, "")
        : limpio.length >= 9
          ? limpio.slice(0, -1)
          : limpio;
      const dvSugerido =
        base.length >= 8 && base.length <= 15 ? calcularDigitoVerificador(base) : null;
      return NextResponse.json(
        {
          error: "NIT_DV_INVALIDO",
          mensaje:
            "Para personas jurídicas el NIT debe incluir el dígito de verificación correcto.",
          sugerencia:
            dvSugerido !== null ? `El NIT correcto sería: ${base}-${dvSugerido}` : undefined,
        },
        { status: 400 }
      );
    }

    // Formato de dirección / correo / móvil (solo lo que venga con valor).
    const erroresFormato = validarCamposEscritura({
      direccion: body.direccion,
      correo: body.correo,
      movil: body.movil,
    });
    if (erroresFormato.length > 0) {
      return NextResponse.json(
        { error: "VALIDACION", errores: erroresFormato },
        { status: 400 }
      );
    }

    // Armar fields para Airtable.
    const fields: Record<string, unknown> = {
      RazonSocial: razonSocial,
      NIT: nit,
      tipo_persona: tipoPersona,
    };
    if (body.direccion) fields.Direccion = String(body.direccion).trim();
    if (body.correo) fields["Correo Electrónico"] = String(body.correo).trim();
    if (body.movil != null && String(body.movil).trim()) {
      fields.Movil = Number(String(body.movil).replace(/\D/g, ""));
    }
    if (body.observaciones) fields.Observaciones = String(body.observaciones).trim();
    if (body.municipioId) fields.Municipio = [body.municipioId];

    // El coordinador que lo crea queda como responsable.
    const coordinadorId = session.user.coordinatorRecordId;
    if (coordinadorId) fields.coordinador_responsable = [coordinadorId];

    const res = await fetch(`https://api.airtable.com/v0/${baseId}/Terceros`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[terceros/POST]", detail);
      return NextResponse.json(
        { error: "Error al crear el tercero", detail },
        { status: 500 }
      );
    }

    const created = await res.json();
    // Invalidar cache en memoria para que aparezca en búsquedas.
    tercerosCache = null;

    const completitud = evaluarCompletitud(created.fields || fields);
    return NextResponse.json({
      id: created.id,
      razonSocial,
      completitud,
    });
  } catch (error) {
    console.error("Error creating tercero:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
