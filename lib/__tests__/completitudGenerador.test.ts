import { describe, it, expect } from "vitest";
import { evaluarCompletitud } from "../completitudGenerador";

const baseCompleto = {
  generador: {
    nombre: "Juan",
    nit: "800141506-1",
    tipo: "AGRICOLA",
    tipopersona: "Natural",
    direccion_sede: "Calle 1",
    movil: "3001234567",
  },
  finca: {
    nombre: "La Esperanza",
    tieneMunicipio: true,
    cultivosCount: 1,
    movil: null,
  },
};

describe("evaluarCompletitud", () => {
  it("complete cuando todos los campos están", () => {
    expect(evaluarCompletitud(baseCompleto)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it("detecta nombre del generador faltante", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      generador: { ...baseCompleto.generador, nombre: "" },
    });
    expect(r.complete).toBe(false);
    expect(r.missing).toContain("nombre del generador");
  });

  it("detecta tipo de generador y dirección de sede faltantes", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      generador: {
        ...baseCompleto.generador,
        tipo: "",
        direccion_sede: "  ",
      },
    });
    expect(r.missing).toContain("tipo de generador");
    expect(r.missing).toContain("dirección de sede del generador");
  });

  it("detecta cultivos = 0", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      finca: { ...baseCompleto.finca, cultivosCount: 0 },
    });
    expect(r.missing).toContain("al menos un cultivo");
  });

  it("detecta municipio de finca faltante", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      finca: { ...baseCompleto.finca, tieneMunicipio: false },
    });
    expect(r.missing).toContain("municipio de la finca");
  });

  it("móvil OK si está en la finca (aunque no en el generador)", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      generador: { ...baseCompleto.generador, movil: "" },
      finca: { ...baseCompleto.finca, movil: "3009999999" },
    });
    expect(r.complete).toBe(true);
  });

  it("falla si no hay móvil ni en finca ni en generador", () => {
    const r = evaluarCompletitud({
      ...baseCompleto,
      generador: { ...baseCompleto.generador, movil: "" },
      finca: { ...baseCompleto.finca, movil: "" },
    });
    expect(r.missing.some((m) => m.toLowerCase().includes("móvil"))).toBe(true);
  });
});
