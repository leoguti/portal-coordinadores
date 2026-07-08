"use client";

import { useEffect, useState, use } from "react";
import { validarDocumento } from "@/lib/validacionesCO";
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
interface Coordinador {
  id: string;
  nombre: string;
}
interface Payload {
  intent: "registro-generador";
  expiraEn: string;
  telefonoValidado: string;
  coordinadores: Coordinador[];
}

export default function NuevoGeneradorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Datos del generador
  const [tipopersona, setTipopersona] = useState<"Natural" | "Juridica">("Natural");
  const [nit, setNit] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("AGRICOLA");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [movil, setMovil] = useState("");
  const [email, setEmail] = useState("");
  const [coordinadorSolicitadoId, setCoordinadorSolicitadoId] = useState("");

  // Datos opcionales de primera finca
  const [agregarFinca, setAgregarFinca] = useState(false);
  const [fNombre, setFNombre] = useState("");
  const [fMunicipio, setFMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [fCultivos, setFCultivos] = useState<Cultivo[]>([]);

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

  function validar(): string | null {
    if (!nit.trim()) return "Falta cédula / NIT";
    {
      const errDoc = validarDocumento(tipopersona, nit);
      if (errDoc) return errDoc;
    }
    if (!nombre.trim()) return "Falta nombre / razón social";
    // Persona Natural: exigir nombre Y apellido (mín. 2 palabras) — el cliente
    // no quiere registros con solo el nombre de pila (hallazgo prueba 2026-07-08)
    if (tipopersona === "Natural" && nombre.trim().split(/\s+/).length < 2) {
      return "Escribe tu nombre y apellido completos (ej: Ángela Mercado)";
    }
    if (!tipo) return "Selecciona el tipo";
    if (!municipio) return "Selecciona el municipio sede";
    if (!coordinadorSolicitadoId) return "Selecciona tu coordinador";
    if (agregarFinca) {
      if (!fNombre.trim()) return "Falta nombre de la finca";
      if (!fMunicipio) return "Falta municipio de la finca";
    }
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
      const body: Record<string, unknown> = {
        tipopersona,
        nit: nit.trim(),
        nombre: nombre.trim(),
        tipo,
        direccion: direccion.trim(),
        municipioId: municipio?.id,
        movil: movil.trim(),
        email: email.trim(),
        coordinadorSolicitadoId,
      };
      if (agregarFinca) {
        body.primera_finca = {
          nombre: fNombre.trim(),
          municipioId: fMunicipio?.id,
          cultivosIds: fCultivos.map((c) => c.id),
        };
      }
      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      <MagicLinkLayout titulo="Registro">
        <ErrorPanel message={loadError} />
      </MagicLinkLayout>
    );
  }
  if (submitOk) {
    return (
      <MagicLinkLayout titulo="Registro">
        <SuccessPanel message={submitOk} />
      </MagicLinkLayout>
    );
  }
  if (!payload) {
    return (
      <MagicLinkLayout titulo="Registro">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  return (
    <MagicLinkLayout titulo="Registrarme como generador">
      <form onSubmit={onSubmit}>
        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">Tus datos</h2>

          <Field label="Tipo de persona" required>
            <div className="grid grid-cols-2 gap-2">
              {(["Natural", "Juridica"] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setTipopersona(v)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    tipopersona === v
                      ? "bg-[#00d084] text-white border-[#00d084]"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {v === "Natural" ? "Persona Natural" : "Persona Jurídica"}
                </button>
              ))}
            </div>
          </Field>

          <Field label={tipopersona === "Natural" ? "Cédula" : "NIT"} required>
            <input
              type="text"
              inputMode="numeric"
              value={nit}
              onChange={(e) => setNit(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
            {nit.length > 0 && validarDocumento(tipopersona, nit) && (
              <p className="text-xs font-medium text-amber-700 mt-1">
                ⚠️ {validarDocumento(tipopersona, nit)}
              </p>
            )}
          </Field>

          <Field label={tipopersona === "Natural" ? "Nombre y apellidos" : "Razón social"} required>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Tipo" required>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            >
              <option value="AGRICOLA">Agrícola</option>
              <option value="PECUARIO">Pecuario</option>
              <option value="MIXTO">Mixto</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>

          <Field label="Dirección de la sede">
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="Municipio sede" required>
            <MunicipioSearch
              value={municipio}
              onChange={setMunicipio}
              magicLinkToken={token}
              placeholder="Busca el municipio…"
            />
          </Field>

          <Field label="Móvil (tu WhatsApp verificado)" required>
            <input
              type="tel"
              inputMode="numeric"
              value={movil}
              readOnly
              disabled
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-gray-100 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Es el número desde el que escribiste — tu identidad en CampoLimpio. No se puede cambiar.
            </p>
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            />
          </Field>

          <Field label="¿Qué coordinador te atiende?" required>
            <select
              value={coordinadorSolicitadoId}
              onChange={(e) => setCoordinadorSolicitadoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            >
              <option value="">— Selecciona —</option>
              {payload.coordinadores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        </FormCard>

        <FormCard>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              id="agregar-finca"
              checked={agregarFinca}
              onChange={(e) => setAgregarFinca(e.target.checked)}
              className="w-5 h-5"
            />
            <label htmlFor="agregar-finca" className="text-sm font-medium text-gray-900">
              ¿Quieres registrar tu primera finca ya?
            </label>
          </div>

          {agregarFinca && (
            <div className="pl-2 border-l-2 border-[#00d084]/30">
              <Field label="Nombre de la finca" required>
                <input
                  type="text"
                  value={fNombre}
                  onChange={(e) => setFNombre(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
              <Field label="Municipio de la finca" required>
                <MunicipioSearch
                  value={fMunicipio}
                  onChange={setFMunicipio}
                  magicLinkToken={token}
                  placeholder="Busca el municipio…"
                />
              </Field>
              <Field label="Cultivos">
                <CultivosMultiSelect
                  value={fCultivos}
                  onChange={setFCultivos}
                  magicLinkToken={token}
                />
              </Field>
            </div>
          )}
        </FormCard>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <StickyBottomButton loading={submitting}>
          Enviar solicitud de registro
        </StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
