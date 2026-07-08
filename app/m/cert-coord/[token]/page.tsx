"use client";

import { parseKg, roundKg } from "@/lib/kilos";
/**
 * Certificado generado por un COORDINADOR vía magic-link de WhatsApp.
 *
 * A diferencia de /m/cert (agricultor), aquí el coordinador puede buscar a
 * CUALQUIER agricultor por cédula/NIT o nombre, elegir la finca y generar el
 * certificado, que sale aprobado de una vez con PDF (paridad con el portal).
 */

import { useEffect, useRef, useState, use } from "react";
import dynamic from "next/dynamic";
import MagicLinkLayout, {
  FormCard,
  Field,
  StickyBottomButton,
  ErrorPanel,
  SuccessPanel,
  LoadingSpinner,
} from "@/components/MagicLinkLayout";
import { rangoFechaDevolucion } from "@/lib/certificadosReglas";

const MunicipioSearch = dynamic(() => import("@/components/MunicipioSearch"), {
  ssr: false,
});

interface Payload {
  intent: "cert-coordinador";
  expiraEn: string;
  coordinador: { id: string; nombre: string };
}

interface GeneradorResult {
  id: string;
  nombre: string;
  nit: string;
  tipopersona: string;
  numFincas: number;
}

interface FincaResult {
  id: string;
  nombre: string;
  estado: string;
  cultivos: string[];
}

interface CertPreview {
  nombregenerador: string;
  cedulagenerador: string;
  tipogenerador: string;
  direcciongenerador: string;
  municipiogenerador: string;
  cultivogenerador: string;
  movilgenerador: string;
  emailgenerador: string;
  fincaNombre: string;
}

