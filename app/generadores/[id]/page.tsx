"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Generador {
  id: string;
  fields: {
    nombregenerador?: string;
    cedulagenerador?: string;
    direcciongenerador?: string;
    municipiogenerador?: string;
    cultivogenerador?: string;
    movilgenerador?: string;
    emailgenerador?: string;
    tipogenerador?: string;
    conteo_certificados?: number;
  };
}

interface Certificado {
  consecutivo: number | null;
  fechadevolucion: string | null;
  ano: number | null;
  municipiodevolucion: string | null;
  total: number | null;
  rigidos: number | null;
  flexibles: number | null;
  metalicos: number | null;
  embalaje: number | null;
  triplelavado: string | null;
  nombrecoordinador: string | null;
  certificadopdf_r2_url: string | null;
}

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default function GeneradorDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [generador, setGenerador] = useState<Generador | null>(null);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loadingG, setLoadingG] = useState(true);
  const [loadingC, setLoadingC] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Fetch generador
    fetch(`/api/generadores/${id}`)
      .then((r) => { if (!r.ok) throw new Error("No encontrado"); return r.json(); })
      .then(setGenerador)
      .catch(() => setError("No se pudo cargar la finca"))
      .finally(() => setLoadingG(false));

    // Fetch certificados
    fetch(`/api/generadores/${id}/certificados`)
      .then((r) => r.json())
      .then((d) => setCertificados(d.certificados || []))
      .catch(() => setCertificados([]))
      .finally(() => setLoadingC(false));
  }, [id, status]);

  if (status === "loading" || loadingG) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error || !generador) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-2xl mx-auto text-center py-24">
          <p className="text-red-500">{error || "Finca no encontrada"}</p>
          <Link href="/generadores" className="mt-4 inline-block text-green-600 hover:underline">← Fincas</Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const f = generador.fields;

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        {/* Breadcrumb + acciones */}
        <div className="flex items-center justify-between">
          <Link href="/generadores" className="text-sm text-gray-500 hover:text-gray-700">← Fincas</Link>
          <Link
            href={`/generadores/${id}/editar`}
            className="px-4 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] transition-colors"
          >
            Editar finca
          </Link>
        </div>

        {/* Datos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{f.nombregenerador || "Sin nombre"}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {f.tipogenerador || "AGRICOLA"} · {f.cedulagenerador || "Sin cédula"}
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
              {f.conteo_certificados ?? 0} cert{(f.conteo_certificados ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Dirección / Finca" value={f.direcciongenerador} />
            <Field label="Municipio" value={f.municipiogenerador} />
            <Field label="Cultivo" value={f.cultivogenerador} />
            <Field label="Tipo" value={f.tipogenerador} />
            <Field label="Móvil" value={f.movilgenerador} />
            <Field label="Email" value={f.emailgenerador} />
          </dl>
        </div>

        {/* Certificados */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Certificados</h2>
            {!loadingC && (
              <span className="text-xs text-gray-400">{certificados.length} registros</span>
            )}
          </div>

          {loadingC ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
            </div>
          ) : certificados.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Sin certificados registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Municipio devolución</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Coordinador</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certificados.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {c.consecutivo ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                      {c.fechadevolucion
                        ? new Date(c.fechadevolucion).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[180px]">
                      <div className="truncate">{c.municipiodevolucion || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-gray-800">
                      {c.total ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[140px]">
                      <div className="truncate">{c.nombrecoordinador || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.certificadopdf_r2_url ? (
                        <a
                          href={c.certificadopdf_r2_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-700 hover:text-green-900 font-medium"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
