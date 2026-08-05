import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import { listarTodosDocumentos } from "@/lib/documentosTerceros";

export const maxDuration = 30;

/**
 * GET /api/documentos-terceros/pendientes
 *
 * Bandeja de revisión (SOLO administradores): todos los documentos con su
 * tercero, agrupables por estado en el cliente. Devuelve también conteos.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  try {
    // Solo versiones VIGENTES: la bandeja es una cola de decisión, no el
    // historial. Una versión reemplazada (p. ej. el mismo archivo subido dos
    // veces) no debe revisarse dos veces — el historial completo vive en el
    // detalle del tercero.
    const docs = (await listarTodosDocumentos()).filter((d) => d.vigente);

    // Datos mínimos de los terceros referenciados (una sola pasada paginada).
    const terceros = new Map<string, { razonSocial: string; nit: string; tipoPersona: string }>();
    let offset = "";
    do {
      const params = new URLSearchParams();
      params.append("fields[]", "RazonSocial");
      params.append("fields[]", "NIT");
      params.append("fields[]", "tipo_persona");
      params.set("pageSize", "100");
      if (offset) params.set("offset", offset);
      const res = await fetch(
        `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Terceros?${params.toString()}`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: "no-store" }
      );
      const data = await res.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      for (const r of data.records || []) {
        terceros.set(r.id, {
          razonSocial: r.fields?.RazonSocial || "(sin nombre)",
          nit: r.fields?.NIT || "",
          tipoPersona: r.fields?.tipo_persona || "",
        });
      }
      offset = data.offset || "";
    } while (offset);

    const documentos = docs.map(({ archivoKey: _omit, ...d }) => ({
      ...d,
      tercero: d.terceroId ? terceros.get(d.terceroId) || null : null,
    }));

    return NextResponse.json({
      documentos,
      conteos: {
        pendientes: documentos.filter((d) => d.estado === "pendiente").length,
        aprobados: documentos.filter((d) => d.estado === "aprobado").length,
        rechazados: documentos.filter((d) => d.estado === "rechazado").length,
      },
    });
  } catch (err) {
    console.error("[documentos-terceros/pendientes] error:", err);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }
}
