// 직접 그리는 SVG 차트 (기능 004, research S8·S9). 런타임 의존성 없이 createElementNS 로만 만든다 (innerHTML 금지).
// 모두 한 계열(series) 차트라 범례 대신 제목이 무엇인지 말한다. 색은 CSS 토큰 --chart (dataviz 검증: 두 테마 통과).
// 접근성: SVG 는 role=img + 요약 문장, 같은 데이터를 "표로 보기"로도 준다. 점·막대는 ←/→ 로 고르고 결과는 글로 알린다.
import { h } from './dom.ts';

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

/** 깔끔한 눈금: 1·2·2.5·5 × 10^n 간격으로 count 개 남짓 */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!(max > min)) {
    const v = max || 1;
    return min === 0 && max === 0 ? [0, 1] : [Math.max(0, v - Math.abs(v) * 0.5), v + Math.abs(v) * 0.5].map((x) => Math.round(x));
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) out.push(Math.round(v * 1000) / 1000);
  if (out.at(-1)! < max) out.push(out.at(-1)! + step);
  return out;
}

export interface ChartHandle {
  el: HTMLElement;
  /** 고른 점·막대 (없으면 -1) */
  selected(): number;
  select(i: number): void;
  destroy(): void;
}

interface Common {
  /** SVG 의 접근 가능한 이름: 차트가 말하는 것을 한 문장으로 */
  summary: string;
  /** 축 눈금 글자 */
  formatTick(v: number): string;
  /** 점·막대를 고를 때 (키보드·터치·마우스) */
  onSelect?(i: number): void;
  height?: number;
}

