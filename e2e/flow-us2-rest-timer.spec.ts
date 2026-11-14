import { test, expect, type Page } from '@playwright/test';
import { createRoutineViaUi, navTo, row } from './helpers.ts';

const bar = (page: Page) => page.getByRole('region', { name: '휴식 시간' });
const seconds = async (page: Page) => Number((await bar(page).locator('.timer-value').textContent())?.trim());

/** 가짜 시계를 멈춰 두고 runFor 로만 진행시킨다 (부하가 있어도 실제 시간이 끼어들지 않게) */
async function freeze(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
}

async function startWith(page: Page, routine: string, ex: string): Promise<void> {
  await page.clock.install({ time: new Date('2026-11-14T10:00:00') });
  await createRoutineViaUi(page, routine, [ex]);
  await row(page, routine).getByRole('button', { name: `${routine} 시작` }).click();
  await freeze(page);
}

test.describe('기능 3 US2: 휴식 타이머', () => {
  test('F6: 세트를 완료하면 60초부터 자동으로 줄어든다 (탭 1회)', async ({ page }) => {
    await startWith(page, '등', '풀업');
    await expect(bar(page).locator('.timer-value')).toHaveText('60');
    await page.getByLabel('풀업 1세트 무게').fill('0');
    await page.getByLabel('풀업 1세트 횟수').fill('8');
    await page.getByRole('button', { name: '풀업 1세트 완료', exact: true }).click();
    // 저장이 끝나고 타이머가 시작된 뒤에 시간을 돌린다
    await expect(page.getByRole('button', { name: '풀업 1세트 완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(bar(page).getByRole('button', { name: '휴식 일시정지' })).toBeVisible();
    await page.clock.runFor(10_000);
    await expect.poll(() => seconds(page)).toBe(50);
    await expect(bar(page).getByRole('button', { name: '휴식 일시정지' })).toBeVisible();
  });

  test('F7: −/+ 15초, 일시정지·재개, 정지', async ({ page }) => {
    await startWith(page, '가슴', '벤치 프레스');
    await bar(page).getByRole('button', { name: '휴식 시작' }).click();
    await bar(page).getByRole('button', { name: '휴식 15초 늘리기' }).click();
    await expect.poll(() => seconds(page)).toBe(75);
    await bar(page).getByRole('button', { name: '휴식 15초 줄이기' }).click();
    await bar(page).getByRole('button', { name: '휴식 15초 줄이기' }).click();
    await expect.poll(() => seconds(page)).toBe(45);
    await bar(page).getByRole('button', { name: '휴식 일시정지' }).click();
    await page.clock.runFor(20_000);
    await expect.poll(() => seconds(page)).toBe(45);
    await bar(page).getByRole('button', { name: '휴식 재개' }).click();
    await page.clock.runFor(5_000);
    await expect.poll(() => seconds(page)).toBe(40);
    await bar(page).getByRole('button', { name: '휴식 정지' }).click();
    await expect.poll(() => seconds(page)).toBe(60);
  });

  test('F8: 새로고침과 종목 이동에도 이어진다 (오차 1초 이내)', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-14T10:00:00') });
    await createRoutineViaUi(page, '둘', ['스쿼트', '런지']);
    await row(page, '둘').getByRole('button', { name: '둘 시작' }).click();
    await freeze(page);
    await bar(page).getByRole('button', { name: '휴식 시작' }).click();
    await page.clock.runFor(15_000);
    await page.getByRole('button', { name: '다음 운동 →' }).click();
    await expect.poll(() => seconds(page)).toBe(45);
    await page.reload();
    await expect(bar(page)).toBeVisible();
    await page.clock.runFor(5_000);
    const left = await seconds(page);
    expect(Math.abs(left - 40)).toBeLessThanOrEqual(1);
  });

  test('F9: 0초가 되면 "휴식 끝"이 화면 낭독기에도 알려진다', async ({ page }) => {
    await startWith(page, '코어', '플랭크');
    await bar(page).getByRole('button', { name: '휴식 15초 줄이기' }).click(); // 기본 45초
    await bar(page).getByRole('button', { name: '휴식 시작' }).click();
    await page.clock.runFor(46_000);
    await expect(bar(page).getByRole('status').filter({ hasText: '휴식 끝' })).toBeVisible();
  });

  test('멈춘 상태의 + 는 기본 휴식 시간을 바꾸고 설정으로 저장된다', async ({ page }) => {
    await startWith(page, '팔', '바벨 컬');
    await bar(page).getByRole('button', { name: '휴식 15초 늘리기' }).click();
    await bar(page).getByRole('button', { name: '휴식 15초 늘리기' }).click();
    await expect.poll(() => seconds(page)).toBe(90);
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('dialog', { name: '완료한 세트가 없어요' }).getByRole('button', { name: '폐기' }).click();
    await navTo(page, '루틴');
    await row(page, '팔').getByRole('button', { name: '팔 시작' }).click();
    await expect.poll(() => seconds(page)).toBe(90);
  });
});
