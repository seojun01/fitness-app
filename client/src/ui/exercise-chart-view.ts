// 종목 차트 본문 (기능 004 US1): 기간·지표 선택, 추이 선 차트, 고른 점 설명, 표, 개인 최고 기록.
// #/stats/exercise/:id 화면과 진행 화면의 대화상자가 함께 쓴다 (research S10).
import type { Session, WeightUnit } from '../../../shared/model.ts';
import { exerciseSeries, firstDayOf, parseDay, periodRange, personalRecords, type DayKey, type ExercisePoint, type Period } from '../../../shared/growth.ts';
import { formatWeight, fromKg } from '../../../shared/units.ts';
import { PERIODS, readPeriod, savePeriod } from '../stats-period.ts';
import { dataTable, lineChart, type ChartHandle } from './charts.ts';
import { h } from './dom.ts';
import { segmented } from './segmented.ts';

type Metric = 'e1rm' | 'maxWeight' | 'volume' | 'totalReps' | 'maxReps';
const METRIC_LABEL: Record<Metric, string> = { e1rm: '추정 1RM', maxWeight: '최고 무게', volume: '세션 볼륨', totalReps: '세션 총 횟수', maxReps: '최다 횟수' };
const WEIGHT_METRICS: Metric[] = ['e1rm', 'maxWeight', 'volume'];
const REPS_METRICS: Metric[] = ['totalReps', 'maxReps'];

