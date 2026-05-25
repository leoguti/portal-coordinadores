import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  getAllKardex,
  listAllActividades,
  getCoordinadoresConZona,
  getMetasMensualesDelAño,
} from "@/lib/airtable";

/**
 * GET /api/dashboard/metas-zonas?year=2026
 * Matriz de metas por ZONA y por mes (real vs meta) para Recolección,
 * Sensibilización y Evaluaciones. Pensado para la pestaña que pidió el director.
 */
export const maxDuration = 60;

type Celda = { real: number; meta: number };
type Fila = { zona: string; meses: Celda[]; realAnual: number; metaAnual: number };
type Tabla = {
  filas: Fila[];
  total: { meses: Celda[]; realAnual: number; metaAnual: number };
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const ceros = () => Array.from({ length: 12 }, () => 0);

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
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const yearStr = String(year);

    const [coordinadores, metasMensuales, allKardex, allActividades] =
      await Promise.all([
        getCoordinadoresConZona(),
        getMetasMensualesDelAño(year),
        getAllKardex(),
        listAllActividades(),
      ]);

    // Mapa coordinador -> zona (solo los que tienen zona)
    const zonaOf = new Map<string, string>();
    for (const c of coordinadores) {
      if (c.zona) zonaOf.set(c.id, c.zona);
    }
    const zonas = [...new Set([...zonaOf.values()])].sort((a, b) =>
      a.localeCompare(b)
    );

    // Acumuladores: tipo -> zona -> [12 meses]
    type Acc = Record<string, number[]>;
    const mk = (): Acc => Object.fromEntries(zonas.map((z) => [z, ceros()]));
    const metaRec = mk(), metaSen = mk(), metaEva = mk();
    const realRec = mk(), realSen = mk(), realEva = mk();

    // --- Metas (plan) por zona/mes ---
    for (const m of metasMensuales) {
      const zona = zonaOf.get(m.coordinadorId);
      if (!zona) continue;
      const mi = m.mes - 1;
      if (mi < 0 || mi > 11) continue;
      metaRec[zona][mi] += m.recoleccion;
      metaSen[zona][mi] += m.sensibilizacion;
      metaEva[zona][mi] += m.evaluaciones;
    }

    // --- Real Recolección (Kardex ENTRADA) por zona/mes ---
    for (const k of allKardex) {
      if (k.fields.AÑO !== yearStr) continue;
      if (k.fields.TipoMovimiento !== "ENTRADA") continue;
      const cid = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      const zona = cid ? zonaOf.get(cid) : undefined;
      if (!zona) continue;
      const mes = k.fields.MES;
      if (!mes) continue;
      const mi = parseInt(mes.split("-")[1], 10) - 1;
      if (mi < 0 || mi > 11) continue;
      realRec[zona][mi] += k.fields.Total || 0;
    }

    // --- Real Sensibilización + Evaluaciones (Actividades) por zona/mes ---
    for (const a of allActividades) {
      if (a.fields.Año !== yearStr) continue;
      if (a.fields.Tipo !== "Sensibilización") continue;
      const cid = a.fields.Coordinador?.[0];
      const zona = cid ? zonaOf.get(cid) : undefined;
      if (!zona) continue;
      const mes = a.fields.Mes;
      if (!mes) continue;
      const mi = parseInt(mes.split("-")[1], 10) - 1;
      if (mi < 0 || mi > 11) continue;
      realSen[zona][mi] += a.fields["Cantidad de Participantes"] || 0;
      realEva[zona][mi] +=
        (a.fields.CantidadEvaluaciones || 0) +
        (a.fields["Personas Evaluadas"] || 0);
    }

    function construir(real: Acc, meta: Acc): Tabla {
      const filas: Fila[] = zonas.map((zona) => {
        const meses: Celda[] = Array.from({ length: 12 }, (_, i) => ({
          real: r2(real[zona][i]),
          meta: r2(meta[zona][i]),
        }));
        return {
          zona,
          meses,
          realAnual: r2(meses.reduce((s, c) => s + c.real, 0)),
          metaAnual: r2(meses.reduce((s, c) => s + c.meta, 0)),
        };
      });
      const totalMeses: Celda[] = Array.from({ length: 12 }, (_, i) => ({
        real: r2(filas.reduce((s, f) => s + f.meses[i].real, 0)),
        meta: r2(filas.reduce((s, f) => s + f.meses[i].meta, 0)),
      }));
      return {
        filas,
        total: {
          meses: totalMeses,
          realAnual: r2(totalMeses.reduce((s, c) => s + c.real, 0)),
          metaAnual: r2(totalMeses.reduce((s, c) => s + c.meta, 0)),
        },
      };
    }

    const now = new Date();
    return NextResponse.json({
      year,
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      zonas,
      metas: {
        recoleccion: construir(realRec, metaRec),
        sensibilizacion: construir(realSen, metaSen),
        evaluaciones: construir(realEva, metaEva),
      },
      lastUpdated: now.toISOString(),
    });
  } catch (error) {
    console.error("Error metas-zonas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
