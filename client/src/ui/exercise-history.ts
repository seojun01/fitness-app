// 종목 이력 화면 (US4, FR-011): 그 종목의 완료 세트를 날짜순(최신 먼저)으로
import { formatWeight } from '../../../shared/units.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { formatDate } from '../format.ts';
import { exerciseHistory } from '../history.ts';
import { getWeightUnit } from '../settings.ts';
import { getExercise } from '../store/records.ts';
import { h } from './dom.ts';
import { emptyState } from './states.ts';

export async function exerciseHistoryScreen(ctx: Ctx, exerciseId: string): Promise<Screen> {
  const ex = await getExercise(ctx.db, exerciseId);
  return {
    title: ex?.name ?? '종목 이력',
    tab: 'history',
    async mount(container) {
      if (!ex) {
        container.appendChild(emptyState({ title: '종목을 찾을 수 없어요', action: { label: '기록으로', onClick: () => (location.hash = '#/history') } }));
        return;
      }
      const [items, unit] = await Promise.all([exerciseHistory(ctx.db, exerciseId), getWeightUnit(ctx.db)]);
      if (items.length === 0) {
        container.appendChild(emptyState({ title: '이 종목의 기록이 아직 없어요' }));
        return;
      }
      container.appendChild(h('a', { class: 'btn btn-block', attrs: { href: `#/stats/exercise/${exerciseId}` }, text: '차트 보기' }));
      container.appendChild(
        h(
          'ul',
          { class: 'list', attrs: { 'aria-label': '세트 기록' } },
          ...items.map((it) =>
            h(
              'li',
              { class: 'list-item' },
              h(
                'button',
                { class: 'list-item-main', type: 'button', onClick: () => (location.hash = `#/history/${it.sessionId}`) },
                h('span', { class: 'list-item-title', text: `${formatDate(it.endedAt)} · ${it.routineName ?? '빈 세션'}` }),
                h('span', { class: 'list-item-sub', text: it.sets.map((s) => `${formatWeight(s.weightKg, unit)}${unit} × ${s.reps}`).join(', ') }),
              ),
            ),
          ),
        ),
      );
    },
  };
}
