/**
 * GET /api/dashboard/certificados-stats
 *
 * Estadísticas de certificados desde **Airtable** (fuente de verdad).
 * Neon NO se usa aquí — es solo backup histórico.
 *
 * Devuelve KPIs, tendencia mensual, top cultivos/municipios/departamentos/
 * coordinadores, composición de materiales, heatmap cultivo×departamento
 * y top generadores. Lista de cultivos canónicos viene de la tabla CULTIVOS.
 *
 * Roles:
 *   - Coordinador: SOLO sus propios certificados (forzado).
 *   - Admin/Supervisor: todos; puede filtrar por ?coordinador=recXXX.
 *
 * Cachea los records crudos por (year, coordinador) durante 5 minutos para
 * que los cambios de filtro de cultivo/depto/meses sean instantáneos.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isJunta } from "@/lib/roles";
import { getCultivosMap } from "@/lib/cultivosCache";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = "Certificados";
const TTL_MS = 5 * 60 * 1000;

interface CertRaw {
  id: string;
  consecutivo?: number;
  fechadevolucion?: string;
  ano?: number;
  id_coordinador?: string[];
  nombrecoordinador?: string[];
  /** Link directo a CULTIVOS (canónico). Fuente preferida para los nombres. */
  cultivos_certificado?: string[];
  /** Lookup viejo desde ubicaciones (texto libre). Fallback. */
  cultivogenerador?: string[];
  municipiodevolucion?: string[];
  Departamento?: string[];
  total?: number;
  rigidos?: number;
  flexibles?: number;
  metalicos?: number;
  embalaje?: number;
  triplelavado?: string;
  nombregenerador?: string[];
  cedulagenerador?: string[];
}

const cache = new Map<string, { ts: number; records: CertRaw[] }>();

function parseList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function normJs(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function first<T>(v: T[] | undefined): T | undefined {
  return Array.isArray(v) && v.length > 0 ? v[0] : undefined;
}

async function fetchAllCerts(year: number, coordinadorId: string): Promise<CertRaw[]> {
  const k = `${year}|${coordinadorId || ""}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.records;

  const fields = [
    "consecutivo", "fechadevolucion", "ano",
    "id_coordinador", "nombrecoordinador",
    "cultivos_certificado",  // link canónico Certificados→CULTIVOS (fuente única)
    "municipiodevolucion", "Departamento",
    "total", "rigidos", "flexibles", "metalicos", "embalaje", "triplelavado",
    "nombregenerador", "cedulagenerador",
  ];
  // Solo contar APROBADOS para estadísticas oficiales. Pendientes/rechazados/
  // anulados no son "kilos válidos". `{estado}=BLANK()` cubre el periodo de
  // transición si algún record nuevo se cuela sin estado por error.
  const clauses: string[] = [
    `{ano}=${year}`,
    `OR({estado}='aprobado', {estado}=BLANK())`,
  ];
  if (coordinadorId) clauses.push(`FIND('${coordinadorId}', ARRAYJOIN({id_coordinador}))`);
  const formula = `AND(${clauses.join(",")})`;

  const out: CertRaw[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    fields.forEach((f) => p.append("fields[]", f));
    p.set("pageSize", "100");
    if (offset) p.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${p}`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const r of data.records || []) {
      out.push({ id: r.id, ...r.fields });
    }
    offset = data.offset;
  } while (offset);

  cache.set(k, { ts: Date.now(), records: out });
  return out;
}

function inRange(rec: CertRaw, monthFrom: number, monthTo: number): boolean {
  if (!rec.fechadevolucion) return false;
  const m = new Date(rec.fechadevolucion).getUTCMonth() + 1;
  return m >= monthFrom && m <= monthTo;
}

// Devuelve los nombres canónicos del cert (resolviendo cultivos_certificado IDs
// contra el mapa de CULTIVOS). Solo canónicos — si no tiene el link, no aporta.
function cultivosCanonicos(rec: CertRaw, cmap: Map<string, string>): string[] {
  const ids = rec.cultivos_certificado || [];
  return ids.map((id) => cmap.get(id) || "").filter(Boolean);
}
function matchesCultivo(rec: CertRaw, cultivosNorm: string[], cmap: Map<string, string>): boolean {
  if (!cultivosNorm.length) return true;
  const vals = cultivosCanonicos(rec, cmap).map(normJs);
  return vals.some((v) => cultivosNorm.includes(v));
}
function matchesDepto(rec: CertRaw, deptosNorm: string[]): boolean {
  if (!deptosNorm.length) return true;
  const vals = (rec.Departamento || []).map(normJs);
  return vals.some((v) => deptosNorm.includes(v));
}

