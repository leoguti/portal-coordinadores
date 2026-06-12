"use client";

import { useEffect, useState, use } from "react";
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

interface Finca {
  id: string;
  nombre: string;
  generadorId: string;
  cultivos: { id: string; nombre: string }[];
  coordinadorSugerido: { id: string; nombre: string } | null;
}
interface FincaCompleta {
  id: string;
  nombre: string;
  municipioLabel: string | null;
  cultivos: { id: string; nombre: string }[];
}
interface Generador {
  id: string;
  nombre: string;
  nit: string;
}
interface Coordinador {
  id: string;
  nombre: string;
}
interface Payload {
  intent: "cert-nuevo";
  expiraEn: string;
  telefonoValidado: string;
  finca: FincaCompleta | null;
  generador: Generador | null;
  fincasDisponibles: Finca[];
  coordinadores: Coordinador[];
  coordinadorSugerido: { id: string; nombre: string } | null;
}

interface MunicipioVal {
  id: string;
  mundep: string;
}

export default function CertNuevoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estado del formulario
  const [fincaId, setFincaId] = useState("");
  const [coordinadorId, setCoordinadorId] = useState("");
  const [coordinadorBloqueado, setCoordinadorBloqueado] = useState(true);
  const [confirmandoCambioCoord, setConfirmandoCambioCoord] = useState(false);
  const [municipioDevolucion, setMunicipioDevolucion] = useState<MunicipioVal | null>(null);
  const [lugar, setLugar] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [rigidos, setRigidos] = useState("");
  const [flexibles, setFlexibles] = useState("");
  const [metalicos, setMetalicos] = useState("");
  const [embalaje, setEmbalaje] = useState("");
  const [triplelavado, setTriplelavado] = useState<"" | "SI" | "NO" | "NO APLICA">("");
  const [observaciones, setObservaciones] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  // Si cambia la finca, recalcular el coord sugerido para esa finca.
  useEffect(() => {
    if (!payload || !fincaId) return;
    const finca = payload.fincasDisponibles.find((f) => f.id === fincaId);
    const sugerido = finca?.coordinadorSugerido || null;
    const sugeridoActivo =
      sugerido && payload.coordinadores.some((c) => c.id === sugerido.id);
    if (sugeridoActivo && sugerido) {
      setCoordinadorId(sugerido.id);
      setCoordinadorBloqueado(true);
      setConfirmandoCambioCoord(false);
    } else {
      // Sin sugerido para esta finca: abrir selector libre.
      setCoordinadorId("");
      setCoordinadorBloqueado(false);
      setConfirmandoCambioCoord(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId]);

  // Cargar datos del magic-link
  useEffect(() => {
    fetch(`/api/m/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "Link inválido");
          return;
        }
        setPayload(data as Payload);
        const p = data as Payload;
        let fid = "";
        if (p.fincasDisponibles?.length === 1) fid = p.fincasDisponibles[0].id;
        else if (p.finca) fid = p.finca.id;
        if (fid) setFincaId(fid);
        // Pre-llenar coord sugerido si la finca pre-seleccionada lo tiene.
        const fincaInicial = p.fincasDisponibles?.find((f) => f.id === fid);
        const sugerido = fincaInicial?.coordinadorSugerido || p.coordinadorSugerido;
        // El sugerido tiene que estar también en la lista de coordinadores
        // activos; si no, abrimos el selector libre.
        const sugeridoActivo =
          sugerido && p.coordinadores.some((c) => c.id === sugerido.id);
        if (sugeridoActivo && sugerido) {
          setCoordinadorId(sugerido.id);
          setCoordinadorBloqueado(true);
        } else {
          setCoordinadorBloqueado(false);
        }
      })
      .catch(() => setLoadError("Error de red"));
  }, [token]);

  const totalKg =
    (Number(rigidos) || 0) +
    (Number(flexibles) || 0) +
    (Number(metalicos) || 0) +
    (Number(embalaje) || 0);

  const { min: fechaMinima, max: fechaMaxima } = rangoFechaDevolucion();

  function validar(): string | null {
    if (!fincaId) return "Selecciona una finca";
    if (!coordinadorId) return "Selecciona tu coordinador";
    if (!municipioDevolucion) return "Selecciona el municipio de devolución";
    if (!lugar.trim()) return "Indica el lugar de devolución";
    if (!fecha) return "Indica la fecha de devolución";
    if (totalKg <= 0) return "El total de kilos debe ser mayor a 0";
    if (!triplelavado) return "Indica si hiciste triple lavado";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const err = validar();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fincaId,
          coordinadorId,
          municipioDevolucionId: municipioDevolucion!.id,
          rigidos: Number(rigidos) || 0,
          flexibles: Number(flexibles) || 0,
          metalicos: Number(metalicos) || 0,
          embalaje: Number(embalaje) || 0,
          triplelavado,
          lugardevolucion: lugar.trim(),
          fechadevolucion: fecha,
          observaciones: observaciones.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error || "Error enviando la solicitud");
        return;
      }
      setSubmitOk(data.mensaje || "Solicitud enviada");
    } catch {
      setSubmitError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <MagicLinkLayout titulo="Certificado">
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }

  if (submitOk) {
    return (
      <MagicLinkLayout titulo="Certificado">
        <SuccessPanel message={submitOk} />
      </MagicLinkLayout>
    );
  }

  if (!payload) {
    return (
      <MagicLinkLayout titulo="Certificado">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  const fincaSeleccionada = payload.fincasDisponibles.find((f) => f.id === fincaId);
  const hayVariasFincas = payload.fincasDisponibles.length > 1;

  return (
    <MagicLinkLayout
      titulo="Nuevo certificado"
      subtitulo={payload.generador?.nombre || ""}
    >
      <form onSubmit={onSubmit}>
        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">Datos generales</h2>

          {hayVariasFincas ? (
            <Field label="Finca" required>
              <select
                value={fincaId}
                onChange={(e) => setFincaId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              >
                <option value="">— Selecciona una finca —</option>
                {payload.fincasDisponibles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Field>
          ) : fincaSeleccionada ? (
            <div className="text-sm text-gray-600 mb-3">
              Finca: <span className="font-medium text-gray-900">{fincaSeleccionada.nombre}</span>
            </div>
          ) : null}

          {fincaSeleccionada && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-emerald-700 font-medium mb-1">
                🌱 Cultivos registrados en la finca
              </p>
              <p className="text-sm text-emerald-900 font-medium">
                {fincaSeleccionada.cultivos.length > 0
                  ? fincaSeleccionada.cultivos.map((c) => c.nombre).join(", ")
                  : "Aún no tienes cultivos registrados"}
              </p>
              <p className="text-xs text-emerald-700 mt-2">
                ¿Necesitas cambiar o agregar cultivos? Vuelve al bot y elige{" "}
                <strong>&quot;Actualizar datos de la finca&quot;</strong>.
                Mientras tu coordinador no apruebe los cambios, no podrás
                generar el certificado.
              </p>
            </div>
          )}

          <Field label="Coordinador que te atiende" required>
            {coordinadorBloqueado && coordinadorId ? (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span className="text-emerald-900 font-medium">
                    {payload.coordinadores.find((c) => c.id === coordinadorId)
                      ?.nombre || "—"}
                  </span>
                </div>
                {!confirmandoCambioCoord ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoCambioCoord(true)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline mt-1.5"
                  >
                    ¿Te atiende otro coordinador? Cambiar
                  </button>
                ) : (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <p className="text-xs text-amber-900 mb-2">
                      ¿Seguro que el coordinador que te atiende cambió? Elegir
                      otro puede generar errores en la entrega del PDF.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCoordinadorBloqueado(false);
                          setConfirmandoCambioCoord(false);
                        }}
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md font-medium"
                      >
                        Sí, cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoCambioCoord(false)}
                        className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md font-medium"
                      >
                        Mantener
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <select
                  value={coordinadorId}
                  onChange={(e) => setCoordinadorId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                >
                  <option value="">— Selecciona tu coordinador —</option>
                  {payload.coordinadores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {payload.fincasDisponibles.find((f) => f.id === fincaId)
                  ?.coordinadorSugerido && (
                  <button
                    type="button"
                    onClick={() => {
                      const sug = payload.fincasDisponibles.find(
                        (f) => f.id === fincaId
                      )?.coordinadorSugerido;
                      if (sug) {
                        setCoordinadorId(sug.id);
                        setCoordinadorBloqueado(true);
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline mt-1.5"
                  >
                    Volver al coordinador sugerido
                  </button>
                )}
              </>
            )}
          </Field>

          <Field label="Fecha de devolución" required hint="No puede ser futura ni mayor a 120 días">
            <input
              type="date"
              value={fecha}
              min={fechaMinima}
              max={fechaMaxima}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>
        </FormCard>

        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">Lugar de devolución</h2>

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
        </FormCard>

        <FormCard>
          <h2 className="font-medium text-gray-900 mb-1">Kilos por tipo de envase</h2>
          <p className="text-xs text-gray-500 mb-3">Suma total: <strong>{totalKg} kg</strong></p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Rígidos">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={rigidos}
                onChange={(e) => setRigidos(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              />
            </Field>
            <Field label="Flexibles">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={flexibles}
                onChange={(e) => setFlexibles(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              />
            </Field>
            <Field label="Metálicos">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={metalicos}
                onChange={(e) => setMetalicos(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              />
            </Field>
            <Field label="Embalaje">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={embalaje}
                onChange={(e) => setEmbalaje(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
              />
            </Field>
          </div>
        </FormCard>

        <FormCard>
          <Field label="¿Hiciste triple lavado?" required>
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

          <Field label="Observaciones (opcional)">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Si tienes algún comentario para tu coordinador…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>
        </FormCard>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <StickyBottomButton loading={submitting}>
          Enviar para aprobación
        </StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
