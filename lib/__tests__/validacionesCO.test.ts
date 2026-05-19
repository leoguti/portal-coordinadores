import { describe, it, expect } from "vitest";
import {
  soloDigitos,
  normalizarMovilCO,
  esMovilCOValido,
  validarDocumento,
} from "../validacionesCO";

describe("soloDigitos", () => {
  it("quita todo lo no numérico", () => {
    expect(soloDigitos("800.141.506-1")).toBe("8001415061");
  });
});

describe("normalizarMovilCO", () => {
  it("quita prefijo 57 cuando hay 12 dígitos", () => {
    expect(normalizarMovilCO("+57 300 123 4567")).toBe("3001234567");
  });
  it("deja 10 dígitos tal cual", () => {
    expect(normalizarMovilCO("300 123 4567")).toBe("3001234567");
  });
});

describe("esMovilCOValido", () => {
  it("acepta celular que empieza por 3 con 10 dígitos", () => {
    expect(esMovilCOValido("3001234567")).toBe(true);
    expect(esMovilCOValido("+573001234567")).toBe(true);
  });
  it("rechaza fijos, longitud incorrecta o que no empieza por 3", () => {
    expect(esMovilCOValido("6041234567")).toBe(false);
    expect(esMovilCOValido("300123456")).toBe(false);
    expect(esMovilCOValido("30012345678")).toBe(false);
  });
});

describe("validarDocumento", () => {
  it("Natural: cédula 6-10 dígitos", () => {
    expect(validarDocumento("Natural", "1098765432")).toBeNull();
    expect(validarDocumento("Natural", "12345")).not.toBeNull();
  });
  it("Juridica: NIT 9-11 dígitos, ignora separadores", () => {
    expect(validarDocumento("Juridica", "800.141.506-1")).toBeNull();
    expect(validarDocumento("Juridica", "800141")).not.toBeNull();
  });
  it("sin tipo de persona devuelve error", () => {
    expect(validarDocumento("", "123456789")).not.toBeNull();
  });
});
