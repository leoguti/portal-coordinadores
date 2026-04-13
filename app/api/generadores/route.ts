import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export interface Generador {
  id: string;
  nombre: string;
  cedula: string;
  direccion: string;
  municipio: string;
  cultivo: string;
  movil: string;
  email: string;
  conteo_certificados: number;
}

/**
 * GET /api/generadores
 * Retorna ubicaciones filtradas por coordinador (vía campo `coordinadores` compilado).
 * - Coordinador: solo sus ubicaciones
 * - Admin/Supervisor: todas (o filtradas por ?coordinadorId=recXXX)
 *
 * Query params:
 *   search        - texto libre (nombre o cédula)
 *   coordinadorId - (solo admin) filtrar por un coordinador específico
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const coordinadorIdParam = searchParams.get("coordinadorId")?.trim() || "";

    const isAdmin = isAdminOrSupervisor(session.user.rol);

    // Determinar qué coordinador filtrar
    const coordinadorId = isAdmin
      ? coordinadorIdParam || null  // admin puede pasar uno o ver todos
      : session.user.coordinatorRecordId; // coordinador solo ve los suyos

    // Construir fórmula de filtro
    const filters: string[] = [];

    if (coordinadorId) {
      // El campo `coordinadores` es una Compilación de IDs de coordinador
      filters.push(`FIND('${coordinadorId}', ARRAYJOIN({coordinadores}, ','))`);
    }

    if (search) {
      const s = search.replace(/'/g, "\\'");
      filters.push(
        `OR(FIND(LOWER('${s}'), LOWER({nombregenerador})), FIND('${s}', {cedulagenerador}))`
      );
    }

    const formula =
      filters.length === 0
        ? "TRUE()"
        : filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`;

    // Paginar todos los resultados de Airtable
    const generadores: Generador[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        filterByFormula: formula,
        "sort[0][field]": "nombregenerador",
        "sort[0][direction]": "asc",
        "fields[]": "nombregenerador",
        // Nota: Airtable no permite fields[] múltiples en URLSearchParams así,
        // lo construimos manualmente abajo
      });

      const fields = [
        "nombregenerador",
        "cedulagenerador",
        "direcciongenerador",
        "mundep",
        "cultivogenerador",
        "movilgenerador",
        "emailgenerador",
        "conteo_certificados",
      ];

      const fieldParams = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
      const filterParam = `filterByFormula=${encodeURIComponent(formula)}`;
      const sortParam = `sort[0][field]=nombregenerador&sort[0][direction]=asc`;
      const offsetParam = offset ? `&offset=${offset}` : "";

      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones?${filterParam}&${sortParam}&${fieldParams}${offsetParam}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[generadores] Airtable error:", err);
        return NextResponse.json({ error: "Error consultando Airtable" }, { status: 500 });
      }

      const data = (await res.json()) as {
        records: {
          id: string;
          fields: {
            nombregenerador?: string;
            cedulagenerador?: string;
            direcciongenerador?: string;
            mundep?: string[];
            cultivogenerador?: string;
            movilgenerador?: string;
            emailgenerador?: string;
            conteo_certificados?: number;
          };
        }[];
        offset?: string;
      };

      for (const r of data.records) {
        generadores.push({
          id: r.id,
          nombre: r.fields.nombregenerador || "Sin nombre",
          cedula: r.fields.cedulagenerador || "",
          direccion: r.fields.direcciongenerador || "",
          municipio: r.fields.mundep?.[0] || "",
          cultivo: r.fields.cultivogenerador || "",
          movil: r.fields.movilgenerador || "",
          email: r.fields.emailgenerador || "",
          conteo_certificados: r.fields.conteo_certificados || 0,
        });
      }

      offset = data.offset;
    } while (offset);

    return NextResponse.json({ generadores, total: generadores.length });
  } catch (err) {
    console.error("[generadores] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
