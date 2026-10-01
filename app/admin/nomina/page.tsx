"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

interface Fila {
  documento: string;
  persona: string;
  cargo: string;
  centroCosto: number | null;
  tipo: "Zona" | "Oficina";
  costoTotalEmpresa: number;
  mediosTransporte: number;
  zona1: string;
  pct1: number;
  zona2: string;
  pct2: number;
}
interface Resumen {
  mes: string | null;
  personas: number;
  costoTotal: number;
  filas: Fila[];
  errores: string[];
  alertas: string[];
  yaCargado: boolean;
  guardado?: { creadas: number; actualizadas: number; borradas: number };
  error?: string;
}
interface MesCargado {
  mes: string;
  personas: number;
  costoTotal: number;
  fechaCarga: string;
  cargadoPor: string;
}

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => (n ? Math.round(n * 100) + " %" : "");

export default function NominaPage() {
  const { status } = useSession();
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [meses, setMeses] = useState<MesCargado[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [denegado, setDenegado] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const cargarMeses = () =>
    fetch("/api/nomina")
      .then(async (r) => {
        if (r.status === 403) {
          setDenegado(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => d && setMeses(d.meses || []));

  useEffect(() => {
    if (status === "authenticated") cargarMeses();
  }, [status]);

  async function enviar(accion: "previsualizar" | "guardar") {
    if (!archivo) return;
    setOcupado(true);
    setError("");
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("accion", accion);
    try {
      const r = await fetch("/api/nomina", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok && !d.filas) throw new Error(d.error || "Error al procesar el archivo");
      setResumen(d);
      if (d.error) setError(d.error);
      if (accion === "guardar" && d.guardado) cargarMeses();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (status === "loading") return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Nómina mensual</h1>
          <Link href="/dashboard-ejecutivo" className="text-sm text-[#00a868] hover:underline">
            ← Volver al dashboard
          </Link>
        </div>

        {denegado ? (
          <div className="bg-red-50 rounded-lg border border-red-200 p-6 text-center text-red-700">
            Acceso restringido. La nómina solo la gestionan Administración y Dirección.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
              <h2 className="font-semibold text-gray-800 mb-2">Subir el Excel de nómina</h2>
              <ol className="text-sm text-gray-600 list-decimal ml-5 space-y-1 mb-4">
                <li>Liquide la nómina como siempre en su Excel y escriba el mes en la celda B2 de la hoja <b>RESUMEN_COSTOS</b> (formato AAAA-MM).</li>
                <li>Revise que la zona y el % de cada persona estén correctos (las celdas amarillas).</li>
                <li>Guarde el archivo como <b>.xlsx</b> y súbalo aquí. Primero verá una vista previa; nada se guarda hasta que confirme.</li>
              </ol>
              <p className="text-xs text-gray-500 mb-4">
                Plazo: día 5 del mes siguiente. Solo se guardan las cifras de la hoja RESUMEN_COSTOS, no el archivo.
                Si sube otra vez el mismo mes, reemplaza la carga anterior.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] || null);
                    setResumen(null);
                    setError("");
                  }}
                  className="text-sm"
                />
                <button
                  disabled={!archivo || ocupado}
                  onClick={() => enviar("previsualizar")}
                  className="rounded-lg bg-[#042726] text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  {ocupado ? "Procesando…" : "Ver vista previa"}
                </button>
              </div>
              {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
            </div>

            {resumen && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
                  <h2 className="font-semibold text-gray-800">
                    Vista previa · {resumen.mes || "mes no identificado"}
                  </h2>
                  <span className="text-sm text-gray-600">
                    {resumen.personas} personas · costo total empresa <b>{pesos(resumen.costoTotal)}</b>
                  </span>
                </div>

                {resumen.errores.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700">
                    <b>Hay que corregir en el Excel antes de guardar:</b>
                    <ul className="list-disc ml-5 mt-1">{resumen.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
                {resumen.alertas.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                    <b>Revise:</b>
                    <ul className="list-disc ml-5 mt-1">{resumen.alertas.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
                {resumen.guardado && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm text-green-800">
                    ✅ Nómina de {resumen.mes} guardada: {resumen.guardado.creadas} nuevas,{" "}
                    {resumen.guardado.actualizadas} actualizadas, {resumen.guardado.borradas} retiradas.
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="text-left px-2 py-2">Persona</th>
                        <th className="text-left px-2 py-2">Cargo</th>
                        <th className="text-center px-2 py-2">C. costo</th>
                        <th className="text-center px-2 py-2">Tipo</th>
                        <th className="text-right px-2 py-2">Costo total empresa</th>
                        <th className="text-left px-2 py-2">Zona(s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.filas.map((f) => (
                        <tr key={f.documento + f.persona} className="border-t border-gray-100">
                          <td className="px-2 py-1.5">{f.persona}</td>
                          <td className="px-2 py-1.5 text-gray-500">{f.cargo}</td>
                          <td className="px-2 py-1.5 text-center">{f.centroCosto ?? ""}</td>
                          <td className="px-2 py-1.5 text-center">{f.tipo}</td>
                          <td className="px-2 py-1.5 text-right">{pesos(f.costoTotalEmpresa)}</td>
                          <td className="px-2 py-1.5">
                            {f.tipo === "Oficina"
                              ? <span className="text-gray-400">—</span>
                              : [f.zona1 && `${f.zona1} ${pct(f.pct1)}`, f.zona2 && `${f.zona2} ${pct(f.pct2)}`].filter(Boolean).join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!resumen.guardado && (
                  <div className="mt-4 flex justify-end">
                    <button
                      disabled={ocupado || resumen.errores.length > 0}
                      onClick={() => enviar("guardar")}
                      className="rounded-lg bg-[#00d084] text-white px-5 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      {resumen.yaCargado ? "Reemplazar la nómina de " : "Guardar la nómina de "}
                      {resumen.mes}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Meses cargados</h2>
              {meses.length === 0 ? (
                <p className="text-sm text-gray-500">Todavía no se ha cargado ningún mes.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-2 py-2">Mes</th>
                      <th className="text-right px-2 py-2">Personas</th>
                      <th className="text-right px-2 py-2">Costo total empresa</th>
                      <th className="text-left px-2 py-2">Cargado por</th>
                      <th className="text-left px-2 py-2">Fecha de carga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meses.map((m) => (
                      <tr key={m.mes} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-medium">{m.mes}</td>
                        <td className="px-2 py-1.5 text-right">{m.personas}</td>
                        <td className="px-2 py-1.5 text-right">{pesos(m.costoTotal)}</td>
                        <td className="px-2 py-1.5 text-gray-500">{m.cargadoPor}</td>
                        <td className="px-2 py-1.5 text-gray-500">
                          {m.fechaCarga ? new Date(m.fechaCarga).toLocaleString("es-CO") : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
