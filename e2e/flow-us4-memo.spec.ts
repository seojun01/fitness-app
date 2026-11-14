import { test, expect } from '@playwright/test';
import { cliExport, createRoutineViaUi, navTo, newDevice, pickInPicker, row } from './helpers.ts';

test.describe('기능 3 US4: 종목 메모', () => {
  test('F12: 메모는 저장되어 다음 세션에도 보이고, 501자는 안내 후 저장되지 않는다', async ({ page }) => {
    await createRoutineViaUi(page, '랫', ['랫 풀다운']);
    await row(page, '랫').getByRole('button', { name: '랫 시작' }).click();
    await page.locator('summary', { hasText: '메모' }).click();
    await page.getByLabel('랫 풀다운 메모').fill('패드 높이 3\n그립 넓게');
    await page.getByLabel('랫 풀다운 메모').blur();
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('dialog', { name: '완료한 세트가 없어요' }).getByRole('button', { name: '폐기' }).click();
    await navTo(page, '루틴');
    await row(page, '랫').getByRole('button', { name: '랫 시작' }).click();
    await page.locator('summary', { hasText: '메모' }).click();
    await expect(page.getByLabel('랫 풀다운 메모')).toHaveValue('패드 높이 3\n그립 넓게');

    await page.getByLabel('랫 풀다운 메모').fill('가'.repeat(501));
    await expect(page.getByRole('alert').filter({ hasText: '메모는 500자까지' })).toBeVisible();
    await page.getByLabel('랫 풀다운 메모').blur();
    await page.reload();
    await page.locator('summary', { hasText: '메모' }).click();
    await expect(page.getByLabel('랫 풀다운 메모')).toHaveValue('패드 높이 3\n그립 넓게');
  });

  test('메모는 다른 기기에도 동기화된다', async ({ browser }) => {
    test.setTimeout(60_000);
    const memo = `시트 높이 ${Date.now().toString(36)}`;
    const A = await newDevice(browser, 'memo-a');
    await createRoutineViaUi(A.page, '메모 루틴', ['레그 익스텐션']);
    await row(A.page, '메모 루틴').getByRole('button', { name: '메모 루틴 시작' }).click();
    await A.page.locator('summary', { hasText: '메모' }).click();
    await A.page.getByLabel('레그 익스텐션 메모').fill(memo);
    await A.page.getByLabel('레그 익스텐션 메모').blur();
    // "동기화됨" 표시는 메모 저장 전 상태일 수 있으니, 서버에 실제로 올라간 것을 확인한다
    await expect.poll(() => (cliExport().exercises as { memo?: string }[]).some((e) => e.memo === memo), { timeout: 15_000 }).toBe(true);
    const B = await newDevice(browser, 'memo-b');
    await B.page.getByRole('button', { name: /자유운동/ }).click();
    await B.page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await pickInPicker(B.page, ['레그 익스텐션']);
    await B.page.locator('summary', { hasText: '메모' }).click();
    await expect(B.page.getByLabel('레그 익스텐션 메모')).toHaveValue(memo);
    await A.context.close();
    await B.context.close();
  });
});
