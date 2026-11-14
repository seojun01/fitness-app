import { test, expect, type Page } from '@playwright/test';
import { cliExport, createCustomInPicker, createRoutineViaUi, navTo, newDevice, openApp, picker, pickerMenu, pickInPicker, row, startFreeWorkout } from './helpers.ts';

const sheet = (page: Page, name: string) => page.getByRole('dialog', { name });

/** 종목 선택에서 직접 종목을 만든다 (자유운동 진행 화면에서) */
async function createCustomInSession(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '종목 추가', exact: true }).click();
  await createCustomInPicker(page, name);
  await picker(page).getByRole('button', { name: '+ 1 운동 추가' }).click();
  await expect(page.locator('.entry-title-lg')).toHaveText(name);
}

test.describe('기능 2 US1: 운동 중 ⓘ로 가이드 보기', () => {
  test('G1: 요점·실수·근육·안전 안내, 닫으면 입력값과 휴식 타이머가 그대로 (탭 2회)', async ({ page }) => {
    await createRoutineViaUi(page, '가슴', ['벤치 프레스']);
    await row(page, '가슴').getByRole('button', { name: '가슴 시작' }).click();
    await page.getByLabel('벤치 프레스 1세트 무게').fill('60');
    await page.getByLabel('벤치 프레스 1세트 횟수').fill('10');
    await page.getByRole('button', { name: '벤치 프레스 1세트 완료', exact: true }).click();
    await expect(page.getByRole('button', { name: '휴식 일시정지' })).toBeVisible();

    await page.getByRole('button', { name: '벤치 프레스 가이드' }).click(); // 탭 1
    const d = sheet(page, '벤치 프레스');
    await expect(d.getByRole('heading', { name: '자세 요점' })).toBeVisible();
    await expect(d.getByRole('heading', { name: '흔한 실수' })).toBeVisible();
    await expect(d.getByRole('heading', { name: '주요 자극 근육' })).toBeVisible();
    await expect(d).toContainText('주동근: 대흉근');
    await expect(d).toContainText('보조근: 전면 삼각근, 삼두근');
    await expect(d.locator('ol li')).toHaveCount(5);
    await expect(d).toContainText('통증이 있으면 멈추고 전문가와 상의하세요');
    await expect(d.getByRole('button', { name: '가이드 수정' })).toHaveCount(0); // 기본 종목은 읽기 전용

    await d.getByRole('button', { name: '닫기' }).click(); // 탭 2
    await expect(d).toBeHidden();
    await expect(page.getByLabel('벤치 프레스 1세트 무게')).toHaveValue('60');
    await expect(page.getByRole('button', { name: '벤치 프레스 1세트 완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '휴식 일시정지' })).toBeVisible();

    await page.getByRole('button', { name: '벤치 프레스 가이드' }).click();
    await page.keyboard.press('Escape');
    await expect(sheet(page, '벤치 프레스')).toBeHidden();
  });

  test('G2: 직접 만든 종목은 "아직 가이드가 없어요"와 "가이드 작성"', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await createCustomInSession(page, '내 케이블 운동');
    await page.getByRole('button', { name: '내 케이블 운동 가이드' }).click();
    const d = sheet(page, '내 케이블 운동');
    await expect(d).toContainText('아직 가이드가 없어요');
    await d.getByRole('button', { name: '가이드 작성' }).click();
    await expect(page.getByRole('heading', { name: '내 케이블 운동 가이드', level: 1 })).toBeVisible();
  });
});

test.describe('기능 2 US2: 종목 선택에서 가이드', () => {
  test('G3: 가이드를 열었다 닫으면 종목 선택이 그대로 열려 있고 고를 수 있다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByLabel('루틴 이름').fill('선택 테스트');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await pickerMenu(page, '스쿼트', '가이드');
    const d = sheet(page, '스쿼트');
    await expect(d).toContainText('주동근: 대퇴사두근, 둔근');
    await d.getByRole('button', { name: '닫기' }).click();
    await expect(picker(page)).toBeVisible();
    await pickInPicker(page, ['스쿼트']);
    await expect(page.getByRole('list', { name: '루틴 종목' })).toContainText('스쿼트');
  });
});

test.describe('기능 2 US3: 가이드 탭', () => {
  test('G4·G5: 부위 필터·검색, 전체 화면, 루틴에 추가', async ({ page }) => {
    await createRoutineViaUi(page, '하체 날', ['스쿼트']);
    await navTo(page, '가이드');
    const items = page.getByRole('list', { name: '가이드 목록' }).getByRole('listitem');
    await page.getByLabel('부위').selectOption('legs');
    await expect(items).toHaveCount(18); // 하체 기본 종목 (기능 5에서 7 → 18)
    for (const t of await items.allInnerTexts()) expect(t).toContain('하체');
    await page.getByLabel('가이드 검색').fill('레그');
    await expect(items).toHaveCount(3); // 하체 중 레그 프레스·레그 컬·레그 익스텐션 (레그 레이즈는 코어라 빠진다)
    await expect(items.filter({ hasText: '레그 컬' })).toHaveCount(1);
    await items.filter({ hasText: '레그 컬' }).getByRole('button').click();
    await expect(page.getByRole('heading', { name: '레그 컬', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: '뒤로' })).toBeVisible();
    await expect(page.locator('.guide')).toContainText('주동근: 햄스트링');
    await page.getByRole('button', { name: '+ 루틴에 추가' }).click();
    await page.getByRole('dialog', { name: '어느 루틴에 추가할까요?' }).getByRole('button', { name: '하체 날' }).click();
    await expect(page.getByRole('status').filter({ hasText: '하체 날에 레그 컬' })).toBeVisible();
    await navTo(page, '루틴');
    await expect(row(page, '하체 날')).toContainText('종목 2개');
  });

  test('기본 종목 이름을 바꿔도 가이드가 남는다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await pickerMenu(page, '해머 컬', '이름 수정');
    await page.getByRole('dialog', { name: '이름 수정' }).getByLabel('새 이름').fill('뉴트럴 그립 컬');
    await page.getByRole('dialog', { name: '이름 수정' }).getByRole('button', { name: '이름 저장' }).click();
    await pickerMenu(page, '뉴트럴 그립 컬', '가이드');
    await expect(sheet(page, '뉴트럴 그립 컬')).toContainText('주동근: 이두근, 전완근');
  });
});

