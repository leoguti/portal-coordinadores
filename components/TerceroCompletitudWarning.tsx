"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { REQUISITO_PLANILLA_SS } from "@/lib/featureFlags";

interface Completitud {
  completo: boolean;
  faltantes: string[];
  nitInvalido: boolean;
}

interface PlanillaCheck {
  mes: string;
  ok: boolean;
  aplica: boolean;
}

/**
 * Muestra un banner informativo sobre el estado de completitud del tercero
 * y, opcionalmente, si tiene la planilla de SS del mes correspondiente.
 */
export default function TerceroCompletitudWarning({
  terceroId,
  mode = "warning",
  fechaReferencia,
}: {
  terceroId: string;
  mode?: "warning" | "error";
  fechaReferencia?: string; // YYYY-MM-DD — si viene, chequea planilla
}) {
  const [completitud, setCompletitud] = useState<Completitud | null>(null);
  const [planilla, setPlanilla] = useState<PlanillaCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terceroId) return;
    setLoading(true);
    const mesParam = fechaReferencia && /^\d{4}-\d{2}/.test(fechaReferencia)
      ? `?mesPlanilla=${fechaReferencia.slice(0, 7)}`
      : "";
    fetch(`/api/terceros/${terceroId}${mesParam}`)
      .then((r) => r.json())
      .then((d) => {
        setCompletitud(d.completitud || null);
        setPlanilla(d.planillaCheck || null);
      })
      .finally(() => setLoading(false));
  }, [terceroId, fechaReferencia]);

  if (loading) return null;

  const incompleto = completitud && !completitud.completo;
  // El requisito de planilla SS está desactivado temporalmente (ver lib/featureFlags.ts).
  const faltaPlanilla = REQUISITO_PLANILLA_SS && planilla && planilla.aplica && !planilla.ok;

  if (!incompleto && !faltaPlanilla) return null;

  const isError = mode === "error";
  const bgColor = isError ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800";
  const badgeColor = isError ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  const linkColor = isError ? "text-red-700" : "text-amber-700";

  return (
    <div className={`mt-2 rounded-lg p-3 border text-sm ${bgColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">⚠</span>
        <div className="flex-1 min-w-0 space-y-2">
          {incompleto && (
            <div>
              <p className="font-medium">
                {isError ? "Este tercero no puede usarse: falta información" : "Este tercero tiene datos incompletos"}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {completitud!.faltantes.map((f) => (
                  <span key={f} className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{f}</span>
                ))}
              </div>
            </div>
          )}
          {faltaPlanilla && (
            <div>
              <p className="font-medium">
                Falta planilla de Seguridad Social del mes {planilla!.mes}
              </p>
              <p className="text-xs mt-1">
                Este tercero es Persona Natural. Debe tener planilla del mes del pago para poder crear la OS.
              </p>
            </div>
          )}
          <Link
            href={`/terceros/${terceroId}`}
            target="_blank"
            className={`inline-block text-xs font-medium underline hover:no-underline ${linkColor}`}
          >
            {faltaPlanilla ? "Subir planilla / completar datos →" : "Completar datos del tercero →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
