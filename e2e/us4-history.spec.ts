import { test, expect, type Page } from '@playwright/test';
import { createRoutineViaUi, navTo, openApp, row } from './helpers.ts';

const weight = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 무게`);
const reps = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 횟수`);

/** 루틴으로 세션 하나를 기록하고 종료한다 */
async function logSession(page: Page, routine: string, ex: string, w: string, r: string): Promise<void> {
  await navTo(page, '루틴');
  await row(page, routine).getByRole('button', { name: `${routine} 시작` }).click();
  await weight(page, ex, 1).fill(w);
  await reps(page, ex, 1).fill(r);
  await page.getByRole('button', { name: `${ex} 1세트 완료`, exact: true }).click();
  await page.getByRole('button', { name: '세션 종료' }).click();
  await expect(page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
}

test.describe('US4: 과거 기록 조회', () => {
  test('빈 상태 → 세션 2개 저장 → 최신순 목록과 상세가 입력값과 일치한다 (V9)', async ({ page }) => {
    await openApp(page, '#/history');
    await expect(page.getByText('아직 기록이 없어요')).toBeVisible();

    await createRoutineViaUi(page, '풀바디', ['벤치 프레스']);
    await logSession(page, '풀바디', '벤치 프레스', '60', '10'); // 600
    await logSession(page, '풀바디', '벤치 프레스', '65', '8'); // 520
    await navTo(page, '기록');
    const items = page.getByRole('list', { name: '운동 기록' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('풀바디');
    await expect(items.nth(0)).toContainText('520 kg'); // 최신 세션이 먼저
    await expect(items.nth(1)).toContainText('600 kg');

    await items.nth(0).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: '기록 상세', level: 1 })).toBeVisible();
    await expect(weight(page, '벤치 프레스', 1)).toHaveValue('65');
    await expect(reps(page, '벤치 프레스', 1)).toHaveValue('8');
  });

  test('시나리오 2: 세트 값을 수정하면 저장되고 목록 요약에 반영된다', async ({ page }) => {
    await createRoutineViaUi(page, '상체', ['풀업']);
    await logSession(page, '상체', '풀업', '10', '10'); // 100
    await navTo(page, '기록');
    await page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first().getByRole('button').first().click();
    await weight(page, '풀업', 1).fill('20');
    await weight(page, '풀업', 1).blur();
    await page.getByRole('link', { name: '기록', exact: true }).click();
    await expect(page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first()).toContainText('200 kg'); // 20×10
    // 잘못된 값은 안내되고 저장되지 않는다
    await page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first().getByRole('button').first().click();
    await reps(page, '풀업', 1).fill('0');
    await reps(page, '풀업', 1).blur();
    await expect(page.getByRole('alert').filter({ hasText: '횟수는 1~999' })).toBeVisible();
    await page.reload();
    await expect(reps(page, '풀업', 1)).toHaveValue('10');
  });

  test('세션을 삭제하면 목록에서 사라지고 되돌릴 수 있다', async ({ page }) => {
    await createRoutineViaUi(page, '코어', ['플랭크']);
    await logSession(page, '코어', '플랭크', '0', '30');
    await navTo(page, '기록');
    const list = page.getByRole('list', { name: '운동 기록' }).getByRole('listitem');
    await list.first().getByRole('button').first().click();
    await page.getByRole('button', { name: '세션 삭제' }).click();
    await expect(page.getByText('아직 기록이 없어요')).toBeVisible();
    await page.getByRole('button', { name: '되돌리기' }).click();
    await navTo(page, '기록');
    await expect(list).toHaveCount(1);
  });

  test('종목 이력: 상세에서 종목 이력으로 가면 그 종목의 세트가 날짜순으로 보인다', async ({ page }) => {
    await createRoutineViaUi(page, '하체', ['스쿼트']);
    await logSession(page, '하체', '스쿼트', '100', '5');
    await logSession(page, '하체', '스쿼트', '105', '5');
    await navTo(page, '기록');
    await page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first().getByRole('button').first().click();
    await page.getByRole('link', { name: '스쿼트 이력' }).click();
    await expect(page.getByRole('heading', { name: '스쿼트', level: 1 })).toBeVisible();
    const items = page.getByRole('list', { name: '세트 기록' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('105');
    await expect(items.nth(1)).toContainText('100');
  });

  test('lb 로 설정하면 목록·상세·종목 이력의 무게가 lb 로 표시된다', async ({ page }) => {
    await createRoutineViaUi(page, '등', ['데드리프트']);
    await logSession(page, '등', '데드리프트', '100', '5'); // 100kg = 220.46 lb, 볼륨 500kg = 1102.31 lb
    await navTo(page, '설정');
    await page.getByRole('radio', { name: 'lb' }).check();
    await navTo(page, '기록');
    const first = page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first();
    await expect(first).toContainText('lb');
    await expect(first).toContainText('1102.31');
    await first.getByRole('button').first().click();
    await expect(weight(page, '데드리프트', 1)).toHaveValue('220.46');
    await page.getByRole('link', { name: '데드리프트 이력' }).click();
    await expect(page.getByRole('list', { name: '세트 기록' })).toContainText('220.46');
  });

  test('다른 기기에서 기록한 완료 세션이 이 기기의 기록 목록에도 보인다 (SC-007)', async ({ browser }) => {
    const { newDevice } = await import('./helpers.ts');
    const A = await newDevice(browser, 'hist-a');
    const name = `동기 ${Date.now().toString(36)}`;
    await createRoutineViaUi(A.page, name, ['벤치 프레스']);
    await logSession(A.page, name, '벤치 프레스', '77', '7');
    await expect(A.page.locator('.sync-status')).toContainText('동기화됨', { timeout: 15_000 });
    const B = await newDevice(browser, 'hist-b');
    await navTo(B.page, '기록');
    await expect(B.page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
    await A.context.close();
    await B.context.close();
  });
});
