"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getOrdenesCoordinador, type Orden } from "@/lib/airtable";

/**
 * Alerta grande de órdenes rechazadas recientes (últimos 15 días) para el
 * coordinador. Vive en el dashboard (lo único que muchos coordinadores
 * abren) y en el listado de órdenes. Regla que comunica: rechazada = sus
 * kardex ya quedaron liberados en ese instante; hay que crear una orden
 * NUEVA con los valores corregidos.
 */
const QUINCE_DIAS = 15 * 86400000;

export default function AlertaOrdenesRechazadas() {
  const { data: session } = useSession();
  const [rechazadas, setRechazadas] = useState<Orden[]>([]);

  useEffect(() => {
    async function load() {
      if (!session?.user?.coordinatorRecordId) return;
      try {
        const ordenes = await getOrdenesCoordinador(session.user.coordinatorRecordId);
        setRechazadas(
          ordenes.filter(
            (o) =>
              o.fields.Estado === "Rechazada" &&
              o.fields.rechazo_en &&
              Date.now() - new Date(o.fields.rechazo_en).getTime() < QUINCE_DIAS
          )
        );
      } catch (err) {
        console.error("[alerta-rechazadas] error:", err);
      }
    }
    load();
  }, [session?.user?.coordinatorRecordId]);

  if (rechazadas.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto mb-4">
      <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
        <p className="font-bold text-red-800 mb-2">
          ⚠️ Administración rechazó {rechazadas.length === 1 ? "una orden tuya" : `${rechazadas.length} órdenes tuyas`}
        </p>
        {rechazadas.map((o) => (
          <p key={o.id} className="text-sm text-red-800 mb-1">
            <Link href={`/ordenes-servicio/${o.id}`} className="font-bold underline">
              #{o.fields.NumeroOrden}
            </Link>
            {o.fields.rechazo_motivo ? ` — "${o.fields.rechazo_motivo}"` : ""}
          </p>
        ))}
        <div className="mt-2 p-3 bg-white border border-red-200 rounded-lg">
          <p className="text-sm text-red-900 font-bold mb-1">📋 Qué debes hacer para arreglarlo:</p>
          <p className="text-sm text-red-800">
            Los kardex de {rechazadas.length === 1 ? "esa orden" : "esas órdenes"}{" "}
            <strong>ya quedaron liberados</strong> (volvieron a &quot;Por Pagar&quot;). Debes{" "}
            <strong>crear una orden NUEVA</strong>: selecciona esos mismos kardex en el paso 1 del
            formulario y esta vez ingresa los <strong>valores corregidos</strong>. La orden
            rechazada no se toca — queda solo como registro.
          </p>
        </div>
        <Link
          href="/ordenes-servicio-v2/nueva"
          className="inline-block mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          + Crear la orden nueva con los kardex liberados →
        </Link>
      </div>
    </div>
  );
}
