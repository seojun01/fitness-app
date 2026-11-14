// 휴식 종료 예약 (기능 006, FR-001): 타이머가 진행 중이면 끝나는 시각을 홈서버에 예약하고, 아니면 예약을 지운다.
// 서버가 그 시각에 푸시를 보내므로 화면이 꺼져 있거나 앱이 백그라운드여도 알림이 온다.
// 홈서버에 등록하지 않은 기기는 아무것도 보내지 않고, 네트워크 오류는 조용히 넘긴다 (앱 안 알림은 그대로 동작한다).
import type { TimerView } from './rest-timer.ts';

export interface RestAlarm {
  /** 타이머 상태가 바뀔 때마다 부른다. 요청은 순서대로 보낸다 */
  sync(view: Pick<TimerView, 'state' | 'endsAt'>): Promise<void>;
}

export function createRestAlarm(opts: { isPaired: () => Promise<boolean>; fetch?: typeof fetch }): RestAlarm {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  /** 마지막으로 서버에 보낸 예약 (undefined = 아직 모름: 앱을 다시 연 직후에는 첫 변경을 반드시 보낸다) */
  let last: string | null | undefined;
  let chain: Promise<void> = Promise.resolve();

  return {
    sync(view) {
      const want = view.state === 'running' && view.endsAt !== null ? new Date(view.endsAt).toISOString() : null;
      if (want === last) return chain;
      last = want;
      chain = chain.then(async () => {
        try {
          if (!(await opts.isPaired())) return;
          await doFetch('/api/rest-alarm', {
            method: want ? 'PUT' : 'DELETE',
            credentials: 'same-origin',
            headers: { 'X-Fitness-Client': '1', ...(want ? { 'Content-Type': 'application/json' } : {}) },
            body: want ? JSON.stringify({ endsAt: want }) : undefined,
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          last = undefined; // 다음 변경 때 다시 보낸다
        }
      });
      return chain;
    },
  };
}
