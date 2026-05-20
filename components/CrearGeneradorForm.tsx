"use client";

/**
 * Formulario de generador + finca. Modos:
 *  - "crear": crea generador y su primera finca (POST /api/generadores/crear).
 *  - "editar": actualiza generador y la finca seleccionada
 *    (PATCH /api/generadores/[id]/editar). Pre-llena con `initial`. Es el
 *    mismo formulario que usan los coordinadores para COMPLETAR datos
 *    faltantes en generadores antiguos (data dirty), aplicando las reglas
 *    de la interfaz "revisar fincas".
 */

import { useEffect, useState } from "react";
import MunicipioSearch from "@/components/MunicipioSearch";
import type {
  GeneradorOption,
  FincaOption,
} from "@/components/GeneradorFincaSelect";
import { esMovilCOValido, validarDocumento } from "@/lib/validacionesCO";

type Mun = { id: string; mundep: string } | null;
type Modo = "crear" | "editar";

const TIPOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"] as const;
const TIPOS_PERSONA = ["Natural", "Juridica"] as const;

export interface GeneradorFincaInitial {
  generador: {
    id: string;
    nombre: string;
    nit: string;
    tipo: string;
    tipopersona: string;
    direccion_sede: string;
    municipio: { id: string; mundep: string } | null;
    movil: string;
    email: string;
  };
  finca: {
    id: string;
    nombre: string;
    municipio: { id: string; mundep: string } | null;
    cultivos: { id: string; nombre: string }[];
    movil: string;
    email: string;
  };
}

