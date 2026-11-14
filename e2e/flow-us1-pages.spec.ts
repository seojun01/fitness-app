import { test, expect, type Page } from '@playwright/test';
import { addExerciseByName, createRoutineViaUi, deleteSetViaMenu, openApp, row, startFreeWorkout } from './helpers.ts';

const weight = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 무게`);
const reps = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 횟수`);
const done = (page: Page, ex: string, n: number) => page.getByRole('button', { name: `${ex} ${n}세트 완료`, exact: true });
const dots = (page: Page) => page.getByRole('navigation', { name: '종목 진행' }).getByRole('button');
const title = (page: Page) => page.locator('.entry-title-lg');

test.describe('기능 3 US1: 한 종목씩 넘기며 운동하기', () => {
  test('시나리오 1~3 (F1~F3): 진행 점, 다음 운동, 점으로 이동, 마지막은 운동 완료', async ({ page }) => {
    await createRoutineViaUi(page, '풀 데이', ['풀업', '랫 풀다운', '바벨 컬']);
    await row(page, '풀 데이').getByRole('button', { name: '풀 데이 시작' }).click();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeHidden(); // 하단 탭 숨김
    await expect(dots(page)).toHaveCount(3);
    await expect(dots(page).nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(title(page)).toHaveText('풀업');
    await expect(page.getByLabel('경과 시간')).toHaveText(/\d\d:\d\d/);

    await weight(page, '풀업', 1).fill('0');
    await reps(page, '풀업', 1).fill('8');
    await done(page, '풀업', 1).click();
    await expect(dots(page).nth(0)).toHaveAttribute('data-done', 'true');
    await page.getByRole('button', { name: '다음 운동 →' }).click();
    await expect(title(page)).toHaveText('랫 풀다운');
    await expect(dots(page).nth(1)).toHaveAttribute('aria-current', 'step');

    await dots(page).nth(0).click(); // 점으로 첫 종목에
    await expect(title(page)).toHaveText('풀업');
    await expect(reps(page, '풀업', 1)).toHaveValue('8');
    await expect(done(page, '풀업', 1)).toHaveAttribute('aria-pressed', 'true');

    await dots(page).nth(2).click();
    await expect(title(page)).toHaveText('바벨 컬');
    await page.getByRole('button', { name: '운동 완료' }).click();
    await expect(page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
  });

  test('새로고침해도 보던 종목에 그대로 있다', async ({ page }) => {
    await createRoutineViaUi(page, '두 종목', ['스쿼트', '레그 프레스']);
    await row(page, '두 종목').getByRole('button', { name: '두 종목 시작' }).click();
    await page.getByRole('button', { name: '다음 운동 →' }).click();
    await expect(title(page)).toHaveText('레그 프레스');
    await page.reload();
    await expect(title(page)).toHaveText('레그 프레스');
  });

  test('시나리오 4·5 (F4): 세트 추가·삭제, 세트 ⋯ 삭제, 모든 세트 완료(빈 세트 안내)', async ({ page }) => {
    await createRoutineViaUi(page, '하체', ['스쿼트']);
    await row(page, '하체').getByRole('button', { name: '하체 시작' }).click();
    await weight(page, '스쿼트', 1).fill('100');
    await reps(page, '스쿼트', 1).fill('5');
    await page.getByRole('button', { name: '스쿼트 세트 추가' }).click(); // 3 → 4
    await expect(weight(page, '스쿼트', 4)).toBeVisible();
    await page.getByRole('button', { name: '스쿼트 세트 삭제' }).click(); // 4 → 3
    await expect(weight(page, '스쿼트', 4)).toHaveCount(0);
    await deleteSetViaMenu(page, '스쿼트', 3); // 3 → 2
    await expect(weight(page, '스쿼트', 3)).toHaveCount(0);
    await page.getByRole('button', { name: '✓ 모든 세트 완료' }).click();
    await expect(done(page, '스쿼트', 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(done(page, '스쿼트', 2)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('alert').filter({ hasText: '값이 비어 있는 세트 1개' })).toBeVisible();
  });

  test('시나리오 6 (F5): + 로 종목 추가하면 그 종목으로 가고, ⋯ 이 종목 삭제는 앞 종목으로 간다', async ({ page }) => {
    await createRoutineViaUi(page, '가슴', ['벤치 프레스']);
    await row(page, '가슴').getByRole('button', { name: '가슴 시작' }).click();
    await addExerciseByName(page, '딥스');
    await expect(title(page)).toHaveText('딥스');
    await expect(dots(page)).toHaveCount(2);
    await page.getByRole('button', { name: '딥스 더보기' }).click();
    await page.getByRole('dialog', { name: '딥스' }).getByRole('button', { name: '이 종목 삭제' }).click();
    await expect(title(page)).toHaveText('벤치 프레스');
    await expect(dots(page)).toHaveCount(1);
  });

  test('종목이 없는 자유운동은 첫 종목 추가를 안내한다', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await expect(page.getByText('종목을 추가해 시작하세요')).toBeVisible();
    await page.getByRole('button', { name: '첫 종목 추가' }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '플랭크', exact: true }).click();
    await expect(title(page)).toHaveText('플랭크');
  });

  test('뒤로 가기로 메인에 가도 세션은 진행 중이고 "이어서 기록"으로 돌아온다', async ({ page }) => {
    await createRoutineViaUi(page, '팔', ['해머 컬']);
    await row(page, '팔').getByRole('button', { name: '팔 시작' }).click();
    await page.getByRole('link', { name: '뒤로' }).click();
    await page.getByRole('button', { name: '이어서 기록' }).click();
    await expect(title(page)).toHaveText('해머 컬');
  });
});
