// 진행 화면 (기능 3 US1~US4): 한 종목씩, 진행 점, 지난번 대비, 메모, 기록, 세트 조작, 휴식 타이머
import type { Session, SessionEntry, SetEntry, WeightUnit } from '../../../shared/model.ts';
import { MEMO_MAX, WEIGHT_KG_MAX, cpLength } from '../../../shared/model.ts';
import { compare, entryTotals, exerciseRecords, previousTotals } from '../../../shared/stats.ts';
import { formatWeight, parseWeightInput, toKg } from '../../../shared/units.ts';
import { durationSec } from '../../../shared/volume.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError, messageForField } from '../errors.ts';
import { setExerciseMemo } from '../exercises.ts';
import { formatClock, formatDate } from '../format.ts';
import {
  addEntry, addSet, completeAllSets, finishSession, getActiveSession, removeEntry, removeLastSet, removeSet, replaceEntryExercise, updateSet, type SetPatch,
} from '../sessions.ts';
import { getRestSeconds, getWeightUnit, setRestSeconds } from '../settings.ts';
import type { StoredExercise, StoredSession } from '../store/db.ts';
import { listAllExercises, listAllSessions } from '../store/records.ts';
import { choose } from './dialog.ts';
import { clear, h } from './dom.ts';
import { pickExercises } from './exercise-picker.ts';
import { createRestTimerBar, type RestTimerBar } from './rest-timer-bar.ts';
import { emptyState } from './states.ts';
import { openGuideSheet } from './guide-sheet.ts';
import { openExerciseChartDialog } from './exercise-chart.ts';

const INDEX_KEY = 'fitness.sessionIndex';

function readLastIndex(sessionId: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX_KEY) ?? 'null') as { sessionId: string; index: number } | null;
    return v && v.sessionId === sessionId && Number.isInteger(v.index) ? v.index : 0;
  } catch {
    return 0;
  }
}
function saveLastIndex(sessionId: string, index: number): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify({ sessionId, index }));
  } catch {
    /* 기기 편의 상태: 실패해도 된다 */
  }
}

