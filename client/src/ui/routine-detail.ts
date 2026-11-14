// 루틴 상세: 종목 목록(이름·부위·목표 세트), 하단 고정 "시작"·"운동 추가", 더보기 (기능 3 US5)
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import { appendExercises, getRoutineForEdit, resolveItems } from '../routines.ts';
import { clear, h } from './dom.ts';
import { pickExercises } from './exercise-picker.ts';
import { routineMenu, startRoutine } from './routine-list.ts';
import { emptyState } from './states.ts';
import { showToast } from './toast.ts';

export async function routineDetailScreen(ctx: Ctx, id: string): Promise<Screen> {
  const first = await getRoutineForEdit(ctx.db, id);
  return {
    title: first?.name ?? '루틴',
    tab: 'routines',
    back: '#/routines',
    async mount(container) {
      const host = h('div', { class: 'with-bottom-actions' });
      container.appendChild(host);

      async function render(): Promise<void> {
        const r = await getRoutineForEdit(ctx.db, id);
        clear(host);
        if (!r) {
          host.appendChild(emptyState({ title: '루틴을 찾을 수 없어요', action: { label: '루틴 목록으로', onClick: () => (location.hash = '#/routines') } }));
          return;
        }
        const items = await resolveItems(ctx.db, r);
        host.appendChild(
          h(
            'div',
            { class: 'list-head' },
            h('h2', { class: 'list-title', text: `종목 ${items.length}개` }),
            h('button', { class: 'btn btn-ghost', type: 'button', text: '⋯', attrs: { 'aria-label': `${r.name} 더보기` }, onClick: () => void routineMenu(ctx, r, { onChange: () => void render(), onDeleted: () => (location.hash = '#/routines') }) }),
          ),
        );
        if (items.length === 0) host.appendChild(emptyState({ title: '아직 종목이 없어요', hint: '아래 "운동 추가"로 종목을 넣어 보세요.' }));
        else {
          host.appendChild(
            h(
              'ul',
              { class: 'list', attrs: { 'aria-label': '루틴 종목' } },
              ...items.map(({ item, exercise }) =>
                h(
                  'li',
                  { class: 'list-item' },
                  h(
                    'div',
                    { class: 'list-item-body' },
                    h('span', { class: 'list-item-title', text: exercise?.name ?? '삭제된 종목' }),
                    h('span', { class: 'list-item-sub', text: `${exercise ? BODY_PART_LABEL[exercise.bodyPart] : '-'} · ${item.targetSets}세트` }),
                  ),
                ),
              ),
            ),
          );
        }
        host.appendChild(
          h(
            'div',
            { class: 'bottom-actions bottom-actions-focus' },
            h('button', { class: 'btn btn-primary btn-lg', type: 'button', text: '▶ 시작', onClick: () => void startRoutine(ctx, r) }),
            h('button', {
              class: 'btn btn-light btn-lg',
              type: 'button',
              text: '+ 운동 추가',
              onClick: async () => {
                const picked = await pickExercises(ctx);
                if (picked.length === 0) return;
                try {
                  const { skipped } = await appendExercises(ctx, id, picked);
                  await render();
                  if (skipped > 0) showToast(`종목은 최대 50개까지라 ${skipped}개는 넣지 못했어요`);
                } catch (e) {
                  showToast(e instanceof ValidationError ? e.message : '추가하지 못했어요');
                }
              },
            }),
          ),
        );
      }
      await render();
    },
  };
}
