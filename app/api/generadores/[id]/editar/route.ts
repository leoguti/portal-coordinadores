import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  soloDigitos,
  esMovilCOValido,
  validarDocumento,
} from "@/lib/validacionesCO";
import { validarNitJuridica, calcularDigitoVerificador } from "@/lib/nit";

export const maxDuration = 30;

/**
 * PATCH /api/generadores/[id]/editar
 *
 * Actualiza el GENERADOR y la FINCA seleccionada en una sola operación.
 *
 * Reglas:
 *  - Mismo conjunto de validaciones que /crear (móvil CO, documento por
 *    tipopersona, cultivos ≥ 1, etc.).
 *  - Dedupe por NIT/cédula normalizado (solo dígitos) EXCLUYENDO este
 *    propio generador (si no, no se podría guardar sin cambiar el NIT).
 *  - La finca debe pertenecer al generador (sanidad).
 *  - Si se guarda con todas las reglas cumplidas, marca finca.revisado = true.
 */

interface Body {
  generador?: {
    nombre?: string;
    nit?: string;
    tipo?: string;
    tipopersona?: string;
    direccionSede?: string;
    municipioId?: string;
    movil?: string;
    email?: string;
  };
  finca?: {
    id?: string;
    nombre?: string;
    municipioId?: string;
    cultivoIds?: string[];
    movil?: string;
    email?: string;
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
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

  const { id: generadorId } = await params;
  if (!generadorId) {
    return NextResponse.json(
      { error: "generadorId requerido en la URL" },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const g = body.generador || {};
  const f = body.finca || {};

  const nombre = (g.nombre || "").trim();
  const nit = (g.nit || "").trim();
  const tipo = (g.tipo || "").trim();
  const tipopersona = (g.tipopersona || "").trim();
  const direccionSede = (g.direccionSede || "").trim();
  const genMunicipioId = (g.municipioId || "").trim();
  const genMovil = (g.movil || "").trim();
  const genEmail = (g.email || "").trim();

  const fincaId = (f.id || "").trim();
  const fincaNombre = (f.nombre || "").trim();
  const fincaMunicipioId = (f.municipioId || "").trim();
  const cultivoIds = Array.isArray(f.cultivoIds)
    ? f.cultivoIds.filter((x) => typeof x === "string" && x.trim())
    : [];
  const fincaMovil = (f.movil || "").trim();
  const fincaEmail = (f.email || "").trim();

  const faltan: string[] = [];
  if (!nombre) faltan.push("nombre del generador");
  if (!nit) faltan.push("NIT/cédula");
  if (!tipo) faltan.push("tipo de generador");
  if (!tipopersona) faltan.push("tipo de persona");
  if (!direccionSede) faltan.push("dirección de sede");
  if (!genMunicipioId) faltan.push("municipio del generador");
  if (!genMovil) faltan.push("móvil del generador");
  if (!fincaId) faltan.push("id de la finca");
  if (!fincaNombre) faltan.push("nombre de la finca");
  if (!fincaMunicipioId) faltan.push("municipio de la finca");
  if (!fincaMovil) faltan.push("móvil de la finca");
  if (cultivoIds.length === 0) faltan.push("al menos un cultivo de la finca");
  if (faltan.length > 0) {
    return NextResponse.json(
      { error: `Faltan campos obligatorios: ${faltan.join(", ")}` },
      { status: 400 }
    );
  }

  const docError = validarDocumento(tipopersona, nit);
  if (docError) {
    return NextResponse.json({ error: docError }, { status: 400 });
  }

  // Personas jurídicas: el NIT debe incluir el dígito de verificación correcto.
  // Algoritmo oficial DIAN (docs/ALGORITMO_DIGITO_VERIFICACION.md). Si es
  // válido, extraemos el DV numérico para poblar el campo dv.
  let dvJuridica: number | null = null;
  if (tipopersona === "Juridica") {
    if (!validarNitJuridica(nit)) {
      const limpio = nit.replace(/[^\d]/g, "");
      const base = nit.includes("-")
        ? nit.split("-")[0].replace(/[^\d]/g, "")
        : limpio.length >= 9
        ? limpio.slice(0, -1)
        : limpio;
      const dvSugerido =
        base.length >= 8 && base.length <= 15
          ? calcularDigitoVerificador(base)
          : null;
      return NextResponse.json(
        {
          error: "NIT_DV_INVALIDO",
          mensaje:
            "El NIT no tiene un dígito de verificación válido. Para personas jurídicas el NIT debe incluir el DV (ej. 900123456-7).",
          sugerencia:
            dvSugerido !== null
              ? `El NIT correcto sería: ${base}-${dvSugerido}`
              : undefined,
        },
        { status: 400 }
      );
    }
    if (nit.includes("-")) {
      const after = nit.split("-")[1]?.replace(/[^\d]/g, "") || "";
      dvJuridica = after.length > 0 ? parseInt(after, 10) : null;
    } else {
      const limpio = nit.replace(/[^\d]/g, "");
      dvJuridica = limpio.length > 0 ? parseInt(limpio.slice(-1), 10) : null;
    }
  }

  if (!esMovilCOValido(genMovil)) {
    return NextResponse.json(
      { error: "El móvil del generador no es un celular colombiano válido" },
      { status: 400 }
    );
  }
  if (!esMovilCOValido(fincaMovil)) {
    return NextResponse.json(
      { error: "El móvil de la finca no es un celular colombiano válido" },
      { status: 400 }
    );
  }

  // Dedupe NIT en otro generador (excluye este mismo id)
  const nitDigits = soloDigitos(nit);
  try {
    const formula = `AND(REGEX_REPLACE({nit}&'', '[^0-9]', '') = '${nitDigits}', RECORD_ID() != '${generadorId}')`;
    const qs = new URLSearchParams();
    qs.append("fields[]", "nombre");
    qs.append("fields[]", "nit");
    qs.set("filterByFormula", formula);
    qs.set("maxRecords", "1");
    const dupRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (dupRes.ok) {
      const dup = await dupRes.json();
      const existing = (dup.records || [])[0];
      if (existing) {
        return NextResponse.json(
          {
            error: "DUPLICADO",
            mensaje: `Otro generador ya tiene ese NIT/cédula: ${
              existing.fields?.nombre || "(sin nombre)"
            }`,
            generador: {
              id: existing.id,
              nombre: String(existing.fields?.nombre || ""),
              nit: String(existing.fields?.nit || ""),
            },
          },
          { status: 409 }
        );
      }
    }
  } catch (err) {
    console.error("[generadores/editar] dedupe error:", err);
    return NextResponse.json(
      { error: "Error comprobando duplicados" },
      { status: 500 }
    );
  }

  // Sanidad: la finca debe pertenecer al generador
  try {
    const fres = await fetch(
      `https://api.airtable.com/v0/${baseId}/FINCAS/${fincaId}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!fres.ok) {
      return NextResponse.json(
        { error: "Finca no encontrada" },
        { status: 404 }
      );
    }
    const frec = await fres.json();
    const links = Array.isArray(frec.fields?.generador)
      ? frec.fields.generador
      : [];
    if (!links.includes(generadorId)) {
      return NextResponse.json(
        { error: "La finca no pertenece al generador indicado" },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("[generadores/editar] verificación finca:", err);
    return NextResponse.json(
      { error: "Error verificando la finca" },
      { status: 500 }
    );
  }

  // 1) PATCH GENERADOR
  try {
    const genFields: Record<string, unknown> = {
      nombre,
      nit,
      tipo,
      tipopersona,
      direccion_sede: direccionSede,
      municipio: [genMunicipioId],
      movil: genMovil,
      email: genEmail || "",
      // Limpiar dv si tipopersona pasó a Natural; setear si es Juridica con DV válido.
      dv: dvJuridica,
    };
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: genFields, typecast: true }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("[generadores/editar] PATCH generador falló:", t);
      return NextResponse.json(
        { error: "Error actualizando el generador" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[generadores/editar] excepción gen:", err);
    return NextResponse.json(
      { error: "Error actualizando el generador" },
      { status: 500 }
    );
  }

  // 2) PATCH FINCA (incluye `revisado: true` ya que pasamos todas las reglas)
  try {
    const fincaFields: Record<string, unknown> = {
      nombre: fincaNombre,
      municipio: [fincaMunicipioId],
      cultivos: cultivoIds,
      movil: fincaMovil,
      email: fincaEmail || "",
      revisado: true,
    };
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/FINCAS/${fincaId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: fincaFields, typecast: true }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("[generadores/editar] PATCH finca falló:", t);
      return NextResponse.json(
        { error: "Error actualizando la finca (el generador sí se actualizó)" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[generadores/editar] excepción finca:", err);
    return NextResponse.json(
      { error: "Error actualizando la finca" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    generador: { id: generadorId, nombre, nit, tipo, tipopersona },
    finca: { id: fincaId, nombre: fincaNombre },
  });
}
