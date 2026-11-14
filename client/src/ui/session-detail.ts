// 세션 상세 화면 (US4): 종목별 세트 확인·수정·삭제, 세션 삭제와 되돌리기
import { WEIGHT_KG_MAX } from '../../../shared/model.ts';
import { formatWeight, parseWeightInput, toKg } from '../../../shared/units.ts';
import { summarize } from '../../../shared/volume.ts';
import type { Screen } from '../app.ts';
import type { Ctx } from '../context.ts';
import { ValidationError, messageForField } from '../errors.ts';
import { formatDate, formatDuration, formatTime } from '../format.ts';
import { deleteSession, removeCompletedSet, restoreSession, updateCompletedSet } from '../history.ts';
import { getWeightUnit } from '../settings.ts';
import type { StoredSession } from '../store/db.ts';
import { getSession } from '../store/records.ts';
import { clear, h } from './dom.ts';
import { emptyState } from './states.ts';
import { showToast } from './toast.ts';

export function sessionDetailScreen(ctx: Ctx, id: string): Screen {
  return {
    title: '기록 상세',
    tab: 'history',
    async mount(container) {
      let session: StoredSession | undefined = await getSession(ctx.db, id);
      if (!session || session.deleted || session.status !== 'completed') {
        container.appendChild(emptyState({ title: '기록을 찾을 수 없어요', action: { label: '기록 목록으로', onClick: () => (location.hash = '#/history') } }));
        return;
      }
      const unit = await getWeightUnit(ctx.db);
      const errors = new Map<string, string>();
      const errorsHost = h('div');
      const renderErrors = () => {
        clear(errorsHost);
        for (const m of new Set(errors.values())) errorsHost.appendChild(h('p', { class: 'field-error', text: m, attrs: { role: 'alert' } }));
      };
      const setError = (k: string, m: string | null) => {
        if (m) errors.set(k, m);
        else errors.delete(k);
        renderErrors();
      };
      const headHost = h('div', { class: 'card' });
      const entriesHost = h('div');

      function renderHead(): void {
        const s = session!;
        const sum = summarize(s);
        clear(headHost);
        headHost.append(
          h('p', { class: 'state-title', text: `${formatDate(s.endedAt!)} ${formatTime(s.startedAt)}~${formatTime(s.endedAt!)}` }),
          h('p', { class: 'hint', text: `${s.routineName ?? '빈 세션'} · 총 볼륨 ${formatWeight(sum.totalVolumeKg, unit)} ${unit} · ${sum.completedSets}세트 · ${formatDuration(sum.durationSec)}` }),
        );
      }

      function renderEntries(): void {
        clear(entriesHost);
        for (const e of session!.entries) {
          const card = h('section', { class: 'card entry' }, h('div', { class: 'entry-head' }, h('h2', { class: 'entry-title', text: e.exerciseName }), h('a', { class: 'btn btn-ghost', attrs: { href: `#/exercise/${e.exerciseId}`, 'aria-label': `${e.exerciseName} 이력` }, text: '이력' })));
          card.appendChild(h('div', { class: 'set-head', attrs: { 'aria-hidden': 'true' } }, h('span', { text: '세트' }), h('span', { text: `무게(${unit})` }), h('span', { text: '횟수' }), h('span', { text: '' }), h('span', { text: '' })));
          e.sets.forEach((set, i) => {
            const base = `${e.exerciseName} ${i + 1}세트`;
            const wKey = `${set.setId}:w`;
            const rKey = `${set.setId}:r`;
            const w = h('input', { class: 'input', type: 'text', value: formatWeight(set.weightKg ?? 0, unit), attrs: { inputmode: 'decimal', 'aria-label': `${base} 무게`, autocomplete: 'off' } });
            const r = h('input', { class: 'input', type: 'text', value: String(set.reps ?? ''), attrs: { inputmode: 'numeric', 'aria-label': `${base} 횟수`, autocomplete: 'off' } });
            const save = async (patch: { weightKg?: number; reps?: number }, key: string) => {
              try {
                session = await updateCompletedSet(ctx, id, e.entryId, set.setId, patch);
                setError(key, null);
                renderHead();
              } catch (err) {
                setError(key, err instanceof ValidationError ? err.message : '저장하지 못했어요');
              }
            };
            // 입력을 마칠 때(change) 저장한다. 잘못된 값은 저장하지 않고 안내만 한다
            w.addEventListener('change', () => {
              const parsed = parseWeightInput(w.value);
              const kg = parsed === null ? null : toKg(parsed, unit);
              if (kg === null || kg > WEIGHT_KG_MAX) return setError(wKey, messageForField('weightKg'));
              void save({ weightKg: kg }, wKey);
            });
            r.addEventListener('change', () => {
              const text = r.value.trim();
              const n = /^\d+$/.test(text) ? Number(text) : NaN;
              if (!Number.isInteger(n) || n < 1 || n > 999) return setError(rKey, messageForField('reps'));
              void save({ reps: n }, rKey);
            });
            card.appendChild(
              h(
                'div',
                { class: 'set-row' },
                h('span', { class: 'set-no', text: String(i + 1) }),
                w,
                r,
                h('span'),
                h('button', {
                  class: 'btn btn-ghost',
                  type: 'button',
                  text: '✕',
                  attrs: { 'aria-label': `${base} 삭제` },
                  onClick: async () => {
                    session = await removeCompletedSet(ctx, id, e.entryId, set.setId);
                    renderHead();
                    renderEntries();
                  },
                }),
              ),
            );
          });
          entriesHost.appendChild(card);
        }
      }

      renderHead();
      renderEntries();
      container.append(
        headHost,
        errorsHost,
        entriesHost,
        h('button', {
          class: 'btn btn-danger btn-block',
          type: 'button',
          text: '세션 삭제',
          onClick: async () => {
            await deleteSession(ctx, id);
            location.hash = '#/history';
            showToast('세션을 삭제했어요', { actionLabel: '되돌리기', onAction: () => void restoreSession(ctx, id).then(() => window.dispatchEvent(new HashChangeEvent('hashchange'))) });
          },
        }),
      );
    },
  };
}
