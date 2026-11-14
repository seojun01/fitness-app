import { test, expect, type Page } from '@playwright/test';
import { cliExport, createCustomInPicker, createRoutineViaUi, newDevice, openApp, picker, pickerMenu, row } from './helpers.ts';

const group = (page: Page, label: '분류' | '근육 부위' | '장비') => picker(page).getByRole('group', { name: label });
const names = (page: Page) => picker(page).getByRole('list', { name: '종목 목록' }).locator('.list-item-title').allInnerTexts();

test.describe('기능 5: 종목 선택', () => {
  test('P1: 여러 종목을 골라 "+ 3 운동 추가" 하면 고른 순서대로 들어간다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByLabel('루틴 이름').fill('여러 개');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    const d = picker(page);
    await expect(d.getByRole('button', { name: /^\+ \d+ 운동 추가$/ })).toBeHidden();
    for (const n of ['스쿼트', '벤치 프레스', '풀업']) await d.getByRole('button', { name: n, exact: true }).click();
    await expect(d.getByRole('button', { name: '벤치 프레스', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await d.getByRole('button', { name: '+ 3 운동 추가' }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole('list', { name: '루틴 종목' }).locator('.list-item-title')).toHaveText(['스쿼트', '벤치 프레스', '풀업']);
  });

  test('P2: 다시 누르면 선택 해제, ↺ 로 초기화, 닫기는 아무것도 추가하지 않는다', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    const d = picker(page);
    await d.getByRole('button', { name: '딥스', exact: true }).click();
    await d.getByRole('button', { name: '딥스', exact: true }).click();
    await expect(d.getByRole('button', { name: /^\+ \d+ 운동 추가$/ })).toBeHidden();
    await d.getByRole('button', { name: '딥스', exact: true }).click();
    await d.getByRole('button', { name: '플랭크', exact: true }).click();
    await d.getByRole('button', { name: '선택 초기화' }).click();
    await expect(d.getByRole('button', { name: /^\+ \d+ 운동 추가$/ })).toBeHidden();
    await d.getByRole('button', { name: '딥스', exact: true }).click();
    await d.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByText('아직 종목이 없어요')).toBeVisible();
  });

  test('P3: 진행 화면 "+" 로 2개를 추가하면 추가된 첫 종목으로 간다', async ({ page }) => {
    await createRoutineViaUi(page, '하나', ['스쿼트']);
    await row(page, '하나').getByRole('button', { name: '하나 시작' }).click();
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await picker(page).getByRole('button', { name: '레그 컬', exact: true }).click();
    await picker(page).getByRole('button', { name: '레그 익스텐션', exact: true }).click();
    await picker(page).getByRole('button', { name: '+ 2 운동 추가' }).click();
    await expect(page.locator('.entry-title-lg')).toHaveText('레그 컬');
    await expect(page.getByRole('navigation', { name: '종목 진행' }).getByRole('button')).toHaveCount(3);
  });

  test('P4: 근육 부위 × 장비 × 검색 조합, 태그와 장비 표시', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await group(page, '근육 부위').getByRole('button', { name: '이두' }).click();
    await group(page, '장비').getByRole('button', { name: '케이블' }).click();
    const cableBiceps = await names(page);
    expect(cableBiceps).toContain('케이블 컬');
    expect(cableBiceps).toContain('랫 풀다운'); // 이두가 보조근인 종목도 포함 (FR-004)
    await picker(page).getByLabel('종목 검색').fill('컬');
    expect(await names(page)).toEqual(['케이블 컬']);
    await picker(page).getByLabel('종목 검색').fill('');
    await group(page, '장비').getByRole('button', { name: '전체' }).click();
    await picker(page).getByLabel('종목 검색').fill('컬');
    const curls = await names(page);
    expect(curls).toContain('바벨 컬');
    expect(curls).toContain('해머 컬');
    expect(curls).not.toContain('레그 컬'); // 이두 필터
    await group(page, '근육 부위').getByRole('button', { name: '전체' }).click();
    await picker(page).getByLabel('종목 검색').fill('랫 풀다운');
    await expect(picker(page).locator('.picker-row').first()).toContainText('등, 이두 · 케이블');
    await group(page, '장비').getByRole('button', { name: '스미스머신' }).click();
    await picker(page).getByLabel('종목 검색').fill('');
    expect((await names(page)).every((n) => n.startsWith('스미스 머신'))).toBe(true);
  });

  test('P5: 좋아하는·자주하는·최근·커스텀 분류', async ({ page }) => {
    await createRoutineViaUi(page, '기록용', ['데드리프트']);
    await row(page, '기록용').getByRole('button', { name: '기록용 시작' }).click();
    await page.getByLabel('데드리프트 1세트 무게').fill('100');
    await page.getByLabel('데드리프트 1세트 횟수').fill('5');
    await page.getByRole('button', { name: '데드리프트 1세트 완료', exact: true }).click();
    await page.getByRole('button', { name: '세션 종료' }).click();
    await page.getByRole('button', { name: '확인' }).click();
    await page.goto('/#/routines/new');
    await expect(page.getByRole('heading', { name: '새 루틴', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await group(page, '분류').getByRole('button', { name: '좋아하는' }).click();
    await expect(picker(page).getByText('맞는 종목이 없어요')).toBeVisible();
    await group(page, '분류').getByRole('button', { name: '전체' }).click();
    await picker(page).getByRole('button', { name: '스쿼트 좋아요', exact: true }).click();
    await expect(picker(page).getByRole('button', { name: '스쿼트 좋아요', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await group(page, '분류').getByRole('button', { name: '좋아하는' }).click();
    expect(await names(page)).toEqual(['스쿼트']);
    await group(page, '분류').getByRole('button', { name: '자주하는' }).click();
    expect(await names(page)).toEqual(['데드리프트']);
    await group(page, '분류').getByRole('button', { name: '최근' }).click();
    expect(await names(page)).toEqual(['데드리프트']);
    await group(page, '분류').getByRole('button', { name: '커스텀' }).click();
    await expect(picker(page).getByText('맞는 종목이 없어요')).toBeVisible();
    await createCustomInPicker(page, '내 밴드 운동', 'shoulders');
    await group(page, '분류').getByRole('button', { name: '커스텀' }).click();
    expect(await names(page)).toEqual(['내 밴드 운동']);
    await expect(picker(page).getByRole('button', { name: '내 밴드 운동', exact: true })).toHaveAttribute('aria-pressed', 'true'); // 만든 종목은 선택됨
  });

  test('P6·P7: ⋯ 메뉴(가이드·이력·이름 수정·삭제 되돌리기), 커스텀 운동 이름 검증', async ({ page }) => {
    await openApp(page, '#/routines/new');
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await pickerMenu(page, '아놀드 프레스', '가이드');
    await expect(page.getByRole('dialog', { name: '아놀드 프레스' })).toContainText('자세 요점');
    await page.getByRole('dialog', { name: '아놀드 프레스' }).getByRole('button', { name: '닫기' }).click();
    await pickerMenu(page, '덤벨 킥백', '삭제');
    await expect(picker(page).getByRole('button', { name: '덤벨 킥백', exact: true })).toHaveCount(0);
    await picker(page).getByRole('button', { name: '되돌리기' }).click(); // 토스트는 열린 모달 안에 뜬다
    await expect(picker(page).getByRole('button', { name: '덤벨 킥백', exact: true })).toBeVisible();
    await picker(page).getByRole('button', { name: '새 종목 만들기' }).click();
    const form = page.getByRole('dialog', { name: '커스텀 운동 추가' });
    await form.getByRole('button', { name: '만들기' }).click();
    await expect(form.getByRole('alert')).toContainText('이름은 1~60자');
    await form.getByRole('button', { name: '취소' }).click();
    await pickerMenu(page, '바벨 컬', '이력');
    await expect(page.getByRole('heading', { name: '바벨 컬', level: 1 })).toBeVisible();
  });

  test('P9: 좋아요는 다른 기기에도 동기화된다', async ({ browser }) => {
    test.setTimeout(60_000);
    // 서버 DB 를 다른 테스트·프로젝트와 같이 쓰므로, 이번 실행에만 있는 종목으로 확인한다
    const name = `좋아요 운동 ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const A = await newDevice(browser, 'fav-a');
    await A.page.goto('/#/routines/new');
    await A.page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await createCustomInPicker(A.page, name);
    await picker(A.page).getByRole('button', { name: `${name} 좋아요`, exact: true }).click();
    await expect(picker(A.page).getByRole('button', { name: `${name} 좋아요`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => (cliExport().exercises as { name: string; favorite?: boolean }[]).some((e) => e.name === name && e.favorite), { timeout: 15_000 }).toBe(true);
    const B = await newDevice(browser, 'fav-b');
    await B.page.goto('/#/routines/new');
    await expect(B.page.getByRole('heading', { name: '새 루틴', level: 1 })).toBeVisible();
    await B.page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await expect(picker(B.page).getByRole('button', { name: `${name} 좋아요`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await A.context.close();
    await B.context.close();
  });
});
