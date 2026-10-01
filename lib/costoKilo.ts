/**
 * Costo por kilo por zona (indicador gerencial del Dashboard Ejecutivo).
 *
 * Tres costos por zona y periodo:
 *  - por kilo de ENTRADA  = gasto ÷ kg que entraron
 *  - por kilo de SALIDA   = gasto ÷ kg que salieron
 *  - por kilo TRABAJADO   = gasto ÷ ((kg entrada + kg salida) ÷ 2)
 *    → el punto medio entre lo que cuesta recibir y lo que cuesta despachar.
 *
 * Reglas (acordadas con Leonardo, oct-2026):
 *  - La zona sale del coordinador (Coordinadores.ZONA): cada zona es un registro.
 *  - Caja menor: se excluye Estado "Rechazado"; se fecha por `Fecha`.
 *  - Órdenes: se excluyen "Borrador" y "Rechazada". Cada ítem CON kardex se
 *    fecha por el MES de su kardex (el transporte pesa en el mes en que se
 *    movieron los kilos); los ítems SIN kardex, por la fecha de la orden.
 *  - Los directos Municipio/JR → DF generan ENTRADA automática + SALIDA: su
 *    costo se cobra una sola vez (sobre la salida) y en el promedio cuentan 1 kg.
 *  - La nómina (opcional) se reparte por zona según Zona1/Pct1, Zona2/Pct2.
 */

export type TipoPeriodo = "trimestre" | "semestre" | "anio";

export interface Periodo {
  year: number;
  tipo: TipoPeriodo;
  /** trimestre: 1-4 · semestre: 1-2 · anio: ignorado */
  n: number;
}

export interface KardexLite {
  id: string;
  mes: string; // YYYY-MM
  tipo: string; // ENTRADA | SALIDA
  total: number;
  coordinadorId: string;
}
export interface GastoCMLite {
  fecha: string;
  estado: string;
  valor: number;
  coordinadorId: string;
}
export interface OrdenLite {
  id: string;
  fecha: string;
  estado: string;
  coordinadorId: string;
}
export interface ItemLite {
  ordenId: string;
  kardexId: string;
  valor: number;
}
export interface NominaLite {
  mes: string;
  costoTotal: number;
  zona1: string;
  pct1: number; // fracción 0..1
  zona2: string;
  pct2: number;
}

export interface FilaZona {
  zona: string;
  gasto: number;
  kgEntrada: number;
  kgSalida: number;
  kgTrabajado: number;
  costoEntrada: number | null;
  costoSalida: number | null;
  costoTrabajado: number | null;
  nomina: number;
  costoTrabajadoConNomina: number | null;
}

