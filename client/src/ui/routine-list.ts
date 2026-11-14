// 메인: 내 루틴 카드(부위·마지막 수행일·시작·더보기), 정렬, 하단 고정 "자유운동"·"+ 추가" (기능 3 US5)
import { relativeDay } from '../../../shared/stats.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import { deleteRoutine, duplicateRoutine, listRoutineCards, restoreRoutine, type RoutineSort } from '../routines.ts';
import { ActiveSessionError, getActiveSession, listOtherDeviceActive, startSession } from '../sessions.ts';
import type { StoredRoutine } from '../store/db.ts';
import { choose } from './dialog.ts';
import { clear, h } from './dom.ts';
import { emptyState, errorState, loadingState } from './states.ts';
import { showToast } from './toast.ts';

const SORT_KEY = 'fitness.routineSort';
const readSort = (): RoutineSort => {
  try {
    return localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'recent';
  } catch {
    return 'recent';
  }
};

export async function startRoutine(ctx: Ctx, routine: StoredRoutine | null): Promise<void> {
  try {
    await startSession(ctx, routine);
  } catch (e) {
    if (!(e instanceof ActiveSessionError)) throw e; // 이미 진행 중이면 그 세션으로 간다
  }
  location.hash = '#/session/0';
}

/** 루틴 더보기 메뉴: 편집·복제·삭제 (목록과 상세에서 함께 쓴다) */
export async function routineMenu(ctx: Ctx, r: StoredRoutine, after: { onChange(): void; onDeleted(): void }): Promise<void> {
  const c = await choose(r.name, '이 루틴을 어떻게 할까요?', [
    { value: 'cancel', label: '취소' },
    { value: 'edit', label: '편집' },
    { value: 'copy', label: '복제' },
    { value: 'delete', label: '삭제', danger: true },
  ]);
  if (c === 'edit') location.hash = `#/routines/${r.id}/edit`;
  if (c === 'copy') {
    await duplicateRoutine(ctx, r.id);
    after.onChange();
  }
  if (c === 'delete') {
    await deleteRoutine(ctx, r.id);
    after.onDeleted();
    showToast(`${r.name} 루틴을 삭제했어요`, { actionLabel: '되돌리기', onAction: () => void restoreRoutine(ctx, r.id).then(after.onChange) });
  }
}

export function routineListScreen(ctx: Ctx): Screen {
  let host: HTMLElement;
  let sort = readSort();

  async function render(): Promise<void> {
    clear(host);
    host.appendChild(loadingState());
    try {
      const [cards, active, others] = await Promise.all([listRoutineCards(ctx.db, sort), getActiveSession(ctx), listOtherDeviceActive(ctx)]);
      clear(host);
      if (active) {
        host.appendChild(
          h(
            'div',
            { class: 'card banner' },
            h('p', { class: 'state-title', text: '진행 중인 세션이 있어요' }),
            h('p', { class: 'hint', text: active.routineName ?? '자유운동' }),
            h('button', { class: 'btn btn-primary', type: 'button', text: '이어서 기록', onClick: () => (location.hash = '#/session') }),
          ),
        );
      }
      for (const o of others) {
        host.appendChild(h('div', { class: 'card' }, h('p', { class: 'state-title', text: '다른 기기에서 진행 중' }), h('p', { class: 'hint', text: `${o.routineName ?? '빈 세션'} · 그 기기에서만 고칠 수 있어요` })));
      }
      const sortSelect = h(
        'select',
        {
          class: 'input input-inline',
          attrs: { id: 'routine-sort' },
          onChange: () => {
            sort = sortSelect.value === 'name' ? 'name' : 'recent';
            try {
              localStorage.setItem(SORT_KEY, sort);
            } catch {
              /* 기기 편의 상태 */
            }
            void render();
          },
        },
        h('option', { value: 'recent', text: '최근 순', selected: sort === 'recent' }),
        h('option', { value: 'name', text: '이름 순', selected: sort === 'name' }),
      );
      host.appendChild(
        h('div', { class: 'list-head' }, h('h2', { class: 'list-title', text: '내 루틴' }), h('label', { class: 'visually-hidden', text: '정렬', attrs: { for: 'routine-sort' } }), sortSelect),
      );
      if (cards.length === 0) {
        host.appendChild(
          emptyState({ title: '아직 루틴이 없어요', hint: '자주 하는 운동을 묶어 루틴으로 저장해 보세요.', action: { label: '첫 루틴 만들기', onClick: () => (location.hash = '#/routines/new') } }),
        );
      } else {
        const ul = h('ul', { class: 'list' });
        for (const { routine: r, bodyParts, lastPerformed } of cards) {
          const parts = bodyParts.length ? bodyParts.slice(0, 3).map((p) => BODY_PART_LABEL[p]).join(', ') + (bodyParts.length > 3 ? ` 외 ${bodyParts.length - 3}` : '') : '종목 없음';
          const when = lastPerformed ? relativeDay(lastPerformed, ctx.now()) : '기록 없음';
          ul.appendChild(
            h(
              'li',
              { class: 'routine-card' },
              h('button', { class: 'start-icon', type: 'button', text: '⚡', attrs: { 'aria-label': `${r.name} 시작` }, onClick: () => void startRoutine(ctx, r) }),
              h(
                'div',
                { class: 'list-item-body' },
                h('button', { class: 'list-item-main', type: 'button', onClick: () => (location.hash = `#/routines/${r.id}`) }, h('span', { class: 'list-item-title routine-name', text: r.name })),
                h('span', { class: 'routine-parts', text: parts }),
                h('span', { class: 'list-item-sub', text: `${when} · 종목 ${r.items.length}개` }),
              ),
              h('button', { class: 'btn btn-ghost', type: 'button', text: '⋯', attrs: { 'aria-label': `${r.name} 더보기` }, onClick: () => void routineMenu(ctx, r, { onChange: () => void render(), onDeleted: () => void render() }) }),
            ),
          );
        }
        host.appendChild(ul);
      }
      host.appendChild(
        h(
          'div',
          { class: 'bottom-actions' },
          h('button', { class: 'btn btn-primary btn-lg', type: 'button', text: '⚡ 자유운동', onClick: () => void startRoutine(ctx, null) }),
          h('button', { class: 'btn btn-light btn-lg', type: 'button', text: '+ 추가', onClick: () => (location.hash = '#/routines/new') }),
        ),
      );
    } catch (err) {
      clear(host);
      host.appendChild(errorState(err instanceof Error ? err.message : String(err), () => void render()));
    }
  }

  return {
    title: '루틴',
    tab: 'routines',
    async mount(container) {
      host = h('div', { class: 'with-bottom-actions' });
      container.appendChild(host);
      await render();
    },
  };
}
