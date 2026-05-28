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
import CultivosMultiSelect from "@/components/CultivosMultiSelect";

const MunicipioSearch = dynamic(() => import("@/components/MunicipioSearch"), {
  ssr: false,
});

interface Cultivo {
  id: string;
  nombre: string;
}
interface Payload {
  intent: "crear-finca";
  expiraEn: string;
  telefonoValidado: string;
  generador: { id: string; nombre: string };
}

export default function NuevaFincaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
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
        setMovil(p.telefonoValidado || "");
      })
      .catch(() => setLoadError("Error de red"));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!nombre.trim()) return setSubmitError("Ponle un nombre a tu finca");
    if (!municipio) return setSubmitError("Selecciona el municipio");
    setSubmitting(true);
    try {
      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          municipioId: municipio.id,
          cultivosIds: cultivos.map((c) => c.id),
          movil: movil.trim(),
          email: email.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error || "Error enviando solicitud");
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
      <MagicLinkLayout titulo="Nueva finca">
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }
  if (submitOk) {
    return (
      <MagicLinkLayout titulo="Nueva finca">
        <SuccessPanel message={submitOk} />
      </MagicLinkLayout>
    );
  }
  if (!payload) {
    return (
      <MagicLinkLayout titulo="Nueva finca">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  return (
    <MagicLinkLayout
      titulo="Registrar nueva finca"
      subtitulo={payload.generador.nombre}
    >
      <form onSubmit={onSubmit}>
        <FormCard>
          <p className="text-xs text-gray-500 mb-3">
            Esta finca quedará vinculada a {payload.generador.nombre}. Tu
            coordinador la aprobará antes de que puedas generar certificados
            para ella.
          </p>

          <Field label="Nombre de la finca" required>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Finca La Esperanza"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Municipio" required>
            <MunicipioSearch
              value={municipio}
              onChange={setMunicipio}
              magicLinkToken={token}
              placeholder="Busca el municipio…"
            />
          </Field>

          <Field label="Cultivos">
            <CultivosMultiSelect
              value={cultivos}
              onChange={setCultivos}
              magicLinkToken={token}
            />
          </Field>

          <Field label="Móvil de la finca" hint="Puede ser distinto al móvil del generador">
            <input
              type="tel"
              inputMode="numeric"
              value={movil}
              onChange={(e) => setMovil(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Email (opcional)">
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

        <StickyBottomButton loading={submitting}>
          Solicitar registro de finca
        </StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