export default function CrearGeneradorForm({
  mode = "crear",
  initial,
  prefillNit,
  onCancel,
  onCreated,
  onExisting,
  onEdited,
}: {
  mode?: Modo;
  initial?: GeneradorFincaInitial;
  prefillNit?: string;
  onCancel: () => void;
  onCreated?: (g: GeneradorOption, f: FincaOption) => void;
  onExisting?: (g: GeneradorOption) => void;
  onEdited?: (g: GeneradorOption, f: FincaOption) => void;
}) {
  const isEditar = mode === "editar";

  // Generador
  const [nombre, setNombre] = useState(initial?.generador.nombre ?? "");
  const [nit, setNit] = useState(
    initial?.generador.nit ??
      (prefillNit && /\d/.test(prefillNit) ? prefillNit : "")
  );
  const [tipo, setTipo] = useState<string>(initial?.generador.tipo ?? "");
  const [tipopersona, setTipopersona] = useState<string>(
    initial?.generador.tipopersona ?? ""
  );
  const [direccionSede, setDireccionSede] = useState(
    initial?.generador.direccion_sede ?? ""
  );
  const [genMunicipio, setGenMunicipio] = useState<Mun>(
    initial?.generador.municipio ?? null
  );
  const [genMovil, setGenMovil] = useState(initial?.generador.movil ?? "");
  const [genEmail, setGenEmail] = useState(initial?.generador.email ?? "");

  // Finca
  const [fincaNombre, setFincaNombre] = useState(initial?.finca.nombre ?? "");
  const [fincaMunicipio, setFincaMunicipio] = useState<Mun>(
    initial?.finca.municipio ?? null
  );
  const [fincaMovil, setFincaMovil] = useState(initial?.finca.movil ?? "");
  const [fincaEmail, setFincaEmail] = useState(initial?.finca.email ?? "");

  // Cultivos
  const [cultivos, setCultivos] = useState<{ id: string; nombre: string }[]>(
    []
  );
  const [cultivoSel, setCultivoSel] = useState<
    { id: string; nombre: string }[]
  >(initial?.finca.cultivos ?? []);
  const [cultivoQ, setCultivoQ] = useState("");

  // Estado
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<GeneradorOption | null>(null);
  // Errores por campo. Se llenan al hacer submit (no en vivo) para no marcar
  // en rojo apenas el usuario abre el form. Una vez se intentó submit, se
  // re-validan en cada cambio para que el rojo desaparezca al corregir.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  // Tras crear con éxito, mostramos una pantalla de confirmación explícita
  // (los coordinadores necesitan un aviso contundente antes de continuar).
  const [creado, setCreado] = useState<{
    generador: GeneradorOption;
    finca: FincaOption;
  } | null>(null);

  useEffect(() => {
    fetch("/api/cultivos")
      .then((r) => r.json())
      .then((d) => setCultivos(d.cultivos || []))
      .catch(() => setCultivos([]));
  }, []);

  // Algunos registros de CULTIVOS pueden venir sin nombre: descartarlos y
  // blindar el filtro (un nombre undefined rompía toda la página).
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

  function validarFormulario(): Record<string, string> {
    const e: Record<string, string> = {};

    // Generador
    if (!nombre.trim()) e.nombre = "Falta el nombre / razón social";
    if (!tipopersona) e.tipopersona = "Selecciona Natural o Jurídica";
    const docErr = validarDocumento(tipopersona, nit);
    if (docErr) e.nit = docErr;
    if (!tipo) e.tipo = "Selecciona el tipo de generador";
    if (!genMovil.trim()) e.genMovil = "Falta el móvil del generador";
    else if (!esMovilCOValido(genMovil))
      e.genMovil = "Celular colombiano: 10 dígitos, empieza por 3";
    if (!direccionSede.trim())
      e.direccionSede = "Falta la dirección de sede";
    if (!genMunicipio) e.genMunicipio = "Selecciona el municipio del generador";

    // Finca
    if (!fincaNombre.trim()) e.fincaNombre = "Falta el nombre de la finca";
    if (!fincaMunicipio)
      e.fincaMunicipio = "Selecciona el municipio de la finca";
    if (cultivoSel.length === 0)
      e.cultivos =
        "Selecciona al menos un cultivo. Escribe para filtrar y HAZ CLICK en el cultivo de la lista.";
    if (!fincaMovil.trim()) e.fincaMovil = "Falta el móvil de la finca";
    else if (!esMovilCOValido(fincaMovil))
      e.fincaMovil = "Celular colombiano: 10 dígitos, empieza por 3";

    return e;
  }

  // Re-validar en vivo solo después del primer intento de submit, para que el
  // rojo desaparezca a medida que el usuario corrige.
  useEffect(() => {
    if (!submitted) return;
    setErrors(validarFormulario());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    submitted,
    nombre,
    nit,
    tipo,
    tipopersona,
    direccionSede,
    genMunicipio,
    genMovil,
    fincaNombre,
    fincaMunicipio,
    fincaMovil,
    cultivoSel,
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDuplicado(null);

    const errs = validarFormulario();
    setErrors(errs);
    setSubmitted(true);
    if (Object.keys(errs).length > 0) {
      // Hacer scroll al primer campo con error (UX)
      const firstKey = Object.keys(errs)[0];
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
      return;
    }

    setEnviando(true);
    try {
      const url = isEditar
        ? `/api/generadores/${initial!.generador.id}/editar`
        : "/api/generadores/crear";
      const method = isEditar ? "PATCH" : "POST";
      const fincaBody: Record<string, unknown> = {
        nombre: fincaNombre,
        municipioId: fincaMunicipio?.id,
        cultivoIds: cultivoSel.map((c) => c.id),
        movil: fincaMovil,
        email: fincaEmail,
      };
      if (isEditar) fincaBody.id = initial!.finca.id;

      const res = await fetch(url, {
        method,
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
          finca: fincaBody,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.generador) {
        setDuplicado(data.generador as GeneradorOption);
        return;
      }
      if (!res.ok) {
        setError(
          data.error || (isEditar ? "Error guardando" : "Error creando")
        );
        return;
      }
      setCreado({
        generador: data.generador as GeneradorOption,
        finca: data.finca as FincaOption,
      });
    } catch {
      setError(
        isEditar
          ? "Error de red guardando cambios"
          : "Error de red creando el generador"
      );
    } finally {
      setEnviando(false);
    }
  }

  const baseInputCls =
    "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2";
  const okBorder = "border-gray-300 focus:ring-green-500";
  const errBorder = "border-red-400 bg-red-50 focus:ring-red-400";
  const inputClsFor = (key: string) =>
    `${baseInputCls} ${errors[key] ? errBorder : okBorder}`;
  // Compat con código previo que usa `inputCls` (sin estado de error).
  const inputCls = `${baseInputCls} ${okBorder}`;
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const errMsg = (key: string) =>
    errors[key] ? (
      <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
        <span className="font-bold">⚠</span>
        <span>{errors[key]}</span>
      </p>
    ) : null;

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
          {creado
            ? isEditar
              ? "Datos actualizados"
              : "Generador creado"
            : isEditar
            ? "Editar generador y finca"
            : "Crear generador nuevo"}
        </h2>
        {!creado && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancelar
          </button>
        )}
      </div>

      {creado ? (
        <div className="text-center py-4">
          <div className="text-6xl mb-3">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            {isEditar
              ? "Datos del generador y la finca actualizados"
              : "Generador y finca creados con éxito"}
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            {isEditar
              ? "Los cambios quedaron guardados. Ya puedes continuar al certificado."
              : "Quedaron registrados en el sistema. Ya puedes generar el certificado."}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-md text-left px-4 py-3 mb-5">
            <dl className="grid grid-cols-1 gap-y-1 text-sm text-gray-700">
              <div>
                <dt className="inline text-gray-500">Generador: </dt>
                <dd className="inline font-medium">
                  {creado.generador.nombre}
                </dd>
              </div>
              <div>
                <dt className="inline text-gray-500">{docLabel}: </dt>
                <dd className="inline font-medium">{creado.generador.nit}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Finca: </dt>
                <dd className="inline font-medium">{creado.finca.nombre}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Cultivo(s): </dt>
                <dd className="inline font-medium">
                  {cultivoSel.map((c) => c.nombre).join(", ") || "—"}
                </dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isEditar) onEdited?.(creado.generador, creado.finca);
              else onCreated?.(creado.generador, creado.finca);
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg text-sm"
          >
            Continuar a generar el certificado
          </button>
        </div>
      ) : duplicado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900 font-medium mb-1">
            {isEditar
              ? "Otro generador ya tiene ese NIT/cédula"
              : "Ya existe un generador con ese NIT/cédula"}
          </p>
          <p className="text-sm text-amber-800 mb-3">
            <strong>{duplicado.nombre}</strong>
            {duplicado.nit && ` · NIT ${duplicado.nit}`}
          </p>
          <p className="text-xs text-amber-700 mb-3">
            {isEditar
              ? "No se puede guardar con un NIT/cédula que ya tiene otro generador. Corrige el dato y vuelve a intentar."
              : "No se crea un duplicado. Puedes usar el generador existente."}
          </p>
          <div className="flex gap-2">
            {!isEditar && (
              <button
                type="button"
                onClick={() => onExisting?.(duplicado)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                Usar este generador
              </button>
            )}
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
            <div data-field="nombre">
              <label className={labelCls}>
                Nombre / Razón social <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClsFor("nombre")}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              {errMsg("nombre")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div data-field="nit">
                <label className={labelCls}>
                  {docLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClsFor("nit")}
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  placeholder={docPlaceholder}
                />
                {errMsg("nit") || (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Jurídica → NIT · Natural → cédula
                  </p>
                )}
              </div>
              <div data-field="tipopersona">
                <label className={labelCls}>
                  Tipo de persona <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputClsFor("tipopersona")}
                  value={tipopersona}
                  onChange={(e) => setTipopersona(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_PERSONA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errMsg("tipopersona")}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div data-field="tipo">
                <label className={labelCls}>
                  Tipo de generador <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputClsFor("tipo")}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errMsg("tipo")}
              </div>
              <div data-field="genMovil">
                <label className={labelCls}>
                  Móvil del generador <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClsFor("genMovil")}
                  value={genMovil}
                  onChange={(e) => setGenMovil(e.target.value)}
                  inputMode="numeric"
                  placeholder="3XXXXXXXXX"
                />
                {errMsg("genMovil") || (
                  <p className="text-[11px] text-gray-400 mt-1">{movilHint}</p>
                )}
              </div>
            </div>
            <div data-field="direccionSede">
              <label className={labelCls}>
                Dirección de sede <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClsFor("direccionSede")}
                value={direccionSede}
                onChange={(e) => setDireccionSede(e.target.value)}
              />
              {errMsg("direccionSede")}
            </div>
            <div data-field="genMunicipio">
              <label className={labelCls}>
                Municipio del generador{" "}
                <span className="text-red-500">*</span>
              </label>
              <div
                className={
                  errors.genMunicipio
                    ? "rounded-lg ring-2 ring-red-400 ring-offset-1"
                    : ""
                }
              >
                <MunicipioSearch
                  value={genMunicipio}
                  onChange={setGenMunicipio}
                  placeholder="Buscar municipio..."
                />
              </div>
              {errMsg("genMunicipio")}
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
            <div data-field="fincaNombre">
              <label className={labelCls}>
                Nombre de la finca <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClsFor("fincaNombre")}
                value={fincaNombre}
                onChange={(e) => setFincaNombre(e.target.value)}
              />
              {errMsg("fincaNombre")}
            </div>
            <div data-field="fincaMunicipio">
              <label className={labelCls}>
                Municipio de la finca <span className="text-red-500">*</span>
              </label>
              <div
                className={
                  errors.fincaMunicipio
                    ? "rounded-lg ring-2 ring-red-400 ring-offset-1"
                    : ""
                }
              >
                <MunicipioSearch
                  value={fincaMunicipio}
                  onChange={setFincaMunicipio}
                  placeholder="Buscar municipio..."
                />
              </div>
              {errMsg("fincaMunicipio")}
            </div>
            <div data-field="cultivos">
              <label className={labelCls}>
                Cultivo(s) <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-gray-500 mb-1">
                Escribe para filtrar y <strong>haz click</strong> en el
                cultivo de la lista para seleccionarlo. Puedes elegir varios.
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
                className={
                  `${baseInputCls} mb-1 ` +
                  (errors.cultivos ? errBorder : okBorder)
                }
                value={cultivoQ}
                onChange={(e) => setCultivoQ(e.target.value)}
                placeholder="Filtrar cultivos..."
              />
              <div
                className={
                  "max-h-40 overflow-y-auto border rounded-md " +
                  (errors.cultivos ? "border-red-400" : "border-gray-200")
                }
              >
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
              <div data-field="fincaMovil">
                <label className={labelCls}>
                  Móvil finca <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClsFor("fincaMovil")}
                  value={fincaMovil}
                  onChange={(e) => setFincaMovil(e.target.value)}
                  inputMode="numeric"
                  placeholder="3XXXXXXXXX"
                />
                {errMsg("fincaMovil") || (
                  <p className="text-[11px] text-gray-400 mt-1">{movilHint}</p>
                )}
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

          {submitted && Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-800">
              <p className="font-semibold mb-1">
                Faltan o están incorrectos {Object.keys(errors).length} campo(s):
              </p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {Object.values(errors).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              <p className="text-xs mt-2 text-red-700">
                Revisa los campos marcados en rojo arriba.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {enviando
              ? isEditar
                ? "Guardando cambios..."
                : "Creando generador..."
              : isEditar
              ? "Guardar cambios"
              : "Crear generador y continuar"}
          </button>
        </form>
      )}
    </div>
  );
}
