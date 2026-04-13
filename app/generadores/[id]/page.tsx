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
    Certificados?: string[];
    coordinadores?: string[];
  };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/generadores/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("No encontrado");
        return r.json();
      })
      .then(setGenerador)
      .catch(() => setError("No se pudo cargar el generador"))
      .finally(() => setLoading(false));
  }, [id, status]);

  if (status === "loading" || loading) {
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
          <p className="text-red-500">{error || "Generador no encontrado"}</p>
          <Link href="/generadores" className="mt-4 inline-block text-green-600 hover:underline">
            ← Volver
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const f = generador.fields;

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/generadores" className="text-sm text-gray-500 hover:text-gray-700">
            ← Generadores
          </Link>
          <Link
            href={`/generadores/${id}/editar`}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Editar
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{f.nombregenerador || "Sin nombre"}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {f.tipogenerador || "AGRICOLA"} · Cédula {f.cedulagenerador || "—"}
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
              {f.conteo_certificados ?? 0} cert{(f.conteo_certificados ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Datos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Datos del generador</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Nombre" value={f.nombregenerador} />
            <Field label="Cédula / NIT" value={f.cedulagenerador} />
            <Field label="Dirección / Finca" value={f.direcciongenerador} />
            <Field label="Municipio" value={f.municipiogenerador} />
            <Field label="Cultivo" value={f.cultivogenerador} />
            <Field label="Tipo" value={f.tipogenerador} />
            <Field label="Móvil" value={f.movilgenerador} />
            <Field label="Email" value={f.emailgenerador} />
          </dl>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
