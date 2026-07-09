"use client";

// Conserva la vista del listado de órdenes al entrar al detalle o a editar:
// el listado guarda su query string de filtros en sessionStorage y los
// enlaces "Volver a ordenes" la reutilizan para regresar a la misma vista.

import { useEffect, useState } from "react";

export const ORDENES_FILTROS_QS_KEY = "ordenes-filtros-qs";
export const ORDENES_EXPANDIDOS_KEY = "ordenes-expandidos";

export function useVolverAOrdenes(): string {
  // Se resuelve tras montar para no causar hydration mismatch.
  const [href, setHref] = useState("/ordenes-servicio");
  useEffect(() => {
    const qs = sessionStorage.getItem(ORDENES_FILTROS_QS_KEY);
    if (qs) setHref("/ordenes-servicio" + qs);
  }, []);
  return href;
}

export function leerExpandidosGuardados(): { meses: string[]; beneficiarios: string[] } {
  if (typeof window === "undefined") return { meses: [], beneficiarios: [] };
  try {
    const raw = sessionStorage.getItem(ORDENES_EXPANDIDOS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      meses: Array.isArray(data.meses) ? data.meses : [],
      beneficiarios: Array.isArray(data.beneficiarios) ? data.beneficiarios : [],
    };
  } catch {
    return { meses: [], beneficiarios: [] };
  }
}

export function guardarExpandidos(meses: Set<string>, beneficiarios: Set<string>) {
  try {
    sessionStorage.setItem(
      ORDENES_EXPANDIDOS_KEY,
      JSON.stringify({ meses: [...meses], beneficiarios: [...beneficiarios] })
    );
  } catch {
    // sessionStorage lleno o bloqueado: la vista sigue funcionando sin memoria
  }
}
