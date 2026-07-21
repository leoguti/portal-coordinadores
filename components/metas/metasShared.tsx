"use client";

// Piezas compartidas entre la vista de Metas por Zona (admin) y Mis Metas
// (coordinador). Centraliza el diseño de celda, colores y leyenda para que
// cualquier ajuste aplique a ambas vistas.

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

// Año en que se concertaron las metas y la fecha del acuerdo. La nota
// explicativa de los primeros meses solo aplica a este año.
export const ACUERDO_METAS_YEAR = 2026;
export const ACUERDO_METAS_FECHA = "13 de marzo de 2026";

export type Celda = { real: number; meta: number };
export type Estado = "pasado" | "actual" | "futuro";

export function estadoMes(
  year: number,
  mesIdx: number,
  currentYear: number,
  currentMonth: number
): Estado {
  if (year < currentYear) return "pasado";
  if (year > currentYear) return "futuro";
  const mes = mesIdx + 1;
  if (mes < currentMonth) return "pasado";
  if (mes === currentMonth) return "actual";
  return "futuro";
}

export function pctColor(p: number): { bg: string; text: string } {
  if (p >= 70) return { bg: "bg-green-100", text: "text-green-700" };
  if (p >= 40) return { bg: "bg-yellow-100", text: "text-yellow-700" };
  return { bg: "bg-red-100", text: "text-red-700" };
}

// % de cumplimiento de la meta del MES (real del mes / meta del mes)
export function cumplimientoMes(c: Celda): number {
  if (c.meta > 0) return Math.round((c.real / c.meta) * 100);
  return c.real > 0 ? 100 : 0;
}

// % acumulado del año hasta cada mes = (real acumulado) / (meta anual)
export function acumuladoPct(meses: Celda[], metaAnual: number): number[] {
  let acc = 0;
  return meses.map((c) => {
    acc += c.real;
    return metaAnual > 0 ? Math.round((acc / metaAnual) * 100) : 0;
  });
}

// Cumplimiento contra el PLAN acumulado: (real enero..mes) / (meta enero..mes).
// Responde "¿vamos al día con lo planeado hasta este punto del año?"
export type AcumPlan = { pct: number; realAcum: number; metaAcum: number };
export function acumuladoVsPlan(meses: Celda[]): AcumPlan[] {
  let r = 0;
  let m = 0;
  return meses.map((c) => {
    r += c.real;
    m += c.meta;
    return {
      pct: m > 0 ? Math.round((r / m) * 100) : r > 0 ? 100 : 0,
      realAcum: r,
      metaAcum: m,
    };
  });
}

// índice (0-11) del mes vigente si el año mostrado es el actual; si no, -1
export function vigenteIdx(year: number, currentYear: number, currentMonth: number): number {
  return year === currentYear ? currentMonth - 1 : -1;
}

// Clases de línea compartidas para que valores y etiquetas queden alineados.
const L_REAL = "text-[10px] leading-[14px] text-center px-1";
const L_META = "text-[10px] leading-[14px] text-center px-1 font-bold border-y border-gray-300/50 bg-black/5";
const L_PCT = "text-[11px] leading-[15px] text-center px-1";
const L_ACUM = "text-[10px] leading-[13px] text-center px-1";

// Anchos de columna iguales en ambas vistas (alineación de meses).
export function MetasColgroup() {
  return (
    <colgroup>
      <col style={{ width: 152 }} />
      {MESES.map((_, i) => (
        <col key={i} style={{ width: 60 }} />
      ))}
      <col style={{ width: 88 }} />
    </colgroup>
  );
}

