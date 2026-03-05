"use client";

import { useEffect, useState, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getCentrosAcopio, getAllKardex, type CentroAcopio, type Kardex } from "@/lib/airtable";
import { isAdminOrSupervisor } from "@/lib/roles";

interface SaldoCoordinador {
  coordId: string;
  nombre: string;
  entradas: number;
  salidas: number;
  saldo: number;
  centros: {
    centroId: string;
    nombre: string;
    entradas: number;
    salidas: number;
    saldo: number;
  }[];
  sinCentro: {
    entradas: number;
    salidas: number;
    saldo: number;
  };
  diferencia: number; // saldo coordinador vs suma centros propios
}

export default function SaldosCoordinadorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [centros, setCentros] = useState<CentroAcopio[]>([]);
  const [allKardex, setAllKardex] = useState<Kardex[]>([]);
  const [saldos, setSaldos] = useState<SaldoCoordinador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [datosYaCargados, setDatosYaCargados] = useState(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>("");
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const canViewAll = isAdminOrSupervisor(session?.user?.rol);

  useEffect(() => {
    async function cargarDatos() {
      if (datosYaCargados) return;
      try {
        setLoading(true);
        setError(null);

        const [centrosData, kardexData] = await Promise.all([
          getCentrosAcopio(),
          getAllKardex(),
        ]);

        setCentros(centrosData);
        setAllKardex(kardexData);

        const mesesSet = new Set<string>();
        kardexData.forEach((k) => {
          const mes = k.fields.MES;
          if (mes && typeof mes === "string" && mes.includes("-")) {
            mesesSet.add(mes);
          }
        });

        const mesesArray = Array.from(mesesSet).sort().reverse();
        setMesesDisponibles(mesesArray);

        if (mesesArray.length > 0 && !mesSeleccionado) {
          setMesSeleccionado(mesesArray[0]);
        }

        setLoading(false);
        setDatosYaCargados(true);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Error al cargar los datos.");
        setLoading(false);
      }
    }

    if (session && !datosYaCargados) {
      cargarDatos();
    }
  }, [session, datosYaCargados, mesSeleccionado, canViewAll]);

  useEffect(() => {
    if (!mesSeleccionado || centros.length === 0 || allKardex.length === 0) return;
    calcularSaldos(mesSeleccionado);
  }, [mesSeleccionado, centros, allKardex]);

  const calcularSaldos = (mes: string) => {
    const [anio, mesNum] = mes.split("-");
    const ultimoDiaMes = new Date(parseInt(anio), parseInt(mesNum), 0).getDate();
    const fechaFinMes = `${anio}-${mesNum}-${ultimoDiaMes.toString().padStart(2, "0")}`;

    // Kardex hasta fin del mes seleccionado
    const kardexHasta = allKardex.filter((k) => {
      const fecha = k.fields.fechakardex;
      if (!fecha) return false;
      return fecha <= fechaFinMes;
    });

    // Mapa centro -> coordinador dueño, nombre, saldo inicial
    const centroDueno = new Map<string, string>();
    const centroNombre = new Map<string, string>();
    const centroSaldoInicial = new Map<string, number>();
    for (const c of centros) {
      const coordId = c.fields.Coordinador?.[0];
      if (coordId) {
        centroDueno.set(c.id, coordId);
      }
      centroNombre.set(c.id, c.fields.Nombre || "Sin nombre");
      centroSaldoInicial.set(c.id, c.fields.SaldoInicialTotal || 0);
    }

    // Obtener todos los coordinadores únicos de kardex
    const coordNombres = new Map<string, string>();
    for (const k of kardexHasta) {
      const coordId = (k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0]);
      const nombre = k.fields["Name (from Coordinador)"]?.[0];
      if (coordId && nombre) {
        coordNombres.set(coordId, nombre);
      }
    }

    // Calcular por coordinador
    const resultado = new Map<string, SaldoCoordinador>();

    for (const [coordId, nombre] of coordNombres) {
      resultado.set(coordId, {
        coordId,
        nombre,
        entradas: 0,
        salidas: 0,
        saldo: 0,
        centros: [],
        sinCentro: { entradas: 0, salidas: 0, saldo: 0 },
        diferencia: 0,
      });
    }

    // Acumular por coordinador (todos los kardex del coordinador)
    for (const k of kardexHasta) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId || !resultado.has(coordId)) continue;
      const total = Math.abs(k.fields.Total || 0);
      const entry = resultado.get(coordId)!;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entry.entradas += total;
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        entry.salidas += total;
      }
    }

    // Acumular por centro de acopio
    const saldoPorCentro = new Map<string, { entradas: number; salidas: number }>();
    for (const k of kardexHasta) {
      const caId = k.fields.CentrodeAcopio?.[0];
      if (!caId) continue;
      if (!saldoPorCentro.has(caId)) {
        saldoPorCentro.set(caId, { entradas: 0, salidas: 0 });
      }
      const total = Math.abs(k.fields.Total || 0);
      const entry = saldoPorCentro.get(caId)!;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entry.entradas += total;
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        entry.salidas += total;
      }
    }

    // Kardex sin centro por coordinador
    for (const k of kardexHasta) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      const caId = k.fields.CentrodeAcopio?.[0];
      if (!coordId || !resultado.has(coordId)) continue;
      if (caId) continue; // tiene centro, skip
      const total = Math.abs(k.fields.Total || 0);
      const entry = resultado.get(coordId)!;
      if (k.fields.TipoMovimiento === "ENTRADA") {
        entry.sinCentro.entradas += total;
      } else if (k.fields.TipoMovimiento === "SALIDA") {
        entry.sinCentro.salidas += total;
      }
    }

    // Asignar centros a coordinadores (por dueño del centro)
    for (const [coordId, entry] of resultado) {
      entry.saldo = entry.entradas - entry.salidas;
      entry.sinCentro.saldo = entry.sinCentro.entradas - entry.sinCentro.salidas;

      // Centros que pertenecen a este coordinador
      const centrosCoord: SaldoCoordinador["centros"] = [];
      let sumaCentros = 0;
      for (const [caId, dueno] of centroDueno) {
        if (dueno !== coordId) continue;
        const ca = saldoPorCentro.get(caId);
        const ent = ca?.entradas || 0;
        const sal = ca?.salidas || 0;
        const si = centroSaldoInicial.get(caId) || 0;
        const saldo = si + ent - sal;
        sumaCentros += saldo;
        if (ent > 0 || sal > 0 || si !== 0) {
          centrosCoord.push({
            centroId: caId,
            nombre: centroNombre.get(caId) || "Sin nombre",
            entradas: ent,
            salidas: sal,
            saldo,
          });
        }
      }
      entry.centros = centrosCoord.sort((a, b) => b.saldo - a.saldo);
      entry.diferencia = entry.saldo - sumaCentros;
    }

    const resultList = Array.from(resultado.values())
      .filter((s) => s.entradas > 0 || s.salidas > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    setSaldos(resultList);
  };

  const formatKg = (kg: number) =>
    new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(kg);

  const formatMesLabel = (mesStr: string): string => {
    if (!mesStr || !mesStr.includes("-")) return "N/A";
    const [anio, mes] = mesStr.split("-");
    const fecha = new Date(parseInt(anio), parseInt(mes) - 1, 1);
    return fecha.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
  };

  if (status === "loading" || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d084] mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!canViewAll) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto p-6">
          <p className="text-red-600">Solo administradores pueden ver esta pagina.</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const totalEntradas = saldos.reduce((s, c) => s + c.entradas, 0);
  const totalSalidas = saldos.reduce((s, c) => s + c.salidas, 0);
  const totalSaldo = saldos.reduce((s, c) => s + c.saldo, 0);
  const totalSumaCentros = saldos.reduce(
    (s, c) => s + c.centros.reduce((sc, ca) => sc + ca.saldo, 0),
    0
  );
  const totalDiferencia = saldos.reduce((s, c) => s + c.diferencia, 0);

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Saldos por Coordinador
          </h1>
          <p className="text-gray-600 mt-1">
            Comparativo: saldo por kardex del coordinador vs suma de sus centros de acopio
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Acumulado hasta:</label>
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00d084] focus:border-transparent"
            >
              {mesesDisponibles.map((mes) => (
                <option key={mes} value={mes}>
                  {formatMesLabel(mes)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen global */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-600 mb-1">Entradas (coord)</div>
            <div className="text-lg font-bold text-green-600">{formatKg(totalEntradas)} kg</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-600 mb-1">Salidas (coord)</div>
            <div className="text-lg font-bold text-red-600">{formatKg(totalSalidas)} kg</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-600 mb-1">Saldo (coord)</div>
            <div className="text-lg font-bold text-blue-600">{formatKg(totalSaldo)} kg</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="text-sm text-gray-600 mb-1">Saldo (centros)</div>
            <div className="text-lg font-bold text-purple-600">{formatKg(totalSumaCentros)} kg</div>
          </div>
          <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${Math.abs(totalDiferencia) < 1 ? "border-green-500" : "border-orange-500"}`}>
            <div className="text-sm text-gray-600 mb-1">Diferencia</div>
            <div className={`text-lg font-bold ${Math.abs(totalDiferencia) < 1 ? "text-green-600" : "text-orange-600"}`}>
              {formatKg(totalDiferencia)} kg
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Coordinador</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Entradas</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Salidas</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Saldo Coord</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Saldo Centros</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diferencia</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s, idx) => {
                const sumaCentros = s.centros.reduce((sum, c) => sum + c.saldo, 0);
                return (
                  <Fragment key={s.coordId}>
                    <tr
                      className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.nombre}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-green-600">
                        {formatKg(s.entradas)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-red-600">
                        {formatKg(s.salidas)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono font-bold text-blue-700">
                        {formatKg(s.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono font-bold text-purple-700">
                        {formatKg(sumaCentros)}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-mono font-bold ${Math.abs(s.diferencia) < 1 ? "text-green-600" : "text-orange-600"}`}>
                        {Math.abs(s.diferencia) < 1 ? "0" : formatKg(s.diferencia)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandido(expandido === s.coordId ? null : s.coordId)}
                          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        >
                          {expandido === s.coordId ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>

                    {expandido === s.coordId && (
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-700 mb-3">
                            Centros de acopio de {s.nombre}:
                          </div>
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-gray-500 uppercase">
                                <th className="text-left pb-2">Centro</th>
                                <th className="text-right pb-2">Entradas</th>
                                <th className="text-right pb-2">Salidas</th>
                                <th className="text-right pb-2">Saldo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.centros.map((c) => (
                                <tr key={c.centroId} className="border-t border-gray-200">
                                  <td className="py-1 text-sm">{c.nombre}</td>
                                  <td className="py-1 text-right text-sm font-mono text-green-600">
                                    {formatKg(c.entradas)}
                                  </td>
                                  <td className="py-1 text-right text-sm font-mono text-red-600">
                                    {formatKg(c.salidas)}
                                  </td>
                                  <td className="py-1 text-right text-sm font-mono font-bold">
                                    {formatKg(c.saldo)}
                                  </td>
                                </tr>
                              ))}
                              {(s.sinCentro.entradas > 0 || s.sinCentro.salidas > 0) && (
                                <tr className="border-t border-orange-200 bg-orange-50">
                                  <td className="py-1 text-sm text-orange-700 font-medium">
                                    Sin centro de acopio
                                  </td>
                                  <td className="py-1 text-right text-sm font-mono text-orange-600">
                                    {formatKg(s.sinCentro.entradas)}
                                  </td>
                                  <td className="py-1 text-right text-sm font-mono text-orange-600">
                                    {formatKg(s.sinCentro.salidas)}
                                  </td>
                                  <td className="py-1 text-right text-sm font-mono font-bold text-orange-700">
                                    {formatKg(s.sinCentro.saldo)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {Math.abs(s.diferencia) >= 1 && (
                            <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">
                              Diferencia de {formatKg(s.diferencia)} kg entre saldo coordinador y suma de centros.
                              Puede ser por kardex sin centro asignado o en centros de otro coordinador.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Totales */}
              <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                <td className="px-4 py-3 text-sm">TOTAL</td>
                <td className="px-4 py-3 text-right text-sm font-mono text-green-700">{formatKg(totalEntradas)}</td>
                <td className="px-4 py-3 text-right text-sm font-mono text-red-700">{formatKg(totalSalidas)}</td>
                <td className="px-4 py-3 text-right text-sm font-mono text-blue-700">{formatKg(totalSaldo)}</td>
                <td className="px-4 py-3 text-right text-sm font-mono text-purple-700">{formatKg(totalSumaCentros)}</td>
                <td className={`px-4 py-3 text-right text-sm font-mono ${Math.abs(totalDiferencia) < 1 ? "text-green-600" : "text-orange-600"}`}>
                  {Math.abs(totalDiferencia) < 1 ? "0" : formatKg(totalDiferencia)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
