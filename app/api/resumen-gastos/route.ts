import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAllGastosCajaMenor,
  getGastosCajaMenorCoordinador,
  getAllOrdenes,
  getOrdenesCoordinador,
  getAllItemsOrden,
  getRubros,
  getCoordinadoresConSaldoInicial,
  type Orden,
} from "@/lib/airtable";
import { isAdminOrSupervisor } from "@/lib/roles";

export const maxDuration = 60;

interface GastoUnificado {
  id: string;
  fuente: "caja-menor" | "orden";
  fecha: string;
  mes: string;
  coordinadorId: string;
  coordinadorNombre: string;
  beneficiarioId: string;
  beneficiarioNombre: string;
  rubroId: string;
  rubroNombre: string;
  valor: number;
  estado: string;
  refId?: string;
  ordenId?: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const canViewAll = isAdminOrSupervisor(session.user?.rol);
    const coordinatorId = session.user.coordinatorRecordId;

    // Fetch in parallel
    const [gastosCM, ordenes, allItems, rubros, coordinadoresList] = await Promise.all([
      canViewAll ? getAllGastosCajaMenor() : getGastosCajaMenorCoordinador(coordinatorId),
      canViewAll ? getAllOrdenes() : getOrdenesCoordinador(coordinatorId),
      getAllItemsOrden(),
      getRubros(),
      canViewAll ? getCoordinadoresConSaldoInicial() : Promise.resolve([]),
    ]);

    // Build rubro name map
    const rubroMap = new Map<string, string>();
    for (const r of rubros) {
      rubroMap.set(r.id, r.fields.Nombre || "Rubro");
    }

    // Build orden map (id → Orden)
    const ordenMap = new Map<string, Orden>();
    for (const o of ordenes) {
      ordenMap.set(o.id, o);
    }

    // Filter items to only those belonging to in-scope ordenes
    const ordenIdSet = new Set(ordenes.map((o) => o.id));
    const itemsInScope = allItems.filter((item) =>
      (item.fields.OrdenServicio || []).some((id) => ordenIdSet.has(id))
    );

    const gastosUnificados: GastoUnificado[] = [];

    // 1. Unify Caja Menor gastos
    for (const g of gastosCM) {
      const fecha = g.fields.Fecha || "";
      const rubroId = (g.fields.Rubro || [])[0] || "";
      const coordinadorId = (g.fields.Coordinador || [])[0] || "";

      gastosUnificados.push({
        id: g.id,
        fuente: "caja-menor",
        fecha,
        mes: fecha.substring(0, 7), // YYYY-MM
        coordinadorId,
        coordinadorNombre: (g.fields.NombreCoordinador || [])[0] || "Sin coordinador",
        beneficiarioId: (g.fields.Beneficiario || [])[0] || "",
        beneficiarioNombre: (g.fields.RazonSocial || [])[0] || "Sin beneficiario",
        rubroId,
        rubroNombre: rubroMap.get(rubroId) || "Sin rubro",
        valor: g.fields.Valor || 0,
        estado: g.fields.Estado || "Pendiente",
        refId: g.fields.NumeroGasto ? `CM-${g.fields.NumeroGasto}` : undefined,
      });
    }

    // 2. Unify Orden items
    for (const item of itemsInScope) {
      const ordenId = (item.fields.OrdenServicio || [])[0];
      if (!ordenId) continue;
      const orden = ordenMap.get(ordenId);
      if (!orden) continue;

      const fecha = orden.fields["Fecha de pedido"] || "";
      const rubroId = (item.fields.Rubro || [])[0] || "";
      const coordinadorId = (orden.fields.Coordinador || [])[0] || "";

      gastosUnificados.push({
        id: item.id,
        fuente: "orden",
        fecha,
        mes: fecha.substring(0, 7),
        coordinadorId,
        coordinadorNombre: (orden.fields.NombreCoordinador || [])[0] || "Sin coordinador",
        beneficiarioId: (orden.fields.Beneficiario || [])[0] || "",
        beneficiarioNombre: (orden.fields.RazonSocial || [])[0] || "Sin beneficiario",
        rubroId,
        rubroNombre: rubroMap.get(rubroId) || "Sin rubro",
        valor: item.fields["Cálculo"] || (item.fields.Cantidad || 0) * (item.fields.PrecioUnitario || 0),
        estado: orden.fields.Estado || "Borrador",
        refId: orden.fields.NumeroOrden ? `OS-${orden.fields.NumeroOrden}` : undefined,
        ordenId,
      });
    }

    // Extract filter options from actual data
    const mesesSet = new Set<string>();
    const beneficiariosMap = new Map<string, string>();
    for (const g of gastosUnificados) {
      if (g.mes) mesesSet.add(g.mes);
      if (g.beneficiarioId) beneficiariosMap.set(g.beneficiarioId, g.beneficiarioNombre);
    }

    const filtros = {
      rubros: rubros.map((r) => ({ id: r.id, nombre: r.fields.Nombre || "Rubro" })),
      meses: [...mesesSet].sort().reverse(),
      beneficiarios: [...beneficiariosMap.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      coordinadores: canViewAll ? coordinadoresList.map((c) => ({ id: c.id, nombre: c.nombre })) : [],
    };

    return NextResponse.json({ gastos: gastosUnificados, filtros });
  } catch (error) {
    console.error("Error in resumen-gastos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
