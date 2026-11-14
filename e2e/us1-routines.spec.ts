import { test, expect } from '@playwright/test';
import { addExerciseByName, createRoutineViaUi, navTo, openApp, openRoutine, openRoutineEditor, routineAction, row } from './helpers.ts';

test.describe('US1: 루틴 만들기 및 관리', () => {
  test('시나리오 1: 빈 상태에서 이름과 종목 3개로 루틴을 저장하면 새로고침해도 남아 있다', async ({ page }) => {
    await openApp(page, '#/routines');
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible();
    await createRoutineViaUi(page, '가슴·삼두', ['벤치 프레스', '푸시업', '트라이셉스 푸시다운']);
    await expect(row(page, '가슴·삼두')).toContainText('종목 3개');
    await page.reload();
    await expect(row(page, '가슴·삼두')).toContainText('종목 3개');
    await openRoutine(page, '가슴·삼두');
    const items = page.getByRole('list', { name: '루틴 종목' });
    await expect(items).toContainText('벤치 프레스');
    await expect(items).toContainText('푸시업');
    await expect(items).toContainText('트라이셉스 푸시다운');
  });

  test('시나리오 2: 종목 순서 변경·삭제·목표 세트 수 변경이 저장된다', async ({ page }) => {
    await createRoutineViaUi(page, '상체', ['벤치 프레스', '풀업', '오버헤드 프레스']);
    await openRoutineEditor(page, '상체');
    await page.getByRole('button', { name: '오버헤드 프레스 위로 이동' }).click();
    await page.getByRole('button', { name: '벤치 프레스 삭제' }).click();
    await page.getByRole('button', { name: '풀업 세트 늘리기' }).click();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('heading', { name: '상체', level: 1, exact: true })).toBeVisible(); // 편집을 마치면 상세로
    await navTo(page, '루틴');
    await expect(row(page, '상체')).toContainText('종목 2개');
    await page.reload();
    await openRoutineEditor(page, '상체');
    const items = page.getByRole('list', { name: '루틴 종목' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('오버헤드 프레스');
    await expect(items.nth(1)).toContainText('풀업');
    await expect(items.nth(1)).toContainText('4세트');
  });

  test('시나리오 3: 복제하면 같은 구성의 새 루틴이 생기고 원본은 변하지 않는다', async ({ page }) => {
    await createRoutineViaUi(page, '하체', ['스쿼트', '레그 프레스']);
    await routineAction(page, '하체', '복제');
    await expect(row(page, '하체 복사')).toContainText('종목 2개');
    await openRoutineEditor(page, '하체 복사');
    await page.getByRole('button', { name: '스쿼트 삭제' }).click();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await navTo(page, '루틴');
    await expect(row(page, '하체 복사')).toContainText('종목 1개');
    await expect(row(page, '하체').filter({ hasNotText: '복사' })).toContainText('종목 2개');
  });

  test('시나리오 4: 삭제하면 목록에서 사라지고 되돌릴 수 있다', async ({ page }) => {
    await createRoutineViaUi(page, '임시', ['플랭크']);
    await routineAction(page, '임시', '삭제');
    await expect(row(page, '임시')).toHaveCount(0);
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible();
    await page.getByRole('button', { name: '되돌리기' }).click();
    await expect(row(page, '임시')).toBeVisible();
  });

  test('잘못된 이름(빈 값·61자)은 안내가 보이고 저장되지 않는다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('이름은 1~60자');
    await expect(page.getByLabel('루틴 이름')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('루틴 이름').fill('가'.repeat(61));
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('이름은 1~60자');
    await navTo(page, '루틴');
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible();
  });

  test('종목을 직접 만들고 이름을 수정·삭제할 수 있다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByLabel('루틴 이름').fill('내 루틴');
    await page.getByRole('button', { name: '종목 추가' }).click();
    const dialog = page.getByRole('dialog', { name: '종목 선택' });
    await dialog.getByText('직접 종목 만들기').click();
    await dialog.getByLabel('종목 이름').fill('내 전용 컬');
    await dialog.getByLabel('부위').selectOption('arms');
    await dialog.getByRole('button', { name: '만들기' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('list', { name: '루틴 종목' })).toContainText('내 전용 컬');
    await page.getByRole('button', { name: '종목 추가' }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '내 전용 컬 이름 수정' }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByLabel('새 이름').fill('내 전용 해머컬');
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '이름 저장' }).click();
    await expect(page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '내 전용 해머컬', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '내 전용 해머컬 삭제' }).click();
    await expect(page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '내 전용 해머컬', exact: true })).toHaveCount(0);
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '닫기' }).click();
    await addExerciseByName(page, '벤치 프레스');
  });
});
