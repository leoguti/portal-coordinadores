import { describe, it, expect } from "vitest";
import {
  calcularCostoKilo,
  mesesDePeriodo,
  periodoAnterior,
  etiquetaPeriodo,
} from "../costoKilo";

const zonas = new Map([
  ["cEje", "EJE CAFETERO"],
  ["cValle", "VALLE DEL CAUCA"],
]);

describe("periodos", () => {
  it("meses de un trimestre, semestre y año", () => {
    expect(mesesDePeriodo({ year: 2026, tipo: "trimestre", n: 3 })).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(mesesDePeriodo({ year: 2026, tipo: "semestre", n: 2 })).toHaveLength(6);
    expect(mesesDePeriodo({ year: 2026, tipo: "anio", n: 1 })[11]).toBe("2026-12");
  });
  it("periodo anterior cruza el año", () => {
    expect(periodoAnterior({ year: 2026, tipo: "trimestre", n: 1 })).toEqual({ year: 2025, tipo: "trimestre", n: 4 });
    expect(periodoAnterior({ year: 2026, tipo: "semestre", n: 2 })).toEqual({ year: 2026, tipo: "semestre", n: 1 });
    expect(etiquetaPeriodo({ year: 2026, tipo: "trimestre", n: 3 })).toBe("T3 2026");
  });
});

describe("calcularCostoKilo", () => {
  const base = {
    periodo: { year: 2026, tipo: "trimestre" as const, n: 3 },
    zonaDeCoordinador: zonas,
    kardex: [
      { id: "k1", mes: "2026-07", tipo: "ENTRADA", total: 1000, coordinadorId: "cEje" },
      { id: "k2", mes: "2026-08", tipo: "SALIDA", total: -600, coordinadorId: "cEje" },
      // transporte de junio pagado en una orden de julio → no cuenta en T3
      { id: "k3", mes: "2026-06", tipo: "SALIDA", total: -500, coordinadorId: "cEje" },
      { id: "k4", mes: "2026-09", tipo: "ENTRADA", total: 400, coordinadorId: "cValle" },
      { id: "k5", mes: "2026-09", tipo: "SALIDA", total: -400, coordinadorId: "cValle" },
    ],
    gastosCM: [
      { fecha: "2026-08-10", estado: "Aprobado", valor: 100_000, coordinadorId: "cEje" },
      { fecha: "2026-08-11", estado: "Rechazado", valor: 999_999, coordinadorId: "cEje" },
    ],
    ordenes: [
      { id: "o1", fecha: "2026-07-02", estado: "Pagada", coordinadorId: "cEje" },
      { id: "o2", fecha: "2026-09-15", estado: "Borrador", coordinadorId: "cEje" },
      { id: "o3", fecha: "2026-10-01", estado: "Enviada", coordinadorId: "cValle" },
    ],
    items: [
      { ordenId: "o1", kardexId: "k2", valor: 700_000 }, // con kardex de agosto → T3
      { ordenId: "o1", kardexId: "k3", valor: 500_000 }, // con kardex de junio → T2
      { ordenId: "o1", kardexId: "", valor: 200_000 }, // sin kardex → fecha de la orden (julio)
      { ordenId: "o2", kardexId: "", valor: 888_888 }, // borrador → fuera
      { ordenId: "o3", kardexId: "k5", valor: 400_000 }, // orden de octubre, kardex de septiembre → T3
    ],
  };

  it("aplica las reglas de fecha y estado y calcula los tres costos", () => {
    const r = calcularCostoKilo(base);
    const eje = r.filas.find((f) => f.zona === "EJE CAFETERO")!;
    expect(eje.gasto).toBe(1_000_000); // 100k CM + 700k + 200k
    expect(eje.kgEntrada).toBe(1000);
    expect(eje.kgSalida).toBe(600);
    expect(eje.costoEntrada).toBe(1000);
    expect(eje.costoSalida).toBeCloseTo(1666.67, 1);
    expect(eje.costoTrabajado).toBe(1250); // 1.000.000 / 800

    const valle = r.filas.find((f) => f.zona === "VALLE DEL CAUCA")!;
    expect(valle.gasto).toBe(400_000);
    expect(valle.costoTrabajado).toBe(1000); // directo: entra y sale 400 kg → 400 kg trabajados

    expect(r.total.gasto).toBe(1_400_000);
    expect(r.total.kgTrabajado).toBe(1200);
  });

  it("sin kilos el costo es null, no infinito", () => {
    const r = calcularCostoKilo({ ...base, kardex: [] });
    expect(r.filas[0].costoTrabajado).toBeNull();
  });

  it("reparte la nómina por zona y reporta meses sin nómina", () => {
    const r = calcularCostoKilo({
      ...base,
      nomina: [
        { mes: "2026-08", costoTotal: 1_000_000, zona1: "EJE CAFETERO", pct1: 0.7, zona2: "VALLE DEL CAUCA", pct2: 0.3 },
        { mes: "2026-08", costoTotal: 500_000, zona1: "ZONA INEXISTENTE", pct1: 1, zona2: "", pct2: 0 },
      ],
    });
    const eje = r.filas.find((f) => f.zona === "EJE CAFETERO")!;
    expect(eje.nomina).toBe(700_000);
    expect(eje.costoTrabajadoConNomina).toBe(2125); // (1.000.000 + 700.000) / 800
    expect(r.mesesSinNomina).toEqual(["2026-07", "2026-09"]);
  });
});
