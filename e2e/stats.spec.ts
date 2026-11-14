import { test, expect, type Page } from '@playwright/test';
import { openApp, pickInPicker, seedSessions as seed, startFreeWorkout, type SeedSpec as Spec } from './helpers.ts';

const BENCH = '5eed0000-0000-4000-8000-000000000001';
const PULLUP = '5eed0000-0000-4000-8000-000000000007';
const SQUAT = '5eed0000-0000-4000-8000-000000000010';

const bench = (w: number, r = 5, n = 1): Spec['entries'][number] => ({ ex: BENCH, name: '벤치 프레스', sets: Array.from({ length: n }, () => [w, r] as [number, number]) });

async function go(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => (location.hash = h), hash);
}
const table = (page: Page, scope = page.locator('main')) => scope.getByRole('table');

test.describe('기능 004: 성장 차트·통계', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('US1: 종목 차트 — 점 3개, 지표 바꾸기, ←/→ 로 고르기, 개인 최고 기록', async ({ page }) => {
    await seed(page, [{ daysAgo: 20, entries: [bench(60)] }, { daysAgo: 10, entries: [bench(65)] }, { daysAgo: 2, entries: [bench(70, 5, 2)] }]);
    await go(page, `#/stats/exercise/${BENCH}`);
    await expect(page.getByRole('heading', { name: '벤치 프레스 차트', level: 1 })).toBeVisible();
    await page.getByText('표로 보기').click();
    await expect(table(page).getByRole('row')).toHaveCount(4); // 머리글 + 3
    await expect(table(page)).toContainText('81.7kg'); // 70×(1+5/30)
    const pr = page.getByRole('region', { name: '개인 최고 기록' });
    await expect(pr).toContainText('최고 무게');
    await expect(pr).toContainText('70kg');
    await expect(pr).toContainText('최고 세션 볼륨');
    await expect(pr).toContainText('700kg');

    await page.getByRole('radiogroup', { name: '지표' }).getByText('최고 무게').click();
    await expect(table(page)).toContainText('65kg');
    const group = page.getByRole('group', { name: '점 고르기' });
    await group.focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('status').filter({ hasText: '최고 무게' })).toContainText('최고 무게 70kg · 70kg×5, 70kg×5');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('status').filter({ hasText: '최고 무게' })).toContainText('65kg');
    await expect(page.getByRole('img', { name: /벤치 프레스 최고 무게, 4주 동안 60kg에서 70kg로 증가/ })).toBeVisible();
  });

  test('US1: 맨몸 종목은 횟수 지표, 기록 1개·0개 안내, lb 단위', async ({ page }) => {
    await seed(page, [{ daysAgo: 1, entries: [{ ex: PULLUP, name: '풀업', sets: [[0, 8], [0, 6]] }, bench(100)] }]);
    await go(page, `#/stats/exercise/${PULLUP}`);
    const metrics = page.getByRole('radiogroup', { name: '지표' });
    await expect(metrics.getByText('세션 총 횟수')).toBeVisible();
    await expect(metrics.getByText('추정 1RM')).toHaveCount(0);
    await expect(page.getByText('기록이 쌓이면 추이가 보여요')).toBeVisible();
    await expect(page.getByRole('region', { name: '개인 최고 기록' })).toContainText('14회');
    await go(page, `#/stats/exercise/${SQUAT}`);
    await expect(page.getByText('아직 기록이 없어요')).toBeVisible();
    // lb 로 바꾸면 무게가 lb 로 보인다
    await go(page, '#/settings');
    await page.getByText('lb', { exact: true }).click();
    await expect(async () => {
      await go(page, '#/routines');
      await go(page, `#/stats/exercise/${BENCH}`);
      await expect(page.getByRole('region', { name: '개인 최고 기록' })).toContainText('220.46lb', { timeout: 1000 });
    }).toPass();
  });

  test('US2: 기간 요약·증감과 주별 막대, 기간은 기억한다, 빈 상태', async ({ page }) => {
    await go(page, '#/stats');
    await expect(page.getByText('운동을 기록하면 여기에 통계가 쌓여요')).toBeVisible();
    await seed(page, [{ daysAgo: 0, hour: 8, entries: [bench(50, 10)] }, { daysAgo: 0, hour: 9, entries: [bench(50, 10)] }, { daysAgo: 7, entries: [bench(40, 10)] }]);
    await go(page, '#/routines');
    await go(page, '#/stats');
    const summary = page.getByRole('region', { name: '기간 요약' });
    await expect(summary).toContainText('3회');
    await expect(summary).toContainText('1,400kg'.replace(',', '')); // 500+500+400
    await expect(summary).toContainText('지난 기간보다 3회 늘었어요');
    await expect(summary).toContainText('2시간 15분');
    const bars = page.getByRole('region', { name: '주별 운동' });
    await bars.getByText('표로 보기').click();
    const rows = bars.getByRole('table').getByRole('row');
    await expect(rows).toHaveCount(5); // 머리글 + 4주 또는 5주
    await expect(rows.last()).toContainText('2회');
    await expect(rows.nth(-2)).toContainText('1회');

    await page.getByRole('radiogroup', { name: '기간' }).getByText('1년').click();
    await expect(page.getByRole('region', { name: '주별 운동' }).getByRole('img').first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radiogroup', { name: '기간' }).getByRole('radio', { name: '1년' })).toBeChecked();
    await page.getByRole('radiogroup', { name: '기간' }).getByText('4주').click();
  });

  test('US3: 부위별 비중과 종목으로 이동', async ({ page }) => {
    await seed(page, [{ daysAgo: 1, entries: [bench(60, 10, 6), { ex: SQUAT, name: '스쿼트', sets: [[100, 5], [100, 5], [100, 5]] }] }]);
    await go(page, '#/stats');
    const parts = page.getByRole('region', { name: '부위별 비중' });
    const chest = parts.getByRole('button', { name: '가슴 6세트 67%' });
    await expect(chest).toBeVisible();
    await expect(parts.getByRole('button', { name: '하체 3세트 33%' })).toBeVisible();
    await expect(parts.getByRole('button', { name: '등 0세트 0%' })).toBeDisabled();
    await chest.click();
    await expect(chest).toHaveAttribute('aria-expanded', 'true');
    await parts.getByRole('link', { name: '벤치 프레스 차트' }).click();
    await expect(page.getByRole('heading', { name: '벤치 프레스 차트', level: 1 })).toBeVisible();
  });

  test('US4: 달력 — 운동한 날 표시·일수, 하루 여러 세션이면 그날 목록, 달 이동', async ({ page }) => {
    await seed(page, [{ daysAgo: 0, hour: 7, entries: [bench(60)] }, { daysAgo: 0, hour: 18, entries: [bench(62)] }]);
    await go(page, '#/stats');
    const cal = page.getByRole('region', { name: '운동 달력' });
    const now = new Date(await page.evaluate(() => new Date().toISOString()));
    const local = await page.evaluate(() => ({ m: new Date().getMonth() + 1, d: new Date().getDate(), y: new Date().getFullYear() }));
    await expect(cal.getByRole('heading', { name: `${local.y}년 ${local.m}월` })).toBeVisible();
    await expect(cal).toContainText(`${local.m}월 운동 1일`);
    await cal.getByRole('button', { name: new RegExp(`^${local.m}월 ${local.d}\\s?일, 운동 2회$`) }).click();
    await expect(page.getByRole('list', { name: '이날 운동 기록' }).getByRole('listitem')).toHaveCount(2);
    await page.goBack();
    await page.getByRole('region', { name: '운동 달력' }).getByRole('button', { name: '이전 달' }).click();
    await expect(page.getByRole('region', { name: '운동 달력' })).toContainText('운동 0일');
    expect(now).toBeTruthy();
  });

  test('US5: 진행 화면 "기록" → "차트 보기" 대화상자, 닫으면 입력값 그대로; 세션 상세·종목 찾기', async ({ page }) => {
    const [id] = await seed(page, [{ daysAgo: 3, entries: [bench(60)] }, { daysAgo: 1, entries: [{ ex: SQUAT, name: '스쿼트', sets: [[100, 5]] }] }]);
    await go(page, '#/routines');
    await startFreeWorkout(page);
    await page.getByRole('button', { name: '첫 종목 추가' }).click();
    await pickInPicker(page, ['벤치 프레스']);
    await page.getByLabel('벤치 프레스 1세트 무게').fill('62.5');
    await page.locator('summary', { hasText: /^기록$/ }).click();
    await page.getByRole('button', { name: '벤치 프레스 차트 보기' }).click();
    const dlg = page.getByRole('dialog', { name: '벤치 프레스 차트' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('region', { name: '개인 최고 기록' })).toContainText('60kg');
    await dlg.getByRole('button', { name: '닫기' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByLabel('벤치 프레스 1세트 무게')).toHaveValue('62.5');

    await go(page, `#/history/${id}`);
    await page.getByRole('link', { name: '벤치 프레스 차트' }).click();
    await expect(page.getByRole('heading', { name: '벤치 프레스 차트', level: 1 })).toBeVisible();

    await go(page, '#/stats');
    const finder = page.getByRole('region', { name: '종목 차트' });
    await expect(finder.getByRole('list', { name: '기록이 있는 종목' }).getByRole('link')).toHaveCount(2);
    await finder.getByRole('searchbox', { name: '종목 차트 찾기' }).fill('데드');
    await expect(finder.getByRole('list', { name: '찾은 종목' })).toContainText('아직 기록 없음');
  });

  test('오프라인에서도 통계가 보이고, 500세션에서 1초 안에 뜬다 (SC-001, FR-012)', async ({ page, context }) => {
    const specs: Spec[] = Array.from({ length: 500 }, (_, i) => ({ daysAgo: Math.floor(i / 2) * 2 + (i % 2), hour: 6 + (i % 12), entries: [bench(40 + (i % 40)), { ex: SQUAT, name: '스쿼트', sets: [[80, 5], [80, 5], [80, 5]] }] }));
    await seed(page, specs);
    await context.setOffline(true);
    for (const [hash, ready] of [
      ['#/stats', () => page.getByRole('region', { name: '기간 요약' })],
      [`#/stats/exercise/${BENCH}`, () => page.getByRole('region', { name: '개인 최고 기록' })],
    ] as const) {
      await go(page, '#/routines');
      await expect(page.getByRole('heading', { name: '루틴', level: 1 })).toBeVisible();
      const t0 = Date.now();
      await go(page, hash);
      await expect(ready()).toBeVisible();
      expect(Date.now() - t0, `${hash} 표시 시간`).toBeLessThan(1000);
    }
    await page.getByRole('radiogroup', { name: '기간' }).getByText('전체').click();
    await expect(page.getByText('기록이 많아 주별 최고값으로 보여요')).toBeVisible();
    await context.setOffline(false);
  });
});
