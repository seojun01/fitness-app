// 가이드 탭 (기능 2 US3): 부위 필터·검색
import { BODY_PARTS, type BodyPart } from '../../../shared/model.ts';
import { muscleNames } from '../../../shared/muscles.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { listGuideEntries } from '../guides.ts';
import { BODY_PART_LABEL } from '../labels.ts';
import { clear, h } from './dom.ts';
import { emptyState, errorState, loadingState } from './states.ts';

export function guideListScreen(ctx: Ctx): Screen {
  let part: BodyPart | '' = '';
  let query = '';
  const results = h('div');

  async function render(): Promise<void> {
    clear(results);
    results.appendChild(loadingState());
    try {
      const entries = await listGuideEntries(ctx.db, { bodyPart: part || undefined, query });
      clear(results);
      if (entries.length === 0) {
        results.appendChild(emptyState({ title: '맞는 종목이 없어요', hint: '부위나 검색어를 바꿔 보세요.' }));
        return;
      }
      results.appendChild(
        h(
          'ul',
          { class: 'list', attrs: { 'aria-label': '가이드 목록' } },
          ...entries.map((e) =>
            h(
              'li',
              { class: 'list-item' },
              h(
                'div',
                { class: 'list-item-body' },
                h('button', { class: 'list-item-main', type: 'button', onClick: () => (location.hash = `#/guides/${e.exercise.id}`) }, h('span', { class: 'list-item-title', text: e.exercise.name })),
                h('span', { class: 'list-item-sub', text: `${BODY_PART_LABEL[e.exercise.bodyPart]} · ${e.hasGuide ? (e.primaryMuscles.length ? `주동근 ${muscleNames(e.primaryMuscles)}` : '가이드 있음') : '가이드 없음'}` }),
              ),
            ),
          ),
        ),
      );
    } catch (err) {
      clear(results);
      results.appendChild(errorState(err instanceof Error ? err.message : String(err), () => void render()));
    }
  }

  return {
    title: '가이드',
    tab: 'guides',
    async mount(container) {
      const select = h(
        'select',
        {
          class: 'input',
          attrs: { id: 'guide-part' },
          onChange: () => {
            part = select.value as BodyPart | '';
            void render();
          },
        },
        h('option', { value: '', text: '전체 부위' }),
        ...BODY_PARTS.filter((p) => p !== 'other').map((p) => h('option', { value: p, text: BODY_PART_LABEL[p] })),
      );
      const search = h('input', { class: 'input', type: 'search', attrs: { id: 'guide-search', placeholder: '이름으로 찾기', autocomplete: 'off' } });
      search.addEventListener('input', () => {
        query = search.value;
        void render();
      });
      container.append(
        h(
          'div',
          { class: 'filter-row' },
          h('div', { class: 'field' }, h('label', { text: '부위', attrs: { for: 'guide-part' } }), select),
          h('div', { class: 'field' }, h('label', { text: '가이드 검색', attrs: { for: 'guide-search' } }), search),
        ),
        results,
      );
      await render();
    },
  };
}
