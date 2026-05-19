"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";
import {
  GeneradorAutocomplete,
  FincaAutocomplete,
  type GeneradorOption,
  type FincaOption,
} from "@/components/GeneradorFincaSelect";

interface Resultado {
  consecutivo: number;
  pdfUrl: string;
  recordId: string;
}

export default function CertificadosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Paso 1: generador → finca ─────────────────────────────
  const [generador, setGenerador] = useState<GeneradorOption | null>(null);
  const [finca, setFinca] = useState<FincaOption | null>(null);
  const [fincaInfo, setFincaInfo] = useState<{
    nombregenerador: string;
    cedulagenerador: string;
    municipiogenerador: string;
    cultivogenerador: string;
  } | null>(null);
  const [fincaInfoLoading, setFincaInfoLoading] = useState(false);

  // ── Paso 2: datos del certificado ─────────────────────────
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [rigidos, setRigidos] = useState("");
  const [flexibles, setFlexibles] = useState("");
  const [metalicos, setMetalicos] = useState("");
  const [embalaje, setEmbalaje] = useState("");
  const [triplelavado, setTriplelavado] = useState<"SI" | "NO" | "">("");
  const [lugardevolucion, setLugardevolucion] = useState("");
  const [municipioDevolucion, setMunicipioDevolucion] = useState<{
    id: string;
    mundep: string;
  } | null>(null);
  const [observaciones, setObservaciones] = useState("");

  // ── Resultado ─────────────────────────────────────────────
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const hoy = new Date().toISOString().split("T")[0];
  const hace90 = new Date();
  hace90.setDate(hace90.getDate() - 90);
  const minFecha = hace90.toISOString().split("T")[0];

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Al elegir finca, traer los datos que se congelarán (mismo resolver que
  // /generar) para mostrarlos como información antes de generar.
  useEffect(() => {
    if (!finca) {
      setFincaInfo(null);
      return;
    }
    let cancel = false;
    setFincaInfoLoading(true);
    fetch(
      `/api/certificados/finca-info?fincaId=${encodeURIComponent(finca.id)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        setFincaInfo(d && !d.error ? d : null);
      })
      .catch(() => {
        if (!cancel) setFincaInfo(null);
      })
      .finally(() => {
        if (!cancel) setFincaInfoLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [finca]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }
  if (!session) return null;

  const totalKg =
    Number(rigidos || 0) +
    Number(flexibles || 0) +
    Number(metalicos || 0) +
    Number(embalaje || 0);

  async function generarCertificado(e: React.FormEvent) {
    e.preventDefault();
    if (!finca || !municipioDevolucion) return;
    setGenerando(true);
    setErrorGenerar(null);

    try {
      const res = await fetch("/api/certificados/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fincaId: finca.id,
          municipioDevolucionId: municipioDevolucion.id,
          rigidos: Number(rigidos || 0),
          flexibles: Number(flexibles || 0),
          metalicos: Number(metalicos || 0),
          embalaje: Number(embalaje || 0),
          triplelavado,
          lugardevolucion,
          fechadevolucion: fechaDevolucion,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorGenerar(data.error || "Error generando el certificado");
        return;
      }
      setResultado(data);
    } catch {
      setErrorGenerar("Error de red generando el certificado");
    } finally {
      setGenerando(false);
    }
  }

  function reiniciar() {
    setGenerador(null);
    setFinca(null);
    setFechaDevolucion("");
    setRigidos("");
    setFlexibles("");
    setMetalicos("");
    setEmbalaje("");
    setTriplelavado("");
    setLugardevolucion("");
    setMunicipioDevolucion(null);
    setObservaciones("");
    setResultado(null);
    setErrorGenerar(null);
  }

  // ── RESULTADO ─────────────────────────────────────────────
  if (resultado) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Certificado generado
            </h2>
            <p className="text-gray-600 mb-1">
              Consecutivo:{" "}
              <span className="font-bold text-green-700 text-xl">
                #{resultado.consecutivo}
              </span>
            </p>
            <p className="text-gray-500 text-sm mb-6">
              PDF generado y email enviado al generador y coordinador.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href={resultado.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg"
              >
                Ver PDF
              </a>
              <button
                onClick={reiniciar}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-2 rounded-lg"
              >
                Nuevo certificado
              </button>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Generar certificado
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Certificado de devolución de envases vacíos de plaguicidas
          </p>
        </div>

        {/* ── PASO 1: GENERADOR → FINCA ──────────────────── */}
        <div className="bg-white rounded-lg shadow p-6 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            1. Generador y finca
          </h2>

          <GeneradorAutocomplete
            value={generador}
            onChange={(g) => {
              setGenerador(g);
              setFinca(null);
            }}
          />

          <FincaAutocomplete
            value={finca}
            onChange={setFinca}
            generadorId={generador?.id}
            disabled={!generador}
          />

          {generador && !finca && (
            <p className="text-xs text-gray-400">
              Selecciona la finca del generador para continuar.
            </p>
          )}

          {finca && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">
                Datos que se congelan en el certificado
              </p>
              {fincaInfoLoading ? (
                <p className="text-xs text-gray-500">
                  Cargando datos de la finca...
                </p>
              ) : fincaInfo ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
                  <div>
                    <dt className="inline text-gray-500">Generador: </dt>
                    <dd className="inline font-medium">
                      {fincaInfo.nombregenerador || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-gray-500">NIT/Cédula: </dt>
                    <dd className="inline font-medium">
                      {fincaInfo.cedulagenerador || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-gray-500">Municipio: </dt>
                    <dd className="inline font-medium">
                      {fincaInfo.municipiogenerador || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-gray-500">Cultivo(s): </dt>
                    <dd className="inline font-medium">
                      {fincaInfo.cultivogenerador || (
                        <span className="text-amber-700">
                          Sin cultivo registrado en la finca
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-amber-700">
                  No se pudieron cargar los datos de la finca.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── PASO 2: DATOS DEL CERTIFICADO ─────────────── */}
        {finca && (
          <form onSubmit={generarCertificado}>
            <div className="bg-white rounded-lg shadow p-6 mb-4 space-y-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                2. Datos de devolución
              </h2>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de devolución <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={fechaDevolucion}
                  onChange={(e) => setFechaDevolucion(e.target.value)}
                  min={minFecha}
                  max={hoy}
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Materiales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materiales (kg) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Rígidos", value: rigidos, set: setRigidos },
                    { label: "Flexibles", value: flexibles, set: setFlexibles },
                    { label: "Metálicos", value: metalicos, set: setMetalicos },
                    { label: "Embalaje", value: embalaje, set: setEmbalaje },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="block text-xs text-gray-500 mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder="0"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Total: {totalKg.toFixed(1)} kg
                </p>
              </div>

              {/* Triple lavado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Triple lavado <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  {(["SI", "NO"] as const).map((v) => (
                    <label
                      key={v}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="triplelavado"
                        value={v}
                        checked={triplelavado === v}
                        onChange={() => setTriplelavado(v)}
                        className="accent-green-600"
                      />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lugar de devolución */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lugar de devolución <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lugardevolucion}
                  onChange={(e) => setLugardevolucion(e.target.value)}
                  placeholder="Ej. Bodega Municipal CampoLimpio"
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Municipio de devolución */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Municipio de devolución{" "}
                  <span className="text-red-500">*</span>
                </label>
                <MunicipioSearch
                  value={municipioDevolucion}
                  onChange={setMunicipioDevolucion}
                  placeholder="Buscar municipio..."
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Opcional"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>

            {errorGenerar && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
                {errorGenerar}
              </div>
            )}

            <button
              type="submit"
              disabled={
                generando ||
                !municipioDevolucion ||
                !lugardevolucion ||
                !fechaDevolucion ||
                !triplelavado ||
                totalKg <= 0
              }
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
            >
              {generando ? "Generando certificado..." : "Generar certificado"}
            </button>

            {generando && (
              <p className="text-center text-xs text-gray-400 mt-2">
                Generando PDF y enviando email... esto puede tomar unos
                segundos.
              </p>
            )}
          </form>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
