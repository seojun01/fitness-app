import { test, expect, type Page } from '@playwright/test';
import { createRoutineViaUi, navTo, row } from './helpers.ts';

const compare = (page: Page) => page.locator('.compare');

async function logSets(page: Page, ex: string, sets: [string, string][]): Promise<void> {
  for (let i = 0; i < sets.length; i++) {
    const n = i + 1;
    if ((await page.getByLabel(`${ex} ${n}세트 무게`).count()) === 0) await page.getByRole('button', { name: `${ex} 세트 추가` }).click();
    await page.getByLabel(`${ex} ${n}세트 무게`).fill(sets[i]![0]);
    await page.getByLabel(`${ex} ${n}세트 횟수`).fill(sets[i]![1]);
    await page.getByRole('button', { name: `${ex} ${n}세트 완료`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${ex} ${n}세트 완료`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
}

async function finishAndBack(page: Page): Promise<void> {
  await page.getByRole('button', { name: '세션 종료' }).click();
  await page.getByRole('button', { name: '확인' }).click();
}

test.describe('기능 3 US3: 지난번 대비와 종목 기록', () => {
  test('F10: 첫 기록 → 두 번째 세션에서 볼륨 ▼/▲', async ({ page }) => {
    await createRoutineViaUi(page, '벤치', ['벤치 프레스']);
    await row(page, '벤치').getByRole('button', { name: '벤치 시작' }).click();
    await expect(compare(page)).toContainText('첫 기록이에요');
    await logSets(page, '벤치 프레스', [['60', '10'], ['60', '8']]); // 1080kg
    await finishAndBack(page);

    await row(page, '벤치').getByRole('button', { name: '벤치 시작' }).click();
    // 직전 값이 채워져 있으니 완료만 누른다
    await page.getByRole('button', { name: '벤치 프레스 1세트 완료', exact: true }).click();
    await expect(compare(page)).toContainText('볼륨 600kg');
    await expect(compare(page)).toContainText('▼480kg');
    await expect(compare(page)).toContainText('지난번까지 480kg 남음');
    await page.getByRole('button', { name: '벤치 프레스 2세트 완료', exact: true }).click();
    await expect(compare(page)).toContainText('지난번과 같아요');
    await page.getByLabel('벤치 프레스 3세트 무게').fill('60');
    await page.getByLabel('벤치 프레스 3세트 횟수').fill('5');
    await page.getByRole('button', { name: '벤치 프레스 3세트 완료', exact: true }).click();
    await expect(compare(page)).toContainText('▲300kg');
  });

  test('맨몸 종목은 횟수로 비교한다', async ({ page }) => {
    await createRoutineViaUi(page, '맨몸', ['푸시업']);
    await row(page, '맨몸').getByRole('button', { name: '맨몸 시작' }).click();
    await logSets(page, '푸시업', [['0', '20']]);
    await expect(compare(page)).toContainText('횟수 20회');
    await finishAndBack(page);
    await row(page, '맨몸').getByRole('button', { name: '맨몸 시작' }).click();
    await expect(compare(page)).toContainText('▼20회');
  });

  test('F11: "기록"에 추정 1RM·최고 무게·누적 볼륨과 최근 기록, lb 설정이면 lb', async ({ page }) => {
    await createRoutineViaUi(page, '데드', ['데드리프트']);
    await row(page, '데드').getByRole('button', { name: '데드 시작' }).click();
    await page.locator('summary', { hasText: '기록' }).click();
    await expect(page.getByText('아직 기록이 없어요')).toBeVisible();
    await logSets(page, '데드리프트', [['100', '5'], ['90', '8']]);
    await finishAndBack(page);
    await row(page, '데드').getByRole('button', { name: '데드 시작' }).click();
    await page.locator('summary', { hasText: '기록' }).click();
    const fold = page.locator('details.fold', { has: page.locator('summary', { hasText: '기록' }) });
    await expect(fold.getByText('추정 1RM', { exact: true }).locator('..')).toContainText('116.7kg'); // 100 × (1+5/30)
    await expect(fold.getByText('최고 무게').locator('..')).toContainText('100kg');
    await expect(fold.getByText('누적 볼륨').locator('..')).toContainText('1220kg');
    await expect(fold.locator('.recent-sets')).toContainText('100kg × 5회');
    // lb
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('dialog', { name: '완료한 세트가 없어요' }).getByRole('button', { name: '폐기' }).click();
    await navTo(page, '설정');
    await page.getByRole('radio', { name: 'lb' }).check();
    await navTo(page, '루틴');
    await row(page, '데드').getByRole('button', { name: '데드 시작' }).click();
    await page.locator('summary', { hasText: '기록' }).click();
    await expect(page.getByText('최고 무게').locator('..')).toContainText('220.46lb');
  });
});
