"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TipoPeriodo = "trimestre" | "semestre" | "anio";
interface FilaZona {
  zona: string;
  gasto: number;
  kgEntrada: number;
  kgSalida: number;
  kgTrabajado: number;
  costoEntrada: number | null;
  costoSalida: number | null;
  costoTrabajado: number | null;
  nomina: number;
  costoTrabajadoConNomina: number | null;
}
interface Data {
  periodo: { year: number; tipo: TipoPeriodo; n: number; etiqueta: string };
  anterior: { etiqueta: string };
  actual: { meses: string[]; filas: FilaZona[]; total: FilaZona; mesesSinNomina: string[] };
  previo: { filas: FilaZona[]; total: FilaZona };
  puedeCargarNomina: boolean;
}

const pesos = (n: number | null) =>
  n === null ? "—" : "$" + Math.round(n).toLocaleString("es-CO");
const kg = (n: number) => Math.round(n).toLocaleString("es-CO");
const millones = (n: number) => "$" + (n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M";

function Variacion({ actual, previo }: { actual: number | null; previo: number | null }) {
  if (actual === null || previo === null || previo === 0) return <span className="text-gray-300">—</span>;
  const p = ((actual - previo) / previo) * 100;
  const sube = p > 0;
  return (
    <span className={`text-xs font-semibold ${sube ? "text-red-600" : "text-green-700"}`}>
      {sube ? "▲" : "▼"} {Math.abs(p).toFixed(0)} %
    </span>
  );
}

function TarjetaFlujo({ f, etiqueta }: { f: FilaZona; etiqueta: string }) {
  const bodega = f.kgEntrada - f.kgSalida;
  const lo = Math.min(f.costoEntrada ?? 0, f.costoSalida ?? 0);
  const hi = Math.max(f.costoEntrada ?? 0, f.costoSalida ?? 0);
  const pos =
    f.costoTrabajado !== null && hi > lo ? ((f.costoTrabajado - lo) / (hi - lo)) * 100 : 50;
  const entradaIzq = (f.costoEntrada ?? 0) <= (f.costoSalida ?? 0);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-[#042726]">
          {f.zona === "TOTAL" ? "Todas las zonas" : f.zona} · {etiqueta}
        </h3>
        <span className="text-sm text-gray-500">
          Gasto del periodo (sin nómina): <b className="text-gray-800">{millones(f.gasto)}</b>
        </span>
      </div>

      {/* Flujo */}
      <div className="flex items-center gap-2 mt-5 text-sm">
        <div className="rounded-xl bg-green-50 text-green-800 font-semibold px-3 py-2 text-center w-32">
          Productores y jornadas
        </div>
        <div className="flex-1 text-center">
          <div className="text-gray-500">entró</div>
          <div className="text-xl font-bold text-[#00a86a]">{kg(f.kgEntrada)} kg</div>
          <div className="h-1 bg-[#00a86a] rounded" />
        </div>
        <div className="rounded-xl bg-[#042726] text-white font-semibold px-3 py-2 text-center w-48">
          Centro de acopio
          <div className="text-xs font-normal text-green-200 mt-1">
            {Math.abs(bodega) < 1
              ? "sin cambio en bodega"
              : bodega > 0
              ? `+${kg(bodega)} kg quedaron en bodega`
              : `salieron ${kg(-bodega)} kg que estaban en bodega`}
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-gray-500">salió</div>
          <div className="text-xl font-bold text-red-700">{kg(f.kgSalida)} kg</div>
          <div className="h-1 bg-red-700 rounded" />
        </div>
        <div className="rounded-xl bg-red-50 text-red-800 font-semibold px-3 py-2 text-center w-32">
          Disposición final
        </div>
      </div>

      {/* Costo */}
      <div className="flex gap-6 mt-6 items-center flex-wrap">
        <div className="rounded-xl bg-[#00d084] px-5 py-3 min-w-[220px]">
          <div className="text-xs font-bold text-[#042726]">COSTO POR KILO TRABAJADO</div>
          <div className="text-3xl font-extrabold text-[#042726]">{pesos(f.costoTrabajado)}</div>
          <div className="text-xs text-[#042726]">punto medio entre lo que cuesta recibir y despachar</div>
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="text-xs text-gray-500 mb-5">El costo real de un kilo está entre estas dos cifras:</div>
          <div className="relative h-2 rounded bg-gradient-to-r from-[#00a86a] to-red-700 mx-4">
            <div
              className="absolute -top-2 w-6 h-6 rounded-full bg-[#00d084] border-4 border-[#042726]"
              style={{ left: `calc(${entradaIzq ? pos : 100 - pos}% - 12px)` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-xs">
            <div>
              <b className="text-base text-[#00a86a]">{pesos(entradaIzq ? f.costoEntrada : f.costoSalida)}</b>
              <br />por kilo que {entradaIzq ? "entró" : "salió"}
            </div>
            <div className="text-right">
              <b className="text-base text-red-700">{pesos(entradaIzq ? f.costoSalida : f.costoEntrada)}</b>
              <br />por kilo que {entradaIzq ? "salió" : "entró"}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Gastamos tanto al <b>recibir</b> el material como al <b>despacharlo</b> a disposición final.
        Cuando queda material en bodega (o sale material de periodos anteriores), las dos cifras se
        separan y el costo real queda en medio.
      </p>
    </div>
  );
}

export default function CostoPorKilo() {
  const hoy = new Date();
  const [year, setYear] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoPeriodo>("trimestre");
  const [n, setN] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const clave = `${year}|${tipo}|${n}`;
  const [claveCargada, setClaveCargada] = useState<string | null>(null);
  const cargando = claveCargada !== clave;
  const [zonaSel, setZonaSel] = useState<string>("TOTAL");

  useEffect(() => {
    const q = new URLSearchParams({ tipo });
    if (year) q.set("year", String(year));
    if (n) q.set("n", String(n));
    fetch(`/api/dashboard/costo-kilo?${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Error");
        return r.json();
      })
      .then((d: Data) => {
        setError("");
        setData(d);
        if (year === null) setYear(d.periodo.year);
        if (n === null) setN(d.periodo.n);
      })
      .catch((e) => setError(e.message))
      .finally(() => setClaveCargada(`${year}|${tipo}|${n}`));
  }, [year, tipo, n]);

  const nMax = tipo === "trimestre" ? 4 : tipo === "semestre" ? 2 : 1;
  const filaSel =
    data && (zonaSel === "TOTAL" ? data.actual.total : data.actual.filas.find((f) => f.zona === zonaSel));
  const previoDe = (z: string) =>
    data ? (z === "TOTAL" ? data.previo.total : data.previo.filas.find((f) => f.zona === z)) : undefined;
  const nominaCompleta = data ? data.actual.mesesSinNomina.length === 0 : false;
  const filasConDatos = data ? data.actual.filas.filter((f) => f.gasto > 0 || f.kgEntrada > 0 || f.kgSalida > 0) : [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={year ?? ""}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {[hoy.getFullYear(), hoy.getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
          {(["trimestre", "semestre", "anio"] as TipoPeriodo[]).map((t, i) => (
            <button
              key={t}
              onClick={() => {
                setTipo(t);
                setN(1);
              }}
              className={`px-3 py-2 ${i ? "border-l border-gray-300" : ""} ${
                tipo === t ? "bg-[#00d084] text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "trimestre" ? "Trimestre" : t === "semestre" ? "Semestre" : "Año"}
            </button>
          ))}
        </div>
        {nMax > 1 && (
          <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
            {Array.from({ length: nMax }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                onClick={() => setN(k)}
                className={`px-3 py-2 ${k > 1 ? "border-l border-gray-300" : ""} ${
                  n === k ? "bg-[#042726] text-white" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tipo === "trimestre" ? `T${k}` : `S${k}`}
              </button>
            ))}
          </div>
        )}
        {data?.puedeCargarNomina && (
          <Link
            href="/admin/nomina"
            className="ml-auto rounded-lg border border-[#00d084] px-3 py-2 text-sm font-medium text-[#00a868] hover:bg-[#00d084] hover:text-white"
          >
            📄 Cargar nómina
          </Link>
        )}
      </div>

      {cargando && <div className="py-16 text-center text-gray-500">Calculando…</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>}

      {data && !cargando && filaSel && (
        <>
          <TarjetaFlujo f={filaSel} etiqueta={data.periodo.etiqueta} />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Zona</th>
                  <th className="text-right px-3 py-2">Gasto</th>
                  <th className="text-right px-3 py-2">Kg entró</th>
                  <th className="text-right px-3 py-2">Kg salió</th>
                  <th className="text-right px-3 py-2">$/kg entrada</th>
                  <th className="text-right px-3 py-2">$/kg salida</th>
                  <th className="text-right px-3 py-2 bg-green-50">$/kg trabajado</th>
                  <th className="text-right px-3 py-2">vs {data.anterior.etiqueta}</th>
                  <th className="text-right px-3 py-2">Con nómina</th>
                </tr>
              </thead>
              <tbody>
                {[...filasConDatos, data.actual.total].map((f) => {
                  const esTotal = f.zona === "TOTAL";
                  return (
                    <tr
                      key={f.zona}
                      onClick={() => setZonaSel(f.zona)}
                      className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        zonaSel === f.zona ? "bg-green-50/60" : ""
                      } ${esTotal ? "font-bold bg-gray-50" : ""}`}
                    >
                      <td className="px-3 py-2">{esTotal ? "TOTAL" : f.zona}</td>
                      <td className="px-3 py-2 text-right">{millones(f.gasto)}</td>
                      <td className="px-3 py-2 text-right">{kg(f.kgEntrada)}</td>
                      <td className="px-3 py-2 text-right">{kg(f.kgSalida)}</td>
                      <td className="px-3 py-2 text-right">{pesos(f.costoEntrada)}</td>
                      <td className="px-3 py-2 text-right">{pesos(f.costoSalida)}</td>
                      <td className="px-3 py-2 text-right bg-green-50 font-semibold">{pesos(f.costoTrabajado)}</td>
                      <td className="px-3 py-2 text-right">
                        <Variacion actual={f.costoTrabajado} previo={previoDe(f.zona)?.costoTrabajado ?? null} />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {nominaCompleta ? pesos(f.costoTrabajadoConNomina) : "pendiente"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500 mt-3 space-y-1">
            <p>
              Gasto = caja menor (sin rechazados) + órdenes de servicio (sin borradores ni rechazadas). Los
              transportes con kardex cuentan en el mes en que se movieron los kilos. Clic en una zona para ver su flujo.
            </p>
            {!nominaCompleta && (
              <p>
                «Con nómina»: falta cargar la nómina de {data.actual.mesesSinNomina.join(", ")}. Plazo: día 5 del mes siguiente.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
