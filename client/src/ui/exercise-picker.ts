// 종목 선택 대화상자: 부위별 목록, 검색, 직접 만들기, 이름 수정·삭제 (FR-003)
import { BODY_PARTS, type BodyPart } from '../../../shared/model.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { createExercise, deleteExercise, listExercises, renameExercise, restoreExercise } from '../exercises.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import type { StoredExercise } from '../store/db.ts';
import { clear, h } from './dom.ts';
import { showToast } from './toast.ts';

/** 종목을 고르면 그 id, 닫으면 null */
export function pickExercise(ctx: Ctx): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'sheet', attrs: { 'aria-labelledby': 'picker-title' } });
    let query = '';
    let editingId: string | null = null;
    let done = false;

    const finish = (id: string | null) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(id);
    };

    const title = h('h2', { class: 'sheet-title', text: '종목 선택', attrs: { id: 'picker-title' } });
    const search = h('input', { class: 'input', type: 'search', attrs: { id: 'picker-search', placeholder: '이름으로 찾기' } });
    const listHost = h('div', { class: 'picker-list' });
    const errorEl = h('p', { class: 'field-error', attrs: { role: 'alert' } });

    async function renderList(): Promise<void> {
      const all = await listExercises(ctx.db);
      const q = query.trim().toLowerCase();
      const shown = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
      clear(listHost);
      if (shown.length === 0) {
        listHost.appendChild(h('p', { class: 'hint', text: '맞는 종목이 없어요. 아래에서 직접 만들 수 있어요.' }));
        return;
      }
      for (const part of BODY_PARTS) {
        const group = shown.filter((e) => e.bodyPart === part);
        if (group.length === 0) continue;
        listHost.appendChild(h('h3', { class: 'section-title', text: BODY_PART_LABEL[part] }));
        const ul = h('ul', { class: 'list' });
        for (const ex of group) ul.appendChild(exerciseRow(ex));
        listHost.appendChild(ul);
      }
    }

    function exerciseRow(ex: StoredExercise): HTMLElement {
      if (editingId === ex.id) {
        const input = h('input', { class: 'input', type: 'text', value: ex.name, attrs: { 'aria-label': '새 이름', maxlength: '120' } });
        return h(
          'li',
          { class: 'list-item item-edit' },
          input,
          h(
            'div',
            { class: 'item-controls' },
            h('button', {
              class: 'btn btn-primary',
              type: 'button',
              text: '이름 저장',
              onClick: async () => {
                try {
                  await renameExercise(ctx, ex.id, input.value);
                  editingId = null;
                  errorEl.textContent = '';
                  await renderList();
                } catch (e) {
                  errorEl.textContent = e instanceof ValidationError ? e.message : '저장하지 못했어요';
                }
              },
            }),
            h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => { editingId = null; errorEl.textContent = ''; void renderList(); } }),
          ),
        );
      }
      return h(
        'li',
        { class: 'list-item item-edit' },
        h('button', { class: 'list-item-main', type: 'button', onClick: () => finish(ex.id) }, h('span', { class: 'list-item-title', text: ex.name })),
        h(
          'div',
          { class: 'item-controls' },
          h('button', { class: 'btn btn-ghost', type: 'button', text: '이력', attrs: { 'aria-label': `${ex.name} 이력` }, onClick: () => { finish(null); location.hash = `#/exercise/${ex.id}`; } }),
          h('button', { class: 'btn btn-ghost', type: 'button', text: '수정', attrs: { 'aria-label': `${ex.name} 이름 수정` }, onClick: () => { editingId = ex.id; void renderList(); } }),
          h('button', {
            class: 'btn btn-ghost',
            type: 'button',
            text: '삭제',
            attrs: { 'aria-label': `${ex.name} 삭제` },
            onClick: async () => {
              await deleteExercise(ctx, ex.id);
              await renderList();
              showToast(`${ex.name} 종목을 삭제했어요`, { actionLabel: '되돌리기', onAction: () => void restoreExercise(ctx, ex.id).then(() => renderList()) });
            },
          }),
        ),
      );
    }

    search.addEventListener('input', () => {
      query = search.value;
      void renderList();
    });

    // 직접 만들기
    const nameInput = h('input', { class: 'input', type: 'text', attrs: { id: 'new-ex-name', maxlength: '120' } });
    const partSelect = h('select', { class: 'input', attrs: { id: 'new-ex-part' } }, ...BODY_PARTS.map((p) => h('option', { value: p, text: BODY_PART_LABEL[p] })));
    const createForm = h(
      'details',
      { class: 'card' },
      h('summary', { text: '직접 종목 만들기' }),
      h('div', { class: 'field' }, h('label', { text: '종목 이름', attrs: { for: 'new-ex-name' } }), nameInput),
      h('div', { class: 'field' }, h('label', { text: '부위', attrs: { for: 'new-ex-part' } }), partSelect),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: '만들기',
        onClick: async () => {
          try {
            const ex = await createExercise(ctx, { name: nameInput.value, bodyPart: partSelect.value as BodyPart });
            finish(ex.id);
          } catch (e) {
            errorEl.textContent = e instanceof ValidationError ? e.message : '만들지 못했어요';
          }
        },
      }),
    );

    dialog.append(
      title,
      h('div', { class: 'field' }, h('label', { text: '종목 검색', attrs: { for: 'picker-search' } }), search),
      errorEl,
      listHost,
      createForm,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: '닫기', onClick: () => finish(null) })),
    );
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      finish(null);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    void renderList();
  });
}
