// 기록 목록 화면 (US4): 완료한 세션을 최신순으로
import { formatWeight } from '../../../shared/units.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { formatDate, formatDuration } from '../format.ts';
import { listHistory, type HistoryRow } from '../history.ts';
import { getWeightUnit } from '../settings.ts';
import { clear, h } from './dom.ts';
import { emptyState, errorState, loadingState } from './states.ts';

const PAGE = 50;

export function historyListScreen(ctx: Ctx): Screen {
  let host: HTMLElement;

  async function render(): Promise<void> {
    clear(host);
    host.appendChild(loadingState());
    try {
      const [rows, unit] = await Promise.all([listHistory(ctx.db), getWeightUnit(ctx.db)]);
      clear(host);
      if (rows.length === 0) {
        host.appendChild(emptyState({ title: '아직 기록이 없어요', hint: '운동을 마치면 여기에 쌓여요.', action: { label: '루틴으로 가기', onClick: () => (location.hash = '#/routines') } }));
        return;
      }
      const ul = h('ul', { class: 'list', attrs: { 'aria-label': '운동 기록' } });
      const more = h('button', { class: 'btn btn-block', type: 'button', text: '더 보기' });
      let shown = 0;
      const item = (r: HistoryRow) =>
        h(
          'li',
          { class: 'list-item' },
          h(
            'button',
            { class: 'list-item-main', type: 'button', onClick: () => (location.hash = `#/history/${r.id}`) },
            h('span', { class: 'list-item-title', text: `${formatDate(r.endedAt)} · ${r.routineName ?? '빈 세션'}` }),
            h('span', { class: 'list-item-sub', text: `총 볼륨 ${formatWeight(r.totalVolumeKg, unit)} ${unit} · ${r.completedSets}세트 · ${formatDuration(r.durationSec)}` }),
          ),
        );
      const showMore = () => {
        for (const r of rows.slice(shown, shown + PAGE)) ul.appendChild(item(r));
        shown = Math.min(rows.length, shown + PAGE);
        more.hidden = shown >= rows.length;
      };
      more.addEventListener('click', showMore);
      showMore();
      host.append(ul, more);
    } catch (err) {
      clear(host);
      host.appendChild(errorState(err instanceof Error ? err.message : String(err), () => void render()));
    }
  }

  return {
    title: '기록',
    tab: 'history',
    async mount(container) {
      host = h('div');
      container.appendChild(host);
      await render();
    },
  };
}