// Fila de encabezado (Zona / Meta + meses + AÑO) con marca de mes vigente.
export function HeaderRow({
  firstLabel,
  year,
  currentYear,
  currentMonth,
}: {
  firstLabel: string;
  year: number;
  currentYear: number;
  currentMonth: number;
}) {
  const vigente = vigenteIdx(year, currentYear, currentMonth);
  return (
    <tr className="bg-gray-50">
      <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-semibold text-gray-600 text-xs">
        {firstLabel}
      </th>
      {MESES.map((m, i) => {
        const est = estadoMes(year, i, currentYear, currentMonth);
        const esVigente = i === vigente;
        return (
          <th
            key={m}
            className={`px-1 py-1.5 text-center text-[11px] font-semibold ${
              esVigente
                ? "border-r-2 border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-r border-gray-100"
            } ${est === "futuro" && !esVigente ? "text-gray-400" : "text-gray-600"}`}
          >
            {esVigente && (
              <div className="text-[8px] font-bold text-indigo-500 leading-none mb-0.5">
                HOY ▾
              </div>
            )}
            {m}
          </th>
        );
      })}
      <th className="px-1.5 py-1.5 text-center text-[11px] font-bold text-gray-700 border-l-2 border-gray-300">
        AÑO
      </th>
    </tr>
  );
}

// Encabezado de fila con etiquetas alineadas real / meta / %
export function RowHeader({ name, bg }: { name: string; bg: string }) {
  return (
    <td className={`sticky left-0 z-10 ${bg} align-top p-0`}>
      <div className="flex">
        <div className="flex-1 px-2 self-center font-semibold text-gray-800 text-[11px] whitespace-nowrap">
          {name}
        </div>
        <div className="pr-1.5 text-right text-gray-400 select-none">
          <div className="text-[9px] leading-[14px]">real</div>
          <div className="text-[9px] leading-[14px] font-bold text-gray-500 border-y border-transparent">
            meta
          </div>
          <div className="text-[9px] leading-[15px]">% mes</div>
          <div className="text-[9px] leading-[13px]">% acum</div>
        </div>
      </div>
    </td>
  );
}

// Celda mensual: recolección (normal) · meta (negrita) · % del mes · % acum.
// El COLOR y el % principal responden al cumplimiento de la META MENSUAL;
// la última línea es el cumplimiento del plan acumulado (real ene..mes ÷
// meta ene..mes), coloreada solo en el texto. Sin meta = gris como el futuro.
export function CeldaMes({
  celda,
  acum,
  plan,
  estado,
  borde,
  mes,
}: {
  celda: Celda;
  acum: number;
  plan: AcumPlan;
  estado: Estado;
  borde: boolean;
  mes: string;
}) {
  const futuro = estado === "futuro";
  const sinMeta = celda.meta === 0;
  const neutral = futuro || sinMeta;
  const cumpleMes = cumplimientoMes(celda);

  let bg = "bg-gray-50";
  let pctText = "text-gray-300";
  if (!neutral) {
    const c = pctColor(cumpleMes);
    bg = c.bg;
    pctText = c.text;
  }
  const bordeCls = borde
    ? "border-r-2 border-indigo-500"
    : "border-r border-gray-100";

  let simbolo = "";
  if (estado === "pasado" && !sinMeta) {
    simbolo = cumpleMes >= 70 ? "✓ " : "✗ ";
  }

  const tip = neutral
    ? sinMeta
      ? `${mes}: sin meta asignada${celda.real ? ` · recolectado ${fmt(celda.real)}` : ""}`
      : `${mes}: meta del mes ${fmt(celda.meta)} (pendiente)`
    : `${mes} · Mes: ${cumpleMes}% (recolectado ${fmt(celda.real)} / meta ${fmt(
        celda.meta
      )}) · Acumulado a ${mes}: ${plan.pct}% (${fmt(plan.realAcum)} de ${fmt(
        plan.metaAcum
      )} planeados) · Avance del año: ${acum}% de la meta anual`;

  return (
    <td className={`${bg} ${bordeCls} p-0 align-top font-mono`} title={tip}>
      <div className={`${L_REAL} ${neutral ? "text-gray-300" : "text-gray-700"}`}>
        {fmt(celda.real)}
      </div>
      <div className={`${L_META} ${neutral ? "text-gray-400" : "text-gray-900"}`}>
        {fmt(celda.meta)}
      </div>
      {neutral ? (
        <>
          <div className="text-[11px] leading-[15px] text-center text-gray-300">·</div>
          <div className={`${L_ACUM} text-gray-300`}>·</div>
        </>
      ) : (
        <>
          <div className={`${L_PCT} ${pctText}`}>
            {simbolo}
            {cumpleMes}%
          </div>
          <div className={`${L_ACUM} font-bold ${pctColor(plan.pct).text}`}>{plan.pct}%</div>
        </>
      )}
    </td>
  );
}

