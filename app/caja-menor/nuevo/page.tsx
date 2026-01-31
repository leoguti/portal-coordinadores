"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import TerceroSearch from "@/components/TerceroSearch";
import { getFechaMinimaPermitida, getFechaMaximaPermitida } from "@/lib/dateValidations";

interface Tercero {
  id: string;
  razonSocial: string;
  nit?: string;
  direccion?: string;
}

export default function NuevoGastoCajaMenorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [fecha, setFecha] = useState(getFechaMaximaPermitida());
  const [beneficiario, setBeneficiario] = useState<Tercero | null>(null);
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [porcentajeRetencion, setPorcentajeRetencion] = useState("0");
  const [factura, setFactura] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const valorNum = parseFloat(valor) || 0;
  const retencionNum = parseFloat(porcentajeRetencion) || 0;
  const valorRetencion = valorNum * retencionNum / 100;
  const valorNeto = valorNum - valorRetencion;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!beneficiario) {
      setError("Debes seleccionar un beneficiario");
      return;
    }
    if (!concepto.trim()) {
      setError("Debes ingresar un concepto");
      return;
    }
    if (valorNum <= 0) {
      setError("El valor debe ser mayor a 0");
      return;
    }

    setSaving(true);

    try {
      // Si hay factura, primero subirla
      let facturaUrl: string | undefined;
      if (factura) {
        const formData = new FormData();
        formData.append("file", factura);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          facturaUrl = uploadData.url;
        } else {
          setError("Error al subir la factura. Intenta de nuevo.");
          setSaving(false);
          return;
        }
      }

      const response = await fetch("/api/caja-menor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          beneficiarioId: beneficiario.id,
          concepto: concepto.trim(),
          valor: valorNum,
          porcentajeRetencion: retencionNum,
          facturaUrl,
        }),
      });

      if (response.ok) {
        router.push("/caja-menor");
      } else {
        const data = await response.json();
        setError(data.error || "Error al crear el gasto");
      }
    } catch (err) {
      console.error("Error creating gasto:", err);
      setError("Error al crear el gasto. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Link href="/caja-menor" className="hover:text-[#00d084] transition-colors">
            Caja Menor
          </Link>
          <span>&rsaquo;</span>
          <span>Nuevo Gasto</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Registrar Gasto</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          {/* Fecha */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del gasto <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              min={getFechaMinimaPermitida()}
              max={getFechaMaximaPermitida()}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Solo se permiten fechas dentro del periodo modificable (regla 7 dias)
            </p>
          </div>

          {/* Beneficiario */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beneficiario <span className="text-red-500">*</span>
            </label>
            <TerceroSearch
              value={beneficiario}
              onChange={setBeneficiario}
              required
              placeholder="Buscar beneficiario por nombre o NIT..."
            />
            {beneficiario && beneficiario.nit && (
              <p className="text-xs text-gray-500 mt-1">
                NIT/CC: {beneficiario.nit}
                {beneficiario.direccion && ` | Dir: ${beneficiario.direccion}`}
              </p>
            )}
          </div>

          {/* Concepto */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Descripcion del gasto..."
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
            />
          </div>

          {/* Valor y Retencion en fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (COP) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
                min="1"
                step="1"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                % Retencion
              </label>
              <input
                type="number"
                value={porcentajeRetencion}
                onChange={(e) => setPorcentajeRetencion(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#00d084] focus:border-transparent font-mono"
              />
            </div>
          </div>

          {/* Calculo automatico */}
          {valorNum > 0 && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase">Resumen</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Valor bruto</p>
                  <p className="font-mono font-bold text-gray-900">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      minimumFractionDigits: 0,
                    }).format(valorNum)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Retencion ({retencionNum}%)</p>
                  <p className="font-mono font-bold text-red-600">
                    -{new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      minimumFractionDigits: 0,
                    }).format(valorRetencion)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Valor neto</p>
                  <p className="font-mono font-bold text-[#00d084] text-lg">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      minimumFractionDigits: 0,
                    }).format(valorNeto)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Factura */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Factura / Soporte
            </label>
            <input
              ref={facturaInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFactura(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => facturaInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm border border-gray-300"
              >
                {factura ? "Cambiar archivo" : "Seleccionar archivo"}
              </button>
              {factura && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{factura.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFactura(null);
                      if (facturaInputRef.current) facturaInputRef.current.value = "";
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Quitar
                  </button>
                </div>
              )}
              {!factura && (
                <span className="text-sm text-gray-400">Imagen o PDF de la factura</span>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-300">
            <Link
              href="/caja-menor"
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#00d084] hover:bg-[#00a868] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Registrar Gasto"}
            </button>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  );
}
