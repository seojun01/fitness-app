// 직접 만든 종목의 가이드 노트 편집 (기능 2 US4)
import { isBuiltinExerciseId } from '../../../shared/model.ts';
import { MUSCLES, MUSCLE_IDS, type MuscleId } from '../../../shared/muscles.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { saveGuideNote } from '../guides.ts';
import { getExercise, getGuideNote } from '../store/records.ts';
import { h } from './dom.ts';
import { emptyState } from './states.ts';

export async function guideNoteEditorScreen(ctx: Ctx, exerciseId: string): Promise<Screen> {
  const ex = await getExercise(ctx.db, exerciseId);
  return {
    title: ex ? `${ex.name} 가이드` : '가이드 작성',
    tab: 'guides',
    back: `#/guides/${exerciseId}`,
    async mount(container) {
      if (!ex || ex.deleted || isBuiltinExerciseId(exerciseId)) {
        container.appendChild(emptyState({ title: '이 종목의 가이드는 고칠 수 없어요', action: { label: '가이드로', onClick: () => (location.hash = `#/guides/${exerciseId}`) } }));
        return;
      }
      const cur = await getGuideNote(ctx.db, exerciseId);
      const live = cur && !cur.deleted ? cur : undefined;
      const cues = h('textarea', { class: 'input memo-input', value: (live?.cues ?? []).join('\n'), attrs: { id: 'note-cues', rows: 5 } });
      const mistakes = h('textarea', { class: 'input memo-input', value: (live?.mistakes ?? []).join('\n'), attrs: { id: 'note-mistakes', rows: 4 } });
      const error = h('p', { class: 'field-error', attrs: { role: 'alert' } });
      const group = (legend: string, name: string, selected: MuscleId[]) => {
        const boxes = MUSCLE_IDS.map((m) => {
          const input = h('input', { type: 'checkbox', value: m, checked: selected.includes(m) });
          return { m, input, label: h('label', { class: 'chip' }, input, h('span', { text: MUSCLES[m] })) };
        });
        const el = h('fieldset', { class: 'chip-group', attrs: { 'aria-label': legend } }, h('legend', { class: 'field-label', text: legend }), ...boxes.map((b) => b.label));
        void name;
        return { el, value: () => boxes.filter((b) => b.input.checked).map((b) => b.m) };
      };
      const primary = group('주동근', 'primary', live?.primaryMuscles ?? []);
      const secondary = group('보조근', 'secondary', live?.secondaryMuscles ?? []);
      const lines = (t: HTMLTextAreaElement) => t.value.split('\n');

      async function save(): Promise<void> {
        error.textContent = '';
        try {
          await saveGuideNote(ctx, exerciseId, { cues: lines(cues), mistakes: lines(mistakes), primaryMuscles: primary.value(), secondaryMuscles: secondary.value() });
          location.hash = `#/guides/${exerciseId}`;
        } catch (e) {
          error.textContent =
            e instanceof ValidationError
              ? e.field.startsWith('secondaryMuscles')
                ? '보조근은 6개까지, 주동근과 겹치지 않게 골라 주세요'
                : e.field.startsWith('primaryMuscles')
                  ? '주동근은 6개까지 고를 수 있어요'
                  : '요점과 실수는 각각 10줄까지, 한 줄에 200자까지 쓸 수 있어요'
              : '저장하지 못했어요';
        }
      }

      container.appendChild(
        h(
          'form',
          { onSubmit: (ev: Event) => { ev.preventDefault(); void save(); } },
          h('div', { class: 'field' }, h('label', { text: '자세 요점 (한 줄에 하나)', attrs: { for: 'note-cues' } }), cues),
          h('div', { class: 'field' }, h('label', { text: '흔한 실수 (한 줄에 하나)', attrs: { for: 'note-mistakes' } }), mistakes),
          primary.el,
          secondary.el,
          h('p', { class: 'hint', text: '모두 비우고 저장하면 가이드가 지워져요.' }),
          error,
          h(
            'div',
            { class: 'btn-row' },
            h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => (location.hash = `#/guides/${exerciseId}`) }),
            h('button', { class: 'btn btn-primary', type: 'submit', text: '저장' }),
          ),
        ),
      );
    },
  };
}
