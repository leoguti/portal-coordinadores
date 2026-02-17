import type { Orden } from "./airtable";

export type BeneficiarioGrupo = {
  ordenes: Orden[];
  total: number;
};

export type MesGrupo = {
  beneficiarios: [string, BeneficiarioGrupo][];
  total: number;
  count: number;
  estadoCounts: Record<string, number>;
};

/**
 * Groups filtered ordenes by Mes → Beneficiario.
 * Returns sorted array: months descending, beneficiarios by total descending.
 */
export function groupOrdenesByMes(
  ordenesFiltradas: Orden[]
): [string, MesGrupo][] {
  const mesMap = new Map<
    string,
    {
      benMap: Map<string, BeneficiarioGrupo>;
      total: number;
      count: number;
      estadoCounts: Record<string, number>;
    }
  >();

  ordenesFiltradas.forEach((orden) => {
    const fecha = orden.fields["Fecha de pedido"] || "";
    const mesKey = fecha.substring(0, 7) || "sin-fecha";
    const beneficiario =
      orden.fields.RazonSocial?.[0] || "Sin beneficiario";
    const estado = orden.fields.Estado || "Sin estado";
    const total = orden.fields.Total || 0;

    if (!mesMap.has(mesKey)) {
      mesMap.set(mesKey, {
        benMap: new Map(),
        total: 0,
        count: 0,
        estadoCounts: {},
      });
    }
    const mes = mesMap.get(mesKey)!;
    mes.total += total;
    mes.count++;
    mes.estadoCounts[estado] = (mes.estadoCounts[estado] || 0) + 1;

    if (!mes.benMap.has(beneficiario)) {
      mes.benMap.set(beneficiario, { ordenes: [], total: 0 });
    }
    const ben = mes.benMap.get(beneficiario)!;
    ben.ordenes.push(orden);
    ben.total += total;
  });

  return [...mesMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([mesKey, { benMap, total, count, estadoCounts }]) => [
      mesKey,
      {
        beneficiarios: [...benMap.entries()].sort(
          (a, b) => b[1].total - a[1].total
        ),
        total,
        count,
        estadoCounts,
      },
    ]);
}
