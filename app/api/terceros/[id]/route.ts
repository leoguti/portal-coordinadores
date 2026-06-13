import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluarCompletitud, validarCamposEscritura } from "@/lib/terceros";
import { validarNitJuridica, calcularDigitoVerificador } from "@/lib/nit";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/Terceros/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const rec = await res.json();
  const completitud = evaluarCompletitud(rec.fields);

  // Si se pide chequear planilla para un mes específico (solo aplica a naturales)
  let planillaCheck: { mes: string; ok: boolean; aplica: boolean } | null = null;
  const mesParam = req.nextUrl.searchParams.get("mesPlanilla");
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const esNatural = rec.fields.tipo_persona === "Natural";
    if (!esNatural) {
      planillaCheck = { mes: mesParam, ok: true, aplica: false };
    } else {
      const pRes = await fetch(
        `https://api.airtable.com/v0/${BASE}/PlanillasSS?filterByFormula=${encodeURIComponent(`{mes_periodo} = '${mesParam}'`)}&pageSize=100`,
        { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
      );
      const pData = await pRes.json();
      const ok = (pData.records || []).some(
        (r: any) => (r.fields.tercero || []).includes(id) && (r.fields.archivo || []).length > 0
      );
      planillaCheck = { mes: mesParam, ok, aplica: true };
    }
  }

  return NextResponse.json({
    id: rec.id,
    fields: rec.fields,
    completitud,
    planillaCheck,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Whitelist de campos que aceptamos
  const fields: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    razonSocial: "RazonSocial",
    nit: "NIT",
    direccion: "Direccion",
    movil: "Movil",
    correo: "Correo Electrónico",
    observaciones: "Observaciones",
    tipoPersona: "tipo_persona",
    proceso: "proceso",
  };

  for (const [k, v] of Object.entries(body)) {
    if (k in mapping && v !== undefined) {
      fields[mapping[k]] = v;
    }
  }

  if (body.municipioId !== undefined) {
    fields.Municipio = body.municipioId ? [body.municipioId] : [];
  }
  if (body.cedulaPdf !== undefined) {
    fields.cedula_pdf = body.cedulaPdf;
  }
  if (body.certificadoCamaraPdf !== undefined) {
    fields.certificado_camara_pdf = body.certificadoCamaraPdf;
  }
  if (body.rutPdf !== undefined) {
    fields.rut_pdf = body.rutPdf;
  }
  if (body.certificacionBancariaPdf !== undefined) {
    fields.certificacion_bancaria_pdf = body.certificacionBancariaPdf;
  }
  if (body.coordinadorResponsableId !== undefined) {
    fields.coordinador_responsable = body.coordinadorResponsableId ? [body.coordinadorResponsableId] : [];
  }

  // Para personas jurídicas, el NIT debe incluir el dígito de verificación
  // y ser válido contra el algoritmo oficial DIAN. Se valida acá para
  // bloquear la escritura (antes solo se reportaba como "incompleto"
  // post-hoc). Necesitamos saber el estado FINAL del tercero, así que si el
  // body trae solo uno de {nit, tipoPersona} consultamos el resto del record.
  const nitNuevo: string | undefined =
    typeof body.nit === "string" ? body.nit : undefined;
  const tipoNuevo: string | undefined =
    typeof body.tipoPersona === "string" ? body.tipoPersona : undefined;
  if (nitNuevo !== undefined || tipoNuevo !== undefined) {
    let nitFinal = nitNuevo;
    let tipoFinal = tipoNuevo;
    if (nitFinal === undefined || tipoFinal === undefined) {
      const curr = await fetch(
        `https://api.airtable.com/v0/${BASE}/Terceros/${id}`,
        { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
      );
      if (curr.ok) {
        const c = await curr.json();
        if (nitFinal === undefined) nitFinal = c.fields?.NIT;
        if (tipoFinal === undefined) tipoFinal = c.fields?.tipo_persona;
      }
    }
    if (tipoFinal === "Jurídica" && nitFinal) {
      if (!validarNitJuridica(nitFinal)) {
        // Sugerir DV correcto si el usuario escribió solo la base
        const limpio = String(nitFinal).replace(/[^\d]/g, "");
        const base = limpio.includes("-")
          ? String(nitFinal).split("-")[0].replace(/[^\d]/g, "")
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
              "Para personas jurídicas el NIT debe incluir el dígito de verificación correcto.",
            sugerencia:
              dvSugerido !== null
                ? `El NIT correcto sería: ${base}-${dvSugerido}`
                : undefined,
          },
          { status: 400 }
        );
      }
    }
  }

  // Validación de formato de dirección (DIAN), correo y móvil. Solo se valida
  // lo que viene en el body con valor; estos campos son clave para exógena y
  // para las notificaciones de pago a terceros.
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

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/Terceros/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[terceros/patch]", err);
    return NextResponse.json({ error: "Error al guardar", detail: err }, { status: 500 });
  }

  const rec = await res.json();
  const completitud = evaluarCompletitud(rec.fields);
  return NextResponse.json({ id: rec.id, fields: rec.fields, completitud });
}
