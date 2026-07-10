import { NextResponse } from "next/server";
import { participantesAprobados, evaluadasAprobadas, evaluacionesWAAprobadas, participantesPendientes, evaluadasPendientes, evaluacionesWAPendientes } from "@/lib/actividadCompleteness";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAllKardex,
  listActividadesForCoordinator,
  getMetasMensualesByCoordinadorYAño,
  getCoordinadoresConZona,
} from "@/lib/airtable";

/**
 * GET /api/dashboard/mis-metas?year=2026
 * Matriz de metas (Recolección / Sensibilización / Evaluaciones) por mes para
 * el coordinador en sesión: real vs meta por cada mes. Mismo modelo que
 * /api/dashboard/metas-zonas pero filtrado a los datos propios.
 */
export const maxDuration = 60;

type Celda = { real: number; meta: number };
type SerieMeta = { meses: Celda[]; realAnual: number; metaAnual: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const ceros = () => Array.from({ length: 12 }, () => 0);

function armar(real: number[], meta: number[]): SerieMeta {
  const meses: Celda[] = Array.from({ length: 12 }, (_, i) => ({
    real: r2(real[i]),
    meta: r2(meta[i]),
  }));
  return {
    meses,
    realAnual: r2(meses.reduce((s, c) => s + c.real, 0)),
    metaAnual: r2(meses.reduce((s, c) => s + c.meta, 0)),
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const coordinatorId = session.user.coordinatorRecordId;

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const yearStr = String(year);

    const [metasMensuales, allKardex, actividades, coordinadores] =
      await Promise.all([
        getMetasMensualesByCoordinadorYAño(coordinatorId, year),
        getAllKardex(),
        listActividadesForCoordinator(coordinatorId),
        getCoordinadoresConZona(),
      ]);

    const zona = coordinadores.find((c) => c.id === coordinatorId)?.zona ?? null;

    // --- Metas (plan) por mes ---
    const metaRec = ceros(), metaSen = ceros(), metaEva = ceros();
    for (const m of metasMensuales) {
      const i = m.mes - 1;
      if (i < 0 || i > 11) continue;
      metaRec[i] += m.metaRecoleccion;
      metaSen[i] += m.metaSensibilizacion;
      metaEva[i] += m.metaEvaluaciones;
    }

    // --- Real Recolección (Kardex ENTRADA del coordinador) por mes ---
    const realRec = ceros();
    for (const k of allKardex) {
      if (k.fields.AÑO !== yearStr) continue;
      if (k.fields.TipoMovimiento !== "ENTRADA") continue;
      const cid = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (cid !== coordinatorId) continue;
      const mes = k.fields.MES;
      if (!mes) continue;
      const i = parseInt(mes.split("-")[1], 10) - 1;
      if (i < 0 || i > 11) continue;
      realRec[i] += k.fields.Total || 0;
    }

    // --- Real Sensibilización + Evaluaciones (Actividades del coordinador) ---
    const realSen = ceros(), realEva = ceros();
    let senEnRevision = 0, evaEnRevision = 0;
    for (const a of actividades) {
      if (a.fields.Año !== yearStr) continue;
      if (a.fields.Tipo !== "Sensibilización") continue;
      const mes = a.fields.Mes;
      if (!mes) continue;
      const i = parseInt(mes.split("-")[1], 10) - 1;
      if (i < 0 || i > 11) continue;
      realSen[i] += participantesAprobados(a.fields);
      realEva[i] +=
        (evaluacionesWAAprobadas(a.fields)) +
        (evaluadasAprobadas(a.fields));
      senEnRevision += participantesPendientes(a.fields);
      evaEnRevision += evaluadasPendientes(a.fields) + evaluacionesWAPendientes(a.fields);
    }

    const now = new Date();
    return NextResponse.json({
      year,
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      zona,
      metas: {
        recoleccion: armar(realRec, metaRec),
        sensibilizacion: armar(realSen, metaSen),
        evaluaciones: armar(realEva, metaEva),
      },
      enRevision: {
        sensibilizacion: senEnRevision,
        evaluaciones: evaEnRevision,
      },
      lastUpdated: now.toISOString(),
    });
  } catch (error) {
    console.error("Error mis-metas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
