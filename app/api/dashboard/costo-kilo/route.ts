import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllKardex,
  getAllGastosCajaMenor,
  getAllOrdenes,
  getAllItemsOrden,
  getCoordinadoresConZona,
} from "@/lib/airtable";
import {
  calcularCostoKilo,
  etiquetaPeriodo,
  periodoAnterior,
  type Periodo,
  type TipoPeriodo,
} from "@/lib/costoKilo";
import { getNominaDelAnio, puedeGestionarNomina } from "@/lib/nomina";

/**
 * GET /api/dashboard/costo-kilo?year=2026&tipo=trimestre&n=3
 * Costo por kilo (entrada, salida y trabajado) por zona, para el periodo pedido
 * y el periodo anterior. Solo Administrador/Supervisor. Ver lib/costoKilo.ts.
 */
export const maxDuration = 60;

/** Periodo por defecto: el trimestre del último mes cerrado. */
function periodoPorDefecto(): Periodo {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), tipo: "trimestre", n: Math.floor(d.getMonth() / 3) + 1 };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!isAdminOrSupervisor(session.user.rol)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const def = periodoPorDefecto();
    const tipo = (["trimestre", "semestre", "anio"].includes(sp.get("tipo") || "")
      ? sp.get("tipo")
      : def.tipo) as TipoPeriodo;
    const year = parseInt(sp.get("year") || "") || def.year;
    const maxN = tipo === "trimestre" ? 4 : tipo === "semestre" ? 2 : 1;
    const nPedido = parseInt(sp.get("n") || "");
    const n = nPedido >= 1 && nPedido <= maxN ? nPedido : tipo === def.tipo && year === def.year ? def.n : 1;
    const periodo: Periodo = { year, tipo, n };
    const anterior = periodoAnterior(periodo);

    const [coordinadores, kardex, gastos, ordenes, items, nominaActual, nominaAnterior] =
      await Promise.all([
        getCoordinadoresConZona(),
        getAllKardex(),
        getAllGastosCajaMenor(),
        getAllOrdenes(),
        getAllItemsOrden(),
        getNominaDelAnio(year).catch(() => []),
        anterior.year !== year ? getNominaDelAnio(anterior.year).catch(() => []) : Promise.resolve([]),
      ]);

    const zonaDeCoordinador = new Map<string, string>();
    for (const c of coordinadores) if (c.zona) zonaDeCoordinador.set(c.id, c.zona);

    const base = {
      zonaDeCoordinador,
      kardex: kardex.map((k) => ({
        id: k.id,
        mes: k.fields.MES || "",
        tipo: k.fields.TipoMovimiento || "",
        total: k.fields.Total || 0,
        coordinadorId: k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0] || "",
      })),
      gastosCM: gastos.map((g) => ({
        fecha: g.fields.Fecha || "",
        estado: g.fields.Estado || "",
        valor: g.fields.Valor || 0,
        coordinadorId: g.fields.Coordinador?.[0] || "",
      })),
      ordenes: ordenes.map((o) => ({
        id: o.id,
        fecha: o.fields["Fecha de pedido"] || "",
        estado: o.fields.Estado || "",
        coordinadorId: o.fields.Coordinador?.[0] || "",
      })),
      items: items.map((it) => ({
        ordenId: it.fields.OrdenServicio?.[0] || "",
        kardexId: it.fields.Kardex?.[0] || "",
        valor: it.fields["Cálculo"] || (it.fields.Cantidad || 0) * (it.fields.PrecioUnitario || 0),
      })),
    };
    const nomina = [...nominaActual, ...nominaAnterior]
      .filter((f) => f.tipo === "Zona")
      .map((f) => ({
        mes: f.mes,
        costoTotal: f.costoTotalEmpresa,
        zona1: f.zona1,
        pct1: f.pct1,
        zona2: f.zona2,
        pct2: f.pct2,
      }));

    const actual = calcularCostoKilo({ ...base, periodo, nomina });
    const previo = calcularCostoKilo({ ...base, periodo: anterior, nomina });

    return NextResponse.json({
      periodo: { ...periodo, etiqueta: etiquetaPeriodo(periodo) },
      anterior: { ...anterior, etiqueta: etiquetaPeriodo(anterior) },
      actual,
      previo: { filas: previo.filas, total: previo.total },
      puedeCargarNomina: puedeGestionarNomina(session.user.email),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error costo-kilo:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
