// 그날 세션 목록 #/stats/day/:day — 달력에서 하루에 세션이 여럿인 날을 눌렀을 때 (기능 004 US4)
import { dayKey, parseDay } from '../../../shared/growth.ts';
import { formatWeight } from '../../../shared/units.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { formatDuration, formatTime } from '../format.ts';
import { listCompletedSessions, toRow } from '../history.ts';
import { getWeightUnit } from '../settings.ts';
import { h } from './dom.ts';
import { emptyState } from './states.ts';

export function statsDayScreen(ctx: Ctx, day: string): Screen {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(parseDay(day).getTime());
  const d = valid ? parseDay(day) : null;
  return {
    title: d ? `${d.getMonth() + 1}월 ${d.getDate()}일 운동` : '그날 운동',
    tab: 'stats',
    back: '#/stats',
    async mount(container) {
      const [sessions, unit] = await Promise.all([listCompletedSessions(ctx.db), getWeightUnit(ctx.db)]);
      const rows = valid ? sessions.filter((s) => dayKey(s.startedAt) === day).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map(toRow) : [];
      if (rows.length === 0) {
        container.appendChild(emptyState({ title: '이날 기록이 없어요', action: { label: '통계로', onClick: () => (location.hash = '#/stats') } }));
        return;
      }
      container.appendChild(
        h(
          'ul',
          { class: 'list', attrs: { 'aria-label': '이날 운동 기록' } },
          ...rows.map((r) =>
            h(
              'li',
              { class: 'list-item' },
              h(
                'a',
                { class: 'list-item-main', attrs: { href: `#/history/${r.id}` } },
                h('span', { class: 'list-item-title', text: `${formatTime(r.startedAt)} · ${r.routineName ?? '빈 세션'}` }),
                h('span', { class: 'list-item-sub', text: `총 볼륨 ${formatWeight(r.totalVolumeKg, unit)} ${unit} · ${r.completedSets}세트 · ${formatDuration(r.durationSec)}` }),
              ),
            ),
          ),
        ),
      );
    },
  };
}