// Celda anual (avance verdadero del año)
export function CeldaAnual({ real, meta }: { real: number; meta: number }) {
  const p = meta > 0 ? Math.round((real / meta) * 100) : real > 0 ? 100 : 0;
  const c = pctColor(p);
  return (
    <td className={`${c.bg} border-l-2 border-gray-300 p-0 align-top font-mono`}>
      <div className={`${L_REAL} text-gray-900`} title="Real acumulado del año">
        {fmt(real)}
      </div>
      <div className={`${L_META} text-gray-900`} title="Meta del año">
        {fmt(meta)}
      </div>
      <div className="text-[11px] leading-[15px] text-center text-gray-300">·</div>
      <div className={`${L_ACUM} ${c.text} font-bold`}>{p}%</div>
    </td>
  );
}

// Leyenda compartida (estructura de celda + colores + símbolos)
export function LeyendaMetas() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs text-gray-600">
      <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 bg-green-100">
        <div className="font-mono text-right leading-tight">
          <div className="text-[10px] text-gray-700">5.080</div>
          <div className="text-[10px] font-bold text-gray-900 bg-black/5 px-1">5.000</div>
          <div className="text-[10px] text-green-700">✓ 102%</div>
          <div className="text-[9px] font-bold text-green-700">98%</div>
        </div>
        <div className="text-[10px] text-gray-600 leading-tight">
          <div>← recolección (real)</div>
          <div className="font-semibold">← meta (negrita)</div>
          <div>← % de cumplimiento del mes</div>
          <div>← % acumulado (real ÷ meta, de enero a ese mes)</div>
        </div>
      </div>
      <span className="basis-full text-[11px] text-gray-500">
        El <strong>color</strong> y el <strong>% principal</strong> de cada celda
        responden al cumplimiento de la <strong>meta del mes</strong> (recolectado
        ÷ meta del mes). La línea de abajo es el <strong>% acumulado</strong>:
        todo lo recolectado de enero a ese mes ÷ todo lo planeado de enero a ese
        mes — responde si la zona va al día con el plan. En meses cerrados:
        {" "}<strong>✓</strong> cumplió la meta · <strong>✗</strong> no la cumplió.
        Los meses sin meta y los futuros van en gris. Pasa el mouse sobre una
        celda para ver el detalle completo.
      </span>
      <span className="text-gray-300">|</span>
      <span><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200 mr-1 align-middle" />≥70%</span>
      <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-200 mr-1 align-middle" />40–69%</span>
      <span><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200 mr-1 align-middle" />&lt;40%</span>
      <span><span className="inline-block w-3 h-3 rounded bg-gray-50 border border-gray-200 mr-1 align-middle" />Sin meta / futuro</span>
      <span><span className="inline-block w-0.5 h-3 bg-indigo-500 mr-1 align-middle" />Mes vigente (pasado | futuro)</span>
    </div>
  );
}

// Nota ámbar: por qué los primeros meses coinciden exactamente con lo ejecutado
export function NotaMetasIniciales({ year }: { year: number }) {
  if (year !== ACUERDO_METAS_YEAR) return null;
  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
      <div className="flex gap-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 flex-shrink-0 text-amber-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="leading-relaxed">
          <p className="font-semibold mb-0.5 text-amber-800">
            Sobre las metas de los primeros meses
          </p>
          <p>
            Las metas de {year} se concertaron el{" "}
            <strong>{ACUERDO_METAS_FECHA}</strong>. Para los meses anteriores a
            ese acuerdo —cuando todavía no existía una meta pactada contra la
            cual comparar— se decidió, de común acuerdo, registrar como meta el
            valor realmente ejecutado. Por eso esos meses aparecen marcados como
            cumplidos (✓) y sus cifras de meta y ejecución coinciden
            exactamente. No se trata de un ajuste de cifras: refleja que la
            planeación formal de metas inició en esa fecha, y el seguimiento de
            ejecución frente a meta aplica de ahí en adelante.
          </p>
        </div>
      </div>
    </div>
  );
}
