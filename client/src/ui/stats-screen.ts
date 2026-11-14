// 통계 탭 #/stats (기능 004 US2~US5): 기간 요약·증감, 주별(월별) 막대, 부위별 비중, 운동 달력, 종목 차트 찾기.
// 세션·종목은 화면을 열 때 한 번 읽고, 기간을 바꾸면 메모리에서 다시 계산한다 (research S7).
import type { BodyPart, Session, WeightUnit } from '../../../shared/model.ts';
import {
  bodyPartShare,
  buckets,
  calendarMonth,
  exercisesByRecency,
  firstDayOf,
  keyOf,
  parseDay,
  periodRange,
  previousRange,
  summarizeRange,
  type Period,
} from '../../../shared/growth.ts';
import { formatWeight, fromKg } from '../../../shared/units.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { formatDuration } from '../format.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import { getWeightUnit } from '../settings.ts';
import { PERIODS, readPeriod, savePeriod } from '../stats-period.ts';
import type { StoredExercise } from '../store/db.ts';
import { listAllExercises, listAllSessions } from '../store/records.ts';
import { columnChart, dataTable, type ChartHandle } from './charts.ts';
import { h } from './dom.ts';
import { compact } from './exercise-chart-view.ts';
import { segmented } from './segmented.ts';
import { emptyState } from './states.ts';

const r2 = (x: number) => Math.round(x * 100) / 100;

export function statsScreen(ctx: Ctx): Screen {
  const charts: ChartHandle[] = [];
  return {
    title: '통계',
    tab: 'stats',
    async mount(container) {
      const [sessions, exercises, unit] = await Promise.all([listAllSessions(ctx.db), listAllExercises(ctx.db), getWeightUnit(ctx.db)]);
      const exMap = new Map(exercises.map((e) => [e.id, e]));
      const recent = exercisesByRecency(sessions);
      const first = firstDayOf(sessions);
      if (!first) {
        container.appendChild(emptyState({ title: '운동을 기록하면 여기에 통계가 쌓여요', hint: '운동을 마칠 때마다 횟수·볼륨·성장 추이가 계산돼요.', action: { label: '루틴으로 가기', onClick: () => (location.hash = '#/routines') } }));
        return;
      }
      const w = (kg: number) => `${formatWeight(kg, unit)}${unit}`;
      const nameOf = (id: string) => exMap.get(id)?.name ?? recent.find((r) => r.exerciseId === id)?.name ?? '종목';

      let period: Period = readPeriod();
      const periodHost = h('div');
      const draw = () => {
        for (const c of charts.splice(0)) c.destroy();
        periodHost.replaceChildren(...periodSections(sessions, exMap, period, unit, w, nameOf, charts, ctx.now()));
      };
      container.append(
        segmented('기간', PERIODS, period, (v) => {
          period = v;
          savePeriod(v);
          draw();
        }),
        periodHost,
        calendarSection(sessions, ctx.now()),
        finderSection(exercises, recent),
      );
      draw();
    },
    unmount() {
      for (const c of charts.splice(0)) c.destroy();
    },
  };
}

// ── 기간 요약·막대·부위 (US2·US3) ──

