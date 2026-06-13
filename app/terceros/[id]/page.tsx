"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import { validarNitJuridica, calcularDigitoVerificador } from "@/lib/nit";

const TIPOS_PERSONA = ["Natural", "Jurídica"];

interface Attachment { id?: string; url: string; filename: string; size?: number }

export default function TerceroEditPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [razonSocial, setRazonSocial] = useState("");
  const [nit, setNit] = useState("");
  const [tipoPersona, setTipoPersona] = useState<"Natural" | "Jurídica" | "">("");
  const [direccion, setDireccion] = useState("");
  const [movil, setMovil] = useState<string>("");
  const [correo, setCorreo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [cedulaPdf, setCedulaPdf] = useState<Attachment[]>([]);
  const [certificadoCamaraPdf, setCertificadoCamaraPdf] = useState<Attachment[]>([]);
  const [rutPdf, setRutPdf] = useState<Attachment[]>([]);
  const [certificacionBancariaPdf, setCertificacionBancariaPdf] = useState<Attachment[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [nitInvalido, setNitInvalido] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [listoCajaMenor, setListoCajaMenor] = useState(false);
  const [listoOS, setListoOS] = useState(false);
  const [uploading, setUploading] = useState<"cedula" | "camara" | "rut" | "bancaria" | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = async () => {
    const res = await fetch(`/api/terceros/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const f = data.fields || {};
    setRazonSocial(f.RazonSocial || "");
    setNit(f.NIT || "");
    setTipoPersona(f.tipo_persona || "");
    setDireccion(f.Direccion || "");
    setMovil(f.Movil?.toString() || "");
    setCorreo(f["Correo Electrónico"] || "");
    setObservaciones(f.Observaciones || "");
    const mundep = f["Municipio-Departamento"]?.[0];
    if (f.Municipio?.[0] && mundep) setMunicipio({ id: f.Municipio[0], mundep });
    else setMunicipio(null);
    setCedulaPdf(f.cedula_pdf || []);
    setCertificadoCamaraPdf(f.certificado_camara_pdf || []);
    setRutPdf(f.rut_pdf || []);
    setCertificacionBancariaPdf(f.certificacion_bancaria_pdf || []);
    setFaltantes(data.completitud?.faltantes || []);
    setNitInvalido(data.completitud?.nitInvalido || false);
    setCompleto(data.completitud?.completo || false);
    setListoCajaMenor(data.completitud?.listoCajaMenor ?? false);
    setListoOS(data.completitud?.listoOrdenServicio ?? false);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, id]);

  // Validación en vivo del DV del NIT cuando es persona jurídica.
  // Si el usuario escribe solo la base ("900123456") sin DV, sugerimos el
  // dígito correcto. Si el DV es inválido, el botón Guardar se bloquea.
  const dvSugerido = (() => {
    if (tipoPersona !== "Jurídica" || !nit) return null;
    const limpio = nit.replace(/[^\d]/g, "");
    const base = nit.includes("-")
      ? nit.split("-")[0].replace(/[^\d]/g, "")
      : limpio.length >= 9
      ? limpio.slice(0, -1)
      : limpio;
    if (base.length < 8 || base.length > 15) return null;
    return calcularDigitoVerificador(base);
  })();
  const nitJuridicaInvalido =
    tipoPersona === "Jurídica" &&
    nit.trim().length > 0 &&
    !validarNitJuridica(nit);

  const handleSave = async () => {
    if (nitJuridicaInvalido) {
      alert(
        `El NIT no tiene un dígito de verificación válido.${
          dvSugerido !== null ? ` Sugerencia: ${nit.replace(/[^\d]/g, "").includes("-") ? nit : `${nit.replace(/[^\d]/g, "").slice(0, -1)}-${dvSugerido}` }` : ""
        }`
      );
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/terceros/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razonSocial,
        nit,
        tipoPersona: tipoPersona || undefined,
        direccion,
        movil: movil ? Number(movil) : null,
        correo,
        observaciones,
        municipioId: municipio?.id || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setFaltantes(data.completitud?.faltantes || []);
      setNitInvalido(data.completitud?.nitInvalido || false);
      setCompleto(data.completitud?.completo || false);
      setListoCajaMenor(data.completitud?.listoCajaMenor ?? false);
      setListoOS(data.completitud?.listoOrdenServicio ?? false);
    } else {
      // Mostrar mensaje específico del backend (NIT_DV_INVALIDO con sugerencia,
      // o errores de formato de dirección/correo/móvil).
      try {
        const err = await res.json();
        if (err.error === "VALIDACION" && Array.isArray(err.errores)) {
          alert(
            "Revisa estos campos antes de guardar:\n\n" +
              err.errores.map((e: { motivo: string }) => `• ${e.motivo}`).join("\n")
          );
        } else {
          alert(
            err.mensaje
              ? `${err.mensaje}${err.sugerencia ? "\n\n" + err.sugerencia : ""}`
              : "Error al guardar"
          );
        }
      } catch {
        alert("Error al guardar");
      }
    }
  };

  const handleUpload = async (field: "cedula" | "camara" | "rut" | "bancaria", file: File) => {
    setUploading(field);
    const fieldName =
      field === "cedula" ? "cedula_pdf" :
      field === "camara" ? "certificado_camara_pdf" :
      field === "rut" ? "rut_pdf" :
      "certificacion_bancaria_pdf";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recordId", id);
    formData.append("fieldName", fieldName);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    setUploading(null);
    if (res.ok) {
      // Recargar para que reflote el estado de completitud
      await load();
    } else {
      alert("Error al subir el documento");
    }
  };

  // Borra un adjunto: PATCH el campo con el array sin ese archivo.
  const handleDeleteAttachment = async (
    patchKey: string,
    files: Attachment[],
    att: Attachment
  ) => {
    if (!confirm(`¿Quitar el archivo "${att.filename}"?`)) return;
    const next = files
      .filter((a) => (a.id || a.url) !== (att.id || att.url))
      .map((a) => (a.id ? { id: a.id } : { url: a.url }));
    const res = await fetch(`/api/terceros/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [patchKey]: next }),
    });
    if (res.ok) await load();
    else alert("No se pudo quitar el archivo");
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-5">

        <div>
          <Link href="/terceros" className="text-sm text-gray-500 hover:text-gray-700">← Volver</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{razonSocial || "Tercero"}</h1>
        </div>

        {/* Estado de completitud — lista de chequeo por propósito */}
        <div className={`rounded-xl p-4 border ${listoOS ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ¿Para qué está listo este tercero?
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base leading-none">{listoCajaMenor ? "✅" : "⬜"}</span>
              <span className={listoCajaMenor ? "text-green-800 font-medium" : "text-gray-700"}>
                Caja Menor
              </span>
              <span className="text-xs text-gray-400">— requiere datos básicos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-base leading-none">{listoOS ? "✅" : "⬜"}</span>
              <span className={listoOS ? "text-green-800 font-medium" : "text-gray-700"}>
                Órdenes de Servicio
              </span>
              <span className="text-xs text-gray-400">— requiere datos + documentos</span>
            </div>
          </div>
          {!listoOS && faltantes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs text-amber-800 mb-1.5">Para completar falta:</p>
              <div className="flex flex-wrap gap-1">
                {faltantes.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Razón Social / Nombre *</label>
            <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                NIT / Cédula *
                {tipoPersona === "Jurídica" && (
                  <span className="ml-1 text-[10px] text-gray-400">
                    (debe incluir dígito de verificación, ej. 900123456-7)
                  </span>
                )}
              </label>
              <input
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 ${
                  nitJuridicaInvalido || nitInvalido
                    ? "border-red-400 bg-red-50 focus:ring-red-400"
                    : "border-gray-300 focus:ring-green-500"
                }`}
              />
              {nitJuridicaInvalido && (
                <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                  <span className="font-bold">⚠</span>
                  <span>
                    El dígito de verificación no es válido.
                    {dvSugerido !== null && (
                      <>
                        {" "}Sugerencia: <strong className="font-mono">
                          {(() => {
                            const base = nit.includes("-")
                              ? nit.split("-")[0].replace(/[^\d]/g, "")
                              : nit.replace(/[^\d]/g, "").slice(0, -1);
                            return `${base}-${dvSugerido}`;
                          })()}
                        </strong>
                      </>
                    )}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de persona *</label>
              <select
                value={tipoPersona}
                onChange={(e) => setTipoPersona(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar...</option>
                {TIPOS_PERSONA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dirección *</label>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Municipio *</label>
            <MunicipioSearch value={municipio} onChange={setMunicipio} placeholder="Buscar municipio..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Móvil / Teléfono *</label>
              <input
                type="tel" value={movil} onChange={(e) => setMovil(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Correo electrónico *</label>
              <input
                type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving || nitJuridicaInvalido}
              title={
                nitJuridicaInvalido
                  ? "Corrige el dígito de verificación del NIT antes de guardar"
                  : undefined
              }
              className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {(() => {
            const items = [
              { field: "rut" as const, patchKey: "rutPdf", title: "RUT", files: rutPdf, aplica: true },
              { field: "bancaria" as const, patchKey: "certificacionBancariaPdf", title: "Certificación bancaria", files: certificacionBancariaPdf, aplica: true },
              { field: "cedula" as const, patchKey: "cedulaPdf", title: "Cédula escaneada", files: cedulaPdf, aplica: tipoPersona === "Natural" },
              { field: "camara" as const, patchKey: "certificadoCamaraPdf", title: "Certificado Cámara de Comercio", files: certificadoCamaraPdf, aplica: tipoPersona === "Jurídica" },
            ];
            const aplicables = items.filter((it) => it.aplica);
            const cargados = aplicables.filter((it) => it.files.length > 0).length;
            return (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Documentos para Órdenes de Servicio</h2>
                  <span className={`text-xs font-semibold ${cargados === aplicables.length ? "text-green-700" : "text-amber-600"}`}>
                    {cargados} de {aplicables.length} cargados
                  </span>
                </div>

                {items.map((it) => {
                  const tiene = it.files.length > 0;
                  const subiendo = uploading === it.field;
                  // Estado visual de la lista de chequeo.
                  const borde = !it.aplica
                    ? "border-gray-200 bg-gray-50"
                    : tiene
                      ? "border-green-300 bg-green-50"
                      : "border-amber-300 bg-amber-50";
                  return (
                    <div key={it.field} className={`rounded-lg border p-3 ${borde}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">
                          {!it.aplica ? "○" : tiene ? "✅" : "⬜"}
                        </span>
                        <span className="text-sm font-medium text-gray-800 flex-1">{it.title}</span>
                        {it.aplica ? (
                          tiene ? (
                            <span className="text-xs font-semibold text-green-700">Cargado</span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">Pendiente</span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">No aplica</span>
                        )}
                      </div>

                      {/* Archivos cargados con opción de quitar */}
                      {tiene && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {it.files.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white border border-green-200 text-gray-700 max-w-[230px]">
                              <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" title={a.filename}>
                                📎 {a.filename}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(it.patchKey, it.files, a)}
                                className="text-gray-400 hover:text-red-600 flex-shrink-0"
                                title="Quitar archivo"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {tiene && it.files.length > 1 && (
                        <p className="text-xs text-amber-700 mt-1">
                          ⚠ Hay {it.files.length} archivos en este documento. Deja solo el correcto y quita los demás.
                        </p>
                      )}

                      {/* Acción de subida — solo si aplica */}
                      {it.aplica && (
                        <div className="mt-2">
                          <label className="inline-flex items-center gap-2 text-xs">
                            <span className={`px-3 py-1.5 rounded border cursor-pointer ${tiene ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-50" : "border-green-600 bg-green-600 text-white hover:bg-green-700"}`}>
                              {subiendo ? "Subiendo..." : tiene ? "Reemplazar / subir otro" : "Seleccionar archivo"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={(e) => e.target.files?.[0] && handleUpload(it.field, e.target.files[0])}
                              disabled={subiendo}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* Planillas de seguridad social (solo naturales) */}
        {tipoPersona === "Natural" && <PlanillasSS terceroId={id} />}

        {/* Reasignación de coordinador responsable */}
        <ReasignarCoordinador terceroId={id} />

      </div>
    </AuthenticatedLayout>
  );
}

function ReasignarCoordinador({ terceroId }: { terceroId: string }) {
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [tRes, cRes] = await Promise.all([
      fetch(`/api/terceros/${terceroId}`),
      fetch(`/api/coordinadores?onlyCoordinadores=true`),
    ]);
    const tData = await tRes.json();
    const cData = await cRes.json();
    const cid = tData.fields?.coordinador_responsable?.[0] || null;
    const coords = cData.coordinadores || [];
    if (cid) {
      const found = coords.find((c: any) => c.id === cid);
      setCurrent(found ? { id: found.id, name: found.name } : { id: cid, name: "(coordinador no encontrado)" });
    } else {
      setCurrent(null);
    }
    setList(coords);
  };

  useEffect(() => { load(); }, [terceroId]);

  const handleReassign = async () => {
    if (!target) return;
    setSaving(true);
    const res = await fetch(`/api/terceros/${terceroId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinadorResponsableId: target }),
    });
    setSaving(false);
    if (res.ok) {
      setConfirming(false);
      setTarget("");
      load();
    } else {
      alert("Error al reasignar");
    }
  };

  const targetName = list.find((c) => c.id === target)?.name || "";
  const others = list.filter((c) => c.id !== current?.id);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-1">Coordinador responsable</h2>
      <p className="text-xs text-gray-500 mb-3">
        Este coordinador es quien mantiene los datos y documentos al día.
      </p>

      {current ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-gray-800">{current.name}</p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-amber-800">Sin coordinador asignado</p>
        </div>
      )}

      {!confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Seleccionar coordinador…</option>
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => target && setConfirming(true)}
            disabled={!target}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            Reasignar
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-sm text-amber-900">
            ¿Confirmas pasar este tercero a <b>{targetName}</b>? Dejarás de verlo en tu lista.
          </p>
          <div className="flex gap-2">
            <button onClick={handleReassign} disabled={saving}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50">
              {saving ? "Reasignando..." : "Confirmar"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={saving}
              className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PlanillasSS ──────────────────────────────────────────────────────────────

interface Planilla {
  id: string;
  mesPeriodo: string;
  archivo: Attachment[];
  montoAportado: number | null;
}

function PlanillasSS({ terceroId }: { terceroId: string }) {
  const [planillas, setPlanillas] = useState<Planilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [mesNuevo, setMesNuevo] = useState("");
  const [montoNuevo, setMontoNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/planillas-ss?terceroId=${terceroId}`);
    const data = await res.json();
    setPlanillas(data.planillas || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [terceroId]);

  const handleCreate = async () => {
    if (!mesNuevo) { alert("Selecciona el mes"); return; }
    setSaving(true);
    const res = await fetch("/api/planillas-ss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terceroId,
        mesPeriodo: mesNuevo,
        montoAportado: montoNuevo || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMesNuevo("");
      setMontoNuevo("");
      setShowAdd(false);
      await load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error al crear planilla");
    }
  };

  const handleUpload = async (planillaId: string, file: File) => {
    setUploading(planillaId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recordId", planillaId);
    formData.append("fieldName", "archivo");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    setUploading(null);
    if (res.ok) await load();
    else alert("Error al subir archivo");
  };

  const handleDelete = async (planillaId: string) => {
    if (!confirm("¿Eliminar esta planilla?")) return;
    const res = await fetch(`/api/planillas-ss/${planillaId}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("Error al eliminar");
  };

  // Generar últimos 12 meses como opciones
  const opciones: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opciones.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const formatMes = (m: string) => {
    if (!/^\d{4}-\d{2}$/.test(m)) return m;
    const [y, mm] = m.split("-").map(Number);
    const d = new Date(y, mm - 1, 1);
    return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-gray-900">Planillas de Seguridad Social</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs px-3 py-1.5 bg-[#042726] text-white rounded-lg hover:bg-[#032120]"
        >
          {showAdd ? "Cancelar" : "+ Agregar"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Aporte mensual obligatorio para personas naturales. Sin planilla del mes de la OS, no se puede crear la orden.
      </p>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mes del período *</label>
              <select value={mesNuevo} onChange={(e) => setMesNuevo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="">Seleccionar...</option>
                {opciones.map((o) => <option key={o} value={o}>{formatMes(o)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Monto aportado (opcional)</label>
              <input
                type="number"
                value={montoNuevo}
                onChange={(e) => setMontoNuevo(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !mesNuevo}
            className="px-3 py-1.5 bg-[#00d084] hover:bg-[#00a868] text-white text-xs rounded-lg disabled:opacity-50">
            {saving ? "Creando..." : "Crear planilla"}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Después de crear, sube el PDF en la fila correspondiente.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : planillas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin planillas registradas</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {planillas.map((p) => (
            <div key={p.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 capitalize">{formatMes(p.mesPeriodo)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.archivo.length > 0 ? (
                    p.archivo.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:text-green-900 font-medium">
                        📎 Ver PDF
                      </a>
                    ))
                  ) : (
                    <span className="text-xs text-amber-600">⚠ Sin archivo</span>
                  )}
                  {p.montoAportado != null && (
                    <span className="text-xs text-gray-500">${p.montoAportado.toLocaleString("es-CO")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                  {uploading === p.id ? "..." : p.archivo.length > 0 ? "Reemplazar" : "Subir PDF"}
                  <input type="file" accept=".pdf,image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(p.id, e.target.files[0])} />
                </label>
                <button onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-500 hover:text-red-700">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
