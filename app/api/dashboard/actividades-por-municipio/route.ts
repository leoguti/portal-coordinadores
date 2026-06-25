import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { listAllActividades } from "@/lib/airtable";

export const maxDuration = 60;

interface MunicipioAgg {
  codigo: string;
  municipio: string;
  departamento: string;
  total: number;
  porTipo: Record<string, number>;
}

/** Normaliza el valor de Tipo (la data tiene espacios al final y "Recoleccion" sin tilde). */
function normalizaTipo(raw?: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.toLowerCase() === "recoleccion") return "Recolección";
  return t;
}

/**
 * GET /api/dashboard/actividades-por-municipio
 * Agrega actividades por municipio (DIVIPOLA) y por tipo, para el mapa de la junta.
 * Query: ?year=2026&monthFrom=1&monthTo=12
 * Solo Admin/Supervisor.
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
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const monthFrom = parseInt(searchParams.get("monthFrom") || "1");
    const monthTo = parseInt(searchParams.get("monthTo") || "12");
    const yearStr = String(year);

    const actividades = await listAllActividades();

    const porMunicipio = new Map<string, MunicipioAgg>();
    const tiposSet = new Set<string>();

    for (const act of actividades) {
      const f = act.fields;
      const fecha = f.Fecha || "";
      const añoAct = f.Año || (fecha.length >= 4 ? fecha.slice(0, 4) : "");
      if (añoAct !== yearStr) continue;

      // Mes en formato YYYY-MM; si falta, derivar de Fecha
      const mesNum = f.Mes
        ? parseInt(f.Mes.split("-")[1])
        : fecha.length >= 7
          ? parseInt(fecha.slice(5, 7))
          : NaN;
      if (!Number.isNaN(mesNum) && (mesNum < monthFrom || mesNum > monthTo)) continue;

      const codigoRaw = f["CODIGOMUN Compilación (de Municipio)"];
      if (codigoRaw == null) continue;
      // DIVIPOLA decimal (ej. 5.147) → "05147" (misma conversión que /mapa)
      const codigo = String(codigoRaw).replace(".", "").padStart(5, "0");

      const mundep = f["mundep (from Municipio)"]?.[0] || "";
      const [municipio, departamento] = mundep.split(" - ");

      const tipo = normalizaTipo(f.Tipo);

      let agg = porMunicipio.get(codigo);
      if (!agg) {
        agg = {
          codigo,
          municipio: municipio || mundep || codigo,
          departamento: departamento || "",
          total: 0,
          porTipo: {},
        };
        porMunicipio.set(codigo, agg);
      }
      agg.total += 1;
      if (tipo) {
        agg.porTipo[tipo] = (agg.porTipo[tipo] || 0) + 1;
        tiposSet.add(tipo);
      }
    }

    const municipios = [...porMunicipio.values()].sort((a, b) => b.total - a.total);
    const departamentos = new Set(
      municipios.map((m) => m.departamento).filter(Boolean)
    );

    return NextResponse.json({
      municipios,
      tipos: [...tiposSet].sort(),
      totals: {
        municipios: municipios.length,
        actividades: municipios.reduce((s, m) => s + m.total, 0),
        departamentos: departamentos.size,
      },
      year,
      monthFrom,
      monthTo,
    });
  } catch (err) {
    console.error("Error actividades-por-municipio:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
