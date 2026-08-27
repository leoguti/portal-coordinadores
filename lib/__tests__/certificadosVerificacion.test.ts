import { describe, it, expect } from "vitest";
import {
  enmascararCedula,
  enmascararNombre,
  generarTokenVerificacion,
  VERIFICACION_BASE_URL,
} from "../certificadosVerificacion";

describe("enmascararNombre", () => {
  it("primeras 3 letras de cada palabra, estilo Nequi", () => {
    expect(enmascararNombre("LEONARDO GUTIERREZ")).toBe("LEO*** GUT***");
    expect(enmascararNombre("ANA DE LA CRUZ")).toBe("ANA*** DE*** LA*** CRU***");
  });

  it("vacío queda vacío", () => {
    expect(enmascararNombre("")).toBe("");
    expect(enmascararNombre("   ")).toBe("");
  });
});

describe("enmascararCedula", () => {
  it("muestra solo los últimos 4 dígitos (ignorando puntos)", () => {
    expect(enmascararCedula("1023456789")).toBe("******6789");
    expect(enmascararCedula("79.456.123")).toBe("****6123");
  });

  it("cédulas muy cortas se ocultan por completo; vacía queda vacía", () => {
    expect(enmascararCedula("123")).toBe("***");
    expect(enmascararCedula("")).toBe("");
  });
});

describe("generarTokenVerificacion", () => {
  it("32 hex chars (128 bits), únicos entre sí", () => {
    const a = generarTokenVerificacion();
    const b = generarTokenVerificacion();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("VERIFICACION_BASE_URL", () => {
  it("apunta al dominio oficial con https", () => {
    expect(VERIFICACION_BASE_URL).toBe("https://portal.campolimpio.org/v/");
  });
});
