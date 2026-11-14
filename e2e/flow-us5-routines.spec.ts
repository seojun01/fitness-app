import { test, expect } from '@playwright/test';
import { createRoutineViaUi, navTo, openApp, openRoutine, routineAction, row } from './helpers.ts';

test.describe('기능 3 US5: 루틴 화면 개편', () => {
  test('F13: 카드에 부위와 마지막 수행일, 운동 후 "오늘"', async ({ page }) => {
    await createRoutineViaUi(page, '풀', ['풀업', '바벨 컬', '랫 풀다운']);
    const card = row(page, '풀');
    await expect(card.locator('.routine-parts')).toHaveText('등, 팔');
    await expect(card).toContainText('기록 없음');
    await card.getByRole('button', { name: '풀 시작' }).click();
    await page.getByLabel('풀업 1세트 무게').fill('0');
    await page.getByLabel('풀업 1세트 횟수').fill('5');
    await page.getByRole('button', { name: '풀업 1세트 완료', exact: true }).click();
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('button', { name: '확인' }).click();
    await expect(row(page, '풀')).toContainText('오늘');
  });

  test('카드 → 상세(뒤로 링크), 상세의 운동 추가와 시작', async ({ page }) => {
    await createRoutineViaUi(page, '하체', ['스쿼트']);
    await openRoutine(page, '하체');
    await expect(page.getByRole('link', { name: '뒤로' })).toBeVisible();
    const items = page.getByRole('list', { name: '루틴 종목' }).getByRole('listitem');
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toContainText('하체 · 3세트');
    await page.getByRole('button', { name: '+ 운동 추가' }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '레그 컬', exact: true }).click();
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toContainText('레그 컬');
    await page.getByRole('button', { name: '▶ 시작' }).click();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '종목 진행' }).getByRole('button')).toHaveCount(2);
  });

  test('카드 더보기: 편집·복제·삭제', async ({ page }) => {
    await createRoutineViaUi(page, '어깨', ['오버헤드 프레스']);
    await routineAction(page, '어깨', '복제');
    await expect(row(page, '어깨 복사')).toBeVisible();
    await routineAction(page, '어깨 복사', '삭제');
    await expect(row(page, '어깨 복사')).toHaveCount(0);
    await routineAction(page, '어깨', '편집');
    await expect(page.getByRole('heading', { name: '루틴 편집', level: 1 })).toBeVisible();
  });

  test('정렬: 이름 순으로 바꾸면 유지된다', async ({ page }) => {
    await createRoutineViaUi(page, '나 루틴', []);
    await createRoutineViaUi(page, '가 루틴', []);
    await page.getByLabel('정렬').selectOption('name');
    const names = page.locator('.routine-name');
    await expect(names.nth(0)).toHaveText('가 루틴');
    await page.reload();
    await expect(page.getByLabel('정렬')).toHaveValue('name');
    await expect(page.locator('.routine-name').nth(0)).toHaveText('가 루틴');
  });

  test('메인 하단의 자유운동과 + 추가', async ({ page }) => {
    await openApp(page, '#/routines');
    await page.getByRole('button', { name: '+ 추가' }).click();
    await expect(page.getByRole('heading', { name: '새 루틴', level: 1 })).toBeVisible();
    await navTo(page, '루틴');
    await page.getByRole('button', { name: /자유운동/ }).click();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
  });
});
