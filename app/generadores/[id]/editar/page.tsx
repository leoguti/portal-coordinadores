"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MunicipioSearch from "@/components/MunicipioSearch";

interface FormData {
  nombregenerador: string;
  cedulagenerador: string;
  direcciongenerador: string;
  cultivogenerador: string;
  movilgenerador: string;
  emailgenerador: string;
  tipogenerador: string;
}

const TIPOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"];

export default function EditarGeneradorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormData>({
    nombregenerador: "",
    cedulagenerador: "",
    direcciongenerador: "",
    cultivogenerador: "",
    movilgenerador: "",
    emailgenerador: "",
    tipogenerador: "AGRICOLA",
  });

  const [municipio, setMunicipio] = useState<{ id: string; mundep: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/generadores/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const f = data.fields || {};
        setForm({
          nombregenerador: f.nombregenerador || "",
          cedulagenerador: f.cedulagenerador || "",
          direcciongenerador: f.direcciongenerador || "",
          cultivogenerador: f.cultivogenerador || "",
          movilgenerador: f.movilgenerador || "",
          emailgenerador: f.emailgenerador || "",
          tipogenerador: f.tipogenerador || "AGRICOLA",
        });
        // Precargar municipio si tiene CODIGOMUN
        if (data.codigomunId && data.mundep) {
          setMunicipio({ id: data.codigomunId, mundep: data.mundep });
        }
      })
      .catch(() => setError("No se pudo cargar la finca"))
      .finally(() => setLoading(false));
  }, [id, status]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/generadores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          municipioId: municipio?.id || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      // Invalida la caché del enrutador: sin esto la ficha se pinta con
      // los datos viejos hasta ~30s después (reporte de Ángela 2026-08-31).
      router.refresh();
      router.push(`/generadores/${id}`);
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <Link href={`/generadores/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al detalle
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-6">Editar finca</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input
                  name="nombregenerador"
                  value={form.nombregenerador}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cédula / NIT</label>
                <input
                  name="cedulagenerador"
                  value={form.cedulagenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección / Nombre finca</label>
                <input
                  name="direcciongenerador"
                  value={form.direcciongenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Municipio *</label>
                <MunicipioSearch
                  value={municipio}
                  onChange={setMunicipio}
                  placeholder="Buscar municipio..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cultivo</label>
                <input
                  name="cultivogenerador"
                  value={form.cultivogenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  name="tipogenerador"
                  value={form.tipogenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Móvil</label>
                <input
                  name="movilgenerador"
                  value={form.movilgenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  name="emailgenerador"
                  type="email"
                  value={form.emailgenerador}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#042726] text-white text-sm rounded-lg hover:bg-[#032120] disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <Link
                href={`/generadores/${id}`}
                className="px-5 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
