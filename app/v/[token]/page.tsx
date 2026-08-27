import type { Metadata } from "next";
import { buscarCertPorToken, type CertVerificado } from "@/lib/certificadosVerificacion";
import { roundKg } from "@/lib/kilos";

// Página PÚBLICA de verificación de certificados (destino del QR impreso).
// Sin sesión: cualquier auditor/comprador escanea y coteja contra el papel.
// Los datos vienen de Neon (registro oficial), con cédula enmascarada.

export const metadata: Metadata = {
  title: "Verificación de certificado — CampoLimpio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtKg(n: number): string {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(roundKg(n))} kg`;
}

function fmtFecha(f: string): string {
  if (!f) return "—";
  const d = new Date(f + (f.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return f;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{valor || "—"}</span>
    </div>
  );
}

function TarjetaCert({ cert }: { cert: CertVerificado }) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="font-bold text-gray-900">Certificado N° {cert.consecutivo}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Coteje estos datos contra el documento que tiene en la mano. Deben coincidir exactamente.
        </p>
      </div>
      <div className="px-5 py-3">
        <Fila label="Generador" valor={cert.nombregenerador} />
        <Fila label="Cédula / NIT" valor={cert.cedulaEnmascarada} />
        <Fila label="Municipio" valor={cert.municipiogenerador} />
        <Fila label="Cultivo" valor={cert.cultivogenerador} />
        <Fila label="Fecha de recolección" valor={fmtFecha(cert.fechadevolucion)} />
        <Fila label="Lugar de devolución" valor={cert.lugardevolucion} />
        <Fila label="Municipio de devolución" valor={cert.municipiodevolucion} />
        <Fila label="Plásticos rígidos" valor={fmtKg(cert.rigidos)} />
        <Fila label="Plásticos flexibles" valor={fmtKg(cert.flexibles)} />
        <Fila label="Metálicos" valor={fmtKg(cert.metalicos)} />
        <Fila label="Embalajes / cartón" valor={fmtKg(cert.embalaje)} />
        <div className="flex justify-between gap-4 py-2 bg-green-50 -mx-5 px-5">
          <span className="text-sm font-bold text-green-900">TOTAL</span>
          <span className="text-sm font-bold text-green-900">{fmtKg(cert.total)}</span>
        </div>
        <Fila label="Triple lavado" valor={cert.triplelavado} />
        <Fila label="Coordinador que recibió" valor={cert.nombrecoordinador} />
      </div>
      {cert.pdfUrl && !cert.anulado && (
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <a
            href={cert.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#00a868] hover:underline"
          >
            Ver el PDF oficial emitido por CampoLimpio →
          </a>
        </div>
      )}
    </div>
  );
}

export default async function VerificacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let cert: CertVerificado | null = null;
  let errorConsulta = false;
  try {
    cert = await buscarCertPorToken(token);
  } catch (err) {
    console.error("[/v] error consultando certificado:", err);
    errorConsulta = true;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#042726] text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-lg font-bold">CampoLimpio</p>
          <p className="text-sm opacity-80">Verificación oficial de certificados — portal.campolimpio.org</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {errorConsulta ? (
          <div className="p-5 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <h1 className="font-bold text-yellow-800 text-lg">No pudimos consultar el registro</h1>
            <p className="text-sm text-yellow-800 mt-1">
              Ocurrió un error temporal. Intente de nuevo en unos minutos. Si persiste, escriba a certificados@campolimpio.org.
            </p>
          </div>
        ) : !cert ? (
          <div className="p-5 bg-red-50 border-2 border-red-300 rounded-lg">
            <h1 className="font-bold text-red-800 text-lg">⚠️ Código no encontrado</h1>
            <p className="text-sm text-red-800 mt-2">
              Este código <strong>NO corresponde a ningún certificado emitido por CampoLimpio</strong>.
            </p>
            <p className="text-sm text-red-800 mt-2">
              Si el documento que tiene muestra este código QR, puede tratarse de un certificado falso.
              Por favor repórtelo a <a className="underline font-medium" href="mailto:certificados@campolimpio.org">certificados@campolimpio.org</a> adjuntando una foto del documento.
            </p>
          </div>
        ) : cert.anulado ? (
          <>
            <div className="p-5 bg-red-50 border-2 border-red-300 rounded-lg">
              <h1 className="font-bold text-red-800 text-lg">❌ Certificado ANULADO</h1>
              <p className="text-sm text-red-800 mt-1">
                El certificado N° {cert.consecutivo} fue emitido por CampoLimpio pero está{" "}
                <strong>anulado{cert.anuladoEn ? ` desde el ${fmtFecha(cert.anuladoEn)}` : ""}</strong> y no tiene validez.
              </p>
            </div>
            <TarjetaCert cert={cert} />
          </>
        ) : (
          <>
            <div className="p-5 bg-green-50 border-2 border-green-400 rounded-lg">
              <h1 className="font-bold text-green-800 text-lg">✅ Certificado VIGENTE</h1>
              <p className="text-sm text-green-800 mt-1">
                Este certificado fue emitido por CampoLimpio y está registrado en nuestra base de datos oficial.
              </p>
            </div>
            <TarjetaCert cert={cert} />
          </>
        )}

        <div className="text-xs text-gray-500 space-y-2">
          <p>
            <strong>¿Cómo verificar?</strong> Esta página solo es auténtica en el dominio{" "}
            <strong>portal.campolimpio.org</strong>. Si llegó aquí desde un QR y la dirección del
            navegador muestra otro dominio, el documento es fraudulento.
          </p>
          <p>
            ¿Tiene un certificado sin código QR? Verifíquelo en{" "}
            <a className="underline" href="/verificar">portal.campolimpio.org/verificar</a>{" "}
            con el número del certificado y la cédula del generador.
          </p>
          <p>
            CampoLimpio Colombia — Programa de Manejo de Envases Vacíos ·{" "}
            <a className="underline" href="mailto:certificados@campolimpio.org">certificados@campolimpio.org</a>
          </p>
        </div>
      </main>
    </div>
  );
}
