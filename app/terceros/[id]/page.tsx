"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";

const TIPOS_PERSONA = ["Natural", "Jurídica"];
const TIPOS_CLASIFICACION = [
  "Centro de Acopio", "Transportador", "Gestor", "Arrendador",
  "Alcadia", "Gobernacion", "Corporacion Autónoma", "Agremiación"
];

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
  const [tipo, setTipo] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [cedulaPdf, setCedulaPdf] = useState<Attachment[]>([]);
  const [certificadoCamaraPdf, setCertificadoCamaraPdf] = useState<Attachment[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [nitInvalido, setNitInvalido] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [uploading, setUploading] = useState<"cedula" | "camara" | null>(null);

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
    setTipo(f.Tipo || []);
    const mundep = f["Municipio-Departamento"]?.[0];
    if (f.Municipio?.[0] && mundep) setMunicipio({ id: f.Municipio[0], mundep });
    else setMunicipio(null);
    setCedulaPdf(f.cedula_pdf || []);
    setCertificadoCamaraPdf(f.certificado_camara_pdf || []);
    setFaltantes(data.completitud?.faltantes || []);
    setNitInvalido(data.completitud?.nitInvalido || false);
    setCompleto(data.completitud?.completo || false);
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, id]);

  const handleSave = async () => {
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
        tipo,
        municipioId: municipio?.id || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setFaltantes(data.completitud?.faltantes || []);
      setNitInvalido(data.completitud?.nitInvalido || false);
      setCompleto(data.completitud?.completo || false);
    } else {
      alert("Error al guardar");
    }
  };

  const handleUpload = async (field: "cedula" | "camara", file: File) => {
    setUploading(field);
    const fieldName = field === "cedula" ? "cedula_pdf" : "certificado_camara_pdf";
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

  const toggleTipo = (t: string) => {
    setTipo((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
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

        {/* Estado de completitud */}
        <div className={`rounded-xl p-4 border ${completo ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg">{completo ? "✓" : "⚠"}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${completo ? "text-green-800" : "text-amber-800"}`}>
                {completo ? "Tercero completo" : "Faltan datos"}
              </p>
              {!completo && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {faltantes.map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                NIT / Cédula * {nitInvalido && <span className="text-red-600">(dígito verificador inválido)</span>}
              </label>
              <input
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 ${nitInvalido ? "border-red-300" : "border-gray-300"}`}
              />
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
            <label className="block text-xs font-medium text-gray-500 mb-2">Clasificación del tercero (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_CLASIFICACION.map((t) => (
                <label key={t} className={`text-xs px-3 py-1.5 rounded-full cursor-pointer border ${tipo.includes(t) ? "bg-[#042726] text-white border-[#042726]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={tipo.includes(t)} onChange={() => toggleTipo(t)} className="hidden" />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Documentos</h2>

          {/* Cédula (Natural) */}
          <div className={`rounded-lg border p-3 ${tipoPersona === "Natural" ? "bg-amber-50 border-amber-200" : "border-gray-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Cédula escaneada {tipoPersona === "Natural" && <span className="text-amber-600">(requerido)</span>}
              </span>
              <span className="text-xs text-gray-400">{cedulaPdf.length} archivo(s)</span>
            </div>
            {cedulaPdf.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {cedulaPdf.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 truncate max-w-[200px]">
                    📎 {a.filename}
                  </a>
                ))}
              </div>
            )}
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => e.target.files?.[0] && handleUpload("cedula", e.target.files[0])}
              disabled={uploading === "cedula"}
              className="block text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:bg-white file:cursor-pointer"
            />
            {uploading === "cedula" && <p className="text-xs text-gray-500 mt-1">Subiendo...</p>}
          </div>

          {/* Cámara de Comercio (Jurídica) */}
          <div className={`rounded-lg border p-3 ${tipoPersona === "Jurídica" ? "bg-amber-50 border-amber-200" : "border-gray-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Certificado Cámara de Comercio {tipoPersona === "Jurídica" && <span className="text-amber-600">(requerido)</span>}
              </span>
              <span className="text-xs text-gray-400">{certificadoCamaraPdf.length} archivo(s)</span>
            </div>
            {certificadoCamaraPdf.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {certificadoCamaraPdf.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 truncate max-w-[200px]">
                    📎 {a.filename}
                  </a>
                ))}
              </div>
            )}
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => e.target.files?.[0] && handleUpload("camara", e.target.files[0])}
              disabled={uploading === "camara"}
              className="block text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-xs file:bg-white file:cursor-pointer"
            />
            {uploading === "camara" && <p className="text-xs text-gray-500 mt-1">Subiendo...</p>}
          </div>
        </div>

      </div>
    </AuthenticatedLayout>
  );
}
