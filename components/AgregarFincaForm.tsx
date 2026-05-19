"use client";

/**
 * Formulario para AGREGAR una finca a un generador que YA existe.
 * Distinto de CrearGeneradorForm (que crea generador + primera finca).
 * Solo captura datos de la finca; el generador no se modifica.
 */

import { useEffect, useState } from "react";
import MunicipioSearch from "@/components/MunicipioSearch";
import type { FincaOption } from "@/components/GeneradorFincaSelect";
import { esMovilCOValido } from "@/lib/validacionesCO";

type Mun = { id: string; mundep: string } | null;

export default function AgregarFincaForm({
  generadorContext,
  onCancel,
  onFincaAdded,
}: {
  generadorContext: { id: string; nombre: string };
  onCancel: () => void;
  onFincaAdded: (f: FincaOption) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState<Mun>(null);
  const [movil, setMovil] = useState("");
  const [email, setEmail] = useState("");

  const [cultivos, setCultivos] = useState<{ id: string; nombre: string }[]>(
    []
  );
  const [cultivoSel, setCultivoSel] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [cultivoQ, setCultivoQ] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<FincaOption | null>(null);

  useEffect(() => {
    fetch("/api/cultivos")
      .then((r) => r.json())
      .then((d) => setCultivos(d.cultivos || []))
      .catch(() => setCultivos([]));
  }, []);

  const cultivosValidos = cultivos.filter(
    (c) => typeof c.nombre === "string" && c.nombre.trim() !== ""
  );
  const cultivosFiltrados = cultivoQ.trim()
    ? cultivosValidos.filter((c) =>
        c.nombre.toLowerCase().includes(cultivoQ.trim().toLowerCase())
      )
    : cultivosValidos;

  function toggleCultivo(c: { id: string; nombre: string }) {
    setCultivoSel((prev) =>
      prev.some((x) => x.id === c.id)
        ? prev.filter((x) => x.id !== c.id)
        : [...prev, c]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!esMovilCOValido(movil)) {
      setError(
        "El móvil de la finca debe ser un celular colombiano (10 dígitos, empieza por 3)"
      );
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(
        `/api/generadores/${encodeURIComponent(
          generadorContext.id
        )}/fincas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finca: {
              nombre,
              municipioId: municipio?.id,
              cultivoIds: cultivoSel.map((c) => c.id),
              movil,
              email,
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error creando la finca");
        return;
      }
      setCreada(data.finca as FincaOption);
    } catch {
      setError("Error de red creando la finca");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const movilHint = "Celular colombiano: 10 dígitos, empieza por 3";

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {creada
            ? "Finca creada"
            : `Agregar finca a ${generadorContext.nombre}`}
        </h2>
        {!creada && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancelar
          </button>
        )}
      </div>

      {creada ? (
        <div className="text-center py-4">
          <div className="text-6xl mb-3">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            Finca agregada con éxito
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            La finca <strong>{creada.nombre}</strong> quedó registrada en{" "}
            <strong>{generadorContext.nombre}</strong>. Ya puedes generar el
            certificado con esta finca.
          </p>
          <button
            type="button"
            onClick={() => onFincaAdded(creada)}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg text-sm"
          >
            Continuar a generar el certificado
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Generador:{" "}
            <span className="font-medium text-gray-700">
              {generadorContext.nombre}
            </span>
          </p>

          <div>
            <label className={labelCls}>
              Nombre de la finca <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>
              Municipio <span className="text-red-500">*</span>
            </label>
            <MunicipioSearch
              value={municipio}
              onChange={setMunicipio}
              placeholder="Buscar municipio..."
            />
          </div>

          <div>
            <label className={labelCls}>
              Cultivo(s) <span className="text-red-500">*</span>
            </label>
            <p className="text-[11px] text-gray-500 mb-1">
              Puedes seleccionar varios cultivos.
            </p>
            {cultivoSel.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {cultivoSel.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                  >
                    {c.nombre}
                    <button
                      type="button"
                      onClick={() => toggleCultivo(c)}
                      className="text-green-600 hover:text-red-600"
                      aria-label={`Quitar ${c.nombre}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className={inputCls + " mb-1"}
              value={cultivoQ}
              onChange={(e) => setCultivoQ(e.target.value)}
              placeholder="Filtrar cultivos..."
            />
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
              {cultivosFiltrados.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">Sin cultivos</p>
              ) : (
                cultivosFiltrados.slice(0, 80).map((c) => {
                  const sel = cultivoSel.some((x) => x.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCultivo(c)}
                      className={`w-full text-left text-sm px-3 py-1.5 border-b border-gray-100 last:border-b-0 ${
                        sel
                          ? "bg-green-50 text-green-800 font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      {sel ? "✓ " : ""}
                      {c.nombre}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Móvil <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={movil}
                onChange={(e) => setMovil(e.target.value)}
                required
                inputMode="numeric"
                placeholder="3XXXXXXXXX"
              />
              <p className="text-[11px] text-gray-400 mt-1">{movilHint}</p>
            </div>
            <div>
              <label className={labelCls}>Email (opcional)</label>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || cultivoSel.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {enviando ? "Creando finca..." : "Crear finca"}
          </button>
        </form>
      )}
    </div>
  );
}
