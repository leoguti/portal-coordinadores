/**
 * Reglas para considerar a un generador + su finca seleccionada
 * "completos" y aptos para emitir un certificado. Espejan las condiciones
 * de la interfaz "revisar fincas", más los campos que el PDF del
 * certificado necesita estrictamente (tipo de generador y dirección de
 * sede).
 *
 * El DV del NIT NO se valida aquí — es un tema aparte.
 */

export interface DatosCompletitud {
  generador: {
    nombre?: string | null;
    nit?: string | null;
    tipo?: string | null;
    tipopersona?: string | null;
    direccion_sede?: string | null;
    movil?: string | null;
  };
  finca: {
    nombre?: string | null;
    tieneMunicipio: boolean;
    cultivosCount: number;
    movil?: string | null;
  };
}

export interface CompletitudResult {
  complete: boolean;
  missing: string[];
}

function vacio(v: string | null | undefined): boolean {
  return !v || !String(v).trim();
}

export function evaluarCompletitud(d: DatosCompletitud): CompletitudResult {
  const missing: string[] = [];

  // Generador
  if (vacio(d.generador.nombre)) missing.push("nombre del generador");
  if (vacio(d.generador.nit)) missing.push("NIT/cédula");
  if (vacio(d.generador.tipopersona)) missing.push("tipo de persona");
  if (vacio(d.generador.tipo)) missing.push("tipo de generador");
  if (vacio(d.generador.direccion_sede))
    missing.push("dirección de sede del generador");

  // Finca
  if (vacio(d.finca.nombre)) missing.push("nombre de la finca");
  if (!d.finca.tieneMunicipio) missing.push("municipio de la finca");
  if (d.finca.cultivosCount < 1) missing.push("al menos un cultivo");

  // Al menos un móvil (de la finca o del generador)
  if (vacio(d.generador.movil) && vacio(d.finca.movil))
    missing.push("móvil (del generador o de la finca)");

  return { complete: missing.length === 0, missing };
}
