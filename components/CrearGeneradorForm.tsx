"use client";

/**
 * Formulario para crear un generador desde cero (camino "no tan feliz").
 * Captura los datos del generador + UNA finca obligatoria (un generador sin
 * finca no tiene sentido). El backend (/api/generadores/crear) comprueba que
 * el NIT/cédula no exista antes de crear.
 */

import { useEffect, useState } from "react";
import MunicipioSearch from "@/components/MunicipioSearch";
import type {
  GeneradorOption,
  FincaOption,
} from "@/components/GeneradorFincaSelect";
import { esMovilCOValido, validarDocumento } from "@/lib/validacionesCO";

type Mun = { id: string; mundep: string } | null;

const TIPOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"] as const;
const TIPOS_PERSONA = ["Natural", "Juridica"] as const;

export default function CrearGeneradorForm({
  prefillNit,
  onCancel,
  onCreated,
  onExisting,
}: {
  prefillNit?: string;
  onCancel: () => void;
  onCreated: (g: GeneradorOption, f: FincaOption) => void;
  onExisting: (g: GeneradorOption) => void;
}) {
  // Generador
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState(
    prefillNit && /\d/.test(prefillNit) ? prefillNit : ""
  );
  const [tipo, setTipo] = useState<string>("");
  const [tipopersona, setTipopersona] = useState<string>("");
  const [direccionSede, setDireccionSede] = useState("");
  const [genMunicipio, setGenMunicipio] = useState<Mun>(null);
  const [genMovil, setGenMovil] = useState("");
  const [genEmail, setGenEmail] = useState("");

  // Finca
  const [fincaNombre, setFincaNombre] = useState("");
  const [fincaMunicipio, setFincaMunicipio] = useState<Mun>(null);
  const [fincaMovil, setFincaMovil] = useState("");
  const [fincaEmail, setFincaEmail] = useState("");

  // Cultivos
  const [cultivos, setCultivos] = useState<{ id: string; nombre: string }[]>(
    []
  );
  const [cultivoSel, setCultivoSel] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [cultivoQ, setCultivoQ] = useState("");

  // Estado
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<GeneradorOption | null>(null);

  useEffect(() => {
    fetch("/api/cultivos")
      .then((r) => r.json())
      .then((d) => setCultivos(d.cultivos || []))
      .catch(() => setCultivos([]));
  }, []);

  const cultivosFiltrados = cultivoQ.trim()
    ? cultivos.filter((c) =>
        c.nombre.toLowerCase().includes(cultivoQ.trim().toLowerCase())
      )
    : cultivos;

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
    setDuplicado(null);

    // Validación en tiempo de ejecución
    const docErr = validarDocumento(tipopersona, nit);
    if (docErr) {
      setError(docErr);
      return;
    }
    if (!esMovilCOValido(genMovil)) {
      setError(
        "El móvil del generador debe ser un celular colombiano (10 dígitos, empieza por 3)"
      );
      return;
    }
    if (!esMovilCOValido(fincaMovil)) {
      setError(
        "El móvil de la finca debe ser un celular colombiano (10 dígitos, empieza por 3)"
      );
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/generadores/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generador: {
            nombre,
            nit,
            tipo,
            tipopersona,
            direccionSede,
            municipioId: genMunicipio?.id,
            movil: genMovil,
            email: genEmail,
          },
          finca: {
            nombre: fincaNombre,
            municipioId: fincaMunicipio?.id,
            cultivoIds: cultivoSel.map((c) => c.id),
            movil: fincaMovil,
            email: fincaEmail,
          },
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.generador) {
        setDuplicado(data.generador as GeneradorOption);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Error creando el generador");
        return;
      }
      onCreated(data.generador as GeneradorOption, data.finca as FincaOption);
    } catch {
      setError("Error de red creando el generador");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  const docLabel =
    tipopersona === "Natural"
      ? "Cédula"
      : tipopersona === "Juridica"
      ? "NIT"
      : "NIT / Cédula";
  const docPlaceholder =
    tipopersona === "Natural" ? "Ej. 1098765432" : "Ej. 800141506-1";
  const movilHint = "Celular colombiano: 10 dígitos, empieza por 3";

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Crear generador nuevo
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Cancelar
        </button>
      </div>

      {duplicado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900 font-medium mb-1">
            Ya existe un generador con ese NIT/cédula
          </p>
          <p className="text-sm text-amber-800 mb-3">
            <strong>{duplicado.nombre}</strong>
            {duplicado.nit && ` · NIT ${duplicado.nit}`}
          </p>
          <p className="text-xs text-amber-700 mb-3">
            No se crea un duplicado. Puedes usar el generador existente.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onExisting(duplicado)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Usar este generador
            </button>
            <button
              type="button"
              onClick={() => setDuplicado(null)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Revisar datos
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {/* GENERADOR */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Datos del generador
            </p>
            <div>
              <label className={labelCls}>
                Nombre / Razón social <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {docLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  required
                  placeholder={docPlaceholder}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Jurídica → NIT · Natural → cédula
                </p>
              </div>
              <div>
                <label className={labelCls}>
                  Tipo de persona <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls}
                  value={tipopersona}
                  onChange={(e) => setTipopersona(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_PERSONA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Tipo de generador <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Móvil del generador <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={genMovil}
                  onChange={(e) => setGenMovil(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="3001234567"
                />
                <p className="text-[11px] text-gray-400 mt-1">{movilHint}</p>
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Dirección de sede <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={direccionSede}
                onChange={(e) => setDireccionSede(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>
                Municipio del generador{" "}
                <span className="text-red-500">*</span>
              </label>
              <MunicipioSearch
                value={genMunicipio}
                onChange={setGenMunicipio}
                placeholder="Buscar municipio..."
              />
            </div>
            <div>
              <label className={labelCls}>Email (opcional)</label>
              <input
                type="email"
                className={inputCls}
                value={genEmail}
                onChange={(e) => setGenEmail(e.target.value)}
              />
            </div>
          </div>

          {/* FINCA */}
          <div className="space-y-3 border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Finca (obligatoria — un generador debe tener al menos una)
            </p>
            <div>
              <label className={labelCls}>
                Nombre de la finca <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={fincaNombre}
                onChange={(e) => setFincaNombre(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>
                Municipio de la finca <span className="text-red-500">*</span>
              </label>
              <MunicipioSearch
                value={fincaMunicipio}
                onChange={setFincaMunicipio}
                placeholder="Buscar municipio..."
              />
            </div>
            <div>
              <label className={labelCls}>
                Cultivo(s) <span className="text-red-500">*</span>
              </label>
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
                  Móvil finca <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={fincaMovil}
                  onChange={(e) => setFincaMovil(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="3001234567"
                />
                <p className="text-[11px] text-gray-400 mt-1">{movilHint}</p>
              </div>
              <div>
                <label className={labelCls}>Email finca (opcional)</label>
                <input
                  type="email"
                  className={inputCls}
                  value={fincaEmail}
                  onChange={(e) => setFincaEmail(e.target.value)}
                />
              </div>
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
            {enviando
              ? "Creando generador..."
              : "Crear generador y continuar"}
          </button>
        </form>
      )}
    </div>
  );
}
