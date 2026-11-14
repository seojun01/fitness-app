// 서비스 워커의 휴식 알림 처리 (sw.ts 가 이벤트에 연결한다). 브라우저 없이 테스트할 수 있도록 서비스 워커 전역(sw)을 받아서 쓴다.

export interface SwWindowClient {
  url: string;
  focus(): Promise<unknown>;
  postMessage(message: unknown): void;
}
export interface NotifySw {
  clients: { matchAll(opts: { type: 'window'; includeUncontrolled: boolean }): Promise<SwWindowClient[]>; openWindow(url: string): Promise<unknown> };
  registration: { showNotification(title: string, options: Record<string, unknown>): Promise<void> };
}

/** 알림 문구에는 운동 기록 내용을 넣지 않는다 (잠금 화면·푸시 서비스에 드러나지 않게, FR-003) */
export const REST_TITLE = '휴식 끝';
export const REST_BODY = '다음 세트를 시작하세요';
export const TEST_TITLE = '테스트 알림이에요';
export const TEST_BODY = '휴식이 끝나면 이렇게 알려 드려요.';
export const SESSION_URL = '/#/session';

/**
 * 푸시를 받았을 때 시스템 알림을 항상 띄운다. 해석할 수 없는 페이로드여도 띄운다 —
 * iOS 는 push 를 받고 알림을 띄우지 않으면 구독을 취소한다.
 */
export async function handlePush(sw: NotifySw, readJson: () => unknown): Promise<void> {
  let test = false;
  try {
    const data = readJson() as { test?: unknown } | null;
    test = !!data && typeof data === 'object' && data.test === true;
  } catch {
    /* 해석할 수 없는 페이로드: 휴식 알림으로 띄운다 */
  }
  await sw.registration.showNotification(test ? TEST_TITLE : REST_TITLE, {
    body: test ? TEST_BODY : REST_BODY,
    tag: test ? 'test' : 'rest-end', // 휴식 알림은 하나로 합친다
    renotify: !test, // 같은 tag 라도 다시 울리고 진동한다
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
}

/** 알림을 눌렀을 때: 열려 있는 창이 있으면 앞으로 가져와 운동 진행 화면으로 보내고, 없으면 새 창을 연다 (FR-004) */
export async function handleNotificationClick(sw: NotifySw): Promise<void> {
  const wins = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.length > 0) {
    await wins[0]!.focus();
    wins[0]!.postMessage({ type: 'open-session' });
    return;
  }
  await sw.clients.openWindow(SESSION_URL);
}
