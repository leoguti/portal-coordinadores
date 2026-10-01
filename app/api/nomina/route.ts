import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCoordinadoresConZona } from "@/lib/airtable";
import {
  leerResumenCostos,
  guardarNominaMes,
  getMesesCargados,
  getNominaDelAnio,
  puedeGestionarNomina,
  type FilaNomina,
} from "@/lib/nomina";

/**
 * Nómina mensual (confidencial: solo los correos de NOMINA_EMAILS).
 *  GET  /api/nomina                    → meses ya cargados
 *  POST /api/nomina  (multipart)       → archivo .xlsx + accion=previsualizar|guardar
 */
export const maxDuration = 60;

async function autorizado() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) return { error: "No autorizado", status: 401 } as const;
  if (!puedeGestionarNomina(session.user.email)) return { error: "Acceso denegado", status: 403 } as const;
  return { session } as const;
}

export async function GET() {
  const a = await autorizado();
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    return NextResponse.json({ meses: await getMesesCargados() });
  } catch (e) {
    console.error("nomina GET:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const mesAnterior = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export async function POST(request: Request) {
  const a = await autorizado();
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const form = await request.formData();
    const archivo = form.get("archivo");
    const accion = String(form.get("accion") || "previsualizar");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(archivo.name)) {
      return NextResponse.json(
        { error: "El archivo debe ser .xlsx. Si es .xls, ábralo en Excel y guárdelo como «Libro de Excel (.xlsx)»." },
        { status: 400 }
      );
    }

    const coordinadores = await getCoordinadoresConZona();
    const zonas = [...new Set(coordinadores.map((c) => c.zona).filter(Boolean) as string[])];
    const lectura = leerResumenCostos(Buffer.from(await archivo.arrayBuffer()), zonas);
    const alertas = [...lectura.alertas];

    // Comparación con lo ya cargado (mes actual y mes anterior)
    let yaCargado = false;
    if (lectura.mes) {
      const year = Number(lectura.mes.slice(0, 4));
      const prev = mesAnterior(lectura.mes);
      const anioPrev = Number(prev.slice(0, 4));
      const cargadas = [
        ...(await getNominaDelAnio(year)),
        ...(anioPrev !== year ? await getNominaDelAnio(anioPrev) : []),
      ];
      yaCargado = cargadas.some((f) => f.mes === lectura.mes);
      const anterior = cargadas.filter((f) => f.mes === prev);
      if (yaCargado) alertas.push(`La nómina de ${lectura.mes} ya estaba cargada: al guardar se reemplaza.`);
      if (anterior.length) {
        const docsPrev = new Set(anterior.map((f) => f.documento));
        const docsAct = new Set(lectura.filas.map((f) => f.documento));
        const nuevas = lectura.filas.filter((f) => !docsPrev.has(f.documento)).map((f) => f.persona);
        const faltan = anterior.filter((f) => !docsAct.has(f.documento)).map((f) => f.persona);
        if (nuevas.length) alertas.push(`Personas nuevas respecto a ${prev}: ${nuevas.join(", ")}.`);
        if (faltan.length) alertas.push(`Personas que estaban en ${prev} y ya no aparecen: ${faltan.join(", ")}.`);
        const totPrev = anterior.reduce((s, f) => s + f.costoTotalEmpresa, 0);
        const totAct = lectura.filas.reduce((s, f) => s + f.costoTotalEmpresa, 0);
        if (totPrev > 0 && Math.abs(totAct - totPrev) / totPrev > 0.2) {
          alertas.push(
            `El costo total cambió ${Math.round(((totAct - totPrev) / totPrev) * 100)} % frente a ${prev}. Verifique que sea correcto.`
          );
        }
      }
    }

    const resumen = {
      mes: lectura.mes,
      personas: lectura.filas.length,
      costoTotal: lectura.filas.reduce((s, f) => s + f.costoTotalEmpresa, 0),
      filas: lectura.filas,
      errores: lectura.errores,
      alertas,
      yaCargado,
    };

    if (accion !== "guardar") return NextResponse.json(resumen);
    if (lectura.errores.length) {
      return NextResponse.json({ ...resumen, error: "Corrija los errores antes de guardar." }, { status: 422 });
    }
    const quien = a.session.user.email || a.session.user.name || "desconocido";
    const r = await guardarNominaMes(lectura.filas as FilaNomina[], quien);
    return NextResponse.json({ ...resumen, guardado: r });
  } catch (e) {
    console.error("nomina POST:", e);
    return NextResponse.json({ error: "Error interno al procesar el archivo" }, { status: 500 });
  }
}
