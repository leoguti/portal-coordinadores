import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllGastosCajaMenor,
  getReembolsosCajaMenor,
  getSaldoInicialCajaMenor,
  getRubros,
  type GastoCajaMenor,
} from "@/lib/airtable";
import LegalizacionMensualPDF, {
  type LegalizacionMensualPDFProps,
} from "@/components/pdf/LegalizacionMensualPDF";

export const maxDuration = 60;

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// Misma función que /caja-menor usa
function calcValorNeto(g: GastoCajaMenor): number {
  const valor = g.fields.Valor || 0;
  const montoIVA = g.fields.MontoIVA || 0;
  const pct = g.fields.PorcentajeRetencion || 0;
  return valor + montoIVA - valor * pct;
}

type Seccion = "transporte" | "alimentacion" | "hospedaje" | "otros";
function seccionPara(
  rubroNombre: string,
  rubroFields: { Tipo?: string[]; requiere_trayecto?: boolean; requiere_noches?: boolean } | undefined
): Seccion {
  const n = (rubroNombre || "").toLowerCase();
  const tipo = (rubroFields?.Tipo?.[0] || "").toLowerCase();
  if (rubroFields?.requiere_noches) return "hospedaje";
  if (n.includes("aloja") || n.includes("hotel") || n.includes("hospedaje")) return "hospedaje";
  if (rubroFields?.requiere_trayecto) return "transporte";
  if (tipo === "transporte") return "transporte";
  if (n.includes("aliment") || n.includes("refriger")) return "alimentacion";
  return "otros";
}

