import { describe, it, expect } from "vitest";
import { estaReabierta, puedeReabrirse } from "../ordenesReapertura";

const AHORA = new Date("2026-08-19T12:00:00Z");

describe("estaReabierta", () => {
  it("vigente cuando reabierta_hasta es futuro", () => {
    expect(estaReabierta({ reabierta_hasta: "2026-08-25T12:00:00.000Z" }, AHORA)).toBe(true);
  });

  it("vencida cuando reabierta_hasta ya pasó", () => {
    expect(estaReabierta({ reabierta_hasta: "2026-08-10T12:00:00.000Z" }, AHORA)).toBe(false);
  });

  it("sin marca o con fecha inválida no está reabierta", () => {
    expect(estaReabierta({}, AHORA)).toBe(false);
    expect(estaReabierta({ reabierta_hasta: "" }, AHORA)).toBe(false);
    expect(estaReabierta({ reabierta_hasta: "no-fecha" }, AHORA)).toBe(false);
  });
});

describe("puedeReabrirse", () => {
  it("Enviada y Borrador sí; Facturada, Pagada y Rechazada no", () => {
    expect(puedeReabrirse({ Estado: "Enviada" })).toBe(true);
    expect(puedeReabrirse({ Estado: "Borrador" })).toBe(true);
    expect(puedeReabrirse({ Estado: "Facturada" })).toBe(false);
    expect(puedeReabrirse({ Estado: "Pagada" })).toBe(false);
    expect(puedeReabrirse({ Estado: "Rechazada" })).toBe(false);
    expect(puedeReabrirse({})).toBe(false);
  });
});