function periodSections(
  sessions: Session[],
  exMap: Map<string, StoredExercise>,
  period: Period,
  unit: WeightUnit,
  w: (kg: number) => string,
  nameOf: (id: string) => string,
  charts: ChartHandle[],
  now: Date,
): HTMLElement[] {
  const range = periodRange(period, now, firstDayOf(sessions))!;
  const cur = summarizeRange(sessions, range);
  const prev = period === 'all' ? null : summarizeRange(sessions, previousRange(range));

  const delta = (d: number, fmt: (v: number) => string) => {
    if (d === 0) return h('span', { class: 'delta delta-same', text: '지난 기간과 같아요' });
    const up = d > 0;
    return h('span', { class: `delta ${up ? 'delta-up' : 'delta-down'}` }, h('span', { attrs: { 'aria-hidden': 'true' }, text: up ? '▲ ' : '▼ ' }), `지난 기간보다 ${fmt(Math.abs(d))} ${up ? '늘었어요' : '줄었어요'}`);
  };
  const tile = (label: string, value: string, d: HTMLElement | null) => h('div', { class: 'stat summary-stat' }, h('span', { class: 'stat-label', text: label }), h('span', { class: 'stat-value', text: value }), d);
  const summary = h(
    'section',
    { class: 'card', attrs: { 'aria-label': '기간 요약' } },
    h('div', { class: 'summary-grid' },
      tile('운동', `${cur.sessions}회`, prev ? delta(cur.sessions - prev.sessions, (v) => `${v}회`) : null),
      tile('총 볼륨', w(cur.volumeKg), prev ? delta(r2(cur.volumeKg - prev.volumeKg), w) : null),
      tile('운동 시간', formatDuration(cur.durationSec), prev ? delta(cur.durationSec - prev.durationSec, formatDuration) : null),
    ),
  );

  // 주별(월별) 막대: 운동 횟수와 볼륨은 단위가 달라 차트를 나눈다 (축 하나 원칙)
  const b = buckets(sessions, range);
  const unitWord = b.unit === 'week' ? '주별' : '월별';
  const when = (label: string) => (b.unit === 'week' ? `${label} 주` : label);
  const colCard = (title: string, values: number[], fmt: (v: number) => string) => {
    const readout = h('p', { class: 'chart-readout', attrs: { role: 'status', 'aria-live': 'polite' } });
    const total = values.reduce((a, v) => a + v, 0);
    const c = columnChart({
      items: b.items.map((it, i) => ({ label: it.label, value: values[i]! })),
      summary: `${unitWord} ${title}, ${b.items.length}개 구간, 가장 많은 구간 ${fmt(Math.max(...values))}, 합계 ${fmt(r2(total))}`,
      formatTick: compact,
      formatValue: (v) => compact(v),
      onSelect: (i) => (readout.textContent = `${when(b.items[i]!.label)} · ${title} ${fmt(values[i]!)}`),
    });
    charts.push(c);
    return h('div', { class: 'chart-card' }, h('p', { class: 'chart-title', text: title }), c.el, readout);
  };
  const volumes = b.items.map((it) => r2(fromKg(it.volumeKg, unit)));
  const bars = h(
    'section',
    { class: 'card', attrs: { 'aria-label': `${unitWord} 운동` } },
    h('h2', { class: 'section-title', text: `${unitWord} 운동` }),
    colCard('운동 횟수', b.items.map((it) => it.sessions), (v) => `${v}회`),
    colCard(`볼륨 (${unit})`, volumes, (v) => `${v}${unit}`),
    dataTable(`${unitWord} 운동`, [b.unit === 'week' ? '주 (월요일)' : '달', '운동', `볼륨 (${unit})`], b.items.map((it, i) => [it.label, `${it.sessions}회`, String(volumes[i])])),
  );

  // 부위별 비중 (완료 세트 수 기준)
  const shares = bodyPartShare(sessions, new Map([...exMap].map(([id, e]) => [id, { bodyPart: e.bodyPart as BodyPart }])), range);
  const parts = h(
    'section',
    { class: 'card', attrs: { 'aria-label': '부위별 비중' } },
    h('h2', { class: 'section-title', text: '부위별 비중' }),
    h('p', { class: 'hint', text: '완료한 세트 수 기준이에요.' }),
    h(
      'ul',
      { class: 'part-list' },
      ...shares.map((p) => {
        const pct = Math.round(p.ratio * 100);
        const list = h('ul', { class: 'part-exercises', hidden: true, attrs: { 'aria-label': `${BODY_PART_LABEL[p.part]} 종목` } }, ...p.exerciseIds.map((id) => h('li', {}, h('a', { class: 'part-exercise', attrs: { href: `#/stats/exercise/${id}`, 'aria-label': `${nameOf(id)} 차트` }, text: nameOf(id) }))));
        const btn = h(
          'button',
          {
            class: 'part-row',
            type: 'button',
            disabled: p.sets === 0,
            attrs: { 'aria-expanded': 'false' },
            onClick: () => {
              const open = btn.getAttribute('aria-expanded') !== 'true';
              btn.setAttribute('aria-expanded', String(open));
              list.hidden = !open;
            },
          },
          h('span', { class: 'part-name', text: BODY_PART_LABEL[p.part] }),
          ' ',
          h('span', { class: 'part-track', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'part-fill', attrs: { style: `width:${pct}%` } })),
          h('span', { class: 'part-value', text: `${p.sets}세트 ${pct}%` }),
        );
        return h('li', {}, btn, list);
      }),
    ),
  );
  return [summary, bars, parts];
}

