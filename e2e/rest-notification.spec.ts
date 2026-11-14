import { test, expect, type Page } from '@playwright/test';
import { navTo, openApp, pairThisDevice, pickInPicker, startFreeWorkout } from './helpers.ts';

const bar = (page: Page) => page.getByRole('region', { name: '휴식 시간' });

/** 이 페이지가 보낸 휴식 예약 요청을 차례로 모은다 (서버 응답까지 받은 것만) */
function recordAlarms(page: Page): { method: string; endsAt: string | null; status: number }[] {
  const log: { method: string; endsAt: string | null; status: number }[] = [];
  page.on('response', (res) => {
    const req = res.request();
    if (!req.url().endsWith('/api/rest-alarm')) return;
    const body = req.postData();
    log.push({ method: req.method(), endsAt: body ? (JSON.parse(body) as { endsAt: string }).endsAt : null, status: res.status() });
  });
  return log;
}

test.describe('기능 006: 휴식 종료 알림', () => {
  test('등록한 기기: 세트 완료 → 예약, 일시정지 → 취소, 재개 → 다시 예약, 세션 종료 → 취소', async ({ page }) => {
    await openApp(page);
    await pairThisDevice(page, 'e2e-rest-alarm');
    const log = recordAlarms(page);
    await navTo(page, '루틴');
    await startFreeWorkout(page);
    await page.getByRole('button', { name: '첫 종목 추가' }).click();
    await pickInPicker(page, ['풀업']);
    await page.getByLabel('풀업 1세트 무게').fill('0');
    await page.getByLabel('풀업 1세트 횟수').fill('8');
    const before = Date.now();
    await page.getByRole('button', { name: '풀업 1세트 완료', exact: true }).click();

    await expect.poll(() => log.length).toBe(1);
    expect(log[0]!.method).toBe('PUT');
    expect(log[0]!.status).toBe(200);
    const ends = Date.parse(log[0]!.endsAt!);
    expect(ends - before).toBeGreaterThan(55_000); // 기본 휴식 60초
    expect(ends - before).toBeLessThan(65_000);

    await bar(page).getByRole('button', { name: '휴식 일시정지' }).click();
    await expect.poll(() => log.map((l) => l.method)).toEqual(['PUT', 'DELETE']);
    await bar(page).getByRole('button', { name: '휴식 재개' }).click();
    await expect.poll(() => log.map((l) => l.method)).toEqual(['PUT', 'DELETE', 'PUT']);

    await page.getByRole('button', { name: '세션 종료' }).click();
    await expect.poll(() => log.map((l) => l.method)).toEqual(['PUT', 'DELETE', 'PUT', 'DELETE']);
    expect(log.every((l) => l.status === 200)).toBe(true);
  });

  test('등록하지 않은 기기는 예약을 보내지 않고, 설정에서 이유를 안내한다', async ({ page }) => {
    await openApp(page);
    const log = recordAlarms(page);
    await startFreeWorkout(page);
    await page.getByRole('button', { name: '첫 종목 추가' }).click();
    await pickInPicker(page, ['플랭크']);
    await bar(page).getByRole('button', { name: '휴식 시작' }).click();
    await bar(page).getByRole('button', { name: '휴식 정지' }).click();
    await page.goto('/#/settings'); // 진행 화면에는 하단 탭이 없다
    const card = page.getByRole('region', { name: '휴식 알림' });
    await expect(card).toContainText(/홈서버에 연결하세요|지원하지 않아요|홈 화면에 추가/);
    await expect(card.getByRole('button', { name: '알림 켜기' })).toHaveCount(0);
    expect(log).toEqual([]);
  });
});
