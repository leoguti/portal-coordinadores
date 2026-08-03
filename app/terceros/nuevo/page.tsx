"use client";

import { Suspense, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import {
  validarDireccionDian,
  validarEmail,
  validarTelefono,
} from "@/lib/terceros";

const TIPOS_PERSONA = ["Natural", "Jurídica"] as const;

export default function NuevoTerceroPage() {
  return (
    <Suspense fallback={null}>
      <NuevoTerceroInner />
    </Suspense>
  );
}

type Proposito = "caja-menor" | "os";

function NuevoTerceroInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Propósito del tercero: define qué se muestra (Caja Menor no necesita
  // documentos). El registro creado es el mismo en ambos casos — un tercero
  // de caja menor puede completarse con documentos después si se necesita en OS.
  const propositoParam = searchParams.get("proposito");
  const [proposito, setProposito] = useState<Proposito | null>(
    propositoParam === "caja-menor" || propositoParam === "os" ? propositoParam : null
  );

  // Permite prellenar el nombre cuando se llega desde "crear inline".
  const [razonSocial, setRazonSocial] = useState(searchParams.get("nombre") || "");
  const [tipoPersona, setTipoPersona] = useState<"" | "Natural" | "Jurídica">("");
  const [nit, setNit] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [movil, setMovil] = useState("");
  const [correo, setCorreo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validaciones en vivo (no bloquean escribir, pero avisan).
  const dirCheck = useMemo(
    () => (direccion.trim() ? validarDireccionDian(direccion) : null),
    [direccion]
  );
  const correoCheck = useMemo(
    () => (correo.trim() ? { ok: validarEmail(correo) } : null),
    [correo]
  );
  const movilCheck = useMemo(
    () => (movil.trim() ? validarTelefono(movil) : null),
    [movil]
  );

  const puedeCrear =
    razonSocial.trim().length > 0 &&
    nit.trim().length > 0 &&
    (tipoPersona === "Natural" || tipoPersona === "Jurídica") &&
    municipio !== null &&
    (!dirCheck || dirCheck.ok) &&
    (!correoCheck || correoCheck.ok) &&
    (!movilCheck || movilCheck.ok);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleCrear = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/terceros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razonSocial: razonSocial.trim(),
          nit: nit.trim(),
          tipoPersona,
          direccion: direccion.trim() || undefined,
          municipioId: municipio?.id,
          movil: movil.trim() || undefined,
          correo: correo.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "NIT_DV_INVALIDO") {
          setError(`${data.mensaje}${data.sugerencia ? ` ${data.sugerencia}` : ""}`);
        } else if (data.error === "VALIDACION" && Array.isArray(data.errores)) {
          setError(data.errores.map((e: { motivo: string }) => e.motivo).join(" · "));
        } else {
          setError(data.error || "No se pudo crear el tercero");
        }
        setSaving(false);
        return;
      }
      // Ir al detalle para que pueda subir documentos (si los necesita).
      router.push(`/terceros/${data.id}?creado=1${proposito ? `&proposito=${proposito}` : ""}`);
    } catch {
      setError("Error de red al crear el tercero");
      setSaving(false);
    }
  };

  // Sin propósito definido: selector de dos tarjetas antes del formulario.
  if (!proposito) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-3xl mx-auto p-6 space-y-5">
          <div>
            <Link href="/terceros" className="text-sm text-gray-500 hover:text-gray-700">
              ← Volver
            </Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">Nuevo tercero</h1>
            <p className="text-sm text-gray-500 mt-1">¿Para qué lo necesitas?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setProposito("caja-menor")}
              className="text-left rounded-xl border-2 border-gray-200 bg-white p-5 hover:border-green-500 hover:bg-green-50/40 transition-colors"
            >
              <div className="text-2xl mb-2">🟢</div>
              <p className="font-semibold text-gray-900">Para Caja Menor</p>
              <p className="text-sm text-gray-500 mt-1">
                Solo datos básicos. No se necesita subir ningún documento.
              </p>
            </button>
            <button
              onClick={() => setProposito("os")}
              className="text-left rounded-xl border-2 border-gray-200 bg-white p-5 hover:border-blue-500 hover:bg-blue-50/40 transition-colors"
            >
              <div className="text-2xl mb-2">🔵</div>
              <p className="font-semibold text-gray-900">Para Órdenes de Servicio</p>
              <p className="text-sm text-gray-500 mt-1">
                Datos básicos + documentos: RUT, certificación bancaria y cédula
                o cámara de comercio.
              </p>
            </button>
          </div>

          <p className="text-xs text-gray-400">
            No te preocupes si después lo necesitas para lo otro: es el mismo
            tercero y siempre podrás completarle los documentos más adelante.
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const esCajaMenor = proposito === "caja-menor";

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <div>
          <Link href="/terceros" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            {esCajaMenor ? "Nuevo tercero para Caja Menor" : "Nuevo tercero para Órdenes de Servicio"}
          </h1>
        </div>

        {esCajaMenor ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            🟢 Para Caja Menor solo necesitas los datos de este formulario.{" "}
            <strong>No hay que subir ningún documento.</strong>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            🔵 Además de estos datos, para usarlo en Órdenes de Servicio
            necesitarás subir los documentos (RUT, certificación bancaria y
            cédula o cámara de comercio). Podrás hacerlo en el siguiente paso.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Formulario de datos básicos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Razón Social / Nombre *
            </label>
            <input
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de persona *</label>
              <select
                value={tipoPersona}
                onChange={(e) => setTipoPersona(e.target.value as "" | "Natural" | "Jurídica")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar...</option>
                {TIPOS_PERSONA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                NIT / Cédula *
                {tipoPersona === "Jurídica" && (
                  <span className="ml-1 text-[10px] text-gray-400">
                    (con dígito de verificación, ej. 900123456-7)
                  </span>
                )}
              </label>
              <input
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Dirección{" "}
              <span className="text-[10px] text-gray-400">
                (formato DIAN: tipo de vía + números, ej. CL 13 65 95)
              </span>
            </label>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej. CL 13 65 95  ·  VRD El Roble Km 4"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                dirCheck && !dirCheck.ok
                  ? "border-red-400 bg-red-50 focus:ring-red-400"
                  : "border-gray-300 focus:ring-green-500"
              }`}
            />
            {dirCheck && !dirCheck.ok ? (
              <p className="text-xs text-red-600 mt-1">⚠ {dirCheck.motivo}</p>
            ) : (
              <p className="text-[11px] text-gray-400 mt-1">
                Usa nomenclatura DIAN. ¿Dudas?{" "}
                <a
                  href="https://muisca.dian.gov.co/WebRutMuisca/visor/formularios/f18/v4/direcciones/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  Generador de direcciones DIAN
                </a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Municipio *</label>
            <MunicipioSearch value={municipio} onChange={setMunicipio} placeholder="Buscar municipio..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Móvil / Teléfono
                <span className="ml-1 text-[10px] text-gray-400">(fijo o celular; para notificarle pagos)</span>
              </label>
              <input
                type="tel"
                value={movil}
                onChange={(e) => setMovil(e.target.value.replace(/\D/g, ""))}
                placeholder="Celular 3001234567 o fijo 6012345"
                className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 ${
                  movilCheck && !movilCheck.ok
                    ? "border-red-400 bg-red-50 focus:ring-red-400"
                    : "border-gray-300 focus:ring-green-500"
                }`}
              />
              {movilCheck && !movilCheck.ok && (
                <p className="text-xs text-red-600 mt-1">⚠ {movilCheck.motivo}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Correo electrónico
                <span className="ml-1 text-[10px] text-gray-400">(opcional; para notificarle pagos)</span>
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="correo@ejemplo.com"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  correoCheck && !correoCheck.ok
                    ? "border-red-400 bg-red-50 focus:ring-red-400"
                    : "border-gray-300 focus:ring-green-500"
                }`}
              />
              {correoCheck && !correoCheck.ok && (
                <p className="text-xs text-red-600 mt-1">⚠ El correo no tiene un formato válido</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleCrear}
              disabled={saving || !puedeCrear}
              className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creando..." : "Crear tercero"}
            </button>
            <Link
              href="/terceros"
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