export interface ResultadoCostoKilo {
  meses: string[];
  filas: FilaZona[];
  total: FilaZona;
  /** meses del periodo sin ninguna fila de nómina cargada */
  mesesSinNomina: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Meses (YYYY-MM) que componen un periodo. */
export function mesesDePeriodo(p: Periodo): string[] {
  let desde = 1;
  let hasta = 12;
  if (p.tipo === "trimestre") {
    desde = (p.n - 1) * 3 + 1;
    hasta = desde + 2;
  } else if (p.tipo === "semestre") {
    desde = (p.n - 1) * 6 + 1;
    hasta = desde + 5;
  }
  const out: string[] = [];
  for (let m = desde; m <= hasta; m++) out.push(`${p.year}-${pad(m)}`);
  return out;
}

/** Periodo inmediatamente anterior (para comparar). */
export function periodoAnterior(p: Periodo): Periodo {
  if (p.tipo === "anio") return { ...p, year: p.year - 1 };
  const max = p.tipo === "trimestre" ? 4 : 2;
  return p.n > 1 ? { ...p, n: p.n - 1 } : { ...p, year: p.year - 1, n: max };
}

/** Etiqueta legible: "T3 2026", "S1 2026", "Año 2026". */
export function etiquetaPeriodo(p: Periodo): string {
  if (p.tipo === "trimestre") return `T${p.n} ${p.year}`;
  if (p.tipo === "semestre") return `S${p.n} ${p.year}`;
  return `Año ${p.year}`;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

function fila(zona: string, gasto: number, ent: number, sal: number, nomina: number): FilaZona {
  const trab = (ent + sal) / 2;
  return {
    zona,
    gasto,
    kgEntrada: ent,
    kgSalida: sal,
    kgTrabajado: trab,
    costoEntrada: div(gasto, ent),
    costoSalida: div(gasto, sal),
    costoTrabajado: div(gasto, trab),
    nomina,
    costoTrabajadoConNomina: div(gasto + nomina, trab),
  };
}

export function calcularCostoKilo(input: {
  periodo: Periodo;
  zonaDeCoordinador: Map<string, string>;
  kardex: KardexLite[];
  gastosCM: GastoCMLite[];
  ordenes: OrdenLite[];
  items: ItemLite[];
  nomina?: NominaLite[];
}): ResultadoCostoKilo {
  const meses = mesesDePeriodo(input.periodo);
  const enPeriodo = new Set(meses);
  const zonas = [...new Set(input.zonaDeCoordinador.values())].sort((a, b) =>
    a.localeCompare(b)
  );
  const acc = new Map<string, { g: number; e: number; s: number; n: number }>(
    zonas.map((z) => [z, { g: 0, e: 0, s: 0, n: 0 }])
  );
  const zonaDe = (cid: string) => input.zonaDeCoordinador.get(cid);

  // Kilos + mapa kardex → mes
  const mesDeKardex = new Map<string, string>();
  for (const k of input.kardex) {
    mesDeKardex.set(k.id, k.mes);
    if (!enPeriodo.has(k.mes)) continue;
    const z = zonaDe(k.coordinadorId);
    if (!z) continue;
    const a = acc.get(z)!;
    const kg = Math.abs(k.total || 0);
    if (k.tipo === "ENTRADA") a.e += kg;
    else if (k.tipo === "SALIDA") a.s += kg;
  }

  // Caja menor
  for (const g of input.gastosCM) {
    if (g.estado === "Rechazado") continue;
    if (!enPeriodo.has((g.fecha || "").slice(0, 7))) continue;
    const z = zonaDe(g.coordinadorId);
    if (z) acc.get(z)!.g += g.valor || 0;
  }

  // Órdenes de servicio
  const ordenes = new Map(input.ordenes.map((o) => [o.id, o]));
  for (const it of input.items) {
    const o = ordenes.get(it.ordenId);
    if (!o || o.estado === "Borrador" || o.estado === "Rechazada") continue;
    const mes = (it.kardexId && mesDeKardex.get(it.kardexId)) || (o.fecha || "").slice(0, 7);
    if (!enPeriodo.has(mes)) continue;
    const z = zonaDe(o.coordinadorId);
    if (z) acc.get(z)!.g += it.valor || 0;
  }

  // Nómina repartida por zona
  const mesesConNomina = new Set<string>();
  for (const n of input.nomina || []) {
    if (!enPeriodo.has(n.mes)) continue;
    mesesConNomina.add(n.mes);
    for (const [z, p] of [
      [n.zona1, n.pct1],
      [n.zona2, n.pct2],
    ] as const) {
      const a = z ? acc.get(z) : undefined;
      if (a && p > 0) a.n += (n.costoTotal || 0) * p;
    }
  }

  const filas = zonas.map((z) => {
    const a = acc.get(z)!;
    return fila(z, a.g, a.e, a.s, a.n);
  });
  const sum = (k: "gasto" | "kgEntrada" | "kgSalida" | "nomina") =>
    filas.reduce((s, f) => s + f[k], 0);
  const total = fila("TOTAL", sum("gasto"), sum("kgEntrada"), sum("kgSalida"), sum("nomina"));

  return {
    meses,
    filas,
    total,
    mesesSinNomina: meses.filter((m) => !mesesConNomina.has(m)),
  };
}