// Resuelve IDs de MUNICIPIOS → mundep (Airtable API no permite crear lookups)
async function fetchMundepByIds(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  // Batches de 100 para no exceder la longitud de la fórmula
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const or = chunk.map((id) => `RECORD_ID()='${id}'`).join(",");
    const url = `https://api.airtable.com/v0/${BASE}/MUNICIPIOS?filterByFormula=${encodeURIComponent(`OR(${or})`)}&fields%5B%5D=mundep&pageSize=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" });
    if (!res.ok) continue;
    const data = (await res.json()) as { records: Array<{ id: string; fields: { mundep?: string } }> };
    for (const r of data.records || []) {
      if (r.fields.mundep) out.set(r.id, r.fields.mundep);
    }
  }
  return out;
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
    // 1. Cargar datos con los MISMOS helpers de /caja-menor
    const [allGastos, reembolsos, saldoInicialCoord, rubros] = await Promise.all([
      getAllGastosCajaMenor(),
      getReembolsosCajaMenor(coordinadorParam),
      getSaldoInicialCajaMenor(coordinadorParam),
      getRubros(),
    ]);

    // Mapa de rubros por ID
    const rubrosById = new Map<string, { Nombre?: string; Tipo?: string[]; requiere_trayecto?: boolean; requiere_noches?: boolean }>();
    for (const r of rubros) {
      rubrosById.set(r.id, {
        Nombre: r.fields.Nombre,
        Tipo: r.fields.Tipo,
        requiere_trayecto: r.fields.requiere_trayecto,
        requiere_noches: r.fields.requiere_noches,
      });
    }

    // 2. Filtrar gastos y reembolsos del coordinador (MISMA lógica que /caja-menor)
    const gastosCoord = allGastos.filter((g) => g.fields.Coordinador?.includes(coordinadorParam));
    const reembolsosCoord = reembolsos; // ya viene filtrado por coord

    // 3. Calcular saldo acumulado mes a mes (MISMA lógica)
    const mesesSet = new Set<string>();
    gastosCoord.forEach((g) => {
      const m = (g.fields.Fecha || "").substring(0, 7);
      if (m) mesesSet.add(m);
    });
    reembolsosCoord.forEach((r) => {
      const m = (r.fields.Fecha || "").substring(0, 7);
      if (m) mesesSet.add(m);
    });
    const mesesOrdenados = Array.from(mesesSet).sort();

    let saldoAcumulado = saldoInicialCoord;
    let saldoAnterior = saldoInicialCoord;
    let reembolsosMes = 0;
    let facturasAprobadasMes = 0;
    let saldoFinal = saldoInicialCoord;

    for (const m of mesesOrdenados) {
      const sa = saldoAcumulado;
      const rMes = reembolsosCoord
        .filter((r) => (r.fields.Fecha || "").substring(0, 7) === m)
        .reduce((sum, r) => sum + (r.fields.Monto || 0), 0);
      const fMes = gastosCoord
        .filter((g) => g.fields.Estado === "Aprobado" && (g.fields.Fecha || "").substring(0, 7) === m)
        .reduce((sum, g) => sum + calcValorNeto(g), 0);
      saldoAcumulado = sa + rMes - fMes;

      if (m === mes) {
        saldoAnterior = sa;
        reembolsosMes = rMes;
        facturasAprobadasMes = fMes;
        saldoFinal = saldoAcumulado;
      }
    }

    // 4. Gastos del mes (todos — el PDF los muestra con estado)
    const gastosDelMes = gastosCoord
      .filter((g) => (g.fields.Fecha || "").substring(0, 7) === mes)
      .sort((a, b) => (a.fields.Fecha || "").localeCompare(b.fields.Fecha || ""));

    // DEBUG: ver qué campos trae cada gasto
    for (const g of gastosDelMes) {
      console.log(`[pdf-mes] gasto ${g.id} fields:`, Object.keys(g.fields).join(", "));
      console.log(`[pdf-mes] hora=${(g.fields as Record<string, unknown>).hora}, tipo_soporte=${(g.fields as Record<string, unknown>).tipo_soporte}, numero_soporte=${(g.fields as Record<string, unknown>).numero_soporte}, municipio=${JSON.stringify((g.fields as Record<string, unknown>).municipio)}`);
    }

    // 5. Reembolsos del mes
    const reembolsosDelMes = reembolsosCoord
      .filter((r) => (r.fields.Fecha || "").substring(0, 7) === mes)
      .sort((a, b) => (a.fields.Fecha || "").localeCompare(b.fields.Fecha || ""));

    // 6. Nombre del coordinador
    const coordinadorNombre = gastosDelMes[0]?.fields?.NombreCoordinador?.[0] ||
                              reembolsosDelMes[0]?.fields?.NombreCoordinador?.[0] ||
                              "Coordinador";

    // 7. Resolver IDs de municipios → nombres (mundep)
    const municipioIds: string[] = [];
    for (const g of gastosDelMes) {
      const mIds = (g.fields as { municipio?: string[] }).municipio || [];
      const mDestIds = (g.fields as { municipio_destino?: string[] }).municipio_destino || [];
      municipioIds.push(...mIds, ...mDestIds);
    }
    const mundepById = await fetchMundepByIds(municipioIds);

    // 8. Agrupar gastos en 4 secciones
    type Row = LegalizacionMensualPDFProps["secciones"][number]["gastos"][number];
    const buckets: Record<Seccion, Row[]> = { transporte: [], alimentacion: [], hospedaje: [], otros: [] };

    for (const g of gastosDelMes) {
      const f = g.fields as GastoCajaMenor["fields"] & {
        municipio?: string[];
        municipio_destino?: string[];
        hora?: string;
        noches?: number;
        tipo_soporte?: string;
        numero_soporte?: string;
      };
      const rubroId = f.Rubro?.[0];
      const rubroFields = rubroId ? rubrosById.get(rubroId) : undefined;
      const rubroNombre = rubroFields?.Nombre || "Sin rubro";
      const seccion = seccionPara(rubroNombre, rubroFields);

      const muniId = f.municipio?.[0];
      const muniDestId = f.municipio_destino?.[0];

      buckets[seccion].push({
        numeroGasto: f.NumeroGasto,
        fecha: f.Fecha,
        hora: f.hora,
        noches: f.noches,
        descripcion: f.Observaciones,
        rubroNombre,
        beneficiario: f.RazonSocial?.[0],
        municipio: muniId ? mundepById.get(muniId) : undefined,
        municipioDestino: muniDestId ? mundepById.get(muniDestId) : undefined,
        valor: calcValorNeto(g),
        estado: f.Estado || "Pendiente",
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
    const reembolsosRows = reembolsosDelMes.map((r) => ({
      numero: r.fields.NumeroReembolso,
      fecha: r.fields.Fecha,
      monto: r.fields.Monto || 0,
      observaciones: r.fields.Observaciones,
    }));

    // 8. Renderizar PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(LegalizacionMensualPDF, {
      mesReporte: mes,
      coordinadorNombre,
      secciones,
      reembolsos: reembolsosRows,
      totalReembolsos: reembolsosMes,
      totalGastos: facturasAprobadasMes,
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
