import { describe, it, expect } from "vitest";
import {
  buildCertificadosFilterFormula,
  escapeFormulaString,
  normalizeTipoGenerador,
} from "../certificadosFilters";

describe("escapeFormulaString", () => {
  it("escapa comillas simples", () => {
    expect(escapeFormulaString("O'Brien")).toBe("O\\'Brien");
  });

  it("escapa comillas dobles", () => {
    expect(escapeFormulaString('say "hi"')).toBe('say \\"hi\\"');
  });
});

describe("normalizeTipoGenerador", () => {
  it("convierte a mayúsculas y recorta", () => {
    expect(normalizeTipoGenerador("Agricola")).toBe("AGRICOLA");
    expect(normalizeTipoGenerador(" agricola ")).toBe("AGRICOLA");
    expect(normalizeTipoGenerador("AGRICOLA")).toBe("AGRICOLA");
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

  it("filtra por búsqueda libre (q) combinando nombre, cédula y consecutivo con OR", () => {
    const f = buildCertificadosFilterFormula({ q: "Perez" });
    expect(f).toContain("OR(");
    expect(f).toContain("FIND('perez', LOWER(ARRAYJOIN({nombregenerador})))");
    expect(f).toContain("FIND('perez', LOWER(ARRAYJOIN({cedulagenerador})))");
    expect(f).toContain('FIND(\'perez\', LOWER({consecutivo} & ""))');
  });

  it("filtra por cultivo usando nombre y FIND sobre ARRAYJOIN(cultivos_certificado)", () => {
    const f = buildCertificadosFilterFormula({ cultivoNombres: ["Aguacate", "Cafe"] });
    expect(f).toContain("FIND('Aguacate', ARRAYJOIN({cultivos_certificado}))");
    expect(f).toContain("FIND('Cafe', ARRAYJOIN({cultivos_certificado}))");
    expect(f.startsWith("OR(") || f.includes("OR(")).toBe(true);
  });

  it("normaliza tipoGenerador a mayúsculas en el filter", () => {
    const f = buildCertificadosFilterFormula({ tiposGenerador: ["Agricola"] });
    expect(f).toBe("FIND('AGRICOLA', UPPER(ARRAYJOIN({tipogenerador})))");
  });

  it("combina varios filtros con AND", () => {
    const f = buildCertificadosFilterFormula({
      ano: 2026,
      departamentos: ["Antioquia"],
      coordinadorIds: ["rec123"],
    });
    expect(f.startsWith("AND(")).toBe(true);
    expect(f).toContain("{ano} = 2026");
    expect(f).toContain("FIND('Antioquia', ARRAYJOIN({Departamento}))");
    expect(f).toContain("FIND('rec123', ARRAYJOIN({id_coordinador}))");
  });

  it("forceCoordinadorId reemplaza coordinadorIds del usuario", () => {
    const f = buildCertificadosFilterFormula({
      coordinadorIds: ["recOTHER"],
      forceCoordinadorId: "recFORCED",
    });
    expect(f).toContain("recFORCED");
    expect(f).not.toContain("recOTHER");
  });

  it("filtra por rango de fechas usando IS_AFTER / IS_BEFORE", () => {
    const f = buildCertificadosFilterFormula({
      fechaDesde: "2026-01-01",
      fechaHasta: "2026-12-31",
    });
    expect(f).toContain("IS_AFTER({fechadevolucion}, DATEADD('2026-01-01', -1, 'days'))");
    expect(f).toContain("IS_BEFORE({fechadevolucion}, DATEADD('2026-12-31', 1, 'days'))");
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
