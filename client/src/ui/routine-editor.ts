// 루틴 편집 화면 (US1): 이름, 종목 추가·삭제·순서 변경, 목표 세트 수
import type { RoutineItem } from '../../../shared/model.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import { addItem, createRoutine, getRoutineForEdit, moveItem, removeItemAt, setTargetSets, updateRoutine } from '../routines.ts';
import { listAllExercises } from '../store/records.ts';
import { clear, h } from './dom.ts';
import { pickExercise } from './exercise-picker.ts';

export function routineEditorScreen(ctx: Ctx, id: string | null): Screen {
  let items: RoutineItem[] = [];
  let name = '';

  return {
    title: id ? '루틴 편집' : '새 루틴',
    tab: 'routines',
    back: id ? `#/routines/${id}` : '#/routines',
    async mount(container) {
      if (id) {
        const cur = await getRoutineForEdit(ctx.db, id);
        if (!cur) {
          container.appendChild(h('p', { text: '루틴을 찾을 수 없어요' }));
          return;
        }
        name = cur.name;
        items = cur.items.map((i) => ({ ...i }));
      }
      const exercises = new Map((await listAllExercises(ctx.db)).map((e) => [e.id, e]));

      const nameInput = h('input', { class: 'input', type: 'text', value: name, attrs: { id: 'routine-name', maxlength: '120', autocomplete: 'off' } });
      const nameError = h('p', { class: 'field-error', attrs: { role: 'alert' } });
      const itemsHost = h('ul', { class: 'list', attrs: { 'aria-label': '루틴 종목' } });
      const itemsEmpty = h('p', { class: 'hint', text: '아직 종목이 없어요. 아래에서 추가해 보세요.' });
      const status = h('p', { class: 'hint', attrs: { role: 'status', 'aria-live': 'polite' } });

      function renderItems(): void {
        clear(itemsHost);
        itemsEmpty.hidden = items.length > 0;
        items.forEach((it, i) => {
          const ex = exercises.get(it.exerciseId);
          const label = ex && !ex.deleted ? ex.name : '삭제된 종목';
          const btn = (text: string, aria: string, onClick: () => void, disabled = false) =>
            h('button', { class: 'btn btn-ghost', type: 'button', text, disabled, attrs: { 'aria-label': aria }, onClick });
          itemsHost.appendChild(
            h(
              'li',
              { class: 'list-item item-edit' },
              h('span', { class: 'list-item-main' }, h('span', { class: 'list-item-title', text: label }), h('span', { class: 'list-item-sub', text: ex ? BODY_PART_LABEL[ex.bodyPart] : '' })),
              h(
                'div',
                { class: 'item-controls' },
                btn('−', `${label} 세트 줄이기`, () => { items = setTargetSets(items, i, it.targetSets - 1); renderItems(); }, it.targetSets <= 1),
                h('span', { class: 'timer', text: `${it.targetSets}세트` }),
                btn('+', `${label} 세트 늘리기`, () => { items = setTargetSets(items, i, it.targetSets + 1); renderItems(); }, it.targetSets >= 20),
                btn('↑', `${label} 위로 이동`, () => { items = moveItem(items, i, i - 1); renderItems(); }, i === 0),
                btn('↓', `${label} 아래로 이동`, () => { items = moveItem(items, i, i + 1); renderItems(); }, i === items.length - 1),
                btn('삭제', `${label} 삭제`, () => { items = removeItemAt(items, i); renderItems(); }),
              ),
            ),
          );
        });
      }
      renderItems();

      const addBtn = h('button', {
        class: 'btn btn-block',
        type: 'button',
        text: '종목 추가',
        onClick: async () => {
          const picked = await pickExercise(ctx);
          if (!picked) return;
          try {
            items = addItem(items, picked);
            // 방금 만든 종목도 이름을 알 수 있게 다시 읽는다
            for (const e of await listAllExercises(ctx.db)) exercises.set(e.id, e);
            renderItems();
            status.textContent = '';
          } catch (e) {
            status.textContent = e instanceof ValidationError ? e.message : '추가하지 못했어요';
          }
        },
      });

      async function save(): Promise<void> {
        nameError.textContent = '';
        nameInput.removeAttribute('aria-invalid');
        try {
          if (id) {
            await updateRoutine(ctx, id, { name: nameInput.value, items });
            location.hash = `#/routines/${id}`; // 편집을 마치면 그 루틴의 상세로
          } else {
            await createRoutine(ctx, nameInput.value, items);
            location.hash = '#/routines';
          }
        } catch (e) {
          if (e instanceof ValidationError) {
            if (e.field === 'name') {
              nameError.textContent = e.message;
              nameInput.setAttribute('aria-invalid', 'true');
              nameInput.focus();
            } else status.textContent = e.message;
          } else status.textContent = '저장하지 못했어요. 다시 시도해 주세요';
        }
      }

      container.appendChild(
        h(
          'form',
          { onSubmit: (ev: Event) => { ev.preventDefault(); void save(); } },
          h('div', { class: 'field' }, h('label', { text: '루틴 이름', attrs: { for: 'routine-name' } }), nameInput, nameError),
          h('h2', { class: 'section-title', text: '종목' }),
          itemsEmpty,
          itemsHost,
          addBtn,
          status,
          h(
            'div',
            { class: 'btn-row', attrs: { style: 'margin-top:16px' } },
            h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => (location.hash = id ? `#/routines/${id}` : '#/routines') }),
            h('button', { class: 'btn btn-primary', type: 'submit', text: '저장' }),
          ),
        ),
      );
    },
  };
}
