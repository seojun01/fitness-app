// 가이드 전체 화면 (기능 2 US3): 가이드 본문 + 루틴에 추가
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { appendExercise, listRoutines } from '../routines.ts';
import { getExercise } from '../store/records.ts';
import { h } from './dom.ts';
import { guideView } from './guide-view.ts';
import { emptyState } from './states.ts';
import { showToast } from './toast.ts';

/** 루틴을 고르는 대화상자. 고른 루틴 id, 취소면 null */
function pickRoutine(ctx: Ctx): Promise<string | null> {
  return new Promise((resolve) => {
    const id = `pick-routine-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'sheet', attrs: { 'aria-labelledby': id } });
    const done = (v: string | null) => {
      dialog.close();
      dialog.remove();
      resolve(v);
    };
    const body = h('div');
    dialog.append(h('h2', { class: 'sheet-title', text: '어느 루틴에 추가할까요?', attrs: { id } }), body, h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => done(null) })));
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done(null);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    void listRoutines(ctx.db).then((routines) => {
      if (routines.length === 0) {
        body.append(h('p', { text: '아직 루틴이 없어요.' }), h('button', { class: 'btn btn-primary btn-block', type: 'button', text: '새 루틴 만들기', onClick: () => { done(null); location.hash = '#/routines/new'; } }));
        return;
      }
      body.appendChild(h('ul', { class: 'list' }, ...routines.map((r) => h('li', { class: 'list-item' }, h('button', { class: 'list-item-main', type: 'button', onClick: () => done(r.id) }, h('span', { class: 'list-item-title', text: r.name }))))));
    });
  });
}

export async function guideScreen(ctx: Ctx, exerciseId: string): Promise<Screen> {
  const ex = await getExercise(ctx.db, exerciseId);
  return {
    title: ex?.name ?? '가이드',
    tab: 'guides',
    back: '#/guides',
    mount(container) {
      if (!ex || ex.deleted) {
        container.appendChild(emptyState({ title: '종목을 찾을 수 없어요', action: { label: '가이드 목록으로', onClick: () => (location.hash = '#/guides') } }));
        return;
      }
      container.append(
        guideView(ctx, exerciseId),
        h('button', {
          class: 'btn btn-primary btn-block guide-add',
          type: 'button',
          text: '+ 루틴에 추가',
          onClick: async () => {
            const routineId = await pickRoutine(ctx);
            if (!routineId) return;
            try {
              const r = await appendExercise(ctx, routineId, exerciseId);
              showToast(`${r.name}에 ${ex.name}을(를) 추가했어요`);
            } catch (e) {
              showToast(e instanceof ValidationError ? e.message : '추가하지 못했어요');
            }
          },
        }),
      );
    },
  };
}