export const monthDay = (k: DayKey) => {
  const d = parseDay(k);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const shortDay = (k: DayKey) => {
  const d = parseDay(k);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
/** 축 눈금: 만 단위가 넘으면 K */
export const compact = (v: number) => (Math.abs(v) >= 10_000 ? `${r2(v / 1000)}K` : String(r2(v)));

export interface ExerciseChartInput {
  exerciseId: string;
  name: string;
  /** 직접 지운 종목: 과거 기록 차트는 볼 수 있다 */
  deleted: boolean;
  bodyweight: boolean;
  sessions: Session[];
  unit: WeightUnit;
  now?: () => Date;
}

export function renderExerciseChart(container: HTMLElement, input: ExerciseChartInput): { destroy(): void } {
  const now = input.now ?? (() => new Date());
  const w = (kg: number) => `${formatWeight(kg, input.unit)}${input.unit}`;
  const pr = personalRecords(input.exerciseId, input.sessions);
  const hasAny = pr.maxReps !== null;
  let period: Period = readPeriod();
  let metric: Metric | null = null;
  let chart: ChartHandle | null = null;
  // 기간·지표를 바꿔 다시 그려도 "표로 보기"를 펼친 상태는 유지한다
  let tableOpen = false;
  const keepOpen = (d: HTMLElement) => {
    (d as HTMLDetailsElement).open = tableOpen;
    d.addEventListener('toggle', () => (tableOpen = (d as HTMLDetailsElement).open));
    return d;
  };
  const body = h('div', { class: 'exercise-chart' });

  const valueOf = (p: ExercisePoint, m: Metric): number =>
    m === 'e1rm' ? p.e1rmKg : m === 'maxWeight' ? p.maxWeightKg : m === 'volume' ? p.volumeKg : m === 'totalReps' ? p.totalReps : p.maxReps;
  const isWeight = (m: Metric) => WEIGHT_METRICS.includes(m);
  const show = (v: number, m: Metric) => (isWeight(m) ? w(v) : `${v}회`);

  function render(): void {
    chart?.destroy();
    chart = null;
    const range = periodRange(period, now(), firstDayOf(input.sessions));
    const series = range ? exerciseSeries(input.exerciseId, input.sessions, range) : { points: [], grouped: false, bodyweightLike: false };
    const repsOnly = input.bodyweight || series.bodyweightLike || (pr.maxWeight === null && hasAny);
    const metrics = repsOnly ? REPS_METRICS : WEIGHT_METRICS;
    if (!metric || !metrics.includes(metric)) metric = metrics[0]!;
    const m = metric;
    const periodLabel = PERIODS.find((p) => p.value === period)!.label;

    const status = h('p', { class: 'chart-readout', attrs: { role: 'status', 'aria-live': 'polite' } });
    const describe = (i: number) => {
      const p = series.points[i]!;
      const when = series.grouped ? `${monthDay(p.day)} 주` : monthDay(p.day);
      const sets = p.sets.length ? ` · ${p.sets.map((s) => (repsOnly ? `${s.reps}회` : `${w(s.weightKg)}×${s.reps}`)).join(', ')}` : '';
      status.textContent = `${when} · ${METRIC_LABEL[m]} ${show(valueOf(p, m), m)}${sets}`;
    };

    const parts: (HTMLElement | null)[] = [
      segmented('기간', PERIODS, period, (v) => {
        period = v;
        savePeriod(v);
        render();
      }),
      segmented('지표', metrics.map((x) => ({ value: x, label: METRIC_LABEL[x] })), m, (v) => {
        metric = v;
        render();
      }),
    ];

    const pts = series.points;
    if (pts.length === 0) {
      parts.push(h('p', { class: 'hint chart-empty', text: hasAny ? `${periodLabel} 동안 기록이 없어요. 기간을 늘려 보세요.` : '아직 기록이 없어요' }));
    } else {
      const disp = (v: number) => (isWeight(m) ? r2(fromKg(v, input.unit)) : v);
      const first = valueOf(pts[0]!, m);
      const last = valueOf(pts.at(-1)!, m);
      const trend = pts.length === 1 ? `${show(last, m)}` : `${show(first, m)}에서 ${show(last, m)}로 ${last > first ? '증가' : last < first ? '감소' : '변화 없음'}`;
      chart = lineChart({
        points: pts.map((p) => ({ label: shortDay(p.day), value: disp(valueOf(p, m)) })),
        summary: `${input.name} ${METRIC_LABEL[m]}, ${periodLabel} 동안 ${trend}`,
        formatTick: compact,
        onSelect: describe,
      });
      status.textContent = pts.length > 1 ? '차트를 누르거나 ←/→ 키로 날짜를 고르세요.' : '';
      parts.push(
        h('div', { class: 'chart-card' }, h('p', { class: 'chart-title', text: `${METRIC_LABEL[m]}${isWeight(m) ? ` (${input.unit})` : ' (회)'}` }), chart.el, status),
        pts.length === 1 ? h('p', { class: 'hint', text: '기록이 쌓이면 추이가 보여요' }) : null,
        series.grouped ? h('p', { class: 'hint', text: '기록이 많아 주별 최고값으로 보여요' }) : null,
        keepOpen(dataTable(`${input.name} ${METRIC_LABEL[m]}`, [series.grouped ? '주' : '날짜', METRIC_LABEL[m]], pts.map((p) => [series.grouped ? `${monthDay(p.day)} 주` : monthDay(p.day), show(valueOf(p, m), m)]))),
      );
    }

    if (hasAny) {
      const item = (label: string, rec: { value: number; day: DayKey; sessionId: string } | null, fmt: (v: number) => string) =>
        rec
          ? h(
              'li',
              { class: 'pr-item' },
              h('span', { class: 'stat-label', text: label }),
              h('span', { class: 'stat-value', text: fmt(rec.value) }),
              h('a', { class: 'pr-date', attrs: { href: `#/history/${rec.sessionId}`, 'aria-label': `${label} 기록한 날 ${monthDay(rec.day)} 기록 보기` }, text: monthDay(rec.day) }),
            )
          : null;
      const reps = (v: number) => `${v}회`;
      parts.push(
        h(
          'section',
          { class: 'pr', attrs: { 'aria-label': '개인 최고 기록' } },
          h('h2', { class: 'section-title', text: '개인 최고 기록' }),
          h(
            'ul',
            { class: 'pr-list' },
            ...(repsOnly
              ? [item('최고 세션 총 횟수', pr.sessionReps, reps), item('한 세트 최다 횟수', pr.maxReps, reps)]
              : [item('추정 1RM', pr.e1rm, w), item('최고 무게', pr.maxWeight, w), item('최고 세션 볼륨', pr.sessionVolume, w), item('한 세트 최다 횟수', pr.maxReps, reps)]),
          ),
          repsOnly ? null : h('p', { class: 'hint', text: '추정 1RM은 엡리 공식으로 계산한 참고값이에요.' }),
        ),
      );
    }
    body.replaceChildren(...parts.filter((x): x is HTMLElement => x !== null));
  }

  if (input.deleted) container.append(h('p', { class: 'hint', text: '삭제된 종목이에요. 지난 기록은 그대로 볼 수 있어요.' }));
  container.append(body);
  render();
  return { destroy: () => chart?.destroy() };
}

