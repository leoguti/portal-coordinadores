/**
 * Utilidades para validación de fechas según reglas de negocio
 * 
 * REGLA PRINCIPAL:
 * - Días 1-7 del mes: Se pueden crear/editar/eliminar registros del mes actual y anterior
 * - Después del día 7: Solo se pueden crear/editar/eliminar registros del mes actual
 * 
 * Los meses "cerrados" son aquellos que ya no se pueden modificar.
 */

/**
 * Obtiene la fecha de inicio del período modificable
 * 
 * @returns Fecha de inicio del período que se puede modificar
 */
export function getFechaInicioModificable(): Date {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  
  if (diaActual > 7) {
    // Después del día 7: solo mes actual
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  } else {
    // Días 1-7: mes anterior y actual
    return new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  }
}

/**
 * Obtiene la fecha de corte para meses cerrados
 * Los meses cerrados son aquellos cuya fecha es ANTES de esta fecha
 * 
 * @returns Fecha de corte (registros antes de esta fecha están cerrados)
 */
export function getFechaCorteMesesCerrados(): Date {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  
  if (diaActual > 7) {
    // Después del día 7: mes actual está abierto, anteriores cerrados
    // Fecha corte: inicio del mes actual
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  } else {
    // Días 1-7: mes actual y anterior abiertos, anteriores cerrados
    // Fecha corte: inicio del mes anterior
    return new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  }
}

/**
 * Verifica si una fecha puede ser modificada/eliminada según reglas de negocio
 * 
 * @param fecha - Fecha a validar (formato YYYY-MM-DD o Date object)
 * @returns true si la fecha puede ser modificada, false si está bloqueada
 */
export function puedeModificarFecha(fecha: string | Date): boolean {
  const fechaMovimiento = typeof fecha === 'string' 
    ? new Date(fecha + 'T00:00:00')
    : new Date(fecha);
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diaActual = hoy.getDate();
  
  // No permitir fechas futuras
  if (fechaMovimiento > hoy) {
    return false;
  }
  
  if (diaActual > 7) {
    // Después del día 7: solo mes actual
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return fechaMovimiento >= inicioMesActual;
  } else {
    // Días 1-7: mes anterior y actual
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return fechaMovimiento >= inicioMesAnterior;
  }
}

/**
 * Verifica si una fecha está en un mes cerrado (no modificable)
 * 
 * @param fecha - Fecha a validar (formato YYYY-MM-DD o Date object)
 * @returns true si está en mes cerrado, false si está en mes abierto
 */
export function estaMesCerrado(fecha: string | Date): boolean {
  const fechaMovimiento = typeof fecha === 'string' 
    ? new Date(fecha + 'T00:00:00')
    : new Date(fecha);
  
  const fechaCorte = getFechaCorteMesesCerrados();
  
  // Un mes está cerrado si la fecha es ANTERIOR a la fecha de corte
  return fechaMovimiento < fechaCorte;
}

/**
 * Obtiene el mensaje de error apropiado cuando una fecha no puede ser modificada
 * 
 * @returns Mensaje descriptivo según el día actual
 */
export function getMensajeErrorFecha(): string {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  
  if (diaActual > 7) {
    return "Solo se pueden modificar movimientos con fecha del mes actual después del día 7";
  } else {
    return "Solo se pueden modificar movimientos con fecha del mes actual y anterior durante los primeros 7 días del mes";
  }
}

/**
 * Obtiene la fecha mínima permitida en formato YYYY-MM-DD
 * Útil para inputs de tipo date
 * 
 * @returns Fecha mínima en formato ISO (YYYY-MM-DD)
 */
export function getFechaMinimaPermitida(): string {
  return getFechaInicioModificable().toISOString().split('T')[0];
}

/**
 * Obtiene la fecha máxima permitida (hoy) en formato YYYY-MM-DD
 * Útil para inputs de tipo date
 * 
 * @returns Fecha de hoy en formato ISO (YYYY-MM-DD)
 */
export function getFechaMaximaPermitida(): string {
  return new Date().toISOString().split('T')[0];
}
