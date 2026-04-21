import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { isAdminOrSupervisor } from "@/lib/roles";
import LegalizacionMensualPDF, {
  type LegalizacionMensualPDFProps,
} from "@/components/pdf/LegalizacionMensualPDF";

export const maxDuration = 60;

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

interface AirtableRecord<F> {
  id: string;
  fields: F;
}
interface GastoFields {
  NumeroGasto?: number;
  Fecha?: string;
  Coordinador?: string[];
  NombreCoordinador?: string[];
  Rubro?: string[];
  Observaciones?: string;
  Valor?: number;
  MontoIVA?: number;
  ValorRetencion?: number;
  Estado?: string;
  MesLegalizacion?: string;
  hora?: string;
  noches?: number;
  tipo_soporte?: string;
  numero_soporte?: string;
  "mundep (from municipio)"?: string[];
  "mundep (from municipio_destino)"?: string[];
  RazonSocial?: string[];
}
interface RubroFields {
  Nombre?: string;
  Tipo?: string[];
  requiere_trayecto?: boolean;
  requiere_noches?: boolean;
}

async function airtableGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

// Determina la sección del PDF a la que pertenece un rubro
type Seccion = "transporte" | "alimentacion" | "hospedaje" | "otros";
function seccionPara(rubroNombre: string, rubroFields: RubroFields): Seccion {
  const n = (rubroNombre || "").toLowerCase();
  const tipo = (rubroFields.Tipo?.[0] || "").toLowerCase();

  if (rubroFields.requiere_noches) return "hospedaje";
  if (n.includes("aloja") || n.includes("hotel") || n.includes("hospedaje")) return "hospedaje";
  if (rubroFields.requiere_trayecto) return "transporte";
  if (tipo === "transporte") return "transporte";
  if (n.includes("aliment") || n.includes("refriger")) return "alimentacion";
  return "otros";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes") || "";
  const coordinadorParam = searchParams.get("coordinador") || "";

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "mes inválido (YYYY-MM)" }, { status: 400 });
  }
  if (!coordinadorParam) {
    return NextResponse.json({ error: "coordinador requerido" }, { status: 400 });
  }

  // Permisos: coordinador solo su propio mes, admin puede cualquiera
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  if (!isAdmin && coordinadorParam !== session.user.coordinatorRecordId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    // 1. Gastos del coordinador en el mes (solo Aprobados)
    const filter = `AND(
      FIND('${coordinadorParam}', ARRAYJOIN({Coordinador}, ','))>0,
      {MesLegalizacion}='${mes}',
      {Estado}='Aprobado'
    )`;

    const gastos: AirtableRecord<GastoFields>[] = [];
    let offset: string | undefined;
    do {
      const data = await airtableGet<{ records: AirtableRecord<GastoFields>[]; offset?: string }>(
        `/GastosCajaMenor?pageSize=100&filterByFormula=${encodeURIComponent(filter)}&sort%5B0%5D%5Bfield%5D=Fecha&sort%5B0%5D%5Bdirection%5D=asc${offset ? `&offset=${offset}` : ""}`
      );
      gastos.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    // 2. Rubros (para saber nombre y flags)
    const rubroIds = Array.from(
      new Set(gastos.flatMap((g) => g.fields.Rubro || []))
    );
    const rubrosById = new Map<string, RubroFields>();
    if (rubroIds.length > 0) {
      const or = rubroIds.map((id) => `RECORD_ID()='${id}'`).join(",");
      const data = await airtableGet<{ records: AirtableRecord<RubroFields>[] }>(
        `/Rubros?filterByFormula=${encodeURIComponent(`OR(${or})`)}&pageSize=100`
      );
      for (const r of data.records || []) {
        rubrosById.set(r.id, r.fields);
      }
    }

    // 3. Nombre del coordinador (del primer gasto)
    const coordinadorNombre = gastos[0]?.fields?.NombreCoordinador?.[0] || "Coordinador";

    // 4. Agrupar en 4 secciones
    type Row = LegalizacionMensualPDFProps["secciones"][number]["gastos"][number];
    const buckets: Record<Seccion, Row[]> = {
      transporte: [],
      alimentacion: [],
      hospedaje: [],
      otros: [],
    };

    for (const g of gastos) {
      const f = g.fields;
      const rubroId = f.Rubro?.[0];
      const rubroFields = rubroId ? rubrosById.get(rubroId) : undefined;
      const rubroNombre = rubroFields?.Nombre || "Sin rubro";
      const seccion = seccionPara(rubroNombre, rubroFields || {});

      const valorNeto =
        (f.Valor || 0) + (f.MontoIVA || 0) - (f.ValorRetencion || 0);

      buckets[seccion].push({
        numeroGasto: f.NumeroGasto,
        fecha: f.Fecha,
        hora: f.hora,
        noches: f.noches,
        descripcion: f.Observaciones,
        rubroNombre,
        municipio: f["mundep (from municipio)"]?.[0],
        municipioDestino: f["mundep (from municipio_destino)"]?.[0],
        valor: valorNeto,
        tipoSoporte: f.tipo_soporte,
        numeroSoporte: f.numero_soporte,
      });
    }

    const secciones: LegalizacionMensualPDFProps["secciones"] = [
      {
        titulo: "GASTOS ASOCIADOS A TRANSPORTE",
        descripcion: "Peajes, tanqueos, transporte público o privado entre otros",
        columnas: "transporte",
        gastos: buckets.transporte,
        total: buckets.transporte.reduce((s, g) => s + g.valor, 0),
      },
      {
        titulo: "GASTOS ASOCIADOS A ALIMENTACIÓN",
        descripcion: "Desayunos, almuerzos, cenas, refrigerios y demás autorizados",
        columnas: "alimentacion",
        gastos: buckets.alimentacion,
        total: buckets.alimentacion.reduce((s, g) => s + g.valor, 0),
      },
      {
        titulo: "GASTOS ASOCIADOS A HOSPEDAJE",
        descripcion: "Hospedaje necesario para el viaje",
        columnas: "hospedaje",
        gastos: buckets.hospedaje,
        total: buckets.hospedaje.reduce((s, g) => s + g.valor, 0),
      },
      {
        titulo: "OTROS GASTOS",
        descripcion: "Gastos que no clasifican en las categorías anteriores",
        columnas: "otros",
        gastos: buckets.otros,
        total: buckets.otros.reduce((s, g) => s + g.valor, 0),
      },
    ];

    const totalGeneral = secciones.reduce((s, sec) => s + sec.total, 0);

    // 5. Renderizar PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(LegalizacionMensualPDF, {
      mesReporte: mes,
      coordinadorNombre,
      secciones,
      totalGeneral,
    }) as any;
    const pdf = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="legalizacion-${mes}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[pdf-mes] error:", e);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
