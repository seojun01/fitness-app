// 종료 요약 화면 (US2, FR-008)
import { formatWeight } from '../../../shared/units.ts';
import { summarize } from '../../../shared/volume.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { formatDuration } from '../format.ts';
import { getWeightUnit } from '../settings.ts';
import { getSession } from '../store/records.ts';
import { h } from './dom.ts';
import { emptyState } from './states.ts';

export function sessionSummaryScreen(ctx: Ctx, id: string): Screen {
  return {
    title: '운동 요약',
    tab: 'routines',
    async mount(container) {
      const s = await getSession(ctx.db, id);
      if (!s || s.deleted || s.status !== 'completed') {
        container.appendChild(emptyState({ title: '요약을 찾을 수 없어요', action: { label: '루틴으로', onClick: () => (location.hash = '#/routines') } }));
        return;
      }
      const unit = await getWeightUnit(ctx.db);
      const sum = summarize(s);
      const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('span', { class: 'stat-value', text: value }), h('span', { class: 'stat-label', text: label }));
      container.append(
        h('p', { class: 'list-item-sub', text: s.routineName ?? '빈 세션' }),
        h(
          'div',
          { class: 'stat-grid' },
          stat(formatDuration(sum.durationSec), '운동 시간'),
          stat(String(sum.completedSets), '완료 세트'),
          stat(`${formatWeight(sum.totalVolumeKg, unit)} ${unit}`, '총 볼륨'),
        ),
        h('h2', { class: 'section-title', text: '수행한 운동' }),
        ...s.entries.map((e) =>
          h(
            'section',
            { class: 'card' },
            h('h3', { class: 'entry-title', text: e.exerciseName }),
            h('ul', { class: 'list' }, ...e.sets.map((x, i) => h('li', { text: `${i + 1}세트  ${formatWeight(x.weightKg ?? 0, unit)}${unit} × ${x.reps ?? 0}회` }))),
          ),
        ),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', text: '확인', onClick: () => (location.hash = '#/routines') }),
      );
    },
  };
}
