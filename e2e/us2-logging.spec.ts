import { test, expect, type Page } from '@playwright/test';
import { addExerciseByName, createRoutineViaUi, deleteSetViaMenu, navTo, openApp, row, startFreeWorkout } from './helpers.ts';

const weight = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 무게`);
const reps = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 횟수`);
const check = (page: Page, ex: string, n: number) => page.getByRole('button', { name: `${ex} ${n}세트 완료`, exact: true });

async function logSet(page: Page, ex: string, n: number, w: string, r: string): Promise<void> {
  await weight(page, ex, n).fill(w);
  await reps(page, ex, n).fill(r);
  await check(page, ex, n).click();
  await expect(check(page, ex, n)).toHaveAttribute('aria-pressed', 'true');
}

test.describe('US2: 운동 세션 중 세트 기록', () => {
  test('시나리오 3·4: 루틴으로 세션을 시작해 세트를 기록하고 종료하면 요약이 보이고 목록에 저장된다 (V3)', async ({ page }) => {
    await createRoutineViaUi(page, '가슴', ['벤치 프레스']);
    await row(page, '가슴').getByRole('button', { name: '가슴 시작' }).click();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    await logSet(page, '벤치 프레스', 1, '60', '10');
    await logSet(page, '벤치 프레스', 2, '60', '8');
    await page.getByRole('button', { name: '벤치 프레스 세트 추가' }).click();
    await logSet(page, '벤치 프레스', 3, '62.5', '6');
    await page.getByRole('button', { name: '세션 종료' }).click();
    await expect(page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
    await expect(page.getByText('완료 세트').locator('..')).toContainText('3');
    // 60×10 + 60×8 + 62.5×6 = 600 + 480 + 375 = 1455
    await expect(page.getByText('총 볼륨').locator('..')).toContainText('1455');
    await page.getByRole('button', { name: '확인' }).click();
    await expect(page.getByRole('heading', { name: '루틴', level: 1, exact: true })).toBeVisible();
  });

  test('시나리오 1 (V4): 두 번째 세션에서는 직전 무게·횟수가 미리 채워지고 체크 한 번으로 완료한다 (SC-001)', async ({ page }) => {
    await createRoutineViaUi(page, '가슴', ['벤치 프레스']);
    await row(page, '가슴').getByRole('button', { name: '가슴 시작' }).click();
    await logSet(page, '벤치 프레스', 1, '60', '10');
    await logSet(page, '벤치 프레스', 2, '65', '8');
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('button', { name: '확인' }).click();

    await row(page, '가슴').getByRole('button', { name: '가슴 시작' }).click();
    await expect(weight(page, '벤치 프레스', 1)).toHaveValue('60');
    await expect(reps(page, '벤치 프레스', 1)).toHaveValue('10');
    await expect(weight(page, '벤치 프레스', 2)).toHaveValue('65');
    await expect(check(page, '벤치 프레스', 1)).toHaveAttribute('aria-pressed', 'false');
    // SC-001: 확인 후 체크 탭 한 번으로 한 세트가 끝난다
    await check(page, '벤치 프레스', 1).click();
    await expect(check(page, '벤치 프레스', 1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('시나리오 2: 세트를 추가·수정·삭제하면 즉시 반영된다', async ({ page }) => {
    await createRoutineViaUi(page, '하체', ['스쿼트']);
    await row(page, '하체').getByRole('button', { name: '하체 시작' }).click();
    await expect(weight(page, '스쿼트', 3)).toBeVisible(); // 목표 세트 기본값 3
    await expect(weight(page, '스쿼트', 4)).toHaveCount(0);
    await page.getByRole('button', { name: '스쿼트 세트 추가' }).click();
    await expect(weight(page, '스쿼트', 4)).toBeVisible();
    await deleteSetViaMenu(page, '스쿼트', 4);
    await expect(weight(page, '스쿼트', 4)).toHaveCount(0);
    await weight(page, '스쿼트', 1).fill('100');
    await reps(page, '스쿼트', 1).fill('5');
    await page.reload();
    await expect(weight(page, '스쿼트', 1)).toHaveValue('100');
    await expect(reps(page, '스쿼트', 1)).toHaveValue('5');
  });

  test('시나리오 4 (V5): 루틴 없이 빈 세션을 시작하고 종목을 즉석에서 추가한다', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await addExerciseByName(page, '데드리프트');
    await logSet(page, '데드리프트', 1, '100', '5');
    await page.getByRole('button', { name: '세션 종료' }).click();
    await expect(page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
  });

  test('V6: 잘못된 값(횟수 0·소수, 무게 음수)은 입력 단계에서 안내되고 완료할 수 없다', async ({ page }) => {
    await createRoutineViaUi(page, '등', ['풀업']);
    await row(page, '등').getByRole('button', { name: '등 시작' }).click();
    await reps(page, '풀업', 1).fill('0');
    await expect(page.getByRole('alert').filter({ hasText: '횟수는 1~999' })).toBeVisible();
    await reps(page, '풀업', 1).fill('2.5');
    await expect(page.getByRole('alert').filter({ hasText: '횟수는 1~999' })).toBeVisible();
    await weight(page, '풀업', 1).fill('-3');
    await expect(page.getByRole('alert').filter({ hasText: '무게는 0 이상' })).toBeVisible();
    await weight(page, '풀업', 1).fill('0');
    await reps(page, '풀업', 1).fill('8');
    await expect(page.getByRole('alert').filter({ hasText: /횟수는|무게는/ })).toHaveCount(0);
    await check(page, '풀업', 1).click();
    await expect(check(page, '풀업', 1)).toHaveAttribute('aria-pressed', 'true'); // 맨몸 0kg 허용
  });

  test('값이 비어 있으면 완료할 수 없고 안내가 보인다', async ({ page }) => {
    await createRoutineViaUi(page, '등', ['랫 풀다운']);
    await row(page, '등').getByRole('button', { name: '등 시작' }).click();
    await check(page, '랫 풀다운', 1).click();
    await expect(page.getByRole('alert').filter({ hasText: /무게|횟수/ })).toBeVisible();
    await expect(check(page, '랫 풀다운', 1)).toHaveAttribute('aria-pressed', 'false');
  });

  test('완료 세트가 없이 종료하면 저장 여부를 묻고, 폐기하면 기록에 남지 않는다', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await page.getByRole('button', { name: '세션 종료' }).click();
    const dialog = page.getByRole('dialog', { name: '완료한 세트가 없어요' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '폐기' }).click();
    await expect(page.getByRole('heading', { name: '루틴', level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '이어서 기록' })).toHaveCount(0);
  });

  test('V10: kg ↔ lb 전환 후에도 입력한 45 lb·100.25 lb 가 그대로 보인다 (SC-006)', async ({ page }) => {
    await openApp(page, '#/settings');
    await page.getByRole('radio', { name: 'lb' }).check();
    await createRoutineViaUi(page, '벤치', ['벤치 프레스']);
    await row(page, '벤치').getByRole('button', { name: '벤치 시작' }).click();
    await logSet(page, '벤치 프레스', 1, '45', '10');
    await page.getByRole('button', { name: '벤치 프레스 세트 추가' }).click();
    await logSet(page, '벤치 프레스', 2, '100.25', '5');
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('button', { name: '확인' }).click();
    await navTo(page, '설정');
    await page.getByRole('radio', { name: 'kg' }).check();
    await page.getByRole('radio', { name: 'lb' }).check();
    await navTo(page, '루틴');
    await row(page, '벤치').getByRole('button', { name: '벤치 시작' }).click();
    await expect(weight(page, '벤치 프레스', 1)).toHaveValue('45');
    await expect(weight(page, '벤치 프레스', 2)).toHaveValue('100.25');
  });

  test('SC-002: 처음 실행에서 안내 없이 루틴 생성 → 세션 시작까지 3분 이내, 화면 이동 5회 이내', async ({ page }) => {
    const t0 = Date.now();
    let navs = 0;
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) navs++;
    });
    await openApp(page, '#/routines');
    await page.getByRole('button', { name: '첫 루틴 만들기' }).click(); // 1
    await page.getByLabel('루틴 이름').fill('첫 루틴');
    await addExerciseByName(page, '벤치 프레스');
    await page.getByRole('button', { name: '저장', exact: true }).click(); // 2 (목록으로)
    await page.getByRole('button', { name: '첫 루틴 시작' }).click(); // 3 (세션 화면)
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(180_000);
    expect(navs).toBeLessThanOrEqual(5);
  });
});
