// 종목 차트 화면 #/stats/exercise/:id 와 진행 화면용 대화상자 (기능 004 US1·US5)
import { exercisesByRecency } from '../../../shared/growth.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { getWeightUnit } from '../settings.ts';
import { getExercise, listAllSessions } from '../store/records.ts';
import { h } from './dom.ts';
import { renderExerciseChart, type ExerciseChartInput } from './exercise-chart-view.ts';

/** 차트에 필요한 것을 한 번에 읽는다 (기간·지표를 바꿀 때는 다시 읽지 않는다, research S7) */
async function loadInput(ctx: Ctx, exerciseId: string): Promise<ExerciseChartInput> {
  const [ex, sessions, unit] = await Promise.all([getExercise(ctx.db, exerciseId), listAllSessions(ctx.db), getWeightUnit(ctx.db)]);
  const fallback = ex ? undefined : exercisesByRecency(sessions).find((x) => x.exerciseId === exerciseId)?.name;
  return {
    exerciseId,
    name: ex?.name ?? fallback ?? '종목',
    deleted: !ex || ex.deleted,
    bodyweight: ex?.bodyweight ?? false,
    sessions,
    unit,
    now: ctx.now,
  };
}

export async function exerciseChartScreen(ctx: Ctx, exerciseId: string): Promise<Screen> {
  const input = await loadInput(ctx, exerciseId);
  let view: { destroy(): void } | null = null;
  return {
    title: `${input.name} 차트`,
    tab: 'stats',
    back: '#/stats',
    mount(container) {
      view = renderExerciseChart(container, input);
    },
    unmount() {
      view?.destroy();
    },
  };
}

/** 진행 화면에서 연다: 원래 화면(입력값·휴식 타이머)은 그대로 둔다 (FR-011) */
export async function openExerciseChartDialog(ctx: Ctx, exerciseId: string): Promise<void> {
  const input = await loadInput(ctx, exerciseId);
  return new Promise((resolve) => {
    const id = `chart-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'picker-full chart-dialog', attrs: { 'aria-labelledby': id } });
    let view: { destroy(): void } | null = null;
    const close = () => {
      if (!dialog.isConnected) return;
      view?.destroy();
      dialog.close();
      dialog.remove();
      resolve();
    };
    const content = h('div', { class: 'chart-dialog-body' });
    dialog.append(
      h('div', { class: 'picker-head sheet-head' }, h('h2', { class: 'sheet-title', text: `${input.name} 차트`, attrs: { id } }), h('button', { class: 'btn btn-ghost', type: 'button', text: '닫기', onClick: close })),
      content,
    );
    // 기록 날짜 링크로 다른 화면에 가면 대화상자를 닫는다
    content.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a[href]')) close();
    });
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      close();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    view = renderExerciseChart(content, input);
  });
}
