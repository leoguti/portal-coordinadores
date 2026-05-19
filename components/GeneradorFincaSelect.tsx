"use client";

/**
 * Selectores con autocomplete para Generador y Finca (esquema nuevo
 * GENERADORES/FINCAS). Patrón extraído de app/certificados/listar/page.tsx
 * para reuso en la generación de certificados del portal.
 */

import { useEffect, useState } from "react";

export interface GeneradorOption {
  id: string;
  nombre: string;
  nit: string;
  tipo: string;
  tipopersona: string;
  fincaIds: string[];
}

export interface FincaOption {
  id: string;
  nombre: string;
}

export function GeneradorAutocomplete({
  value,
  onChange,
  onCreateNew,
}: {
  value: GeneradorOption | null;
  onChange: (g: GeneradorOption | null) => void;
  /** Si se pasa, al no haber resultados se ofrece crear uno nuevo. */
  onCreateNew?: (prefill: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeneradorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/generadores/buscar?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Generador
      </label>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-green-50">
          <span className="text-sm text-gray-800 flex-1">
            <span className="font-medium">{value.nombre}</span>
            {value.nit && (
              <span className="text-xs text-gray-500"> · NIT {value.nit}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-gray-500 hover:text-red-600 text-sm"
            aria-label="Quitar generador"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por nombre o NIT (mín 2 caracteres)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {open && q.length >= 2 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-xs text-gray-400">Buscando...</div>
              ) : results.length === 0 ? (
                <div className="p-2">
                  <p className="text-xs text-gray-400 mb-2">Sin resultados</p>
                  {onCreateNew && (
                    <button
                      type="button"
                      onClick={() => {
                        onCreateNew(q.trim());
                        setOpen(false);
                      }}
                      className="w-full text-left text-sm font-medium text-green-700 hover:bg-green-50 rounded px-2 py-1.5 border border-green-200"
                    >
                      + Crear generador nuevo
                    </button>
                  )}
                </div>
              ) : (
                results.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onChange(g);
                      setQ("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-800">
                      {g.nombre}
                    </div>
                    <div className="text-xs text-gray-500">
                      {g.nit && `NIT ${g.nit}`}
                      {g.tipo && ` · ${g.tipo}`}
                      {g.fincaIds.length > 0 &&
                        ` · ${g.fincaIds.length} finca(s)`}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FincaAutocomplete({
  value,
  onChange,
  generadorId,
  disabled,
  onCrearFinca,
}: {
  value: FincaOption | null;
  onChange: (f: FincaOption | null) => void;
  generadorId?: string;
  disabled: boolean;
  /** Si se pasa Y hay generador seleccionado, al no haber resultados se
   *  ofrece "+ Crear nueva finca para este generador". */
  onCrearFinca?: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FincaOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si hay generador seleccionado, cargamos sus fincas al inicio (sin q).
    // Si el generador tiene EXACTAMENTE una finca, se auto-selecciona para
    // ahorrarle un click al coordinador.
    if (generadorId && !value) {
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/fincas/buscar?generador=${encodeURIComponent(generadorId)}`
          );
          if (res.ok) {
            const data = await res.json();
            const list: FincaOption[] = data.results || [];
            setResults(list);
            if (list.length === 1) {
              onChange({ id: list[0].id, nombre: list[0].nombre });
            }
          }
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }
    // onChange es estable desde el padre; lo omitimos a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generadorId, value]);

  useEffect(() => {
    if (!generadorId && q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = generadorId
          ? `/api/fincas/buscar?generador=${encodeURIComponent(
              generadorId
            )}&q=${encodeURIComponent(q)}`
          : `/api/fincas/buscar?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, generadorId]);

  const placeholder = generadorId
    ? "Selecciona o filtra fincas..."
    : "Buscar finca por nombre (mín 2 caracteres)";

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Finca
      </label>
      {value ? (
        <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-green-50">
          <span className="text-sm text-gray-800 flex-1 font-medium">
            {value.nombre}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-gray-500 hover:text-red-600 text-sm"
            aria-label="Quitar finca"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {open && (generadorId || q.length >= 2) && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-xs text-gray-400">Buscando...</div>
              ) : (
                <>
                  {results.length === 0 ? (
                    <p className="p-2 text-xs text-gray-400">Sin resultados</p>
                  ) : (
                    results.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onChange({ id: f.id, nombre: f.nombre });
                          setQ("");
                          setOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-800">
                          {f.nombre}
                        </div>
                      </button>
                    ))
                  )}
                  {onCrearFinca && generadorId && (
                    <div
                      className={
                        results.length > 0
                          ? "p-2 border-t border-gray-200 bg-gray-50"
                          : "p-2"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onCrearFinca();
                          setOpen(false);
                        }}
                        className="w-full text-left text-sm font-medium text-green-700 hover:bg-green-100 rounded px-2 py-1.5 border border-green-200"
                      >
                        + Crear nueva finca para este generador
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
