import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const maxDuration = 60;

interface CultivoOption {
  id: string;
  nombre: string;
}

interface CoordinadorOption {
  id: string;
  nombre: string;
  rol: string;
}

interface FiltrosCache {
  cultivos: CultivoOption[];
  coordinadores: CoordinadorOption[];
  departamentos: string[];
  municipios: string[];
  meses: string[];
  anos: number[];
  loadedAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hora

let cache: FiltrosCache | null = null;
let loading: Promise<FiltrosCache> | null = null;

async function fetchAllPaginated<T>(
  url: string,
  apiKey: string,
  params: URLSearchParams,
  extract: (record: { id: string; fields: Record<string, unknown> }) => T | null
): Promise<T[]> {
  const items: T[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams(params);
    if (offset) p.set("offset", offset);
    const res = await fetch(`${url}?${p.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable error ${res.status}: ${text}`);
    }
    const data = await res.json();
    for (const rec of data.records || []) {
      const item = extract(rec);
      if (item !== null) items.push(item);
    }
    offset = data.offset;
  } while (offset);
  return items;
}

async function loadFiltros(): Promise<FiltrosCache> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Airtable no configurado");

  // Cultivos
  const cultivosParams = new URLSearchParams();
  cultivosParams.append("fields[]", "nombre");
  cultivosParams.set("pageSize", "100");
  const cultivos = await fetchAllPaginated<CultivoOption>(
    `https://api.airtable.com/v0/${baseId}/CULTIVOS`,
    apiKey,
    cultivosParams,
    (rec) => {
      const nombre = String(rec.fields["nombre"] || "").trim();
      if (!nombre) return null;
      return { id: rec.id, nombre };
    }
  );
  cultivos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Coordinadores con rol Coordinador o Administrador
  const coordParams = new URLSearchParams();
  coordParams.append("fields[]", "Name");
  coordParams.append("fields[]", "Rol");
  coordParams.set(
    "filterByFormula",
    `OR({Rol} = 'Coordinador', {Rol} = 'Administrador')`
  );
  coordParams.set("pageSize", "100");
  const coordinadores = await fetchAllPaginated<CoordinadorOption>(
    `https://api.airtable.com/v0/${baseId}/Coordinadores`,
    apiKey,
    coordParams,
    (rec) => {
      const nombre = String(rec.fields["Name"] || "").trim();
      const rol = String(rec.fields["Rol"] || "").trim();
      if (!nombre) return null;
      return { id: rec.id, nombre, rol };
    }
  );
  coordinadores.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Escaneo de Certificados para extraer departamentos, municipios, años y meses únicos
  const certParams = new URLSearchParams();
  certParams.append("fields[]", "Departamento");
  certParams.append("fields[]", "municipiogenerador");
  certParams.append("fields[]", "ano");
  certParams.append("fields[]", "fechadevolucion");
  certParams.set("pageSize", "100");

  const deptoSet = new Set<string>();
  const muniSet = new Set<string>();
  const anoSet = new Set<number>();
  const mesSet = new Set<string>();

  await fetchAllPaginated<null>(
    `https://api.airtable.com/v0/${baseId}/Certificados`,
    apiKey,
    certParams,
    (rec) => {
      const dep = rec.fields["Departamento"];
      if (Array.isArray(dep)) {
        for (const d of dep) {
          const s = String(d || "").trim();
          if (s) deptoSet.add(s);
        }
      }
      const mun = rec.fields["municipiogenerador"];
      if (Array.isArray(mun)) {
        for (const m of mun) {
          const s = String(m || "").trim();
          if (s) muniSet.add(s);
        }
      }
      const ano = rec.fields["ano"];
      let anoNumber: number | null = null;
      if (typeof ano === "number" && Number.isFinite(ano)) anoNumber = ano;
      else if (Array.isArray(ano) && typeof ano[0] === "number") anoNumber = ano[0];
      if (anoNumber !== null) anoSet.add(anoNumber);

      const fecha = rec.fields["fechadevolucion"];
      const fechaStr = typeof fecha === "string" ? fecha : Array.isArray(fecha) ? String(fecha[0] || "") : "";
      if (fechaStr && /^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
        mesSet.add(fechaStr.slice(0, 7));
      }
      return null;
    }
  );

  const departamentos = [...deptoSet].sort((a, b) => a.localeCompare(b, "es"));
  const municipios = [...muniSet].sort((a, b) => a.localeCompare(b, "es"));
  const anos = [...anoSet].sort((a, b) => b - a);
  const meses = [...mesSet].sort().reverse(); // más reciente primero

  return {
    cultivos,
    coordinadores,
    departamentos,
    municipios,
    meses,
    anos,
    loadedAt: Date.now(),
  };
}

async function getFiltrosCache(force = false): Promise<FiltrosCache> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) {
    return cache;
  }
  if (!loading) {
    loading = loadFiltros()
      .then((data) => {
        cache = data;
        loading = null;
        return data;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const data = await getFiltrosCache(force);
    return NextResponse.json({
      cultivos: data.cultivos,
      coordinadores: data.coordinadores,
      departamentos: data.departamentos,
      municipios: data.municipios,
      meses: data.meses,
      anos: data.anos,
    });
  } catch (error) {
    console.error("Error loading certificados filtros:", error);
    return NextResponse.json(
      { error: "Error cargando filtros" },
      { status: 500 }
    );
  }
}
