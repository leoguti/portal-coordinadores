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
  Beneficiario?: string[];
  RazonSocial?: string[];
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
}
interface RubroFields {
  Nombre?: string;
  Tipo?: string[];
  requiere_trayecto?: boolean;
  requiere_noches?: boolean;
}
interface ReembolsoFields {
  NumeroReembolso?: number;
  Coordinador?: string[];
  Fecha?: string;
  Monto?: number;
  Observaciones?: string;
}
interface CoordFields {
  Name?: string;
  SaldoInicial?: number;
  saldo_inicial?: number;
}

async function airtableGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

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

  const isAdmin = isAdminOrSupervisor(session.user.rol);
  if (!isAdmin && coordinadorParam !== session.user.coordinatorRecordId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    // 1. Gastos del coordinador en el mes (todos, no solo Aprobados — el PDF muestra estado)
    const filterGastos = `AND(
      FIND('${coordinadorParam}', ARRAYJOIN({Coordinador}, ','))>0,
      {MesLegalizacion}='${mes}'
    )`;
    const gastos: AirtableRecord<GastoFields>[] = [];
    let offset: string | undefined;
    do {
      const data = await airtableGet<{ records: AirtableRecord<GastoFields>[]; offset?: string }>(
        `/GastosCajaMenor?pageSize=100&filterByFormula=${encodeURIComponent(filterGastos)}&sort%5B0%5D%5Bfield%5D=Fecha&sort%5B0%5D%5Bdirection%5D=asc${offset ? `&offset=${offset}` : ""}`
      );
      gastos.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    // 2. Reembolsos del coordinador en el mes
    const filterReemb = `AND(
      FIND('${coordinadorParam}', ARRAYJOIN({Coordinador}, ','))>0,
      DATETIME_FORMAT({Fecha}, 'YYYY-MM')='${mes}'
    )`;
    const reembolsos: AirtableRecord<ReembolsoFields>[] = [];
    let offR: string | undefined;
    do {
      const data = await airtableGet<{ records: AirtableRecord<ReembolsoFields>[]; offset?: string }>(
        `/ReembolsosCajaMenor?pageSize=100&filterByFormula=${encodeURIComponent(filterReemb)}&sort%5B0%5D%5Bfield%5D=Fecha&sort%5B0%5D%5Bdirection%5D=asc${offR ? `&offset=${offR}` : ""}`
      );
      reembolsos.push(...(data.records || []));
      offR = data.offset;
    } while (offR);

    // 3. Todos los gastos aprobados y reembolsos ANTES de este mes, para calcular saldo anterior
    const mesFinMesAnteriorStr = (() => {
      const [y, m] = mes.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      d.setDate(0); // último día del mes anterior
      return d.toISOString().split("T")[0];
    })();

    const filtroHistorico = `AND(
      FIND('${coordinadorParam}', ARRAYJOIN({Coordinador}, ','))>0,
      IS_BEFORE({Fecha}, '${mes}-01')
    )`;

    // Gastos anteriores Aprobados
    let sumaGastosAnteriores = 0;
    let offH1: string | undefined;
    do {
      const filterGastosHistoricos = `AND(
        FIND('${coordinadorParam}', ARRAYJOIN({Coordinador}, ','))>0,
        IS_BEFORE({Fecha}, '${mes}-01'),
        {Estado}='Aprobado'
      )`;
      const data = await airtableGet<{ records: AirtableRecord<GastoFields>[]; offset?: string }>(
        `/GastosCajaMenor?pageSize=100&fields%5B%5D=Valor&fields%5B%5D=MontoIVA&fields%5B%5D=ValorRetencion&filterByFormula=${encodeURIComponent(filterGastosHistoricos)}${offH1 ? `&offset=${offH1}` : ""}`
      );
      for (const g of data.records || []) {
        sumaGastosAnteriores +=
          (g.fields.Valor || 0) + (g.fields.MontoIVA || 0) - (g.fields.ValorRetencion || 0);
      }
      offH1 = data.offset;
    } while (offH1);

    // Reembolsos anteriores
    let sumaReembolsosAnteriores = 0;
    let offH2: string | undefined;
    do {
      const data = await airtableGet<{ records: AirtableRecord<ReembolsoFields>[]; offset?: string }>(
        `/ReembolsosCajaMenor?pageSize=100&fields%5B%5D=Monto&filterByFormula=${encodeURIComponent(filtroHistorico)}${offH2 ? `&offset=${offH2}` : ""}`
      );
      for (const r of data.records || []) {
        sumaReembolsosAnteriores += r.fields.Monto || 0;
      }
      offH2 = data.offset;
    } while (offH2);
    void mesFinMesAnteriorStr; // unused (kept for posible log)

    // 4. Saldo inicial del coordinador
    const coordRes = await airtableGet<{ id: string; fields: CoordFields }>(
      `/Coordinadores/${coordinadorParam}`
    );
    const saldoInicialCoord =
      coordRes.fields.SaldoInicial ?? coordRes.fields.saldo_inicial ?? 0;

    const saldoAnterior = saldoInicialCoord + sumaReembolsosAnteriores - sumaGastosAnteriores;

    // 5. Rubros (para saber nombre y flags)
    const rubroIds = Array.from(new Set(gastos.flatMap((g) => g.fields.Rubro || [])));
    const rubrosById = new Map<string, RubroFields>();
    if (rubroIds.length > 0) {
      const or = rubroIds.map((id) => `RECORD_ID()='${id}'`).join(",");
      const data = await airtableGet<{ records: AirtableRecord<RubroFields>[] }>(
        `/Rubros?filterByFormula=${encodeURIComponent(`OR(${or})`)}&pageSize=100`
      );
      for (const r of data.records || []) rubrosById.set(r.id, r.fields);
    }

    // 6. Nombre del coordinador
    const coordinadorNombre =
      coordRes.fields.Name || gastos[0]?.fields?.NombreCoordinador?.[0] || "Coordinador";

    // 7. Agrupar gastos en 4 secciones
    type Row = LegalizacionMensualPDFProps["secciones"][number]["gastos"][number];
    const buckets: Record<Seccion, Row[]> = { transporte: [], alimentacion: [], hospedaje: [], otros: [] };
    let totalGastosAprobados = 0;

    for (const g of gastos) {
      const f = g.fields;
      const rubroId = f.Rubro?.[0];
      const rubroFields = rubroId ? rubrosById.get(rubroId) : undefined;
      const rubroNombre = rubroFields?.Nombre || "Sin rubro";
      const seccion = seccionPara(rubroNombre, rubroFields || {});
      const valorNeto = (f.Valor || 0) + (f.MontoIVA || 0) - (f.ValorRetencion || 0);
      const estado = f.Estado || "Pendiente";
      if (estado === "Aprobado") totalGastosAprobados += valorNeto;

      buckets[seccion].push({
        numeroGasto: f.NumeroGasto,
        fecha: f.Fecha,
        hora: f.hora,
        noches: f.noches,
        descripcion: f.Observaciones,
        rubroNombre,
        beneficiario: f.RazonSocial?.[0],
        municipio: f["mundep (from municipio)"]?.[0],
        municipioDestino: f["mundep (from municipio_destino)"]?.[0],
        valor: valorNeto,
        estado,
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

    // Reembolsos al template
    const reembolsosRows = reembolsos.map((r) => ({
      numero: r.fields.NumeroReembolso,
      fecha: r.fields.Fecha,
      monto: r.fields.Monto || 0,
      observaciones: r.fields.Observaciones,
    }));
    const totalReembolsos = reembolsosRows.reduce((s, r) => s + r.monto, 0);
    const saldoFinal = saldoAnterior + totalReembolsos - totalGastosAprobados;

    // 8. Renderizar PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(LegalizacionMensualPDF, {
      mesReporte: mes,
      coordinadorNombre,
      secciones,
      reembolsos: reembolsosRows,
      totalReembolsos,
      totalGastos: totalGastosAprobados,
      saldoAnterior,
      saldoFinal,
    }) as any;
    const pdf = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="legalizacion-caja-menor-${mes}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[pdf-mes] error:", e);
    return NextResponse.json(
      { error: "Error generando PDF", detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