test.describe('기능 2 US4: 직접 만든 종목의 가이드 노트', () => {
  test('G6: 작성·표시·모두 비우기·잘못된 입력', async ({ page }) => {
    await openApp(page, '#/routines');
    await startFreeWorkout(page);
    await createCustomInSession(page, '내 스윙 변형');
    await page.getByRole('button', { name: '내 스윙 변형 가이드' }).click();
    await sheet(page, '내 스윙 변형').getByRole('button', { name: '가이드 작성' }).click();

    await page.getByLabel('자세 요점 (한 줄에 하나)').fill('엉덩이로 민다\n팔은 힘을 뺀다');
    await page.getByLabel('흔한 실수 (한 줄에 하나)').fill('스쿼트처럼 앉는다');
    await page.getByRole('group', { name: '주동근' }).getByLabel('둔근').check();
    await page.getByRole('group', { name: '보조근' }).getByLabel('둔근').check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('주동근과 겹치지 않게');
    await page.getByRole('group', { name: '보조근' }).getByLabel('둔근').uncheck();
    await page.getByRole('group', { name: '보조근' }).getByLabel('햄스트링').check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('heading', { name: '내 스윙 변형', level: 1 })).toBeVisible();
    await expect(page.locator('.guide ol li')).toHaveText(['엉덩이로 민다', '팔은 힘을 뺀다']);
    await expect(page.locator('.guide')).toContainText('주동근: 둔근');
    await expect(page.locator('.guide')).toContainText('보조근: 햄스트링');

    await page.getByRole('button', { name: '가이드 수정' }).click();
    await page.getByLabel('흔한 실수 (한 줄에 하나)').fill('가'.repeat(201));
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('한 줄에 200자까지');

    await page.getByLabel('자세 요점 (한 줄에 하나)').fill('');
    await page.getByLabel('흔한 실수 (한 줄에 하나)').fill('');
    await page.getByRole('group', { name: '주동근' }).getByLabel('둔근').uncheck();
    await page.getByRole('group', { name: '보조근' }).getByLabel('햄스트링').uncheck();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.locator('.guide')).toContainText('아직 가이드가 없어요');
  });

  test('G7: 노트는 다른 기기에도 동기화된다', async ({ browser }) => {
    test.setTimeout(60_000);
    const name = `노트 운동 ${Date.now().toString(36)}`;
    const A = await newDevice(browser, 'note-a');
    await A.page.getByRole('button', { name: /자유운동/ }).click();
    await createCustomInSession(A.page, name);
    await A.page.getByRole('button', { name: `${name} 가이드` }).click();
    await sheet(A.page, name).getByRole('button', { name: '가이드 작성' }).click();
    await A.page.getByLabel('자세 요점 (한 줄에 하나)').fill('동기화 확인용 요점');
    await A.page.getByRole('button', { name: '저장', exact: true }).click();
    await expect.poll(() => ((cliExport() as unknown as { guideNotes: { cues: string[] }[] }).guideNotes ?? []).some((n) => n.cues[0] === '동기화 확인용 요점'), { timeout: 15_000 }).toBe(true);
    const B = await newDevice(browser, 'note-b');
    await navTo(B.page, '가이드');
    await B.page.getByLabel('가이드 검색').fill(name);
    await B.page.getByRole('list', { name: '가이드 목록' }).getByRole('button', { name, exact: true }).click();
    await expect(B.page.locator('.guide')).toContainText('동기화 확인용 요점');
    await A.context.close();
    await B.context.close();
  });
});

