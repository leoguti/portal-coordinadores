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

const MunicipioSearch = dynamic(() => import("@/components/MunicipioSearch"), {
  ssr: false,
});

interface Generador {
  id: string;
  nombre: string;
  nit: string;
  tipopersona: string;
  tipo: string;
  direccion: string;
  municipioId: string | null;
  municipioLabel: string | null;
  movil: string;
  email: string;
}
interface Coordinador {
  id: string;
  nombre: string;
}
interface Payload {
  intent: "editar-generador";
  expiraEn: string;
  generador: Generador;
  coordinadores: Coordinador[];
  coordinadorSugerido: { id: string; nombre: string } | null;
}

export default function EditarGeneradorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [movil, setMovil] = useState("");
  const [email, setEmail] = useState("");
  const [coordinadorId, setCoordinadorId] = useState("");
  const [coordinadorBloqueado, setCoordinadorBloqueado] = useState(true);
  const [confirmandoCambioCoord, setConfirmandoCambioCoord] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/m/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "Link inválido");
          return;
        }
        const p = data as Payload;
        setPayload(p);
        setNombre(p.generador.nombre);
        setTipo(p.generador.tipo);
        setDireccion(p.generador.direccion);
        if (p.generador.municipioId && p.generador.municipioLabel) {
          setMunicipio({
            id: p.generador.municipioId,
            mundep: p.generador.municipioLabel,
          });
        }
        setMovil(p.generador.movil);
        setEmail(p.generador.email);
        // Coord sugerido (último cert aprobado de alguna finca del generador).
        const sugerido = p.coordinadorSugerido;
        const sugeridoActivo =
          sugerido && p.coordinadores?.some((c) => c.id === sugerido.id);
        if (sugeridoActivo && sugerido) {
          setCoordinadorId(sugerido.id);
          setCoordinadorBloqueado(true);
        } else {
          setCoordinadorBloqueado(false);
        }
      })
      .catch(() => setLoadError("Error de red"));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!nombre.trim()) {
      setSubmitError("El nombre es obligatorio");
      return;
    }
    if (!coordinadorId) {
      setSubmitError("Selecciona un coordinador que revise el cambio");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          direccion: direccion.trim(),
          municipioId: municipio?.id || null,
          movil: movil.trim(),
          email: email.trim(),
          coordinadorId,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error || "Error enviando cambios");
        return;
      }
      setSubmitOk(data.mensaje || "Cambios enviados");
    } catch {
      setSubmitError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <MagicLinkLayout titulo="Mis datos">
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }
  if (submitOk) {
    return (
      <MagicLinkLayout titulo="Mis datos">
        <SuccessPanel message={submitOk} />
      </MagicLinkLayout>
    );
  }
  if (!payload) {
    return (
      <MagicLinkLayout titulo="Mis datos">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  const esEmpresa = (payload.generador.tipopersona || "")
    .toLowerCase()
    .includes("juridic");
  const titulo = esEmpresa
    ? `Editando datos de la empresa`
    : `Editando mis datos`;
  const subtitulo = esEmpresa
    ? `${payload.generador.nombre} · NIT ${payload.generador.nit}`
    : `${payload.generador.nombre} · CC ${payload.generador.nit}`;

  return (
    <MagicLinkLayout titulo={titulo} subtitulo={subtitulo}>
      <form onSubmit={onSubmit}>
        <FormCard>
          <p className="text-xs text-gray-500 mb-3">
            {esEmpresa
              ? "El NIT y el tipo de persona no se pueden cambiar desde aquí. Si necesitas corregirlos, escríbele a tu coordinador."
              : "Tu cédula y tipo de persona no se pueden cambiar desde aquí. Si necesitas corregirlos, escríbele a tu coordinador."}
          </p>

          <Field label="Nombre / Razón social" required>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            >
              <option value="">— Selecciona —</option>
              <option value="AGRICOLA">Agrícola</option>
              <option value="PECUARIO">Pecuario</option>
              <option value="MIXTO">Mixto</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>

          <Field label="Dirección sede">
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Municipio sede">
            <MunicipioSearch
              value={municipio}
              onChange={setMunicipio}
              magicLinkToken={token}
              placeholder="Busca el municipio…"
            />
          </Field>

          <Field label="Móvil">
            <input
              type="tel"
              inputMode="numeric"
              value={movil}
              onChange={(e) => setMovil(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>
        </FormCard>

        <FormCard>
          <Field label="Coordinador que va a aprobar este cambio" required>
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
                      otro puede retrasar la aprobación de tus cambios.
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
                {payload.coordinadorSugerido && (
                  <button
                    type="button"
                    onClick={() => {
                      const sug = payload.coordinadorSugerido;
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
        </FormCard>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <StickyBottomButton loading={submitting}>Guardar cambios</StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
