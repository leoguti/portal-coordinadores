import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCultivosMap } from "@/lib/cultivosCache";
import { evaluarCompletitud } from "@/lib/completitudGenerador";

export const maxDuration = 30;

/**
 * GET /api/certificados/finca-info?fincaId=recXXX
 *
 * Devuelve, para una finca:
 *  - Campos crudos del generador y la finca (para el panel y para
 *    pre-llenar el formulario de edición).
 *  - Strings normalizados que el PDF mostrará (display).
 *  - Estado de completitud (`complete`, `missing`) según las mismas
 *    reglas de la interfaz "revisar fincas" + lo que el PDF necesita.
 */

async function getRecord(
  apiKey: string,
  baseId: string,
  table: string,
  id: string
): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${table}/${id}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

function firstId(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable no configurado" },
      { status: 500 }
    );
  }

  const fincaId = (req.nextUrl.searchParams.get("fincaId") || "").trim();
  if (!fincaId) {
    return NextResponse.json({ error: "fincaId requerido" }, { status: 400 });
  }

  try {
    const finca = await getRecord(apiKey, baseId, "FINCAS", fincaId);
    if (!finca) {
      return NextResponse.json(
        { error: "Finca no encontrada" },
        { status: 404 }
      );
    }
    const ff = finca.fields;
    const generadorId = firstId(ff.generador);
    if (!generadorId) {
      return NextResponse.json(
        { error: "La finca no tiene generador vinculado" },
        { status: 400 }
      );
    }

    const generador = await getRecord(
      apiKey,
      baseId,
      "GENERADORES",
      generadorId
    );
    if (!generador) {
      return NextResponse.json(
        { error: "Generador no encontrado" },
        { status: 404 }
      );
    }
    const gf = generador.fields;

    // Municipios (finca y generador) en paralelo
    const fincaMunId = firstId(ff.municipio);
    const genMunId = firstId(gf.municipio);
    const [fincaMunRec, genMunRec] = await Promise.all([
      fincaMunId
        ? getRecord(apiKey, baseId, "MUNICIPIOS", fincaMunId)
        : Promise.resolve(null),
      genMunId
        ? getRecord(apiKey, baseId, "MUNICIPIOS", genMunId)
        : Promise.resolve(null),
    ]);
    const fincaMundep = fincaMunRec
      ? String(fincaMunRec.fields?.mundep || "").trim()
      : "";
    const genMundep = genMunRec
      ? String(genMunRec.fields?.mundep || "").trim()
      : "";

    // Cultivos: ids + nombres
    const cultivoIds = Array.isArray(ff.cultivos)
      ? (ff.cultivos as string[]).map(String)
      : [];
    let cultivosMap: Map<string, string> = new Map();
    try {
      cultivosMap = await getCultivosMap();
    } catch {
      /* opcional */
    }
    const cultivosNombrados = cultivoIds.map((id) => ({
      id,
      nombre: cultivosMap.get(id) || "",
    }));
    const cultivogenerador = cultivosNombrados
      .map((c) => c.nombre)
      .filter(Boolean)
      .join(", ");

    // Datos raw para pre-llenar el formulario de edición
    const generadorRaw = {
      id: generador.id,
      nombre: String(gf.nombre || "").trim(),
      nit: String(gf.nit || "").trim(),
      tipo: String(gf.tipo || "").trim(),
      tipopersona: String(gf.tipopersona || "").trim(),
      direccion_sede: String(gf.direccion_sede || "").trim(),
      municipio:
        genMunId && genMundep ? { id: genMunId, mundep: genMundep } : null,
      movil: String(gf.movil || "").trim(),
      email: String(gf.email || "").trim(),
    };
    const fincaRaw = {
      id: finca.id,
      nombre: String(ff.nombre || "").trim(),
      municipio:
        fincaMunId && fincaMundep
          ? { id: fincaMunId, mundep: fincaMundep }
          : null,
      cultivos: cultivosNombrados,
      movil: String(ff.movil || "").trim(),
      email: String(ff.email || "").trim(),
    };

    // Completitud
    const completitud = evaluarCompletitud({
      generador: {
        nombre: generadorRaw.nombre,
        nit: generadorRaw.nit,
        tipo: generadorRaw.tipo,
        tipopersona: generadorRaw.tipopersona,
        direccion_sede: generadorRaw.direccion_sede,
        movil: generadorRaw.movil,
      },
      finca: {
        nombre: fincaRaw.nombre,
        tieneMunicipio: !!fincaRaw.municipio,
        cultivosCount: cultivoIds.length,
        movil: fincaRaw.movil,
      },
    });

    return NextResponse.json({
      // Compat con UI actual (display panel)
      fincaNombre: fincaRaw.nombre,
      nombregenerador: generadorRaw.nombre,
      cedulagenerador: generadorRaw.nit,
      municipiogenerador: fincaMundep,
      cultivogenerador,
      cultivoIds,
      // Datos crudos para pre-llenar el form de edición
      generador: generadorRaw,
      finca: fincaRaw,
      // Estado para warning rojo + bloqueo de "Generar"
      completitud,
    });
  } catch (err) {
    console.error("[certificados/finca-info]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
