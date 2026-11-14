// 가이드를 대화상자로 연다 (기능 2): 진행 화면·종목 선택에서. 원래 화면은 그대로 둔다 (research G8)
import type { Ctx } from '../context.ts';
import { getExercise } from '../store/records.ts';
import { h } from './dom.ts';
import { guideView } from './guide-view.ts';

export async function openGuideSheet(ctx: Ctx, exerciseId: string, fallbackName = '운동 가이드'): Promise<void> {
  const name = (await getExercise(ctx.db, exerciseId))?.name ?? fallbackName;
  return new Promise((resolve) => {
    const id = `guide-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'sheet guide-sheet', attrs: { 'aria-labelledby': id } });
    const close = () => {
      if (!dialog.isConnected) return;
      dialog.close();
      dialog.remove();
      resolve();
    };
    dialog.append(
      h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title', text: name, attrs: { id } }), h('button', { class: 'btn btn-ghost', type: 'button', text: '닫기', onClick: close })),
      guideView(ctx, exerciseId, { beforeNavigate: close }),
    );
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      close();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