/** 폭이 바뀌면 다시 그린다. 선택은 유지한다 */
function responsive(build: (width: number, selected: number) => SVGElement, count: number, opts: Common, groupLabel: string): ChartHandle {
  let selected = -1;
  const wrap = h('div', { class: 'chart', attrs: { role: 'group', 'aria-label': groupLabel, tabindex: count > 0 ? '0' : '-1' } });
  let width = 0;
  const draw = () => {
    const w = Math.max(240, Math.round(wrap.getBoundingClientRect().width) || 320);
    width = w;
    wrap.replaceChildren(build(w, selected));
  };
  const select = (i: number) => {
    if (count === 0) return;
    const next = Math.max(0, Math.min(count - 1, i));
    if (next === selected) return;
    selected = next;
    wrap.replaceChildren(build(width || 320, selected));
    opts.onSelect?.(selected);
  };
  wrap.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    const map: Record<string, number> = { ArrowLeft: selected < 0 ? count - 1 : selected - 1, ArrowRight: selected < 0 ? count - 1 : selected + 1, Home: 0, End: count - 1 };
    if (!(key in map)) return;
    e.preventDefault();
    select(map[key]!);
  });
  wrap.addEventListener('pointerdown', (e) => {
    const svg = wrap.querySelector('svg');
    if (!svg || count === 0) return;
    const box = svg.getBoundingClientRect();
    const x = ((e as PointerEvent).clientX - box.left) * (width / box.width);
    const xs = (svg as SVGElement & { __xs?: number[] }).__xs ?? [];
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i;
    select(best);
  });
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    const w = Math.round(wrap.getBoundingClientRect().width);
    if (w > 0 && Math.abs(w - width) > 1) draw();
  });
  ro?.observe(wrap);
  queueMicrotask(draw);
  wrap.appendChild(build(320, selected)); // 붙기 전 첫 그림 (폭을 알면 다시 그린다)
  return { el: wrap, selected: () => selected, select, destroy: () => ro?.disconnect() };
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/** 날짜에 따른 한 지표의 선 차트. 점은 r=4, 고른 점은 크게 + 세로 보조선 (색에만 의존하지 않음) */
export function lineChart(opts: Common & { points: { label: string; value: number }[] }): ChartHandle {
  const { points } = opts;
  const H = opts.height ?? 200;
  const build = (W: number, sel: number): SVGElement => {
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': opts.summary, class: 'chart-svg' });
    const values = points.map((p) => p.value);
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const pad = (hi - lo) * 0.1;
    const ticks = niceTicks(Math.max(0, lo - pad), hi + pad, 3);
    const t0 = ticks[0]!;
    const t1 = ticks.at(-1)!;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const y = (v: number) => PAD.top + ih - ((v - t0) / (t1 - t0 || 1)) * ih;
    const x = (i: number) => PAD.left + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    for (const t of ticks) {
      svg.append(svgEl('line', { x1: PAD.left, x2: W - PAD.right, y1: y(t), y2: y(t), class: 'chart-grid' }));
      svg.append(svgEl('text', { x: PAD.left - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'chart-tick' }, opts.formatTick(t)));
    }
    // x 라벨: 처음·끝 (가운데는 자리가 있을 때만)
    const xLabels = points.length <= 1 ? [0] : iw > 300 && points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0, points.length - 1];
    for (const i of xLabels) {
      if (!points[i]) continue;
      const anchor = points.length <= 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
      svg.append(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': anchor, class: 'chart-tick' }, points[i]!.label));
    }
    if (sel >= 0 && points[sel]) svg.append(svgEl('line', { x1: x(sel), x2: x(sel), y1: PAD.top, y2: PAD.top + ih, class: 'chart-cross' }));
    if (points.length > 1) svg.append(svgEl('polyline', { points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '), class: 'chart-line' }));
    points.forEach((p, i) => svg.append(svgEl('circle', { cx: x(i), cy: y(p.value), r: i === sel ? 7 : points.length > 40 ? 3 : 4, class: i === sel ? 'chart-dot chart-dot-selected' : 'chart-dot' })));
    (svg as SVGElement & { __xs?: number[] }).__xs = points.map((_, i) => x(i));
    return svg;
  };
  return responsive(build, points.length, opts, '점 고르기');
}

/** 세로 막대 (주별·월별). 막대 ≤24px, 위쪽만 둥글게, 막대 사이 간격, 최댓값에만 값 라벨 */
export function columnChart(opts: Common & { items: { label: string; value: number }[]; formatValue(v: number): string }): ChartHandle {
  const { items } = opts;
  const H = opts.height ?? 160;
  const build = (W: number, sel: number): SVGElement => {
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': opts.summary, class: 'chart-svg' });
    const hi = Math.max(0, ...items.map((b) => b.value));
    const ticks = niceTicks(0, hi || 1, 2);
    const top = ticks.at(-1)!;
    const left = 36;
    const iw = W - left - 8;
    const ih = H - PAD.top - PAD.bottom;
    const base = PAD.top + ih;
    const slot = iw / Math.max(1, items.length);
    const bw = Math.max(2, Math.min(24, slot - 2));
    for (const t of ticks) {
      const yy = base - (t / top) * ih;
      svg.append(svgEl('line', { x1: left, x2: W - 8, y1: yy, y2: yy, class: 'chart-grid' }));
      svg.append(svgEl('text', { x: left - 6, y: yy + 4, 'text-anchor': 'end', class: 'chart-tick' }, opts.formatTick(t)));
    }
    // x 라벨: 겹치지 않게 간격을 두고 (마지막은 항상)
    const every = Math.max(1, Math.ceil(36 / slot));
    const maxIdx = items.reduce((m, b, i) => (b.value > (items[m]?.value ?? -1) ? i : m), 0);
    items.forEach((b, i) => {
      const cx = left + slot * i + slot / 2;
      const hgt = (b.value / top) * ih;
      if (i === sel) svg.append(svgEl('rect', { x: left + slot * i, y: PAD.top, width: slot, height: ih, class: 'chart-col-hover' }));
      if (b.value > 0) {
        const r = Math.min(4, bw / 2, hgt);
        const x0 = cx - bw / 2;
        const y0 = base - hgt;
        svg.append(svgEl('path', { d: `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${base}Z`, class: i === sel ? 'chart-col chart-col-selected' : 'chart-col' }));
      }
      if ((items.length - 1 - i) % every === 0) svg.append(svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'chart-tick' }, b.label));
      if (i === maxIdx && b.value > 0) svg.append(svgEl('text', { x: cx, y: base - hgt - 4, 'text-anchor': 'middle', class: 'chart-value' }, opts.formatValue(b.value)));
    });
    svg.append(svgEl('line', { x1: left, x2: W - 8, y1: base, y2: base, class: 'chart-axis' }));
    (svg as SVGElement & { __xs?: number[] }).__xs = items.map((_, i) => left + slot * i + slot / 2);
    return svg;
  };
  return responsive(build, items.length, opts, '막대 고르기');
}

/** 차트와 같은 데이터를 표로 (화면 낭독기·정확한 값 확인용, FR-013) */
export function dataTable(caption: string, headers: string[], rows: string[][]): HTMLElement {
  return h(
    'details',
    { class: 'chart-table' },
    h('summary', { text: '표로 보기' }),
    h(
      'table',
      {},
      h('caption', { class: 'visually-hidden', text: caption }),
      h('thead', {}, h('tr', {}, ...headers.map((t) => h('th', { attrs: { scope: 'col' }, text: t })))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c, i) => (i === 0 ? h('th', { attrs: { scope: 'row' }, text: c }) : h('td', { text: c })))))),
    ),
  );
}
