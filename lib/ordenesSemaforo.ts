/**
 * Semáforo de facturación de Órdenes de Servicio — reglas puras, sin
 * dependencias de servidor, para usarse igual en el enforcement de
 * createOrdenServicio y en la UI (listado y wizard de nueva orden).
 *
 * Política (acordada con administración 2026-06-17, activada 2026-08-19):
 * una orden "sin resolver" es la que está en estado `Enviada` SIN adjunto
 * en el campo `Factura`. Las `Facturada` sin pagar no cuentan (ese atasco
 * es de tesorería, no del coordinador). La antigüedad corre desde
 * `Fecha de pedido`.
 *
 *   🟢 verde    < 40 días — flujo normal (mediana histórica: 1 día).
 *   🟡 amarillo ≥ 40 días — aviso: el coordinador aún puede crear órdenes.
 *   🔴 rojo     ≥ 60 días — bloquea la creación de órdenes nuevas hasta
 *                que administración suba la factura (Enviada → Facturada).
 */

export const DIAS_AVISO = 40;
export const DIAS_BLOQUEO = 60;

/** Campos mínimos que el semáforo necesita de una orden (estructural, para
 *  no depender del módulo "use server" de airtable). */
export interface OrdenSemaforoFields {
  NumeroOrden?: number;
  Estado?: string;
  "Fecha de pedido"?: string;
  Factura?: Array<{ url?: string }>;
  NombreCoordinador?: string[];
}

export interface OrdenSemaforo {
  id: string;
  fields: OrdenSemaforoFields;
}

export interface OrdenEnMora {
  id: string;
  numero: number | string;
  fechaPedido: string;
  dias: number;
  coordinador: string;
}

/**
 * Días que la orden lleva Enviada sin factura, o null si no aplica
 * (otro estado, ya tiene factura adjunta, o no tiene fecha de pedido).
 */
export function diasSinFactura(
  fields: OrdenSemaforoFields,
  hoy: Date = new Date()
): number | null {
  if (fields.Estado !== "Enviada") return null;
  if (Array.isArray(fields.Factura) && fields.Factura.length > 0) return null;
  const fecha = fields["Fecha de pedido"];
  if (!fecha) return null;
  const inicio = new Date(fecha + "T00:00:00");
  if (isNaN(inicio.getTime())) return null;
  return Math.floor((hoy.getTime() - inicio.getTime()) / 86400000);
}

export type ColorSemaforo = "verde" | "amarillo" | "rojo";

export function colorPorDias(dias: number): ColorSemaforo {
  if (dias >= DIAS_BLOQUEO) return "rojo";
  if (dias >= DIAS_AVISO) return "amarillo";
  return "verde";
}

/**
 * Clasifica un lote de órdenes (típicamente las de un coordinador, o todas
 * para la vista admin). Devuelve solo las que están en mora, ordenadas de
 * más antigua a más reciente.
 */
export function semaforoDeOrdenes(
  ordenes: OrdenSemaforo[],
  hoy: Date = new Date()
): { amarillas: OrdenEnMora[]; rojas: OrdenEnMora[] } {
  const amarillas: OrdenEnMora[] = [];
  const rojas: OrdenEnMora[] = [];
  for (const orden of ordenes) {
    const dias = diasSinFactura(orden.fields, hoy);
    if (dias === null) continue;
    const color = colorPorDias(dias);
    if (color === "verde") continue;
    const entrada: OrdenEnMora = {
      id: orden.id,
      numero: orden.fields.NumeroOrden ?? "S/N",
      fechaPedido: orden.fields["Fecha de pedido"] || "",
      dias,
      coordinador: orden.fields.NombreCoordinador?.[0] || "",
    };
    if (color === "rojo") rojas.push(entrada);
    else amarillas.push(entrada);
  }
  const porAntiguedad = (a: OrdenEnMora, b: OrdenEnMora) => b.dias - a.dias;
  amarillas.sort(porAntiguedad);
  rojas.sort(porAntiguedad);
  return { amarillas, rojas };
}
