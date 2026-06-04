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
interface Finca {
  id: string;
  nombre: string;
  municipioId: string | null;
  municipioLabel: string | null;
  cultivos: Cultivo[];
  movil: string;
  email: string;
}
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
  intent: "editar-perfil";
  expiraEn: string;
  generador: Generador;
  fincas: Finca[];
  coordinadores: Coordinador[];
  coordinadorSugerido: { id: string; nombre: string } | null;
}

interface MunicipioVal {
  id: string;
  mundep: string;
}

interface FincaEstado {
  id: string;
  nombre: string;
  municipio: MunicipioVal | null;
  cultivos: Cultivo[];
  movil: string;
  email: string;
  dirty: boolean;
  expanded: boolean;
}

interface EmpresaEstado {
  nombre: string;
  tipo: string;
  direccion: string;
  municipio: MunicipioVal | null;
  movil: string;
  email: string;
  dirty: boolean;
  expanded: boolean;
}

export default function PerfilPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState<EmpresaEstado | null>(null);
  const [fincas, setFincas] = useState<FincaEstado[]>([]);
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
        setEmpresa({
          nombre: p.generador.nombre,
          tipo: p.generador.tipo,
          direccion: p.generador.direccion,
          municipio:
            p.generador.municipioId && p.generador.municipioLabel
              ? { id: p.generador.municipioId, mundep: p.generador.municipioLabel }
              : null,
          movil: p.generador.movil,
          email: p.generador.email,
          dirty: false,
          expanded: false,
        });
        setFincas(
          p.fincas.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            municipio:
              f.municipioId && f.municipioLabel
                ? { id: f.municipioId, mundep: f.municipioLabel }
                : null,
            cultivos: f.cultivos,
            movil: f.movil,
            email: f.email,
            dirty: false,
            expanded: false,
          }))
        );
        const sugerido = p.coordinadorSugerido;
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

  function updateEmpresa(patch: Partial<EmpresaEstado>) {
    setEmpresa((prev) =>
      prev ? { ...prev, ...patch, dirty: true } : prev
    );
  }
  function updateFinca(id: string, patch: Partial<FincaEstado>) {
    setFincas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch, dirty: true } : f))
    );
  }
  function toggleEmpresa() {
    setEmpresa((prev) => (prev ? { ...prev, expanded: !prev.expanded } : prev));
  }
  function toggleFinca(id: string) {
    setFincas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f))
    );
  }

  const tieneCambios =
    (empresa?.dirty || false) || fincas.some((f) => f.dirty);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!tieneCambios) {
      setSubmitError("No has hecho cambios todavía");
      return;
    }
    if (!coordinadorId) {
      setSubmitError("Selecciona el coordinador que revisará los cambios");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { coordinadorId };
      if (empresa?.dirty) {
        body.empresa = {
          nombre: empresa.nombre.trim(),
          tipo: empresa.tipo.trim(),
          direccion: empresa.direccion.trim(),
          municipioId: empresa.municipio?.id || null,
          movil: empresa.movil.trim(),
          email: empresa.email.trim(),
        };
      }
      const fincasDirty = fincas
        .filter((f) => f.dirty)
        .map((f) => ({
          id: f.id,
          nombre: f.nombre.trim(),
          municipioId: f.municipio?.id || null,
          cultivosIds: f.cultivos.map((c) => c.id),
          movil: f.movil.trim(),
          email: f.email.trim(),
        }));
      if (fincasDirty.length > 0) body.fincas = fincasDirty;

      const r = await fetch(`/api/m/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  if (!payload || !empresa) {
    return (
      <MagicLinkLayout titulo="Mis datos">
        <LoadingSpinner />
      </MagicLinkLayout>
    );
  }

  const esEmpresa = (payload.generador.tipopersona || "")
    .toLowerCase()
    .includes("juridic");
  const tituloPagina = esEmpresa ? "Mis datos" : "Mis datos";
  const subtitulo = esEmpresa
    ? `${payload.generador.nombre} · NIT ${payload.generador.nit}`
    : `${payload.generador.nombre} · CC ${payload.generador.nit}`;

  return (
    <MagicLinkLayout titulo={tituloPagina} subtitulo={subtitulo}>
      <form onSubmit={onSubmit}>
        {/* CARD EMPRESA */}
        <FormCard>
          <button
            type="button"
            onClick={toggleEmpresa}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="font-medium text-gray-900">
                {esEmpresa ? "Mi empresa" : "Mis datos personales"}
                {empresa.dirty && (
                  <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    modificado
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {empresa.nombre || "—"} · {empresa.municipio?.mundep || "Sin municipio"}
              </p>
            </div>
            <span className="text-emerald-700 text-sm font-medium">
              {empresa.expanded ? "Cerrar" : "Editar"}
            </span>
          </button>

          {empresa.expanded && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-3">
                {esEmpresa
                  ? "El NIT y el tipo de persona no se pueden cambiar. Si necesitas corregirlos, escríbele a tu coordinador."
                  : "Tu cédula y tipo de persona no se pueden cambiar. Si necesitas corregirlos, escríbele a tu coordinador."}
              </p>
              <Field label="Nombre / Razón social" required>
                <input
                  type="text"
                  value={empresa.nombre}
                  onChange={(e) => updateEmpresa({ nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={empresa.tipo}
                  onChange={(e) => updateEmpresa({ tipo: e.target.value })}
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
                  value={empresa.direccion}
                  onChange={(e) => updateEmpresa({ direccion: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
              <Field label="Municipio sede">
                <MunicipioSearch
                  value={empresa.municipio}
                  onChange={(v) => updateEmpresa({ municipio: v })}
                  magicLinkToken={token}
                  placeholder="Busca el municipio…"
                />
              </Field>
              <Field label="Móvil">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={empresa.movil}
                  onChange={(e) => updateEmpresa({ movil: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={empresa.email}
                  onChange={(e) => updateEmpresa({ email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                />
              </Field>
            </div>
          )}
        </FormCard>

        {/* CARDS FINCAS */}
        <FormCard>
          <h2 className="font-medium text-gray-900 mb-3">
            Mis fincas ({fincas.length})
          </h2>
          {fincas.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aún no tienes fincas registradas. Vuelve al bot para agregar la primera.
            </p>
          ) : (
            <div className="space-y-2">
              {fincas.map((f) => (
                <div
                  key={f.id}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleFinca(f.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        🌱 {f.nombre || "Sin nombre"}
                        {f.dirty && (
                          <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            modificado
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {f.municipio?.mundep || "Sin municipio"} ·{" "}
                        {f.cultivos.length > 0
                          ? f.cultivos.map((c) => c.nombre).join(", ")
                          : "Sin cultivos"}
                      </p>
                    </div>
                    <span className="text-emerald-700 text-sm font-medium">
                      {f.expanded ? "Cerrar" : "Editar"}
                    </span>
                  </button>

                  {f.expanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <Field label="Nombre de la finca" required>
                        <input
                          type="text"
                          value={f.nombre}
                          onChange={(e) =>
                            updateFinca(f.id, { nombre: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                        />
                      </Field>
                      <Field label="Municipio">
                        <MunicipioSearch
                          value={f.municipio}
                          onChange={(v) => updateFinca(f.id, { municipio: v })}
                          magicLinkToken={token}
                          placeholder="Busca el municipio…"
                        />
                      </Field>
                      <Field label="Cultivos">
                        <CultivosMultiSelect
                          value={f.cultivos}
                          onChange={(v) => updateFinca(f.id, { cultivos: v })}
                          magicLinkToken={token}
                        />
                      </Field>
                      <Field label="Móvil">
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={f.movil}
                          onChange={(e) =>
                            updateFinca(f.id, { movil: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                        />
                      </Field>
                      <Field label="Email">
                        <input
                          type="email"
                          value={f.email}
                          onChange={(e) =>
                            updateFinca(f.id, { email: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </FormCard>

        {/* COORDINADOR */}
        {tieneCambios && (
          <FormCard>
            <Field label="Coordinador que va a aprobar los cambios" required>
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
                        otro puede retrasar la aprobación.
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
        )}

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <StickyBottomButton loading={submitting}>
          {tieneCambios
            ? "Guardar todos los cambios"
            : "Toca \"Editar\" en cualquier sección para empezar"}
        </StickyBottomButton>
      </form>
    </MagicLinkLayout>
  );
}
