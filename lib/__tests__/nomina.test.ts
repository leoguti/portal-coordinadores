import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { leerResumenCostos, puedeGestionarNomina } from "../nomina";

const ZONAS = ["EJE CAFETERO", "VALLE DEL CAUCA", "URABA"];

/** Arma un .xlsx en memoria con la hoja RESUMEN_COSTOS (datos ficticios). */
function libro(filas: unknown[][], opts: { mes?: string; hoja?: string } = {}) {
  const aoa: unknown[][] = [
    ["RESUMEN DE COSTOS DE NÓMINA"],
    ["Mes (AAAA-MM):", opts.mes ?? "2026-08"],
    ["instrucciones"],
    [],
    ["Mes", "Cédula", "Nombre", "Cargo", "Centro de costo", "Tipo", "Devengado", "Aportes", "Prestaciones",
      "Medios transporte", "Otros auxilios", "COSTO TOTAL", "Zona 1", "% zona 1", "Zona 2", "% zona 2", "Control"],
    ...filas,
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), opts.hoja ?? "RESUMEN_COSTOS");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "PERSONA1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const coord = ["2026-08", "1.234.567", "PEDRO PRUEBA", "COORDINADOR OPERATIVO", 609, "Zona",
  1000, 300, 200, 500, 0, 2000, "Eje Cafetero", 0.7, "VALLE DEL CAUCA", 0.3, "OK"];
const oficina = ["2026-08", 7654321, "ANA OFICINA", "ADMINISTRATIVA", 101, "Oficina",
  800, 200, 100, 0, 50, 1150, "", "", "", "", "—"];

describe("leerResumenCostos", () => {
  it("lee filas válidas, normaliza cédula, zona y porcentajes", () => {
    const r = leerResumenCostos(libro([coord, oficina, ["", "", "TOTALES"]]), ZONAS);
    expect(r.errores).toEqual([]);
    expect(r.mes).toBe("2026-08");
    expect(r.filas).toHaveLength(2);
    const p = r.filas[0];
    expect(p.documento).toBe("1234567");
    expect(p.zona1).toBe("EJE CAFETERO");
    expect(p.pct1).toBeCloseTo(0.7);
    expect(p.costoTotalEmpresa).toBe(2000);
    expect(r.filas[1].tipo).toBe("Oficina");
  });

  it("acepta % escritos como 70 y 30", () => {
    const f = [...coord];
    f[13] = 70;
    f[15] = 30;
    expect(leerResumenCostos(libro([f]), ZONAS).errores).toEqual([]);
  });

  it("detecta % que no suman 100, zona inexistente y cédula vacía", () => {
    const f1 = [...coord];
    f1[15] = 0.2;
    const f2 = [...coord];
    f2[1] = "";
    f2[12] = "MARTE";
    f2[14] = "";
    f2[13] = 1;
    const r = leerResumenCostos(libro([f1, f2]), ZONAS);
    expect(r.errores.join(" ")).toMatch(/suman 90 %/);
    expect(r.errores.join(" ")).toMatch(/«MARTE» no existe/);
    expect(r.errores.join(" ")).toMatch(/falta la cédula/);
  });

  it("falla si no existe la hoja o si no hay valores calculados", () => {
    expect(leerResumenCostos(libro([coord], { hoja: "OTRA" }), ZONAS).errores[0]).toMatch(/no tiene la hoja/);
    const sinValores = [...coord];
    sinValores[11] = "";
    expect(leerResumenCostos(libro([sinValores]), ZONAS).errores.join(" ")).toMatch(/guárdelo/);
  });
});

describe("puedeGestionarNomina", () => {
  it("solo los correos autorizados", () => {
    expect(puedeGestionarNomina("Administrativa@campolimpio.org")).toBe(true);
    expect(puedeGestionarNomina("direccion@campolimpio.org")).toBe(true);
    expect(puedeGestionarNomina("antioquia@campolimpio.org")).toBe(false);
    expect(puedeGestionarNomina(undefined)).toBe(false);
  });
});
