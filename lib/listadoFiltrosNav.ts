"use client";

// Conserva la vista de un listado (órdenes, actividades, caja menor…) al
// entrar a un detalle y volver: el listado refleja sus filtros en la URL y
// guarda esa query en sessionStorage; los enlaces "Volver" la reutilizan.
// Los grupos expandidos se guardan aparte en sessionStorage.

import { useEffect, useState } from "react";

const qsKey = (basePath: string) => `filtros-qs:${basePath}`;
const expandKey = (basePath: string) => `expandidos:${basePath}`;

// Escribe los filtros no vacíos en la URL (sin recargar ni re-navegar) y
// guarda la query para que useVolverAlListado pueda reconstruir el enlace.
export function reflejarFiltrosEnUrl(basePath: string, filtros: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  window.history.replaceState(null, "", basePath + qs);
  try {
    sessionStorage.setItem(qsKey(basePath), qs);
  } catch {
    // sin sessionStorage el enlace de volver queda sin filtros, nada más
  }
}

// Href de "Volver al listado" con los últimos filtros aplicados.
// Se resuelve tras montar para no causar hydration mismatch.
export function useVolverAlListado(basePath: string): string {
  const [href, setHref] = useState(basePath);
  useEffect(() => {
    const qs = sessionStorage.getItem(qsKey(basePath));
    if (qs) setHref(basePath + qs);
  }, [basePath]);
  return href;
}

export function leerExpandidosGuardados(basePath: string): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(expandKey(basePath));
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function guardarExpandidos(basePath: string, grupos: Record<string, Set<string>>) {
  try {
    const data: Record<string, string[]> = {};
    for (const [k, s] of Object.entries(grupos)) data[k] = [...s];
    sessionStorage.setItem(expandKey(basePath), JSON.stringify(data));
  } catch {
    // sessionStorage lleno o bloqueado: la vista sigue funcionando sin memoria
  }
}
