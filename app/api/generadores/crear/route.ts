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
 * POST /api/generadores/crear
 *
 * Crea un generador desde cero en el esquema nuevo (GENERADORES + FINCAS).
 *
 * Reglas:
 *  1. Antes de crear, comprueba que el NIT/cédula NO exista (comparación
 *     normalizada: solo dígitos, "800141506-1" == "8001415061"). Si existe,
 *     responde 409 con el generador existente — no se duplica.
 *  2. Un generador SIEMPRE debe tener al menos una finca: se crea la finca
 *     obligatoria en la misma operación. Si la finca falla, se borra el
 *     generador (rollback) para no dejar generadores huérfanos.
 *
 * Body:
 * {
 *   generador: { nombre, nit, tipo, tipopersona, direccionSede,
 *                municipioId, movil, email? },
 *   finca: { nombre, municipioId, cultivoIds[], movil?, email? }
 * }
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
    nombre?: string;
    municipioId?: string;
    cultivoIds?: string[];
    movil?: string;
    email?: string;
  };
}

export async function POST(req: NextRequest) {
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

  const fincaNombre = (f.nombre || "").trim();
  const fincaMunicipioId = (f.municipioId || "").trim();
  const cultivoIds = Array.isArray(f.cultivoIds)
    ? f.cultivoIds.filter((x) => typeof x === "string" && x.trim())
    : [];
  const fincaMovil = (f.movil || "").trim();
  const fincaEmail = (f.email || "").trim();

  // Validaciones de obligatorios
  const faltan: string[] = [];
  if (!nombre) faltan.push("nombre del generador");
  if (!nit) faltan.push("NIT/cédula");
  if (!tipo) faltan.push("tipo");
  if (!tipopersona) faltan.push("tipo de persona");
  if (!direccionSede) faltan.push("dirección de sede");
  if (!genMunicipioId) faltan.push("municipio del generador");
  if (!genMovil) faltan.push("móvil del generador");
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

  // Formato del documento según tipo de persona (NIT jurídica / cédula natural)
  const docError = validarDocumento(tipopersona, nit);
  if (docError) {
    return NextResponse.json({ error: docError }, { status: 400 });
  }

  // Personas jurídicas: el NIT debe incluir el dígito de verificación correcto.
  // Se valida con el algoritmo oficial DIAN (docs/ALGORITMO_DIGITO_VERIFICACION.md).
  // Si es válido, además extraemos el DV numérico para poblarlo en el campo dv.
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
    // DV válido: extraer el número
    if (nit.includes("-")) {
      const after = nit.split("-")[1]?.replace(/[^\d]/g, "") || "";
      dvJuridica = after.length > 0 ? parseInt(after, 10) : null;
    } else {
      const limpio = nit.replace(/[^\d]/g, "");
      dvJuridica = limpio.length > 0 ? parseInt(limpio.slice(-1), 10) : null;
    }
  }

  // Móviles colombianos (10 dígitos, empiezan por 3)
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

  const nitDigits = soloDigitos(nit);

  // 1. Dedupe por NIT/cédula normalizado (solo dígitos) vía REGEX_REPLACE.
  try {
    const formula = `REGEX_REPLACE({nit}&'', '[^0-9]', '') = '${nitDigits}'`;
    const params = new URLSearchParams();
    params.append("fields[]", "nombre");
    params.append("fields[]", "nit");
    params.append("fields[]", "FINCAS");
    params.append("fields[]", "tipo");
    params.append("fields[]", "tipopersona");
    params.set("filterByFormula", formula);
    params.set("maxRecords", "1");
    const dupRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (dupRes.ok) {
      const dup = await dupRes.json();
      const existing = (dup.records || [])[0];
      if (existing) {
        return NextResponse.json(
          {
            error: "DUPLICADO",
            mensaje: `Ya existe un generador con ese NIT/cédula: ${
              existing.fields?.nombre || "(sin nombre)"
            }`,
            generador: {
              id: existing.id,
              nombre: String(existing.fields?.nombre || ""),
              nit: String(existing.fields?.nit || ""),
              tipo: String(existing.fields?.tipo || ""),
              tipopersona: String(existing.fields?.tipopersona || ""),
              fincaIds: Array.isArray(existing.fields?.FINCAS)
                ? existing.fields.FINCAS
                : [],
            },
          },
          { status: 409 }
        );
      }
    } else {
      const t = await dupRes.text();
      console.error("[generadores/crear] dedupe error:", dupRes.status, t);
      return NextResponse.json(
        { error: "Error comprobando duplicados" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[generadores/crear] dedupe excepción:", err);
    return NextResponse.json(
      { error: "Error comprobando duplicados" },
      { status: 500 }
    );
  }

  // 2. Crear GENERADOR
  let generadorId: string;
  try {
    const genFields: Record<string, unknown> = {
      nombre,
      nit,
      tipo,
      tipopersona,
      direccion_sede: direccionSede,
      municipio: [genMunicipioId],
      movil: genMovil,
    };
    if (genEmail) genFields.email = genEmail;
    if (dvJuridica !== null) genFields.dv = dvJuridica;

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: genFields, typecast: true }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("[generadores/crear] crear generador falló:", t);
      return NextResponse.json(
        { error: "Error creando el generador" },
        { status: 500 }
      );
    }
    const data = await res.json();
    generadorId = data.id;
  } catch (err) {
    console.error("[generadores/crear] excepción creando generador:", err);
    return NextResponse.json(
      { error: "Error creando el generador" },
      { status: 500 }
    );
  }

  // 3. Crear FINCA obligatoria vinculada al generador
  try {
    const fincaFields: Record<string, unknown> = {
      nombre: fincaNombre,
      generador: [generadorId],
      municipio: [fincaMunicipioId],
      cultivos: cultivoIds,
      // Asigna la finca al coordinador que la crea para que aparezca en su
      // lista de "Generadores y Fincas" (filtrada por coordinador_asignado).
      coordinador_asignado: [session.user.coordinatorRecordId],
    };
    if (fincaMovil) fincaFields.movil = fincaMovil;
    if (fincaEmail) fincaFields.email = fincaEmail;

    const res = await fetch(`https://api.airtable.com/v0/${baseId}/FINCAS`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: fincaFields, typecast: true }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[generadores/crear] crear finca falló:", t);
      // Rollback: borrar el generador para no dejarlo huérfano
      await fetch(
        `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      ).catch(() => {});
      return NextResponse.json(
        { error: "Error creando la finca; no se creó el generador" },
        { status: 500 }
      );
    }
    const fincaData = await res.json();

    return NextResponse.json(
      {
        generador: {
          id: generadorId,
          nombre,
          nit,
          tipo,
          tipopersona,
          fincaIds: [fincaData.id],
        },
        finca: { id: fincaData.id, nombre: fincaNombre },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[generadores/crear] excepción creando finca:", err);
    await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } }
    ).catch(() => {});
    return NextResponse.json(
      { error: "Error creando la finca; no se creó el generador" },
      { status: 500 }
    );
  }
}
