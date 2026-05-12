import { describe, it, expect } from "vitest";
import {
  buildCertificadosFilterFormula,
  escapeFormulaString,
} from "../certificadosFilters";

describe("escapeFormulaString", () => {
  it("escapa comillas simples", () => {
    expect(escapeFormulaString("O'Brien")).toBe("O\\'Brien");
  });

  it("escapa comillas dobles", () => {
    expect(escapeFormulaString('say "hi"')).toBe('say \\"hi\\"');
  });
});

describe("buildCertificadosFilterFormula", () => {
  it("devuelve string vacío sin filtros", () => {
    expect(buildCertificadosFilterFormula({})).toBe("");
  });

  it("filtra por año", () => {
    const f = buildCertificadosFilterFormula({ ano: 2026 });
    expect(f).toBe("{ano} = 2026");
  });

  it("ignora año no numérico", () => {
    const f = buildCertificadosFilterFormula({ ano: "abc" as unknown as string });
    expect(f).toBe("");
  });

  it("filtra por cultivo usando nombre y FIND sobre ARRAYJOIN(cultivos_certificado)", () => {
    const f = buildCertificadosFilterFormula({ cultivoNombres: ["Aguacate", "Cafe"] });
    expect(f).toContain("FIND('Aguacate', ARRAYJOIN({cultivos_certificado}))");
    expect(f).toContain("FIND('Cafe', ARRAYJOIN({cultivos_certificado}))");
    expect(f.startsWith("OR(") || f.includes("OR(")).toBe(true);
  });

  it("filtra por municipios (multi) con OR", () => {
    const f = buildCertificadosFilterFormula({
      municipios: ["Rionegro - Antioquia", "La Ceja - Antioquia"],
    });
    expect(f).toBe(
      "OR(FIND('Rionegro - Antioquia', ARRAYJOIN({municipiogenerador})),FIND('La Ceja - Antioquia', ARRAYJOIN({municipiogenerador})))"
    );
  });

  it("filtra por fincaNombres (multi) con OR sobre FINCAS", () => {
    const f = buildCertificadosFilterFormula({
      fincaNombres: ["La Esperanza", "El Mirador"],
    });
    expect(f).toContain("FIND('La Esperanza', ARRAYJOIN({FINCAS}))");
    expect(f).toContain("FIND('El Mirador', ARRAYJOIN({FINCAS}))");
    expect(f.startsWith("OR(")).toBe(true);
  });

  it("filtra por mes con DATETIME_FORMAT", () => {
    const f = buildCertificadosFilterFormula({ mes: "2026-01" });
    expect(f).toBe(
      "DATETIME_FORMAT({fechadevolucion}, 'YYYY-MM') = '2026-01'"
    );
  });

  it("ignora mes con formato inválido", () => {
    expect(buildCertificadosFilterFormula({ mes: "2026/01" })).toBe("");
    expect(buildCertificadosFilterFormula({ mes: "abc" })).toBe("");
  });

  it("combina varios filtros con AND", () => {
    const f = buildCertificadosFilterFormula({
      ano: 2026,
      departamentos: ["Antioquia"],
      coordinadorIds: ["rec123"],
      mes: "2026-03",
    });
    expect(f.startsWith("AND(")).toBe(true);
    expect(f).toContain("{ano} = 2026");
    expect(f).toContain("FIND('Antioquia', ARRAYJOIN({Departamento}))");
    expect(f).toContain("FIND('rec123', ARRAYJOIN({id_coordinador}))");
    expect(f).toContain("DATETIME_FORMAT({fechadevolucion}, 'YYYY-MM') = '2026-03'");
  });

  it("forceCoordinadorId reemplaza coordinadorIds del usuario", () => {
    const f = buildCertificadosFilterFormula({
      coordinadorIds: ["recOTHER"],
      forceCoordinadorId: "recFORCED",
    });
    expect(f).toContain("recFORCED");
    expect(f).not.toContain("recOTHER");
  });

  it("multi-departamento usa OR", () => {
    const f = buildCertificadosFilterFormula({
      departamentos: ["Antioquia", "Cundinamarca"],
    });
    expect(f).toBe(
      "OR(FIND('Antioquia', ARRAYJOIN({Departamento})),FIND('Cundinamarca', ARRAYJOIN({Departamento})))"
    );
  });
});