export function sessionScreen(ctx: Ctx, params: Record<string, string>): Screen {
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let bar: RestTimerBar | undefined;
  let flushMemo: (() => Promise<void>) | undefined;
  let goTo: ((index: number) => void) | undefined;

  return {
    title: '운동 중',
    tab: 'routines',
    focus: true,
    back: '#/routines',
    onRoute(p) {
      if (!goTo) return false;
      goTo(p.index === undefined ? 0 : Number(p.index));
      return true;
    },
    unmount() {
      if (clockTimer) clearInterval(clockTimer);
      bar?.destroy();
      void flushMemo?.();
    },
    async mount(container) {
      let session: StoredSession | undefined = await getActiveSession(ctx);
      if (!session) {
        location.hash = '#/routines';
        return;
      }
      const sessionId = session.id;
      const [unit, exList, allSessions, restBase] = await Promise.all([getWeightUnit(ctx.db), listAllExercises(ctx.db), listAllSessions(ctx.db), getRestSeconds(ctx.db)]);
      const exercises = new Map<string, StoredExercise>(exList.map((e) => [e.id, e]));
      const history: Session[] = allSessions;
      let index = params.index === undefined ? readLastIndex(sessionId) : Number(params.index);

      // 저장은 한 줄로 순서대로 처리한다 (연속 입력이 서로 덮어쓰지 않게)
      let chain: Promise<unknown> = Promise.resolve();
      const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
        const next = chain.then(fn, fn);
        chain = next.catch(() => undefined);
        return next;
      };

      // ── 오류 안내 ──
      const errors = new Map<string, string>();
      const errorsHost = h('div', { class: 'errors' });
      const renderErrors = () => {
        clear(errorsHost);
        for (const msg of new Set(errors.values())) errorsHost.appendChild(h('p', { class: 'field-error', text: msg, attrs: { role: 'alert' } }));
      };
      const setError = (key: string, msg: string | null) => {
        if (msg) errors.set(key, msg);
        else errors.delete(key);
        renderErrors();
      };
      const reportFailure = (key: string, e: unknown) => setError(key, e instanceof ValidationError ? e.message : '저장하지 못했어요. 다시 시도해 주세요');

      // ── 상단: 경과 시간, 진행 점, 종목 추가, 종료 ──
      const clock = h('span', { class: 'timer session-clock', attrs: { 'aria-label': '경과 시간' } });
      const tick = () => {
        if (session) clock.textContent = formatClock(durationSec(session, ctx.now().getTime()));
      };
      const dots = h('nav', { class: 'progress-dots', attrs: { 'aria-label': '종목 진행' } });
      // 한 줄 상단 바: 뒤로 · 경과 시간 · 진행 점 · 종목 추가 · 종료 (앱 상단 바는 이 화면에서 숨긴다)
      const head = h(
        'div',
        { class: 'session-head' },
        h('h1', { class: 'visually-hidden', text: '운동 중' }),
        h('a', { class: 'session-back', text: '‹', attrs: { href: '#/routines', 'aria-label': '뒤로' } }),
        clock,
        dots,
        h('button', { class: 'btn btn-ghost icon-btn', type: 'button', text: '+', attrs: { 'aria-label': '종목 추가' }, onClick: () => void addExercise() }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: '종료', attrs: { 'aria-label': '세션 종료' }, onClick: () => void finish() }),
      );
      const entryHost = h('div', { class: 'entry-page' });

      const hasDone = (e: SessionEntry) => e.sets.some((x) => x.done);
      function renderDots(): void {
        clear(dots);
        session!.entries.forEach((e, i) => {
          dots.appendChild(
            h('button', {
              class: 'dot',
              type: 'button',
              attrs: {
                'aria-label': `${i + 1}번째 종목: ${e.exerciseName}${hasDone(e) ? ' (완료한 세트 있음)' : ''}`,
                'aria-current': i === index ? 'step' : undefined,
                'data-done': String(hasDone(e)),
              },
              onClick: () => (location.hash = `#/session/${i}`),
            }),
          );
        });
        // 종목이 많으면 진행 점은 한 줄에서 가로로 넘긴다: 지금 종목이 보이게 맞춘다
        const cur = dots.querySelector<HTMLElement>('[aria-current]');
        if (cur) {
          const box = dots.getBoundingClientRect();
          const c = cur.getBoundingClientRect();
          dots.scrollLeft += c.left + c.width / 2 - (box.left + box.width / 2);
        }
      }

      // ── 휴식 타이머 ──
      bar = createRestTimerBar({ baseSeconds: restBase, onBaseChange: (s) => void setRestSeconds(ctx, s) });

      // ── 한 종목 화면 ──
      function renderEntry(): void {
        void flushMemo?.();
        flushMemo = undefined;
        clear(entryHost);
        errors.clear();
        renderErrors();
        const entries = session!.entries;
        if (entries.length === 0) {
          entryHost.appendChild(emptyState({ title: '종목을 추가해 시작하세요', action: { label: '첫 종목 추가', onClick: () => void addExercise() } }));
          renderDots();
          return;
        }
        index = Math.min(Math.max(0, Number.isFinite(index) ? index : 0), entries.length - 1);
        saveLastIndex(sessionId, index);
        renderDots();
        const entry = entries[index]!;
        const ex = exercises.get(entry.exerciseId);
        const bodyweight = ex?.bodyweight ?? false;
        const name = entry.exerciseName;

        // 지난번 대비
        const prev = previousTotals(entry.exerciseId, history, sessionId);
        const compareLine = h('p', { class: 'compare' });
        const renderCompare = () => {
          const cur = session!.entries.find((e) => e.entryId === entry.entryId);
          if (!cur) return;
          const c = compare(entryTotals(cur), prev, bodyweight);
          clear(compareLine);
          const val = (n: number) => (c.metric === 'volume' ? `${formatWeight(n, unit)}${unit}` : `${n}회`);
          const label = c.metric === 'volume' ? '볼륨' : '횟수';
          const visual = h('span', { attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'compare-label', text: `${label} ` }), h('strong', { text: val(c.current) }));
          let spoken = `이번 ${label} ${val(c.current)}`;
          if (c.direction === 'first') {
            visual.append(h('span', { class: 'compare-diff first', text: '  첫 기록이에요' }));
            spoken += ', 첫 기록이에요';
          } else if (c.direction === 'same') {
            visual.append(h('span', { class: 'compare-diff same', text: '  지난번과 같아요' }));
            spoken += ', 지난번과 같아요';
          } else {
            visual.append(h('span', { class: `compare-diff ${c.direction}`, text: `  ${c.direction === 'down' ? '▼' : '▲'}${val(c.diff)}` }));
            spoken += c.direction === 'down' ? `, 지난번까지 ${val(c.diff)} 남음` : `, 지난번보다 ${val(c.diff)} 많음`;
          }
          compareLine.append(visual, h('span', { class: 'visually-hidden', text: spoken }));
        };
        renderCompare();

        // 메모
        const memo = h('textarea', { class: 'input memo-input', value: ex?.memo ?? '', attrs: { id: 'entry-memo', rows: 3, maxlength: '1000' } });
        const memoCount = h('span', { class: 'hint' });
        const memoErr = h('p', { class: 'field-error', attrs: { role: 'alert' } });
        let memoTimer: ReturnType<typeof setTimeout> | undefined;
        let memoDirty = false;
        const saveMemo = async () => {
          if (!memoDirty || !ex) return;
          memoDirty = false;
          if (memoTimer) clearTimeout(memoTimer);
          if (cpLength(memo.value) > MEMO_MAX) return;
          try {
            const saved = await setExerciseMemo(ctx, ex.id, memo.value);
            exercises.set(ex.id, saved);
          } catch (e) {
            memoErr.textContent = e instanceof ValidationError ? e.message : '메모를 저장하지 못했어요';
          }
        };
        flushMemo = saveMemo;
        const updateCount = () => {
          const n = cpLength(memo.value);
          memoCount.textContent = `${n}/${MEMO_MAX}`;
          memoErr.textContent = n > MEMO_MAX ? messageForField('memo') : '';
          memo.setAttribute('aria-invalid', String(n > MEMO_MAX));
        };
        updateCount();
        memo.addEventListener('input', () => {
          updateCount();
          memoDirty = true;
          if (memoTimer) clearTimeout(memoTimer);
          memoTimer = setTimeout(() => void saveMemo(), 400);
        });
        memo.addEventListener('blur', () => void saveMemo());

        // 기록
        const rec = exerciseRecords(entry.exerciseId, history);
        const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('span', { class: 'stat-value', text: value }), h('span', { class: 'stat-label', text: label }));
        const w = (kg: number) => `${formatWeight(kg, unit)}${unit}`;
        const recordsBody =
          rec.recent.length === 0
            ? h('p', { class: 'hint', text: '아직 기록이 없어요' })
            : h(
                'div',
                {},
                h(
                  'div',
                  { class: 'stat-grid' },
                  ...(bodyweight || rec.maxWeightKg === 0
                    ? [stat(`${rec.maxReps}회`, '최다 횟수'), stat(`${rec.totalReps}회`, '누적 횟수'), stat(w(rec.totalVolumeKg), '누적 볼륨')]
                    : [stat(w(rec.best1rmKg), '추정 1RM'), stat(w(rec.maxWeightKg), '최고 무게'), stat(w(rec.totalVolumeKg), '누적 볼륨')]),
                ),
                bodyweight || rec.maxWeightKg === 0 ? null : h('p', { class: 'hint', text: '추정 1RM은 엡리 공식으로 계산한 참고값이에요.' }),
                h('h3', { class: 'section-title', text: '최근 기록' }),
                h(
                  'div',
                  { class: 'recent-grid' },
                  ...rec.recent.map((r) =>
                    h(
                      'div',
                      { class: 'recent' },
                      h('p', { class: 'recent-date', text: formatDate(r.endedAt) }),
                      h('ol', { class: 'recent-sets' }, ...r.sets.map((s) => h('li', { text: `${w(s.weightKg)} × ${s.reps}회` }))),
                    ),
                  ),
                ),
              );

        // 세트 표
        const rows = h('div', { class: 'set-rows' });
        const patchSet = (set: SetEntry, patch: SetPatch, key: string) =>
          enqueue(async () => {
            try {
              session = await updateSet(ctx, sessionId, entry.entryId, set.setId, patch);
              setError(key, null);
              renderCompare();
              renderDots();
              return true;
            } catch (e) {
              reportFailure(key, e);
              return false;
            }
          });
        const curEntry = () => session!.entries.find((e) => e.entryId === entry.entryId)!;

        function setRow(set: SetEntry, i: number): HTMLElement {
          const n = i + 1;
          const base = `${name} ${n}세트`;
          const row = h('div', { class: 'set-row', attrs: { 'data-done': String(set.done) } });
          const wKey = `${set.setId}:w`;
          const rKey = `${set.setId}:r`;
          const weightInput = h('input', {
            class: 'input',
            type: 'text',
            value: set.weightKg === null ? '' : formatWeight(set.weightKg, unit),
            attrs: { inputmode: 'decimal', 'aria-label': `${base} 무게`, autocomplete: 'off' },
            onInput: () => {
              const text = weightInput.value;
              if (text.trim() === '') return void patchSet(set, { weightKg: null, done: false }, wKey).then(() => syncRow());
              const parsed = parseWeightInput(text);
              const kg = parsed === null ? null : toKg(parsed, unit);
              if (kg === null || kg > WEIGHT_KG_MAX) return setError(wKey, messageForField('weightKg'));
              void patchSet(set, { weightKg: kg }, wKey);
            },
          });
          const repsInput = h('input', {
            class: 'input',
            type: 'text',
            value: set.reps === null ? '' : String(set.reps),
            attrs: { inputmode: 'numeric', 'aria-label': `${base} 횟수`, autocomplete: 'off' },
            onInput: () => {
              const text = repsInput.value.trim();
              if (text === '') return void patchSet(set, { reps: null, done: false }, rKey).then(() => syncRow());
              const v = /^\d+$/.test(text) ? Number(text) : NaN;
              if (!Number.isInteger(v) || v < 1 || v > 999) return setError(rKey, messageForField('reps'));
              void patchSet(set, { reps: v }, rKey);
            },
          });
          const checkBtn = h('button', {
            class: 'check',
            type: 'button',
            text: '✓',
            attrs: { 'aria-label': `${base} 완료`, 'aria-pressed': String(set.done) },
            onClick: () =>
              void enqueue(async () => {
                const cur = curEntry().sets.find((x) => x.setId === set.setId);
                if (!cur) return;
                const next = !cur.done;
                const patch: SetPatch = { done: next };
                if (next && cur.weightKg === null && bodyweight) patch.weightKg = 0; // 맨몸 운동은 무게 비워도 0
                try {
                  session = await updateSet(ctx, sessionId, entry.entryId, set.setId, patch);
                  setError(`${set.setId}:c`, null);
                  syncRow();
                  renderCompare();
                  renderDots();
                  if (next) bar?.timer.start(); // 세트를 완료하면 휴식 시작 (FR-007)
                } catch (e) {
                  reportFailure(`${set.setId}:c`, e);
                }
              }),
          });
          function syncRow(): void {
            const saved = curEntry().sets.find((x) => x.setId === set.setId);
            if (!saved) return;
            checkBtn.setAttribute('aria-pressed', String(saved.done));
            row.setAttribute('data-done', String(saved.done));
            if (saved.weightKg !== null && weightInput.value.trim() === '') weightInput.value = formatWeight(saved.weightKg, unit);
          }
          const more = h('button', {
            class: 'btn btn-ghost',
            type: 'button',
            text: '⋯',
            attrs: { 'aria-label': `${base} 더보기` },
            onClick: async () => {
              const c = await choose(`${n}세트`, `${name} ${n}세트`, [
                { value: 'cancel', label: '취소' },
                { value: 'delete', label: '이 세트 삭제', danger: true },
              ]);
              if (c !== 'delete') return;
              await enqueue(async () => {
                session = await removeSet(ctx, sessionId, entry.entryId, set.setId);
                renderSets();
                renderCompare();
                renderDots();
              });
            },
          });
          row.append(h('span', { class: 'set-no', text: String(n) }), weightInput, repsInput, checkBtn, more);
          return row;
        }

        const removeLastBtn = h('button', {
          class: 'btn btn-ghost text-warn',
          type: 'button',
          text: '− 세트 삭제',
          attrs: { 'aria-label': `${name} 세트 삭제` },
          onClick: () =>
            void enqueue(async () => {
              session = await removeLastSet(ctx, sessionId, entry.entryId);
              renderSets();
              renderCompare();
              renderDots();
            }),
        });
        function renderSets(): void {
          clear(rows);
          curEntry().sets.forEach((s, i) => rows.appendChild(setRow(s, i)));
          removeLastBtn.disabled = curEntry().sets.length === 0;
        }
        renderSets();

        const isLast = index === entries.length - 1;
        entryHost.append(
          h(
            'div',
            { class: 'entry-head' },
            h(
              'div',
              { class: 'entry-name' },
              h('h2', { class: 'entry-title entry-title-lg', text: name }),
              h('button', { class: 'info-btn', type: 'button', text: 'i', attrs: { 'aria-label': `${name} 가이드` }, onClick: () => void openGuideSheet(ctx, entry.exerciseId, name) }),
            ),
            h('button', {
              class: 'btn btn-ghost',
              type: 'button',
              text: '⋯',
              attrs: { 'aria-label': `${name} 더보기` },
              onClick: async () => {
                const c = await choose(name, '이 종목을 어떻게 할까요?', [
                  { value: 'cancel', label: '취소' },
                  { value: 'replace', label: '다른 운동으로 변경' },
                  { value: 'delete', label: '이 종목 삭제', danger: true },
                ]);
                if (c === 'replace') {
                  await replaceExercise(entry);
                  return;
                }
                if (c !== 'delete') return;
                await enqueue(async () => {
                  session = await removeEntry(ctx, sessionId, entry.entryId);
                  goTo?.(Math.max(0, index - 1));
                });
              },
            }),
          ),
          compareLine,
          h('details', { class: 'fold' }, h('summary', { text: '메모' }), h('label', { class: 'visually-hidden', text: `${name} 메모`, attrs: { for: 'entry-memo' } }), memo, memoCount, memoErr),
          h(
            'details',
            { class: 'fold' },
            h('summary', { text: '기록' }),
            recordsBody,
            // 그 종목 성장 차트: 대화상자라 진행 중 입력값·휴식 타이머가 그대로다 (기능 004 FR-011)
            h('button', { class: 'btn btn-block chart-open', type: 'button', text: '차트 보기', attrs: { 'aria-label': `${name} 차트 보기` }, onClick: () => void openExerciseChartDialog(ctx, entry.exerciseId) }),
          ),
          errorsHost,
          h('div', { class: 'set-head', attrs: { 'aria-hidden': 'true' } }, h('span', { text: '세트' }), h('span', { text: `무게(${unit})` }), h('span', { text: '회' }), h('span', { text: '완료' }), h('span', { text: '' })),
          rows,
          h(
            'div',
            { class: 'btn-row' },
            h('button', {
              class: 'btn btn-ghost text-accent',
              type: 'button',
              text: '+ 세트 추가',
              attrs: { 'aria-label': `${name} 세트 추가` },
              onClick: () =>
                void enqueue(async () => {
                  try {
                    session = await addSet(ctx, sessionId, entry.entryId);
                    renderSets();
                  } catch (e) {
                    reportFailure(`${entry.entryId}:add`, e);
                  }
                }),
            }),
            removeLastBtn,
          ),
          h(
            'div',
            { class: 'btn-row' },
            h('button', {
              class: 'btn btn-ghost text-ok',
              type: 'button',
              text: '✓ 모든 세트 완료',
              onClick: () =>
                void enqueue(async () => {
                  const out = await completeAllSets(ctx, sessionId, entry.entryId);
                  session = out.session;
                  renderSets();
                  renderCompare();
                  renderDots();
                  if (out.completed > 0) bar?.timer.start();
                  setError('all', out.skippedEmpty > 0 ? `값이 비어 있는 세트 ${out.skippedEmpty}개는 완료하지 않았어요` : null);
                }),
            }),
            h('button', {
              class: 'btn btn-primary',
              type: 'button',
              text: isLast ? '운동 완료' : '다음 운동 →',
              onClick: () => (isLast ? void finish() : (location.hash = `#/session/${index + 1}`)),
            }),
          ),
        );
      }

      goTo = (i: number) => {
        index = i;
        renderEntry();
        window.scrollTo(0, 0);
      };

      /** 이 자리의 종목을 다른 종목으로 바꾼다. 완료한 세트가 있으면 먼저 확인한다 */
      async function replaceExercise(shown: SessionEntry): Promise<void> {
        await chain; // 진행 중인 저장(세트 완료 등)이 끝난 뒤의 최신 상태로 판단한다
        const entry = session!.entries.find((e) => e.entryId === shown.entryId);
        if (!entry) return;
        const done = entry.sets.filter((x) => x.done).length;
        if (done > 0) {
          const c = await choose('다른 운동으로 변경할까요?', `${entry.exerciseName}에서 완료한 ${done}세트 기록이 지워지고, 새 운동의 지난 기록으로 다시 채워져요.`, [
            { value: 'cancel', label: '취소' },
            { value: 'ok', label: '변경', primary: true },
          ]);
          if (c !== 'ok') return;
        }
        const [picked] = await pickExercises(ctx, { single: { exclude: entry.exerciseId } });
        if (!picked) return;
        await enqueue(async () => {
          try {
            session = await replaceEntryExercise(ctx, sessionId, entry.entryId, picked);
            for (const e of await listAllExercises(ctx.db)) exercises.set(e.id, e);
            renderEntry();
            renderDots();
            setError('replace', null);
          } catch (e) {
            reportFailure('replace', e);
          }
        });
      }

      // 좌우로 밀어 이전·다음 운동 (터치). 입력 칸·차트에서 시작한 동작과 세로 스크롤은 무시한다
      let swipe: { x: number; y: number; id: number } | null = null;
      entryHost.addEventListener('pointerdown', (e) => {
        const ev = e as PointerEvent;
        if (ev.pointerType !== 'touch' || (ev.target as Element).closest('input, textarea, select, .chart, details[open] .recent-grid')) return;
        swipe = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      });
      entryHost.addEventListener('pointercancel', () => (swipe = null));
      entryHost.addEventListener('pointerup', (e) => {
        const ev = e as PointerEvent;
        const start = swipe;
        swipe = null;
        if (!start || start.id !== ev.pointerId) return;
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        const next = dx < 0 ? index + 1 : index - 1;
        if (next < 0 || next >= session!.entries.length) return;
        entryHost.setAttribute('data-slide', dx < 0 ? 'next' : 'prev');
        location.hash = `#/session/${next}`;
      });
      entryHost.addEventListener('animationend', () => entryHost.removeAttribute('data-slide'));

      async function addExercise(): Promise<void> {
        const picked = await pickExercises(ctx);
        if (picked.length === 0) return;
        await enqueue(async () => {
          const first = session!.entries.length; // 추가된 첫 종목의 번호
          let skipped = 0;
          for (const id of picked) {
            try {
              session = await addEntry(ctx, sessionId, id);
            } catch (e) {
              if (e instanceof ValidationError) skipped++;
              else reportFailure('add-entry', e);
            }
          }
          for (const e of await listAllExercises(ctx.db)) exercises.set(e.id, e);
          setError('add-entry', skipped > 0 ? `종목은 최대 50개까지라 ${skipped}개는 넣지 못했어요` : null);
          if (session!.entries.length > first) {
            location.hash = `#/session/${first}`;
            if (index === first) renderEntry();
          }
        });
      }

      async function finish(): Promise<void> {
        await chain; // 진행 중인 저장이 끝난 뒤
        await flushMemo?.();
        const out = await finishSession(ctx, sessionId, { ifEmpty: 'ask' });
        if (out.outcome === 'completed') {
          bar?.timer.stop();
          location.hash = `#/session/summary/${sessionId}`;
          return;
        }
        const c = await choose('완료한 세트가 없어요', '이 세션을 기록으로 저장할까요?', [
          { value: 'keep', label: '계속 기록' },
          { value: 'discard', label: '폐기', danger: true },
          { value: 'save', label: '저장', primary: true },
        ]);
        if (c === 'discard') {
          await finishSession(ctx, sessionId, { ifEmpty: 'discard' });
          bar?.timer.stop();
          location.hash = '#/routines';
        } else if (c === 'save') {
          await finishSession(ctx, sessionId, { ifEmpty: 'save' });
          bar?.timer.stop();
          location.hash = `#/session/summary/${sessionId}`;
        }
      }

      container.append(head, entryHost, bar.el);
      renderEntry();
      tick();
      clockTimer = setInterval(tick, 1000);
    },
  };
}
