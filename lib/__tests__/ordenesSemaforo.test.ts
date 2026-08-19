import { describe, it, expect } from "vitest";
import {
  diasSinFactura,
  colorPorDias,
  semaforoDeOrdenes,
  DIAS_AVISO,
  DIAS_BLOQUEO,
} from "../ordenesSemaforo";

const HOY = new Date("2026-08-19T12:00:00");

function orden(fields: Record<string, unknown>, id = "rec1") {
  return { id, fields } as Parameters<typeof semaforoDeOrdenes>[0][0];
}

describe("diasSinFactura", () => {
  it("cuenta días desde Fecha de pedido para Enviada sin factura", () => {
    expect(
      diasSinFactura({ Estado: "Enviada", "Fecha de pedido": "2026-06-30" }, HOY)
    ).toBe(50);
  });

  it("no aplica si la orden ya tiene factura adjunta", () => {
    expect(
      diasSinFactura(
        { Estado: "Enviada", "Fecha de pedido": "2026-06-30", Factura: [{ url: "x" }] },
        HOY
      )
    ).toBeNull();
  });

  it("no aplica a Facturada, Pagada ni Borrador", () => {
    for (const Estado of ["Facturada", "Pagada", "Borrador", "Rechazada"]) {
      expect(diasSinFactura({ Estado, "Fecha de pedido": "2026-01-01" }, HOY)).toBeNull();
    }
  });

  it("no aplica sin fecha de pedido o con fecha inválida", () => {
    expect(diasSinFactura({ Estado: "Enviada" }, HOY)).toBeNull();
    expect(diasSinFactura({ Estado: "Enviada", "Fecha de pedido": "no-fecha" }, HOY)).toBeNull();
  });
});

describe("colorPorDias", () => {
  it("umbrales exactos: 39 verde, 40 amarillo, 59 amarillo, 60 rojo", () => {
    expect(colorPorDias(DIAS_AVISO - 1)).toBe("verde");
    expect(colorPorDias(DIAS_AVISO)).toBe("amarillo");
    expect(colorPorDias(DIAS_BLOQUEO - 1)).toBe("amarillo");
    expect(colorPorDias(DIAS_BLOQUEO)).toBe("rojo");
  });
});

describe("semaforoDeOrdenes", () => {
  it("clasifica y ordena de más antigua a más reciente", () => {
    const { amarillas, rojas } = semaforoDeOrdenes(
      [
        orden({ NumeroOrden: 1, Estado: "Enviada", "Fecha de pedido": "2026-08-15" }, "a"), // 4d verde
        orden({ NumeroOrden: 2, Estado: "Enviada", "Fecha de pedido": "2026-07-05" }, "b"), // 45d amarilla
        orden({ NumeroOrden: 3, Estado: "Enviada", "Fecha de pedido": "2026-06-01" }, "c"), // 79d roja
        orden({ NumeroOrden: 4, Estado: "Enviada", "Fecha de pedido": "2026-06-10" }, "d"), // 70d roja
        orden({ NumeroOrden: 5, Estado: "Facturada", "Fecha de pedido": "2026-01-01" }, "e"),
      ],
      HOY
    );
    expect(amarillas.map((o) => o.numero)).toEqual([2]);
    expect(rojas.map((o) => o.numero)).toEqual([3, 4]);
    expect(rojas[0].dias).toBe(79);
  });

  it("incluye el coordinador del lookup para la vista admin", () => {
    const { rojas } = semaforoDeOrdenes(
      [
        orden({
          NumeroOrden: 9,
          Estado: "Enviada",
          "Fecha de pedido": "2026-06-01",
          NombreCoordinador: ["Tolima - Carlos"],
        }),
      ],
      HOY
    );
    expect(rojas[0].coordinador).toBe("Tolima - Carlos");
  });

  it("sin órdenes en mora devuelve listas vacías", () => {
    const res = semaforoDeOrdenes(
      [orden({ NumeroOrden: 1, Estado: "Enviada", "Fecha de pedido": "2026-08-18" })],
      HOY
    );
    expect(res.amarillas).toEqual([]);
    expect(res.rojas).toEqual([]);
  });
});