interface AggMap { certs: number; kg: number; }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const rol = session.user?.rol;
  // "Junta" ve todos los certificados igual que admin (solo lectura del board)
  const isAdmin = rol === "Administrador" || rol === "Supervisor" || isJunta(rol);
  const isCoordinador = rol === "Coordinador";
  if (!isAdmin && !isCoordinador) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year = Math.max(2018, parseInt(sp.get("year") || String(now.getFullYear())));
  const monthFrom = Math.min(12, Math.max(1, parseInt(sp.get("monthFrom") || "1")));
  const monthTo = Math.min(12, Math.max(monthFrom, parseInt(sp.get("monthTo") || "12")));
  const coordParam = sp.get("coordinador") || "";
  const coordinadorFilter = isCoordinador
    ? session.user.coordinatorRecordId!
    : coordParam || "";
  const cultivos = parseList(sp.get("cultivo"));
  const departamentos = parseList(sp.get("departamento"));
  const cultivosN = cultivos.map(normJs);
  const deptosN = departamentos.map(normJs);

  try {
    const [allCur, allPrev, cultivosMap] = await Promise.all([
      fetchAllCerts(year, coordinadorFilter),
      fetchAllCerts(year - 1, coordinadorFilter),
      getCultivosMap().catch(() => new Map<string, string>()),
    ]);

    // Aplicar filtros de mes + cultivo + depto en memoria
    const filt = (rec: CertRaw) =>
      inRange(rec, monthFrom, monthTo) &&
      matchesCultivo(rec, cultivosN, cultivosMap) &&
      matchesDepto(rec, deptosN);
    const cur = allCur.filter(filt);
    const prev = allPrev.filter(filt);

    // KPIs
    let certs = 0, kg = 0, rigidos = 0, flexibles = 0, metalicos = 0, embalaje = 0;
    let tlSi = 0, tlNo = 0, tlNA = 0, tlSinResp = 0;
    for (const r of cur) {
      certs++;
      kg += Number(r.total || 0);
      rigidos += Number(r.rigidos || 0);
      flexibles += Number(r.flexibles || 0);
      metalicos += Number(r.metalicos || 0);
      embalaje += Number(r.embalaje || 0);
      const v = normJs(r.triplelavado || "");
      if (!v) tlSinResp++;
      else if (v === "si" || v === "s" || v === "sí") tlSi++;
      else if (v === "no") tlNo++;
      else if (v.includes("aplica")) tlNA++;
      else tlSinResp++;
    }
    let certsPrev = 0, kgPrev = 0;
    for (const r of prev) { certsPrev++; kgPrev += Number(r.total || 0); }

    // Tendencia mensual (current + prev)
    const tendCur: Record<string, { certs: number; kg: number }> = {};
    const tendPrev: Record<string, { certs: number; kg: number }> = {};
    for (const r of cur) {
      if (!r.fechadevolucion) continue;
      const ym = r.fechadevolucion.slice(0, 7);
      const e = tendCur[ym] || (tendCur[ym] = { certs: 0, kg: 0 });
      e.certs++; e.kg += Number(r.total || 0);
    }
    for (const r of prev) {
      if (!r.fechadevolucion) continue;
      const ym = r.fechadevolucion.slice(0, 7);
      const e = tendPrev[ym] || (tendPrev[ym] = { certs: 0, kg: 0 });
      e.certs++; e.kg += Number(r.total || 0);
    }

    // Agregaciones por dimensión (normalizadas → mapear a forma canónica)
    function addToMap(map: Map<string, AggMap>, key: string, kgInc: number) {
      const e = map.get(key) || { certs: 0, kg: 0 };
      e.certs++;
      e.kg += kgInc;
      map.set(key, e);
    }
    const cultivoAgg = new Map<string, AggMap>();
    const deptoAgg = new Map<string, AggMap>();
    const muniAgg = new Map<string, AggMap>();
    const coordAgg = new Map<string, AggMap & { nombre: string }>();
    const genAgg = new Map<string, AggMap & { nombre: string; cedula: string | null }>();
    const heatAgg = new Map<string, AggMap & { cultivo: string; depto: string }>();

    let sinCultivoCanonico = 0;

    for (const r of cur) {
      const totalKg = Number(r.total || 0);
      const cultArr = cultivosCanonicos(r, cultivosMap); // solo canónicos
      const deptoArr = (r.Departamento || []).filter(Boolean);
      const muni = first(r.municipiodevolucion) || "(sin)";
      const coordId = first(r.id_coordinador) || "";
      const coordNom = first(r.nombrecoordinador) || "(sin)";
      const genNom = first(r.nombregenerador) || "(sin)";
      const genCed = first(r.cedulagenerador) || null;

      if (cultArr.length === 0) {
        sinCultivoCanonico++;
        addToMap(cultivoAgg, "Sin cultivo", totalKg);
      } else {
        for (const c of cultArr) addToMap(cultivoAgg, c, totalKg);
      }

      if (deptoArr.length === 0) addToMap(deptoAgg, "(sin)", totalKg);
      else for (const d of deptoArr) addToMap(deptoAgg, String(d), totalKg);

      addToMap(muniAgg, String(muni), totalKg);

      const ck = coordId || coordNom;
      const ce = coordAgg.get(ck) || { certs: 0, kg: 0, nombre: String(coordNom) };
      ce.certs++; ce.kg += totalKg; coordAgg.set(ck, ce);

      const gk = (genCed ? String(genCed) : "") + "|" + String(genNom);
      const ge = genAgg.get(gk) || { certs: 0, kg: 0, nombre: String(genNom), cedula: genCed ? String(genCed) : null };
      ge.certs++; ge.kg += totalKg; genAgg.set(gk, ge);

      // heatmap cultivo×depto
      for (const c of cultArr) {
        for (const d of deptoArr) {
          if (!c || !d) continue;
          const hk = c + "||" + String(d);
          const he = heatAgg.get(hk) || { certs: 0, kg: 0, cultivo: c, depto: String(d) };
          he.certs++; he.kg += totalKg; heatAgg.set(hk, he);
        }
      }
    }

    // Sort y top-N
    const sortByKg = <T extends AggMap>(a: T, b: T) => b.kg - a.kg;
    const porCultivo = [...cultivoAgg.entries()].map(([cultivo, v]) => ({ cultivo, ...v })).sort(sortByKg).slice(0, 15);
    const porDepto = [...deptoAgg.entries()].map(([depto, v]) => ({ depto, ...v })).sort(sortByKg).slice(0, 15);
    const porMunicipio = [...muniAgg.entries()].map(([mun, v]) => ({ mun, ...v })).sort(sortByKg).slice(0, 15);
    const porCoordinador = [...coordAgg.entries()].map(([id, v]) => ({ id, nombre: v.nombre, certs: v.certs, kg: v.kg })).sort(sortByKg);
    const topGeneradores = [...genAgg.values()].sort(sortByKg).slice(0, 20);

    // Heatmap: top 8 cultivos × top 8 deptos (entre los presentes)
    const topCs = porCultivo.slice(0, 8).map((x) => x.cultivo);
    const topDs = porDepto.slice(0, 8).map((x) => x.depto);
    const heatmap = [...heatAgg.values()].filter((h) => topCs.includes(h.cultivo) && topDs.includes(h.depto));

    // Tendencias formateadas
    const tendCurArr = Object.entries(tendCur).map(([ym, v]) => ({ ym, certs: v.certs, kg: v.kg })).sort((a, b) => a.ym.localeCompare(b.ym));
    const tendPrevArr = Object.entries(tendPrev).map(([ym, v]) => ({ ym, certs: v.certs, kg: v.kg })).sort((a, b) => a.ym.localeCompare(b.ym));

    // Filtros disponibles: SOLO valores presentes en certificados del año.
    // Cultivos: nombres canónicos resueltos desde cultivos_certificado (link a CULTIVOS).
    const cultivosSet = new Set<string>();
    for (const r of allCur) for (const c of cultivosCanonicos(r, cultivosMap)) cultivosSet.add(c);
    const cultivosFiltro = [...cultivosSet].sort((a, b) => a.localeCompare(b, "es"));
    const deptosSet = new Set<string>();
    for (const r of allCur) for (const d of (r.Departamento || [])) if (d) deptosSet.add(String(d));
    const departamentosFiltro = [...deptosSet].sort((a, b) => a.localeCompare(b, "es"));

    // Años disponibles en Airtable: solo año actual y anterior (los más viejos
    // están en Neon-backup, no aquí). La auditoría confirmó: solo 2025 y 2026.
    const years: number[] = [now.getFullYear(), now.getFullYear() - 1];

    return NextResponse.json({
      meta: {
        year, monthFrom, monthTo,
        coordinador: coordinadorFilter || null,
        coordinadorForzado: isCoordinador,
        fuente: "airtable",
        sinCultivoCanonico, // certs del periodo sin link cultivos_certificado
      },
      kpis: {
        certs,
        kg,
        certsPrev,
        kgPrev,
        deltaCertsPct: certsPrev > 0 ? ((certs - certsPrev) / certsPrev) * 100 : null,
        deltaKgPct: kgPrev > 0 ? ((kg - kgPrev) / kgPrev) * 100 : null,
        tripleLavado: { si: tlSi, no: tlNo, noAplica: tlNA, sinRespuesta: tlSinResp },
      },
      materiales: { rigidos, flexibles, metalicos, embalaje },
      tendencia: { actual: tendCurArr, anterior: tendPrevArr },
      porCultivo,
      porDepto,
      porMunicipio,
      porCoordinador,
      topGeneradores,
      heatmap,
      filtros: {
        years,
        cultivos: cultivosFiltro,
        departamentos: departamentosFiltro,
      },
    });
  } catch (e) {
    console.error("certificados-stats (Airtable) error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
