import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { cliExport, createRoutineViaUi, navTo, newDevice, row, syncStatus } from './helpers.ts';

const uniq = (base: string) => `${base} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function logOne(page: Page, routine: string, ex: string, w: string, r: string): Promise<void> {
  await row(page, routine).getByRole('button', { name: `${routine} 시작` }).click();
  await page.getByLabel(`${ex} 1세트 무게`).fill(w);
  await page.getByLabel(`${ex} 1세트 횟수`).fill(r);
  await page.getByRole('button', { name: `${ex} 1세트 완료`, exact: true }).click();
  await page.getByRole('button', { name: '세션 종료' }).click();
  await page.getByRole('button', { name: '확인' }).click();
}

test.describe('내보내기와 전체 삭제', () => {
  test('V11: 앱 내보내기 파일과 `fitness-admin export` 가 같은 내용이다 (내부 필드 제외)', async ({ browser }) => {
    const name = uniq('내보내기 루틴');
    const { page, context } = await newDevice(browser, 'export-dev');
    await createRoutineViaUi(page, name, ['벤치 프레스']);
    await logOne(page, name, '벤치 프레스', '62.5', '8');
    await expect(syncStatus(page)).toContainText('동기화됨', { timeout: 15_000 });

    await navTo(page, '설정');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '데이터 내보내기' }).click()]);
    const app = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(app.format).toBe('fitness-export');
    expect(app.version).toBe(1);

    const server = cliExport() as typeof app;
    const mine = (x: typeof app) => ({
      routine: x.routines.find((r: { name: string }) => r.name === name),
      session: x.sessions.find((s: { routineName: string }) => s.routineName === name),
    });
    expect(mine(app).routine).toBeTruthy();
    expect(mine(app).session).toBeTruthy();
    expect(mine(server)).toEqual(mine(app)); // 같은 레코드, 같은 필드
    for (const k of ['version', 'updatedBy', 'deleted', 'dirty']) expect(Object.keys(mine(app).routine)).not.toContain(k);
    expect(mine(app).session.entries[0].sets[0]).toMatchObject({ weightKg: 62.5, reps: 8, done: true });
    await context.close();
  });

  test('V12: 전체 삭제하면 앱과 서버에서 내 데이터가 사라진다 (되돌릴 수 없다는 확인 단계 포함)', async ({ browser }) => {
    const name = uniq('지워질 루틴');
    const { page, context } = await newDevice(browser, 'erase-dev');
    await createRoutineViaUi(page, name, ['풀업']);
    await logOne(page, name, '풀업', '0', '10');
    await expect(syncStatus(page)).toContainText('동기화됨', { timeout: 15_000 });
    expect((cliExport().routines as { name: string }[]).some((r) => r.name === name)).toBe(true);

    await navTo(page, '설정');
    await page.getByRole('button', { name: '모든 데이터 삭제' }).click();
    const dialog = page.getByRole('dialog', { name: '모든 데이터를 삭제할까요?' });
    await expect(dialog).toContainText('되돌릴 수 없어요');
    await dialog.getByRole('button', { name: '취소' }).click(); // 취소하면 아무 일도 없다
    await navTo(page, '루틴');
    await expect(row(page, name)).toBeVisible();

    await navTo(page, '설정');
    await page.getByRole('button', { name: '모든 데이터 삭제' }).click();
    await page.getByRole('dialog', { name: '모든 데이터를 삭제할까요?' }).getByRole('button', { name: '모두 삭제' }).click();
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible();
    await navTo(page, '기록');
    await expect(page.getByText('아직 기록이 없어요')).toBeVisible();
    await expect(syncStatus(page)).toContainText('동기화됨', { timeout: 15_000 });

    await expect.poll(() => (cliExport().routines as { name: string }[]).some((r) => r.name === name), { timeout: 15_000 }).toBe(false);
    expect((cliExport().sessions as unknown as { routineName: string }[]).some((s) => s.routineName === name)).toBe(false);
    // 기본 종목은 남아 있어 앱을 계속 쓸 수 있다
    await navTo(page, '루틴');
    await page.getByRole('button', { name: '첫 루틴 만들기' }).click();
    await page.getByRole('button', { name: '종목 추가' }).click();
    await expect(page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '벤치 프레스', exact: true })).toBeVisible();
    await context.close();
  });

  test('페어링하지 않은 기기도 내보내기와 삭제를 쓸 수 있다', async ({ page }) => {
    await createRoutineViaUi(page, '로컬 루틴', []);
    await navTo(page, '설정');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '데이터 내보내기' }).click()]);
    const data = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(data.routines.map((r: { name: string }) => r.name)).toContain('로컬 루틴');
    await page.getByRole('button', { name: '모든 데이터 삭제' }).click();
    await expect(page.getByRole('dialog')).toContainText('이 기기에서 지워져요');
    await page.getByRole('dialog').getByRole('button', { name: '모두 삭제' }).click();
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible();
  });
});
