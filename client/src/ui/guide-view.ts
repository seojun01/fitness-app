// 가이드 본문 (기능 2): 자세 요점·흔한 실수·주요 자극 근육·안전 안내. 대화상자와 전체 화면이 함께 쓴다.
import { isBuiltinExerciseId } from '../../../shared/model.ts';
import { muscleNames, type MuscleId } from '../../../shared/muscles.ts';
import type { Ctx } from '../context.ts';
import { resolveGuide } from '../guides.ts';
import { clear, h } from './dom.ts';
import { emptyState, errorState, loadingState } from './states.ts';

export interface GuideViewOptions {
  /** 편집 화면으로 가기 전에 부른다 (대화상자를 닫는 등) */
  beforeNavigate?(): void;
}

function muscles(primary: MuscleId[], secondary: MuscleId[]): HTMLElement {
  return h(
    'section',
    { class: 'guide-section' },
    h('h3', { class: 'section-title', text: '주요 자극 근육' }),
    h('p', { class: 'guide-muscles' }, h('strong', { text: '주동근: ' }), primary.length ? muscleNames(primary) : '없음'),
    secondary.length ? h('p', { class: 'guide-muscles' }, h('strong', { text: '보조근: ' }), muscleNames(secondary)) : null,
  );
}

const list = (title: string, items: string[], ordered: boolean) =>
  items.length === 0
    ? null
    : h('section', { class: 'guide-section' }, h('h3', { class: 'section-title', text: title }), h(ordered ? 'ol' : 'ul', { class: 'guide-list' }, ...items.map((t) => h('li', { text: t }))));

export function guideView(ctx: Ctx, exerciseId: string, opts: GuideViewOptions = {}): HTMLElement {
  const host = h('div', { class: 'guide' });
  host.appendChild(loadingState('가이드를 불러오는 중…'));
  const goEdit = () => {
    opts.beforeNavigate?.();
    location.hash = `#/guides/${exerciseId}/edit`;
  };

  async function render(): Promise<void> {
    try {
      const g = await resolveGuide(ctx.db, exerciseId);
      clear(host);
      const custom = !isBuiltinExerciseId(exerciseId) && !!g.exercise && !g.exercise.deleted;
      if (g.kind === 'none') {
        host.appendChild(
          emptyState({ title: '아직 가이드가 없어요', hint: custom ? '자세 요점이나 주의할 점을 직접 적어 둘 수 있어요.' : undefined, action: custom ? { label: '가이드 작성', onClick: goEdit } : undefined }),
        );
        return;
      }
      const data = g.kind === 'builtin' ? g.guide : g.note;
      host.append(
        ...[list('자세 요점', data.cues, true), list('흔한 실수', data.mistakes, false), muscles(data.primaryMuscles, data.secondaryMuscles)].filter((x): x is HTMLElement => !!x),
        h('p', { class: 'hint guide-safety', text: '통증이 있으면 멈추고 전문가와 상의하세요.' }),
      );
      if (g.kind === 'note') host.appendChild(h('button', { class: 'btn btn-block', type: 'button', text: '가이드 수정', onClick: goEdit }));
    } catch (err) {
      clear(host);
      host.appendChild(errorState(err instanceof Error ? err.message : '가이드를 불러오지 못했어요', () => void render()));
    }
  }
  void render();
  return host;
}