export default function CertCoordinadorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Paso 1: búsqueda de generador
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<GeneradorResult[]>([]);
  const [generador, setGenerador] = useState<GeneradorResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paso 2: finca
  const [fincas, setFincas] = useState<FincaResult[] | null>(null);
  const [fincaId, setFincaId] = useState("");
  // Preview de los datos que saldrán en el certificado (solo lectura).
  const [preview, setPreview] = useState<CertPreview | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  // Paso 3: datos del cert
  const [rigidos, setRigidos] = useState("");
  const [flexibles, setFlexibles] = useState("");
  const [metalicos, setMetalicos] = useState("");
  const [embalaje, setEmbalaje] = useState("");
  const [triplelavado, setTriplelavado] = useState("");
  const [lugar, setLugar] = useState("");
  const [municipioDevolucion, setMunicipioDevolucion] = useState<{
    id: string;
    mundep: string;
  } | null>(null);
  const [fecha, setFecha] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const { min: fechaMinima, max: fechaMaxima } = rangoFechaDevolucion();

  useEffect(() => {
    fetch(`/api/m/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "Link inválido");
          return;
        }
        setPayload(data as Payload);
      })
      .catch(() => setLoadError("Error de red"));
  }, [token]);

  // Búsqueda con debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2 || generador) {
      setResultados([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(
          `/api/m/${token}/buscar-generador?q=${encodeURIComponent(q)}`
        );
        const data = await r.json();
        setResultados(r.ok ? data.results || [] : []);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, generador]);

  // Cargar el preview de los datos del certificado cuando se elige la finca.
  useEffect(() => {
    if (!fincaId) {
      setPreview(null);
      return;
    }
    let cancelado = false;
    setCargandoPreview(true);
    setPreview(null);
    fetch(`/api/m/${token}/buscar-generador?finca=${encodeURIComponent(fincaId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setPreview(data.preview || null);
      })
      .catch(() => {
        if (!cancelado) setPreview(null);
      })
      .finally(() => {
        if (!cancelado) setCargandoPreview(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fincaId, token]);

  async function seleccionarGenerador(g: GeneradorResult) {
    setGenerador(g);
    setResultados([]);
    setFincas(null);
    setFincaId("");
    setPreview(null);
    try {
      const r = await fetch(
        `/api/m/${token}/buscar-generador?generador=${encodeURIComponent(g.id)}`
      );
      const data = await r.json();
      const lista: FincaResult[] = r.ok ? data.fincas || [] : [];
      setFincas(lista);
      if (lista.length === 1) setFincaId(lista[0].id);
    } catch {
      setFincas([]);
    }
  }

  function limpiarGenerador() {
    setGenerador(null);
    setFincas(null);
    setFincaId("");
    setPreview(null);
    setQuery("");
  }

  const totalKg =
    parseKg(rigidos) +
    parseKg(flexibles) +
    parseKg(metalicos) +
    parseKg(embalaje);

  function validar(): string | null {
    if (!generador) return "Busca y selecciona al agricultor";
    if (!fincaId) return "Selecciona la finca";
    if (totalKg <= 0) return "El total de kilos debe ser mayor a 0";
    if (!triplelavado) return "Indica si se hizo triple lavado";
    if (!municipioDevolucion) return "Selecciona el municipio de devolución";
    if (!lugar.trim()) return "Indica el lugar de devolución";
    if (!fecha) return "Selecciona la fecha de recolección";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fincaId,
          municipioDevolucionId: municipioDevolucion!.id,
          rigidos: parseKg(rigidos),
          flexibles: parseKg(flexibles),
          metalicos: parseKg(metalicos),
          embalaje: parseKg(embalaje),
          triplelavado,
          lugardevolucion: lugar.trim(),
          fechadevolucion: fecha,
          observaciones: observaciones.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error || "Error generando el certificado");
        return;
      }
      setSubmitOk(
        data.mensaje || "Certificado generado. Te llega el PDF por WhatsApp."
      );
    } catch {
      setSubmitError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <MagicLinkLayout titulo="Generar certificado">
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }
  if (submitOk) {
    return (
      <MagicLinkLayout titulo="Generar certificado">
        <SuccessPanel message={submitOk} />
      </MagicLinkLayout>
    );
  }
  if (!payload) {
    return (
      <MagicLinkLayout titulo="Generar certificado">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  const esJuridicaPreview = (generador?.tipopersona || "")
    .toLowerCase()
    .includes("juridic");

  return (
    <MagicLinkLayout
      titulo="Generar certificado"
      subtitulo={`Coordinador: ${payload.coordinador.nombre}`}
    >
      <form onSubmit={onSubmit}>
        {/* ── Paso 1: agricultor ── */}
        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">1. Agricultor</h2>
          {generador ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-emerald-900 font-medium">
                    {generador.nombre}
                  </p>
                  <p className="text-xs text-emerald-700">
                    {generador.tipopersona?.toLowerCase().includes("juridic")
                      ? "NIT"
                      : "Cédula"}
                    : {generador.nit || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={limpiarGenerador}
                  className="text-xs text-gray-500 underline shrink-0"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <Field label="Busca por cédula, NIT o nombre" required>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. 1234567890 o Juan Pérez"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                autoFocus
              />
              {buscando && (
                <p className="text-xs text-gray-400 mt-1.5">Buscando…</p>
              )}
              {resultados.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                  {resultados.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => seleccionarGenerador(g)}
                      className="w-full text-left px-3 py-2.5 bg-white hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {g.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        {g.tipopersona?.toLowerCase().includes("juridic")
                          ? "NIT"
                          : "CC"}{" "}
                        {g.nit || "—"} · {g.numFincas}{" "}
                        {g.numFincas === 1 ? "finca" : "fincas"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {!buscando &&
                query.trim().length >= 2 &&
                resultados.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Sin resultados. Si el agricultor no existe, créalo primero
                    desde el portal.
                  </p>
                )}
            </Field>
          )}

          {/* ── Paso 2: finca ── */}
          {generador && fincas && (
            <div className="mt-3">
              <Field label="Finca" required>
                {fincas.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    Este agricultor no tiene fincas registradas. Regístrale una
                    desde el portal antes de generar el certificado.
                  </p>
                ) : (
                  <select
                    value={fincaId}
                    onChange={(e) => setFincaId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                  >
                    <option value="">— Selecciona la finca —</option>
                    {fincas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                        {f.estado && f.estado !== "aprobado"
                          ? ` (${f.estado})`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {/* Preview de los datos que se imprimirán en el certificado. */}
              {fincaId && cargandoPreview && (
                <p className="text-xs text-gray-400 mt-2">
                  Cargando datos del certificado…
                </p>
              )}
              {preview && (
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">
                      📄 Datos que aparecerán en el certificado
                    </p>
                  </div>
                  <dl className="divide-y divide-gray-100">
                    {(
                      [
                        [esJuridicaPreview ? "Razón social" : "Nombre", preview.nombregenerador],
                        [esJuridicaPreview ? "NIT" : "Cédula", preview.cedulagenerador],
                        ["Finca", preview.fincaNombre],
                        ["Dirección", preview.direcciongenerador],
                        ["Municipio", preview.municipiogenerador],
                        ["Cultivos", preview.cultivogenerador],
                        ["Móvil", preview.movilgenerador],
                        ["Email", preview.emailgenerador],
                      ] as const
                    ).map(([label, valor]) => (
                      <div
                        key={label}
                        className="flex gap-2 px-3 py-1.5 text-sm"
                      >
                        <dt className="text-gray-500 w-24 shrink-0">{label}</dt>
                        <dd className="text-gray-900 break-words min-w-0">
                          {valor || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="bg-amber-50 border-t border-amber-200 px-3 py-2">
                    <p className="text-xs text-amber-800">
                      ✏️ ¿Algún dato incorrecto? Por ahora estos datos solo se
                      pueden corregir desde el <strong>portal en un
                      computador</strong> (portal.campolimpio.org), no desde
                      aquí.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </FormCard>

        {/* ── Paso 3: datos del certificado ── */}
        <FormCard>
          <h2 className="font-medium text-gray-900 mb-1">
            2. Kilos por tipo de envase
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Suma total: <strong>{roundKg(totalKg)} kg</strong>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["Rígidos", rigidos, setRigidos],
                ["Flexibles", flexibles, setFlexibles],
                ["Metálicos", metalicos, setMetalicos],
                ["Embalaje", embalaje, setEmbalaje],
              ] as const
            ).map(([label, value, setter]) => (
              <Field key={label} label={label}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
            ))}
          </div>

          <Field label="¿Se hizo triple lavado?" required>
            <div className="grid grid-cols-3 gap-2">
              {(["SI", "NO", "NO APLICA"] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setTriplelavado(v)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    triplelavado === v
                      ? "bg-[#00d084] text-white border-[#00d084]"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {v === "NO APLICA" ? "No aplica" : v === "SI" ? "Sí" : "No"}
                </button>
              ))}
            </div>
          </Field>
        </FormCard>

        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">3. Devolución</h2>

          <Field label="Municipio" required>
            <MunicipioSearch
              value={municipioDevolucion}
              onChange={setMunicipioDevolucion}
              magicLinkToken={token}
              placeholder="Busca el municipio…"
            />
          </Field>

          <Field label="Bodega o lugar exacto" required>
            <input
              type="text"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ej. Bodega Municipal"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field
            label="Fecha de recolección"
            required
            hint="Debe ser hoy o una fecha pasada, con máximo 5 meses de antigüedad"
          >
            <input
              type="date"
              value={fecha}
              min={fechaMinima}
              max={fechaMaxima}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Observaciones (opcional)">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>
        </FormCard>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <p className="text-blue-800 text-xs">
            ℹ️ El certificado sale <strong>aprobado de una vez</strong> a tu
            nombre — no pasa por bandeja de revisión. Te llega el PDF por
            WhatsApp.
          </p>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <StickyBottomButton loading={submitting}>
          Generar certificado
        </StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
