// 종목 선택 (기능 5): 전체 화면, 검색, 세 줄 필터, 좋아요, 더보기, 여러 개 선택 후 한 번에 추가
import { BODY_PARTS, EQUIPMENT, type BodyPart, type Equipment } from '../../../shared/model.ts';
import { GROUP_LABEL, MUSCLE_GROUPS, type MuscleGroup } from '../../../shared/muscle-groups.ts';
import type { Ctx } from '../context.ts';
import { ValidationError } from '../errors.ts';
import { filterCatalog, loadCatalog, tagLabel, type Category, type CatalogItem } from '../exercise-catalog.ts';
import { createExercise, deleteExercise, renameExercise, restoreExercise, toggleFavorite } from '../exercises.ts';
import { BODY_PART_LABEL, EQUIPMENT_LABEL } from '../labels.ts';
import { choose } from './dialog.ts';
import { clear, h } from './dom.ts';
import { openGuideSheet } from './guide-sheet.ts';
import { emptyState } from './states.ts';
import { showToast } from './toast.ts';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'favorite', label: '좋아하는' },
  { key: 'frequent', label: '자주하는' },
  { key: 'recent', label: '최근' },
  { key: 'custom', label: '커스텀' },
];

/** 작은 입력 대화상자 (이름 수정·커스텀 운동 추가) */
function formDialog(title: string, fields: HTMLElement[], submitLabel: string, onSubmit: () => Promise<string | null>): Promise<boolean> {
  return new Promise((resolve) => {
    const id = `form-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'sheet', attrs: { 'aria-labelledby': id } });
    const error = h('p', { class: 'field-error', attrs: { role: 'alert' } });
    const done = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(ok);
    };
    dialog.append(
      h(
        'form',
        {
          onSubmit: async (ev: Event) => {
            ev.preventDefault();
            const msg = await onSubmit();
            if (msg) error.textContent = msg;
            else done(true);
          },
        },
        h('h2', { class: 'sheet-title', text: title, attrs: { id } }),
        ...fields,
        error,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', text: '취소', onClick: () => done(false) }), h('button', { class: 'btn btn-primary', type: 'submit', text: submitLabel })),
      ),
    );
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done(false);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

const field = (label: string, input: HTMLElement, id: string) => {
  input.id = id;
  return h('div', { class: 'field' }, h('label', { text: label, attrs: { for: id } }), input);
};

/** 고른 종목 id 들(고른 순서), 닫으면 빈 배열 */
/** single: 하나만 고른다 (진행 중 운동 변경). 하단 버튼은 "이 운동으로 변경", exclude 는 목록에서 뺄 지금 종목 */
export function pickExercises(ctx: Ctx, opts: { single?: { exclude?: string } } = {}): Promise<string[]> {
  const single = opts.single;
  return new Promise((resolve) => {
    const titleId = `picker-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'picker-full', attrs: { 'aria-labelledby': titleId } });
    let items: CatalogItem[] = [];
    let selected: string[] = [];
    let query = '';
    let category: Category = 'all';
    let group: MuscleGroup | undefined;
    let equipment: Equipment | undefined;
    let done = false;

    const finish = (ids: string[]) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(ids);
    };

    // ── 위쪽: 뒤로, 검색, 새 종목 ──
    const search = h('input', { class: 'input picker-search', type: 'search', attrs: { id: `${titleId}-q`, placeholder: '종목 검색', autocomplete: 'off' } });
    search.addEventListener('input', () => {
      query = search.value;
      renderList();
    });
    const head = h(
      'div',
      { class: 'picker-head' },
      h('button', { class: 'btn btn-ghost icon-btn', type: 'button', text: '‹', attrs: { 'aria-label': '닫기' }, onClick: () => finish([]) }),
      h('label', { class: 'visually-hidden', text: '종목 검색', attrs: { for: `${titleId}-q` } }),
      search,
      h('button', { class: 'btn btn-ghost icon-btn', type: 'button', text: '＋', attrs: { 'aria-label': '새 종목 만들기' }, onClick: () => void addCustom() }),
    );

    // ── 세 줄 필터 ──
    function chipRow<T extends string>(label: string, options: { key: T | undefined; label: string }[], get: () => T | undefined, set: (v: T | undefined) => void, cls: string): HTMLElement {
      const row = h('div', { class: `chip-row ${cls}`, attrs: { role: 'group', 'aria-label': label } });
      const draw = () => {
        clear(row);
        for (const o of options) {
          row.appendChild(
            h('button', {
              class: 'chip-tab',
              type: 'button',
              text: o.label,
              attrs: { 'aria-pressed': String(get() === o.key) },
              onClick: () => {
                set(o.key);
                draw();
                renderList();
              },
            }),
          );
        }
      };
      draw();
      return row;
    }
    const filters = h(
      'div',
      { class: 'picker-filters' },
      chipRow<Category>('분류', CATEGORIES.map((c) => ({ key: c.key, label: c.label })), () => category, (v) => (category = v ?? 'all'), 'row-category'),
      chipRow<MuscleGroup>('근육 부위', [{ key: undefined, label: '전체' }, ...MUSCLE_GROUPS.map((g) => ({ key: g, label: GROUP_LABEL[g] }))], () => group, (v) => (group = v), 'row-group'),
      chipRow<Equipment>('장비', [{ key: undefined, label: '전체' }, ...EQUIPMENT.map((e) => ({ key: e, label: EQUIPMENT_LABEL[e] }))], () => equipment, (v) => (equipment = v), 'row-equipment'),
    );

    // ── 목록 ──
    const list = h('ul', { class: 'list picker-list', attrs: { 'aria-label': '종목 목록' } });
    const listHost = h('div', {});
    const body = h('div', { class: 'picker-body' });

    function row(item: CatalogItem): HTMLElement {
      const ex = item.exercise;
      const isSel = selected.includes(ex.id);
      return h(
        'li',
        { class: 'picker-row', attrs: { 'data-selected': String(isSel) } },
        h('button', {
          class: 'heart',
          type: 'button',
          text: ex.favorite ? '♥' : '♡',
          attrs: { 'aria-label': `${ex.name} 좋아요`, 'aria-pressed': String(!!ex.favorite) },
          onClick: async () => {
            const saved = await toggleFavorite(ctx, ex.id);
            item.exercise = saved;
            renderList();
          },
        }),
        h(
          'div',
          { class: 'list-item-body' },
          h(
            'button',
            {
              class: 'list-item-main',
              type: 'button',
              attrs: { 'aria-pressed': String(isSel) },
              onClick: () => {
                selected = isSel ? selected.filter((id) => id !== ex.id) : single ? [ex.id] : [...selected, ex.id];
                renderList();
              },
            },
            h('span', { class: 'list-item-title', text: ex.name }),
            isSel ? h('span', { class: 'picked', text: ' ✓', attrs: { 'aria-hidden': 'true' } }) : null,
          ),
          h('span', { class: 'list-item-sub', text: `${tagLabel(item)} · ${EQUIPMENT_LABEL[item.equipment]}` }),
        ),
        h('button', { class: 'btn btn-ghost', type: 'button', text: '⋯', attrs: { 'aria-label': `${ex.name} 더보기` }, onClick: () => void menu(item) }),
      );
    }

    function renderList(): void {
      const shown = filterCatalog(items, { query, category, group, equipment }).filter((it) => it.exercise.id !== single?.exclude);
      clear(listHost);
      clear(list);
      if (shown.length === 0) {
        listHost.appendChild(
          emptyState({
            title: category === 'frequent' || category === 'recent' ? '아직 기록이 없어요' : '맞는 종목이 없어요',
            hint: '필터를 바꾸거나 커스텀 운동을 추가해 보세요.',
          }),
        );
      } else {
        for (const it of shown) list.appendChild(row(it));
        listHost.appendChild(list);
      }
      renderBar();
    }

    // ── 아래쪽: 맨 위로, + N 운동 추가, 선택 초기화 ──
    const topBtn = h('button', { class: 'fab fab-top', type: 'button', text: '↑', attrs: { 'aria-label': '맨 위로' }, onClick: () => body.scrollTo({ top: 0, behavior: 'smooth' }) });
    const addBtn = h('button', { class: 'btn btn-light btn-lg picker-add', type: 'button', onClick: () => finish(selected) });
    const resetBtn = h('button', { class: 'fab fab-reset', type: 'button', text: '↺', attrs: { 'aria-label': '선택 초기화' }, onClick: () => { selected = []; renderList(); } });
    const bar = h('div', { class: 'picker-bar' }, topBtn, addBtn, resetBtn);
    function renderBar(): void {
      const n = selected.length;
      addBtn.hidden = n === 0;
      resetBtn.hidden = n === 0;
      addBtn.textContent = single ? '이 운동으로 변경' : `+ ${n} 운동 추가`;
      topBtn.hidden = body.scrollTop < 300;
    }
    body.addEventListener('scroll', () => (topBtn.hidden = body.scrollTop < 300));

    // ── 더보기 메뉴 ──
    async function menu(item: CatalogItem): Promise<void> {
      const ex = item.exercise;
      const c = await choose(ex.name, '이 종목을 어떻게 할까요?', [
        { value: 'cancel', label: '취소' },
        { value: 'guide', label: '가이드' },
        { value: 'history', label: '이력' },
        { value: 'rename', label: '이름 수정' },
        { value: 'delete', label: '삭제', danger: true },
      ]);
      if (c === 'guide') await openGuideSheet(ctx, ex.id, ex.name);
      if (c === 'history') {
        finish([]);
        location.hash = `#/exercise/${ex.id}`;
      }
      if (c === 'rename') {
        const input = h('input', { class: 'input', type: 'text', value: ex.name, attrs: { maxlength: '120', autocomplete: 'off' } });
        await formDialog('이름 수정', [field('새 이름', input, `${titleId}-rename`)], '이름 저장', async () => {
          try {
            item.exercise = await renameExercise(ctx, ex.id, input.value);
            renderList();
            return null;
          } catch (e) {
            return e instanceof ValidationError ? e.message : '저장하지 못했어요';
          }
        });
      }
      if (c === 'delete') {
        await deleteExercise(ctx, ex.id);
        selected = selected.filter((id) => id !== ex.id);
        item.exercise = { ...ex, deleted: true };
        renderList();
        showToast(`${ex.name} 종목을 삭제했어요`, {
          actionLabel: '되돌리기',
          onAction: () =>
            void restoreExercise(ctx, ex.id).then(() => {
              item.exercise = { ...ex, deleted: false };
              renderList();
            }),
        });
      }
    }

    // ── 커스텀 운동 추가 ──
    async function addCustom(): Promise<void> {
      const name = h('input', { class: 'input', type: 'text', attrs: { maxlength: '120', autocomplete: 'off' } });
      const part = h('select', { class: 'input' }, ...BODY_PARTS.map((p) => h('option', { value: p, text: BODY_PART_LABEL[p] })));
      const eq = h('select', { class: 'input' }, ...EQUIPMENT.map((e) => h('option', { value: e, text: EQUIPMENT_LABEL[e], selected: e === 'other' })));
      await formDialog('커스텀 운동 추가', [field('종목 이름', name, `${titleId}-name`), field('부위', part, `${titleId}-part`), field('장비', eq, `${titleId}-eq`)], '만들기', async () => {
        try {
          const ex = await createExercise(ctx, { name: name.value, bodyPart: part.value as BodyPart, equipment: eq.value as Equipment });
          items = await loadCatalog(ctx.db);
          selected = single ? [ex.id] : [...selected, ex.id];
          category = 'all';
          query = '';
          search.value = '';
          renderList();
          return null;
        } catch (e) {
          return e instanceof ValidationError ? e.message : '만들지 못했어요';
        }
      });
    }

    body.append(
      filters,
      h('button', { class: 'btn btn-ghost picker-custom', type: 'button', text: '⊕ 커스텀 운동 추가', onClick: () => void addCustom() }),
      listHost,
    );
    dialog.append(h('h2', { class: 'visually-hidden', text: single ? '변경할 종목 선택' : '종목 선택', attrs: { id: titleId } }), head, body, bar);
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      finish([]);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    listHost.appendChild(h('p', { class: 'hint', text: '불러오는 중…' }));
    renderBar();
    void loadCatalog(ctx.db).then((loaded) => {
      items = loaded;
      renderList();
    });
  });
}