// ── 달력 (US4) ──

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function calendarSection(sessions: Session[], now: Date): HTMLElement {
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const todayKey = keyOf(now);
  const host = h('div');
  const section = h('section', { class: 'card cal-card', attrs: { 'aria-label': '운동 달력' } }, host);
  const move = (d: number) => {
    const t = new Date(year, month - 1 + d, 1);
    year = t.getFullYear();
    month = t.getMonth() + 1;
    render();
    (host.querySelector(d < 0 ? '[data-nav=prev]' : '[data-nav=next]') as HTMLElement | null)?.focus();
  };
  function render(): void {
    const cal = calendarMonth(sessions, year, month);
    const grid = h(
      'div',
      { class: 'cal-grid' },
      ...WEEKDAYS.map((d) => h('span', { class: 'cal-weekday', attrs: { 'aria-hidden': 'true' }, text: d })),
      ...cal.weeks.flat().map((c) => {
        if (!c.inMonth) return h('span', { class: 'cal-day cal-out', attrs: { 'aria-hidden': 'true' } });
        const n = parseDay(c.day).getDate();
        const today = c.day === todayKey;
        if (c.sessionIds.length === 0) return h('span', { class: today ? 'cal-day cal-today' : 'cal-day', text: String(n) });
        return h(
          'button',
          {
            class: today ? 'cal-day cal-active cal-today' : 'cal-day cal-active',
            type: 'button',
            onClick: () => (location.hash = c.sessionIds.length === 1 ? `#/history/${c.sessionIds[0]}` : `#/stats/day/${c.day}`),
          },
          // 읽히는 이름: "11월 3일, 운동 1회" (보이는 글자는 날짜 숫자와 점)
          h('span', {}, h('span', { class: 'visually-hidden', text: `${month}월` }), ' ', String(n), h('span', { class: 'visually-hidden', text: `일, 운동 ${c.sessionIds.length}회` })),
          h('span', { class: 'cal-dot', attrs: { 'aria-hidden': 'true' }, text: '•' }),
        );
      }),
    );
    host.replaceChildren(
      h(
        'div',
        { class: 'cal-head' },
        h('button', { class: 'btn btn-ghost', type: 'button', text: '‹', attrs: { 'aria-label': '이전 달', 'data-nav': 'prev' }, onClick: () => move(-1) }),
        h('h2', { class: 'cal-title', text: `${year}년 ${month}월` }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: '›', attrs: { 'aria-label': '다음 달', 'data-nav': 'next' }, onClick: () => move(1) }),
      ),
      h('p', { class: 'hint cal-count', text: `${month}월 운동 ${cal.activeDays}일` }),
      grid,
    );
  }
  render();
  return section;
}

// ── 종목 차트 찾기 (US5, FR-006) ──

function finderSection(exercises: StoredExercise[], recent: { exerciseId: string; name: string }[]): HTMLElement {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const recorded = new Set(recent.map((r) => r.exerciseId));
  const others = exercises.filter((e) => !e.deleted && e.name && !recorded.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const list = h('ul', { class: 'list', attrs: { 'aria-label': '기록이 있는 종목' } });
  const item = (id: string, name: string, sub: string) =>
    h('li', { class: 'list-item' }, h('a', { class: 'list-item-main', attrs: { href: `#/stats/exercise/${id}` } }, h('span', { class: 'list-item-title' }, name, h('span', { class: 'visually-hidden', text: ' 차트' })), h('span', { class: 'list-item-sub', text: sub })));
  const recordedItem = (r: { exerciseId: string; name: string }) => {
    const ex = byId.get(r.exerciseId);
    return item(r.exerciseId, ex && !ex.deleted ? ex.name : r.name, ex && !ex.deleted ? '기록 있음' : '삭제된 종목 · 기록 있음');
  };
  const search = h('input', { class: 'input', type: 'search', attrs: { 'aria-label': '종목 차트 찾기', placeholder: '종목 이름으로 찾기' } });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    if (!q) {
      list.setAttribute('aria-label', '기록이 있는 종목');
      list.replaceChildren(...recent.slice(0, 8).map(recordedItem));
      return;
    }
    list.setAttribute('aria-label', '찾은 종목');
    const hit = (name: string) => name.toLowerCase().includes(q);
    const rows = [...recent.filter((r) => hit(byId.get(r.exerciseId)?.name ?? r.name)).map(recordedItem), ...others.filter((e) => hit(e.name)).map((e) => item(e.id, e.name, '아직 기록 없음'))];
    list.replaceChildren(...(rows.length ? rows : [h('li', { class: 'hint', text: '찾는 종목이 없어요' })]));
  };
  search.addEventListener('input', render);
  render();
  return h('section', { class: 'card', attrs: { 'aria-label': '종목 차트' } }, h('h2', { class: 'section-title', text: '종목 차트' }), search, list);
}
