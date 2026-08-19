/**
 * Reapertura de Órdenes de Servicio para corrección — reglas puras.
 *
 * Cuando un coordinador detecta tarde un error en una orden cuyo mes ya
 * cerró, un administrador puede "reabrirla": durante DIAS_REAPERTURA días
 * la orden se puede eliminar aunque esté fuera de la ventana de edición
 * (la cascada del portal devuelve sus kardex a "Por Pagar" y quedan
 * reutilizables en la orden corregida). La marca vive en Airtable
 * (`reabierta_hasta`, `reapertura_motivo`, `reapertura_por`) y muere sola
 * al vencer. Solo aplica a órdenes sin factura (Enviada/Borrador) —
 * Facturada/Pagada no se reabren desde el portal.
 */

export const DIAS_REAPERTURA = 7;

export interface OrdenReaperturaFields {
  Estado?: string;
  reabierta_hasta?: string;
  reapertura_motivo?: string;
  reapertura_por?: string;
}

/** ¿La orden está reabierta y la marca sigue vigente? */
export function estaReabierta(
  fields: OrdenReaperturaFields,
  ahora: Date = new Date()
): boolean {
  if (!fields.reabierta_hasta) return false;
  const hasta = new Date(fields.reabierta_hasta);
  if (isNaN(hasta.getTime())) return false;
  return hasta.getTime() > ahora.getTime();
}

/** ¿El estado de la orden admite reapertura? */
export function puedeReabrirse(fields: OrdenReaperturaFields): boolean {
  const estado = fields.Estado || "";
  return estado === "Enviada" || estado === "Borrador";
}
