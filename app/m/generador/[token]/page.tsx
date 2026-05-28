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
interface Payload {
  intent: "editar-generador";
  expiraEn: string;
  generador: Generador;
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

  return (
    <MagicLinkLayout
      titulo="Mis datos"
      subtitulo={`NIT/CC: ${payload.generador.nit}`}
    >
      <form onSubmit={onSubmit}>
        <FormCard>
          <p className="text-xs text-gray-500 mb-3">
            Tu NIT/cédula y tipo de persona no se pueden cambiar desde aquí. Si
            necesitas corregirlos, escríbele a tu coordinador.
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
