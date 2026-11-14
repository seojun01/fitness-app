import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { navTo, openApp, startFreeWorkout } from './helpers.ts';

async function ready(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10_000 }).toBe(true);
}

test.describe('기능 2: 오프라인·내보내기·DB 업그레이드', () => {
  test('G8: 앱을 한 번 연 뒤 오프라인에서 처음 여는 종목의 가이드가 보인다 (사전 캐시)', async ({ page, context }) => {
    await openApp(page, '#/routines');
    await ready(page);
    await context.setOffline(true);
    await page.goto('/#/guides');
    await page.getByRole('list', { name: '가이드 목록' }).getByRole('button', { name: '카프 레이즈', exact: true }).click();
    await expect(page.locator('.guide')).toContainText('주동근: 종아리');
    await context.setOffline(false);
  });

  test('G9: 노트가 내보내기 v2 에 들어가고 전체 삭제 후 사라진다', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '종목 선택' });
    await picker.getByText('직접 종목 만들기').click();
    await picker.getByLabel('종목 이름').fill('내보낼 운동');
    await picker.getByRole('button', { name: '만들기' }).click();
    await page.getByRole('button', { name: '내보낼 운동 가이드' }).click();
    await page.getByRole('dialog', { name: '내보낼 운동' }).getByRole('button', { name: '가이드 작성' }).click();
    await page.getByLabel('자세 요점 (한 줄에 하나)').fill('내보내기 요점');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await navTo(page, '설정');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '데이터 내보내기' }).click()]);
    const data = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(data.version).toBe(2);
    expect(data.guideNotes.map((n: { cues: string[] }) => n.cues[0])).toContain('내보내기 요점');
    await page.getByRole('button', { name: '모든 데이터 삭제' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '모두 삭제' }).click();
    await navTo(page, '설정');
    const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '데이터 내보내기' }).click()]);
    expect(JSON.parse(readFileSync((await d2.path())!, 'utf8')).guideNotes).toEqual([]);
  });

  test('G9: 이전 버전(IndexedDB v1)으로 기록한 브라우저에서 새 버전을 열면 기록이 그대로다', async ({ page }) => {
    await page.goto('/manifest.webmanifest'); // 앱이 실행되지 않는 같은 출처의 파일에서 v1 DB 를 직접 만든다
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('fitness', 1);
          open.onupgradeneeded = () => {
            const db = open.result;
            for (const s of ['exercises', 'routines', 'sessions', 'settings']) {
              const st = db.createObjectStore(s, { keyPath: 'id' });
              st.createIndex('byDirty', 'dirty');
              if (s === 'sessions') {
                st.createIndex('byStatus', 'status');
                st.createIndex('byEndedAt', 'endedAt');
              }
            }
            db.createObjectStore('meta');
          };
          open.onsuccess = () => {
            const tx = open.result.transaction(['routines', 'meta'], 'readwrite');
            tx.objectStore('routines').put({ id: '00000000-0000-4000-8000-0000000000aa', name: '옛 버전 루틴', items: [], createdAt: '2026-11-01T00:00:00.000Z', deleted: false, version: '001762000000000-000000-old', updatedBy: 'old', dirty: 0 });
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        }),
    );
    await openApp(page, '#/routines');
    await expect(page.locator('.routine-name')).toHaveText(['옛 버전 루틴']);
    await navTo(page, '가이드');
    await expect(page.getByRole('list', { name: '가이드 목록' })).toBeVisible();
  });
});
