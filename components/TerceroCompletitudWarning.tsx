"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Completitud {
  completo: boolean;
  faltantes: string[];
  nitInvalido: boolean;
}

/**
 * Muestra un banner informativo sobre el estado de completitud del tercero.
 * Por defecto es warning (no bloquea). Pasar `mode="error"` para bloqueo visual.
 */
export default function TerceroCompletitudWarning({
  terceroId,
  mode = "warning",
}: {
  terceroId: string;
  mode?: "warning" | "error";
}) {
  const [completitud, setCompletitud] = useState<Completitud | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terceroId) return;
    setLoading(true);
    fetch(`/api/terceros/${terceroId}`)
      .then((r) => r.json())
      .then((d) => setCompletitud(d.completitud || null))
      .finally(() => setLoading(false));
  }, [terceroId]);

  if (loading) return null;
  if (!completitud || completitud.completo) return null;

  const isError = mode === "error";

  return (
    <div
      className={`mt-2 rounded-lg p-3 border text-sm ${
        isError
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium">
            {isError ? "Este tercero no puede usarse: falta información" : "Este tercero tiene datos incompletos"}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {completitud.faltantes.map((f) => (
              <span
                key={f}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isError ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {f}
              </span>
            ))}
          </div>
          <Link
            href={`/terceros/${terceroId}`}
            target="_blank"
            className={`inline-block mt-2 text-xs font-medium underline hover:no-underline ${
              isError ? "text-red-700" : "text-amber-700"
            }`}
          >
            Completar datos del tercero →
          </Link>
        </div>
      </div>
    </div>
  );
}
