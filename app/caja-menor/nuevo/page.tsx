"use client";

import { useState, useRef, useEffect } from "react";
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

interface KardexDisponible {
  id: string;
  fields: {
    idkardex?: number;
    fechakardex?: string;
    TipoMovimiento?: string;
    "mundep (from MunicipioOrigen)"?: string[];
    Total?: number;
  };
}

export default function NuevoGastoCajaMenorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [verificandoSaldo, setVerificandoSaldo] = useState(true);

  // Verificar que el coordinador tenga saldo inicial asignado
  useEffect(() => {
    async function verificarSaldo() {
      if (!session?.user?.coordinatorRecordId) return;
      try {
        const res = await fetch(
          `/api/caja-menor/asignaciones?coordinadorId=${session.user.coordinatorRecordId}`
        );
        if (res.ok) {
          const { saldoInicial } = await res.json();
          // Si no tiene saldo inicial, redirigir
          if (saldoInicial === 0 || saldoInicial === undefined) {
            router.replace("/caja-menor");
            return;
          }
        }
      } catch {
        // Si falla la verificación, permitir continuar
      }
      setVerificandoSaldo(false);
    }
    if (session?.user?.coordinatorRecordId) {
      verificarSaldo();
    }
  }, [session?.user?.coordinatorRecordId, router]);

  const [fecha, setFecha] = useState(getFechaMaximaPermitida());
  const [beneficiario, setBeneficiario] = useState<Tercero | null>(null);
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [porcentajeRetencion, setPorcentajeRetencion] = useState("0");
  const [factura, setFactura] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facturaInputRef = useRef<HTMLInputElement>(null);

  // Kardex Caja Menor
  const [kardexDisponibles, setKardexDisponibles] = useState<KardexDisponible[]>([]);
  const [kardexSeleccionados, setKardexSeleccionados] = useState<string[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(true);

  // Cargar Kardex "Caja Menor" disponibles
  useEffect(() => {
    async function fetchKardex() {
      try {
        const res = await fetch("/api/kardex/caja-menor");
        if (res.ok) {
          const data = await res.json();
          setKardexDisponibles(data.kardex || []);
        }
      } catch {
        // Si falla, simplemente no mostrar la sección
      } finally {
        setLoadingKardex(false);
      }
    }
    if (session?.user?.coordinatorRecordId) {
      fetchKardex();
    } else {
      setLoadingKardex(false);
    }
  }, [session?.user?.coordinatorRecordId]);

  function toggleKardex(kardexId: string) {
    setKardexSeleccionados((prev) =>
      prev.includes(kardexId)
        ? prev.filter((id) => id !== kardexId)
        : [...prev, kardexId]
    );
  }

  if (status === "loading" || verificandoSaldo) {
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

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

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
    if (!factura) {
      setError("Debes adjuntar la factura o soporte del gasto");
      return;
    }

    setSaving(true);

    try {
      // 1. Crear el gasto primero (sin factura)
      const response = await fetch("/api/caja-menor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          beneficiarioId: beneficiario.id,
          concepto: concepto.trim(),
          valor: valorNum,
          porcentajeRetencion: retencionNum,
          ...(kardexSeleccionados.length > 0 && { kardexIds: kardexSeleccionados }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Error al crear el gasto");
        setSaving(false);
        return;
      }

      const { gasto: gastoCreado } = await response.json();

      // 2. Si hay factura, subirla al registro creado
      if (factura && gastoCreado?.id) {
        const base64 = await fileToBase64(factura);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: gastoCreado.id,
            fieldName: "Factura",
            file: base64,
            filename: factura.name,
            contentType: factura.type,
          }),
        });

        if (!uploadRes.ok) {
          // El gasto se creo pero la factura fallo - no es critico
          console.error("Error subiendo factura, pero el gasto fue creado");
        }
      }

      router.push("/caja-menor");
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

          {/* Kardex Caja Menor (opcional) */}
          {!loadingKardex && kardexDisponibles.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kardex relacionados <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {kardexDisponibles.map((k) => {
                  const checked = kardexSeleccionados.includes(k.id);
                  const fechaStr = k.fields.fechakardex
                    ? new Date(k.fields.fechakardex + "T00:00:00").toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "";
                  const municipio = k.fields["mundep (from MunicipioOrigen)"]?.[0] || "";
                  const total = k.fields.Total || 0;
                  return (
                    <label
                      key={k.id}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        checked ? "bg-green-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKardex(k.id)}
                        className="accent-[#00d084] w-4 h-4"
                      />
                      <span className="text-sm text-gray-800">
                        <span className="font-mono font-bold">#{k.fields.idkardex}</span>
                        {" - "}
                        {fechaStr}
                        {" - "}
                        <span className="font-medium">{k.fields.TipoMovimiento}</span>
                        {municipio && ` - ${municipio}`}
                        {" "}
                        <span className="text-gray-500">({total.toLocaleString("es-CO")} kg)</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {kardexSeleccionados.length > 0 && (
                <p className="text-xs text-[#00d084] font-medium mt-1">
                  {kardexSeleccionados.length} kardex seleccionado{kardexSeleccionados.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

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
              Factura / Soporte <span className="text-red-500">*</span>
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
