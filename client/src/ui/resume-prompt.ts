// 오래 방치된 진행 중 세션: 앱을 열 때 "이어하기 / 종료 / 폐기"를 묻는다 (US3, research R10)
import type { Ctx } from '../context.ts';
import { resolveStale, restoreState } from '../sessions.ts';
import { choose } from './dialog.ts';

export async function promptIfStale(ctx: Ctx): Promise<void> {
  const { active, stale } = await restoreState(ctx);
  if (!active || !stale) return;
  const choice = await choose('오래전에 시작한 세션이 있어요', `${active.routineName ?? '빈 세션'} 세션이 12시간 넘게 진행 중이에요. 어떻게 할까요?`, [
    { value: 'discard', label: '폐기', danger: true },
    { value: 'finish', label: '종료하고 저장' },
    { value: 'continue', label: '이어서 기록', primary: true },
  ]);
  if (choice === 'cancel') return;
  await resolveStale(ctx, active.id, choice as 'continue' | 'finish' | 'discard');
  location.hash = choice === 'continue' ? '#/session' : '#/routines';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
