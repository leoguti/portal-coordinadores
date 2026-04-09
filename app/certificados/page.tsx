"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";

interface Ubicacion {
  id: string;
  nombre: string;
  cedula: string;
  direccion: string;
  municipio: string;
  cultivo: string;
  email: string;
  movil: string;
  tipo: string;
}

interface Resultado {
  consecutivo: number;
  pdfUrl: string;
  airtableId: string;
}

export default function CertificadosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Paso 1 – búsqueda
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<Ubicacion | null>(null);

  // Paso 2 – datos del certificado
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [rigidos, setRigidos] = useState("");
  const [flexibles, setFlexibles] = useState("");
  const [metalicos, setMetalicos] = useState("");
  const [embalaje, setEmbalaje] = useState("");
  const [triplelavado, setTriplelavado] = useState<"SI" | "NO" | "PENDIENTE">("PENDIENTE");
  const [lugardevolucion, setLugardevolucion] = useState("");
  const [municipioDevolucion, setMunicipioDevolucion] = useState<{ id: string; mundep: string } | null>(null);
  const [observaciones, setObservaciones] = useState("");

  // Resultado
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Fechas permitidas
  const hoy = new Date().toISOString().split("T")[0];
  const hace120 = new Date();
  hace120.setDate(hace120.getDate() - 120);
  const minFecha = hace120.toISOString().split("T")[0];

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }
  if (!session) return null;

  async function buscarGenerador(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim()) return;
    setBuscando(true);
    setErrorBusqueda(null);
    setUbicaciones([]);
    setSeleccionada(null);

    const res = await fetch(`/api/certificados/generador?cedula=${encodeURIComponent(cedula.trim())}`);
    const data = await res.json();
    setBuscando(false);

    if (!res.ok || !data.found) {
      setErrorBusqueda("No se encontró ningún generador con esa cédula/NIT.");
      return;
    }

    if (data.ubicaciones.length === 1) {
      setSeleccionada(data.ubicaciones[0]);
    } else {
      setUbicaciones(data.ubicaciones);
    }
  }

  async function generarCertificado(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionada || !municipioDevolucion) return;
    setGenerando(true);
    setErrorGenerar(null);

    const res = await fetch("/api/certificados/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ubicacionId: seleccionada.id,
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
    setGenerando(false);

    if (!res.ok) {
      setErrorGenerar(data.error || "Error generando el certificado");
      return;
    }

    setResultado(data);
  }

  function reiniciar() {
    setCedula("");
    setUbicaciones([]);
    setSeleccionada(null);
    setFechaDevolucion("");
    setRigidos("");
    setFlexibles("");
    setMetalicos("");
    setEmbalaje("");
    setTriplelavado("PENDIENTE");
    setLugardevolucion("");
    setMunicipioDevolucion(null);
    setObservaciones("");
    setResultado(null);
    setErrorGenerar(null);
    setErrorBusqueda(null);
  }

  // ── RESULTADO ──────────────────────────────────────────────
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
              Consecutivo: <span className="font-bold text-green-700 text-xl">#{resultado.consecutivo}</span>
            </p>
            <p className="text-gray-500 text-sm mb-6">
              El PDF fue generado y el email enviado al generador y coordinador.
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
          <h1 className="text-2xl font-bold text-gray-900">Generar certificado</h1>
          <p className="text-gray-500 text-sm mt-1">
            Certificado de devolución de envases vacíos de plaguicidas
          </p>
        </div>

        {/* ── PASO 1: BUSCAR GENERADOR ─────────────────────── */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            1. Generador
          </h2>

          {!seleccionada ? (
            <>
              <form onSubmit={buscarGenerador} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="Cédula o NIT del generador"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={buscando}
                />
                <button
                  type="submit"
                  disabled={buscando || !cedula.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  {buscando ? "Buscando..." : "Buscar"}
                </button>
              </form>

              {errorBusqueda && (
                <p className="text-red-600 text-sm">{errorBusqueda}</p>
              )}

              {ubicaciones.length > 1 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Se encontraron {ubicaciones.length} fincas. Selecciona una:
                  </p>
                  <div className="space-y-2">
                    {ubicaciones.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSeleccionada(u); setUbicaciones([]); }}
                        className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:border-green-400 hover:bg-green-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900 text-sm">{u.nombre}</p>
                        <p className="text-gray-500 text-xs">{u.direccion} · {u.municipio}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">{seleccionada.nombre}</p>
                <p className="text-sm text-gray-500">C.C./NIT: {seleccionada.cedula}</p>
                <p className="text-sm text-gray-500">{seleccionada.direccion}</p>
                <p className="text-sm text-gray-500">{seleccionada.municipio} · {seleccionada.cultivo}</p>
              </div>
              <button
                onClick={() => { setSeleccionada(null); setUbicaciones([]); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
              >
                Cambiar
              </button>
            </div>
          )}
        </div>

        {/* ── PASO 2: DATOS DEL CERTIFICADO ───────────────── */}
        {seleccionada && (
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
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
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
                  Total: {(Number(rigidos || 0) + Number(flexibles || 0) + Number(metalicos || 0) + Number(embalaje || 0)).toFixed(1)} kg
                </p>
              </div>

              {/* Triple lavado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Triple lavado <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {(["SI", "NO", "PENDIENTE"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
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
                  Municipio de devolución <span className="text-red-500">*</span>
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

            {/* ── GENERAR ─────────────────────────────────────── */}
            {errorGenerar && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
                {errorGenerar}
              </div>
            )}

            <button
              type="submit"
              disabled={generando || !municipioDevolucion || !lugardevolucion || !fechaDevolucion}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
            >
              {generando ? "Generando certificado..." : "Generar certificado"}
            </button>

            {generando && (
              <p className="text-center text-xs text-gray-400 mt-2">
                Esto puede tomar unos segundos — generando PDF y enviando email...
              </p>
            )}
          </form>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
