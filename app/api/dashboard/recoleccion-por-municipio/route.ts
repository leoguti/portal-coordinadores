import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllKardex } from "@/lib/airtable";
import { divipolaFromDecimal } from "@/lib/divipola";

export const maxDuration = 60;

interface MunicipioShare {
  codigo: string;
  municipio: string;
  departamento: string;
  /** Participación (%) sobre el total nacional de entradas del periodo. */
  sharePct: number;
}

/** Mapa recordId de MUNICIPIOS → { codigo DIVIPOLA 5 dígitos, municipio, departamento, deptoCodigo 2 dígitos } */
async function getMunicipiosMap(): Promise<
  Map<string, { codigo: string; municipio: string; departamento: string; deptoCodigo: string }>
> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const map = new Map<
    string,
    { codigo: string; municipio: string; departamento: string; deptoCodigo: string }
  >();
  if (!apiKey || !baseId) return map;

  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    ["CODIGOMUN", "MUNICIPIO", "DEPARTAMENTO", "CODIGODEPTO"].forEach((f) => params.append("fields[]", f));
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/MUNICIPIOS?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) break;
    const data = await res.json();
    for (const r of data.records || []) {
      // DIVIPOLA decimal (ej. 73.563 → "73563"; 25.43 → "25430")
      const codigo = divipolaFromDecimal(r.fields?.CODIGOMUN);
      if (!codigo) continue;
      map.set(r.id, {
        codigo,
        municipio: r.fields?.MUNICIPIO || "",
        departamento: r.fields?.DEPARTAMENTO || "",
        deptoCodigo: codigo.slice(0, 2),
      });
    }
    offset = data.offset;
  } while (offset);
  return map;
}

/**
 * GET /api/dashboard/recoleccion-por-municipio
 * Participación (%) de cada municipio en la recolección nacional (kardex
 * ENTRADAS por MunicipioOrigen). NO expone kilos: solo porcentajes.
 * Query: ?year=2026&monthFrom=1&monthTo=12
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const monthFrom = parseInt(searchParams.get("monthFrom") || "1");
    const monthTo = parseInt(searchParams.get("monthTo") || "12");
    const yearStr = String(year);

    const [allKardex, municipiosMap] = await Promise.all([
      getAllKardex(),
      getMunicipiosMap(),
    ]);

    // kg por municipio y por departamento (solo interno — jamás sale en la respuesta)
    const kgPorMunicipio = new Map<
      string,
      { municipio: string; departamento: string; deptoCodigo: string; kg: number }
    >();
    const kgPorDepto = new Map<string, { nombre: string; kg: number }>();
    let totalKg = 0;

    for (const k of allKardex) {
      const f = k.fields;
      if (f.TipoMovimiento !== "ENTRADA") continue;
      if (f.AÑO !== yearStr) continue;
      const mesNum = f.MES ? parseInt(f.MES.split("-")[1]) : NaN;
      if (!Number.isNaN(mesNum) && (mesNum < monthFrom || mesNum > monthTo)) continue;

      const munId = f.MunicipioOrigen?.[0];
      if (!munId) continue;
      const info = municipiosMap.get(munId);
      if (!info) continue;

      const kg = f.Total || 0;
      if (kg <= 0) continue;

      const agg = kgPorMunicipio.get(info.codigo);
      if (agg) {
        agg.kg += kg;
      } else {
        kgPorMunicipio.set(info.codigo, {
          municipio: info.municipio,
          departamento: info.departamento,
          deptoCodigo: info.deptoCodigo,
          kg,
        });
      }
      const dAgg = kgPorDepto.get(info.deptoCodigo);
      if (dAgg) {
        dAgg.kg += kg;
      } else {
        kgPorDepto.set(info.deptoCodigo, { nombre: info.departamento, kg });
      }
      totalKg += kg;
    }

    const municipios: MunicipioShare[] = [...kgPorMunicipio.entries()]
      .map(([codigo, m]) => ({
        codigo,
        municipio: m.municipio,
        departamento: m.departamento,
        sharePct: totalKg > 0 ? Math.round((m.kg / totalKg) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);

    const departamentos = new Set(
      municipios.map((m) => m.departamento).filter(Boolean)
    );
    const top10Pct =
      Math.round(municipios.slice(0, 10).reduce((s, m) => s + m.sharePct, 0) * 10) / 10;

    // Agregación por departamento: % sobre kg reales (sin error de redondeo)
    // + cuántos municipios con recolección tiene cada uno
    const munPorDepto = new Map<string, number>();
    kgPorMunicipio.forEach((m) => {
      munPorDepto.set(m.deptoCodigo, (munPorDepto.get(m.deptoCodigo) || 0) + 1);
    });
    const porDepartamento = [...kgPorDepto.entries()]
      .map(([codigo, d]) => ({
        codigo,
        nombre: d.nombre,
        sharePct: totalKg > 0 ? Math.round((d.kg / totalKg) * 1000) / 10 : 0,
        municipios: munPorDepto.get(codigo) || 0,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);

    return NextResponse.json({
      municipios,
      porDepartamento,
      totals: {
        municipios: municipios.length,
        departamentos: departamentos.size,
        top10Pct,
      },
      year,
      monthFrom,
      monthTo,
    });
  } catch (err) {
    console.error("Error recoleccion-por-municipio:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
