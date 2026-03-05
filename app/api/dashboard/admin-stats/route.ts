import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllKardex,
  getAllOrdenes,
  listAllActividades,
  getAllGastosCajaMenor,
  getAllMetas,
  getReembolsosCajaMenor,
  getCentrosAcopio,
  getAllCoordinadoresActivos,
  countAllCertificados,
  getCoordinadoresConSaldoInicial,
} from "@/lib/airtable";

/**
 * GET /api/dashboard/admin-stats
 * Consolidated admin/supervisor dashboard metrics
 * Query: ?year=2026 (default: current year)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!isAdminOrSupervisor(session.user.rol)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const yearStr = String(year);

    // Fetch all data in parallel
    const [
      allKardex,
      allOrdenes,
      allActividades,
      allGastos,
      allMetas,
      allReembolsos,
      centrosAcopio,
      coordinadoresActivos,
      certificadosCount,
      coordinadoresSaldo,
    ] = await Promise.all([
      getAllKardex(),
      getAllOrdenes(),
      listAllActividades(),
      getAllGastosCajaMenor(),
      getAllMetas(year),
      getReembolsosCajaMenor(),
      getCentrosAcopio(),
      getAllCoordinadoresActivos(),
      countAllCertificados(year),
      getCoordinadoresConSaldoInicial(),
    ]);

    // --- Filter by year ---
    const kardexYear = allKardex.filter((k) => k.fields.AÑO === yearStr);
    const actividadesYear = allActividades.filter((a) => a.fields.Año === yearStr);

    // --- KPIs ---
    const entradasKg = kardexYear
      .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
      .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
    const salidasKg = Math.abs(
      kardexYear
        .filter((k) => k.fields.TipoMovimiento === "SALIDA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
    );

    const actSensibilizacion = actividadesYear.filter(
      (a) => a.fields.Tipo === "Sensibilización"
    );
    const eventosSensibilizacion = actSensibilizacion.length;
    const personasCapacitadas = actSensibilizacion.reduce(
      (sum, a) => sum + (a.fields["Cantidad de Participantes"] || 0),
      0
    );
    const personasEvaluadas = actSensibilizacion.reduce(
      (sum, a) => sum + (a.fields["Personas Evaluadas"] || 0),
      0
    );

    const ordenesTotal = {
      monto: allOrdenes.reduce((sum, o) => sum + (o.fields.Total || 0), 0),
      count: allOrdenes.length,
    };

    // --- Metas Recoleccion ---
    // Build coordinator lookup map
    const coordMap = new Map(
      coordinadoresActivos.map((c) => [c.id, c.name])
    );

    // Saldo acumulativo al cierre del año anterior per coordinator
    // = entradas históricas (hasta año-1) - salidas históricas (hasta año-1)
    const kardexHastaAnterior = allKardex.filter((k) => {
      const kYear = parseInt(k.fields.AÑO || "0");
      return kYear > 0 && kYear < year;
    });
    const entradaHistPorCoord = new Map<string, number>();
    const salidaHistPorCoord = new Map<string, number>();
    for (const k of kardexHastaAnterior) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId) continue;
      const total = k.fields.Total || 0;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entradaHistPorCoord.set(coordId, (entradaHistPorCoord.get(coordId) || 0) + total);
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        salidaHistPorCoord.set(coordId, (salidaHistPorCoord.get(coordId) || 0) + Math.abs(total));
      }
    }

    // Accumulate kardex kg per coordinator
    const entradaPorCoord = new Map<string, number>();
    const salidaPorCoord = new Map<string, number>();
    for (const k of kardexYear) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId) continue;
      const total = k.fields.Total || 0;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entradaPorCoord.set(coordId, (entradaPorCoord.get(coordId) || 0) + total);
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        salidaPorCoord.set(coordId, (salidaPorCoord.get(coordId) || 0) + Math.abs(total));
      }
    }

    // Build metas by coordinator
    const metaGlobalRecoleccion = allMetas.reduce(
      (sum, m) => sum + (m.fields.MetaRecoleccion || 0),
      0
    );
    const metaGlobalSensibilizacion = allMetas.reduce(
      (sum, m) => sum + (m.fields.MetaSensibilizacion || 0),
      0
    );

    function semaforo(porcentaje: number): string {
      if (porcentaje >= 70) return "verde";
      if (porcentaje >= 40) return "amarillo";
      return "rojo";
    }

    const metasRecoleccionPorCoord = allMetas.map((m) => {
      const coordId = m.fields.id_coordinador?.[0] || m.fields.Coordinador?.[0] || "";
      const meta = m.fields.MetaRecoleccion || 0;
      const entradas = Math.round((entradaPorCoord.get(coordId) || 0) * 100) / 100;
      const salidas = Math.round((salidaPorCoord.get(coordId) || 0) * 100) / 100;
      const saldoAnterior = Math.round(
        ((entradaHistPorCoord.get(coordId) || 0) -
        (salidaHistPorCoord.get(coordId) || 0)) * 100
      ) / 100;
      const porcentaje = meta > 0 ? Math.round((entradas / meta) * 100) : 0;
      return {
        id: coordId,
        nombre: coordMap.get(coordId) || "Sin nombre",
        saldoAnterior,
        meta,
        entradas,
        salidas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    // --- Metas Sensibilizacion ---
    // Accumulate personas per coordinator (participantes y evaluadas)
    const personasPorCoord = new Map<string, number>();
    const evaluadasPorCoord = new Map<string, number>();
    for (const a of actSensibilizacion) {
      const coordId = a.fields.Coordinador?.[0];
      if (!coordId) continue;
      personasPorCoord.set(
        coordId,
        (personasPorCoord.get(coordId) || 0) +
          (a.fields["Cantidad de Participantes"] || 0)
      );
      evaluadasPorCoord.set(
        coordId,
        (evaluadasPorCoord.get(coordId) || 0) +
          (a.fields["Personas Evaluadas"] || 0)
      );
    }

    const metasSensibilizacionPorCoord = allMetas.map((m) => {
      const coordId = m.fields.id_coordinador?.[0] || m.fields.Coordinador?.[0] || "";
      const meta = m.fields.MetaSensibilizacion || 0;
      const actual = personasPorCoord.get(coordId) || 0;
      const evaluadas = evaluadasPorCoord.get(coordId) || 0;
      const porcentaje = meta > 0 ? Math.round((actual / meta) * 100) : 0;
      return {
        id: coordId,
        nombre: coordMap.get(coordId) || "Sin nombre",
        meta,
        actual,
        evaluadas,
        porcentaje,
        semaforo: semaforo(porcentaje),
      };
    });

    // --- Charts ---
    // Monthly trend (12 months)
    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    const tendenciaMensual = Array.from({ length: 12 }, (_, i) => {
      const mesStr = `${year}-${String(i + 1).padStart(2, "0")}`;
      const kardexMes = kardexYear.filter((k) => k.fields.MES === mesStr);
      const entradas = kardexMes
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
      const salidas = Math.abs(
        kardexMes
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
      );
      return {
        mes: monthNames[i],
        entradas: Math.round(entradas),
        salidas: Math.round(salidas),
      };
    });

    // Material distribution
    const materialKeys = [
      "Reciclaje", "Incineracion", "Flexibles",
      "PlasticoContaminado", "Lonas", "Carton", "Metal",
    ] as const;
    const distribucionMateriales: Record<string, number> = {};
    for (const mat of materialKeys) {
      distribucionMateriales[mat] = Math.round(
        kardexYear.reduce((sum, k) => sum + (k.fields[mat] || 0), 0)
      );
    }

    // Orders by status
    const estadosOrden = ["Borrador", "Enviada", "Facturada", "Pagada", "Rechazada"];
    const ordenesPorEstado = estadosOrden.map((estado) => {
      const matching = allOrdenes.filter((o) => o.fields.Estado === estado);
      return {
        estado,
        count: matching.length,
        total: matching.reduce((sum, o) => sum + (o.fields.Total || 0), 0),
      };
    });

    // Collection per coordinator
    const recoleccionPorCoordinador = coordinadoresActivos
      .filter((c) => c.rol === "Coordinador")
      .map((c) => ({
        nombre: c.name,
        kg: Math.round((entradaPorCoord.get(c.id) || 0) + (salidaPorCoord.get(c.id) || 0)),
      }))
      .filter((c) => c.kg > 0);

    // --- Financiero ---
    const totalEnviadas = allOrdenes
      .filter((o) => o.fields.Estado === "Enviada")
      .reduce((sum, o) => sum + (o.fields.Total || 0), 0);
    const totalFacturadas = allOrdenes
      .filter((o) => o.fields.Estado === "Facturada")
      .reduce((sum, o) => sum + (o.fields.Total || 0), 0);
    const totalPagadas = allOrdenes
      .filter((o) => o.fields.Estado === "Pagada")
      .reduce((sum, o) => sum + (o.fields.Total || 0), 0);
    const cajaMenorGastado = allGastos.reduce(
      (sum, g) => sum + (g.fields.Valor || 0),
      0
    );

    // Financial per coordinator
    const financieroPorCoord = coordinadoresActivos
      .filter((c) => c.rol === "Coordinador")
      .map((c) => {
        const coordOrdenes = allOrdenes.filter(
          (o) => o.fields.Coordinador?.[0] === c.id
        );
        const coordGastos = allGastos.filter(
          (g) => g.fields.Coordinador?.[0] === c.id
        );
        const estados = coordOrdenes.map((o) => o.fields.Estado || "");
        const estadoCounts: Record<string, number> = {};
        for (const e of estados) {
          estadoCounts[e] = (estadoCounts[e] || 0) + 1;
        }
        const estadoPredominante =
          Object.entries(estadoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

        return {
          nombre: c.name,
          ordenes: coordOrdenes.length,
          totalOrdenes: coordOrdenes.reduce(
            (sum, o) => sum + (o.fields.Total || 0),
            0
          ),
          cajaMenor: coordGastos.reduce(
            (sum, g) => sum + (g.fields.Valor || 0),
            0
          ),
          estadoPredominante,
        };
      });

    // --- Extras ---
    // Kg per centro de acopio
    const kgPorCentro = centrosAcopio.map((centro) => {
      const centroKardex = kardexYear.filter(
        (k) => k.fields.CentrodeAcopio?.[0] === centro.id
      );
      const entradasCentro = centroKardex
        .filter((k) => k.fields.TipoMovimiento === "ENTRADA")
        .reduce((sum, k) => sum + (k.fields.Total || 0), 0);
      const salidasCentro = Math.abs(
        centroKardex
          .filter((k) => k.fields.TipoMovimiento === "SALIDA")
          .reduce((sum, k) => sum + (k.fields.Total || 0), 0)
      );
      return {
        nombre: centro.fields.Nombre || "Sin nombre",
        entradas: Math.round(entradasCentro),
        salidas: Math.round(salidasCentro),
        saldo: Math.round(
          (centro.fields.SaldoInicialTotal || 0) + entradasCentro - salidasCentro
        ),
      };
    });

    // Rejection rates
    const totalGastos = allGastos.length;
    const gastosRechazados = allGastos.filter(
      (g) => g.fields.Estado === "Rechazado"
    ).length;
    const tasaRechazoGastos =
      totalGastos > 0 ? Math.round((gastosRechazados / totalGastos) * 100) : 0;

    const totalOrd = allOrdenes.length;
    const ordenesRechazadas = allOrdenes.filter(
      (o) => o.fields.Estado === "Rechazada"
    ).length;
    const tasaRechazoOrdenes =
      totalOrd > 0 ? Math.round((ordenesRechazadas / totalOrd) * 100) : 0;

    // Saldo caja menor per coordinator
    const reembolsoPorCoord = new Map<string, number>();
    for (const r of allReembolsos) {
      const coordId = r.fields.Coordinador?.[0];
      if (coordId) {
        reembolsoPorCoord.set(
          coordId,
          (reembolsoPorCoord.get(coordId) || 0) + (r.fields.Monto || 0)
        );
      }
    }
    const gastoPorCoord = new Map<string, number>();
    for (const g of allGastos) {
      const coordId = g.fields.Coordinador?.[0];
      if (coordId) {
        gastoPorCoord.set(
          coordId,
          (gastoPorCoord.get(coordId) || 0) + (g.fields.Valor || 0)
        );
      }
    }
    const saldoCajaMenor = coordinadoresSaldo.map((c) => ({
      nombre: c.nombre,
      saldoDisponible:
        c.saldoInicial +
        (reembolsoPorCoord.get(c.id) || 0) -
        (gastoPorCoord.get(c.id) || 0),
    }));

    // Geographic coverage
    const municipiosSet = new Set<string>();
    for (const a of actividadesYear) {
      const mun = a.fields.Municipio?.[0];
      if (mun) municipiosSet.add(mun);
    }
    const coberturaGeografica = municipiosSet.size;

    // --- Alertas ---
    const kardexSinOrden = kardexYear.filter(
      (k) => k.fields.EstadoPago === "Por Pagar"
    ).length;
    const ordenesPendientes = allOrdenes.filter(
      (o) => o.fields.Estado === "Enviada"
    ).length;
    const gastosPendientes = allGastos.filter(
      (g) => g.fields.Estado === "Pendiente"
    ).length;
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasParaCierre = ultimoDiaMes.getDate() - hoy.getDate();

    return NextResponse.json({
      kpis: {
        entradasKg: Math.round(entradasKg),
        salidasKg: Math.round(salidasKg),
        certificados: certificadosCount,
        eventosSensibilizacion,
        personasCapacitadas,
        personasEvaluadas,
        ordenesTotal,
      },
      metasRecoleccion: {
        global: {
          meta: metaGlobalRecoleccion,
          entradas: Math.round(entradasKg * 100) / 100,
          salidas: Math.round(salidasKg * 100) / 100,
        },
        porCoordinador: metasRecoleccionPorCoord,
      },
      metasSensibilizacion: {
        global: {
          meta: metaGlobalSensibilizacion,
          actual: personasCapacitadas,
          evaluadas: personasEvaluadas,
        },
        porCoordinador: metasSensibilizacionPorCoord,
      },
      charts: {
        tendenciaMensual,
        distribucionMateriales,
        ordenesPorEstado,
        recoleccionPorCoordinador,
      },
      financiero: {
        totalEnviadas,
        totalFacturadas,
        totalPagadas,
        cajaMenorGastado,
        porCoordinador: financieroPorCoord,
        porEstado: ordenesPorEstado,
      },
      extras: {
        kgPorCentro,
        tasaRechazoGastos,
        tasaRechazoOrdenes,
        saldoCajaMenor,
        coberturaGeografica,
      },
      alertas: {
        kardexSinOrden,
        ordenesPendientes,
        gastosPendientes,
        diasParaCierre,
      },
      year,
      coordinadoresList: coordinadoresActivos.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
