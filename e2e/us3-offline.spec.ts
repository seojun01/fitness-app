import { test, expect, type Page } from '@playwright/test';
import { cliExport, cliRevoke, createRoutineViaUi, deviceIdOf, newDevice, openApp, pairThisDevice, pickInPicker, row, syncStatus } from './helpers.ts';

const weight = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 무게`);
const reps = (page: Page, ex: string, n: number) => page.getByLabel(`${ex} ${n}세트 횟수`);
const check = (page: Page, ex: string, n: number) => page.getByRole('button', { name: `${ex} ${n}세트 완료`, exact: true });

/** 서비스 워커가 앱 셸을 캐시하고 페이지를 제어할 때까지 기다린다 (오프라인에서 새로고침하려면 필요) */
async function ready(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10_000 })
    .toBe(true);
}

const uniq = (base: string) => `${base} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test.describe('US3: 오프라인 보존과 홈서버 동기화', () => {
  test('V7: 네트워크를 끊어도 기록이 되고, 새로고침해도 진행 중 세션이 복원된다', async ({ page, context }) => {
    await openApp(page, '#/routines');
    await ready(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
    await page.getByRole('button', { name: /자유운동/ }).click();
    await page.getByRole('button', { name: '종목 추가', exact: true }).click();
    await pickInPicker(page, ['스쿼트']);
    await weight(page, '스쿼트', 1).fill('100');
    await reps(page, '스쿼트', 1).fill('5');
    await check(page, '스쿼트', 1).click();
    await expect(check(page, '스쿼트', 1)).toHaveAttribute('aria-pressed', 'true');
    await page.reload(); // 오프라인 새로고침
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    await expect(weight(page, '스쿼트', 1)).toHaveValue('100');
    await expect(reps(page, '스쿼트', 1)).toHaveValue('5');
    await expect(check(page, '스쿼트', 1)).toHaveAttribute('aria-pressed', 'true');
    await context.setOffline(false);
  });

  test('V7: 앱을 열었다 닫아도(새 탭) 진행 중 세션이 "이어서 기록"으로 남아 있다', async ({ page, context }) => {
    await openApp(page, '#/routines');
    await page.getByRole('button', { name: /자유운동/ }).click();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    const again = await context.newPage();
    await openApp(again, '#/routines');
    await expect(again.getByRole('button', { name: '이어서 기록' })).toBeVisible();
    await again.close();
  });

  test('V8: 오프라인에서 기록한 세션이 복귀 후 중복·누락 없이 서버에 반영되고 다른 기기에서도 보인다 (SC-007)', async ({ browser }) => {
    const name = uniq('동기화 루틴');
    const A = await newDevice(browser, 'phone');
    const before = cliExport().sessions.length;
    await ready(A.page);
    await createRoutineViaUi(A.page, name, ['벤치 프레스']);
    await expect(syncStatus(A.page)).toContainText('동기화됨', { timeout: 15_000 });

    await A.context.setOffline(true);
    await row(A.page, name).getByRole('button', { name: `${name} 시작` }).click();
    await weight(A.page, '벤치 프레스', 1).fill('80');
    await reps(A.page, '벤치 프레스', 1).fill('6');
    await check(A.page, '벤치 프레스', 1).click();
    await A.page.getByRole('button', { name: '세션 종료' }).click();
    await expect(A.page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
    await expect(syncStatus(A.page)).toContainText('연결 안 됨', { timeout: 15_000 });
    await expect(syncStatus(A.page)).toContainText('대기 중');
    expect(cliExport().sessions.length).toBe(before); // 서버에는 아직 없다

    await A.context.setOffline(false);
    await expect(syncStatus(A.page)).toContainText('동기화됨', { timeout: 30_000 });
    const after = cliExport().sessions;
    expect(after.length).toBe(before + 1); // 중복 없이 정확히 하나
    expect(after.at(-1)!.entries).toHaveLength(1);

    const B = await newDevice(browser, 'pc');
    await expect(row(B.page, name)).toBeVisible({ timeout: 15_000 }); // 다른 기기에서도 같은 데이터
    await B.context.close();
    await A.context.close();
  });

  test('다른 기기가 시작한 진행 중 세션은 "다른 기기에서 진행 중"으로만 보인다', async ({ browser }) => {
    const A = await newDevice(browser, 'phone2');
    // 서버에 이미 있는 다른 테스트의 진행 중 세션과 구분하려고, 이 기기가 시작한 세션을 이름 있는 루틴으로 만든다
    const name = uniq('진행 루틴');
    await createRoutineViaUi(A.page, name, []);
    await row(A.page, name).getByRole('button', { name: `${name} 시작` }).click();
    await expect(A.page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
    // 표시가 "동기화됨"이어도 방금 시작한 세션이 아직 올라가기 전일 수 있으니 서버에서 확인한다
    await expect.poll(() => (cliExport().sessions as unknown as { routineName: string }[]).some((x) => x.routineName === name), { timeout: 15_000 }).toBe(true);
    const B = await newDevice(browser, 'pc2');
    await expect(B.page.getByText(`${name} · 그 기기에서만 고칠 수 있어요`)).toBeVisible({ timeout: 15_000 });
    await expect(B.page.getByRole('button', { name: '이어서 기록' })).toHaveCount(0);
    await B.context.close();
    await A.context.close();
  });

  test('V13: 서버에서 기기를 해제하면 앱이 재연결 안내를 보인다', async ({ browser }) => {
    const A = await newDevice(browser, 'to-revoke');
    const id = await deviceIdOf(A.page);
    cliRevoke(id);
    await createRoutineViaUi(A.page, '해제 뒤 루틴', []);
    await expect(syncStatus(A.page)).toContainText('이 기기의 등록이 해제되었어요', { timeout: 15_000 });
    await expect(syncStatus(A.page).getByRole('link', { name: '다시 등록하기' })).toBeVisible();
    await expect(row(A.page, '해제 뒤 루틴')).toBeVisible(); // 로컬 기록은 그대로다
    await A.context.close();
  });

  test('페어링하지 않아도 앱은 완전히 동작하고, 연결하면 그동안의 기록이 올라간다', async ({ page }) => {
    const name = uniq('연결 전 루틴');
    await createRoutineViaUi(page, name, []);
    await expect(syncStatus(page)).toContainText('이 기기에만 저장 중');
    await pairThisDevice(page, 'late-pair');
    await page.goto('/#/routines');
    await expect(row(page, name)).toBeVisible();
    await expect.poll(() => (cliExport().routines as { name: string }[]).some((r) => r.name === name)).toBe(true);
  });
});
