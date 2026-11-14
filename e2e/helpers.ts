import { execFileSync } from 'node:child_process';
import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

/** 앱을 열고 주 메뉴가 보일 때까지 기다린다 */
export async function openApp(page: Page, hash = ''): Promise<void> {
  await page.goto('/' + hash);
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
}

export async function navTo(page: Page, name: string): Promise<void> {
  const link = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}

/** 제목으로 목록의 한 줄을 찾는다 */
export function row(page: Page, text: string): Locator {
  return page.getByRole('listitem').filter({ hasText: text });
}

/** 종목 선택 화면 (기능 5: 전체 화면, 여러 개 선택 후 "+ N 운동 추가") */
export const picker = (page: Page): Locator => page.getByRole('dialog', { name: '종목 선택' });

/** 열려 있는 종목 선택에서 이름으로 종목들을 고르고 "+ N 운동 추가"를 누른다 */
export async function pickInPicker(page: Page, names: string[]): Promise<void> {
  const d = picker(page);
  await expect(d).toBeVisible();
  for (const name of names) await d.getByRole('button', { name, exact: true }).click();
  await d.getByRole('button', { name: `+ ${names.length} 운동 추가` }).click();
  await expect(d).toBeHidden();
}

/** 루틴 편집·진행 화면에서 종목 선택을 열어 이름으로 종목을 추가한다 */
export async function addExerciseByName(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '종목 추가', exact: true }).click();
  await pickInPicker(page, [name]);
}

/** 열려 있는 종목 선택에서 커스텀 운동을 만든다 (만든 종목은 선택된 상태가 된다) */
export async function createCustomInPicker(page: Page, name: string, bodyPart?: string): Promise<void> {
  await picker(page).getByRole('button', { name: '⊕ 커스텀 운동 추가' }).click();
  const form = page.getByRole('dialog', { name: '커스텀 운동 추가' });
  await form.getByLabel('종목 이름').fill(name);
  if (bodyPart) await form.getByLabel('부위').selectOption(bodyPart);
  await form.getByRole('button', { name: '만들기' }).click();
  await expect(form).toBeHidden();
}

/** 종목 선택의 종목 더보기(⋯) 메뉴에서 항목을 고른다 */
export async function pickerMenu(page: Page, name: string, action: '가이드' | '이력' | '이름 수정' | '삭제'): Promise<void> {
  await picker(page).getByRole('button', { name: `${name} 더보기`, exact: true }).click();
  await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: action, exact: true }).click();
}

/** 새 루틴을 만들어 저장한다 */
export async function createRoutineViaUi(page: Page, name: string, exercises: string[]): Promise<void> {
  await openApp(page, '#/routines');
  await page.getByRole('button', { name: /^\+ 추가$|첫 루틴 만들기/ }).first().click();
  await page.getByLabel('루틴 이름').fill(name);
  for (const ex of exercises) await addExerciseByName(page, ex);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '루틴', level: 1, exact: true })).toBeVisible();
  await expect(row(page, name)).toBeVisible();
}

/** 메인의 루틴 카드에서 상세를 연다 */
export async function openRoutine(page: Page, name: string): Promise<void> {
  await row(page, name).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1, exact: true })).toBeVisible();
}

/** 루틴 카드의 더보기(⋯)에서 편집·복제·삭제를 고른다 */
export async function routineAction(page: Page, name: string, action: '편집' | '복제' | '삭제'): Promise<void> {
  await row(page, name).getByRole('button', { name: `${name} 더보기` }).click();
  await page.getByRole('dialog', { name }).getByRole('button', { name: action, exact: true }).click();
}

/** 루틴 편집 화면을 연다 (카드 → 더보기 → 편집) */
export async function openRoutineEditor(page: Page, name: string): Promise<void> {
  await routineAction(page, name, '편집');
  await expect(page.getByRole('heading', { name: '루틴 편집', level: 1 })).toBeVisible();
}

/** 진행 화면에서 루틴 없이 시작 */
export async function startFreeWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /자유운동/ }).click();
  await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeVisible();
}

/** 진행 화면 세트 행의 더보기(⋯)에서 그 세트를 지운다 */
export async function deleteSetViaMenu(page: Page, exercise: string, n: number): Promise<void> {
  await page.getByRole('button', { name: `${exercise} ${n}세트 더보기` }).click();
  await page.getByRole('dialog', { name: `${n}세트` }).getByRole('button', { name: '이 세트 삭제' }).click();
}

/** 서버 CLI 로 페어링 코드를 발급한다 (e2e 서버와 같은 DB 를 쓴다) */
export function cliPair(name: string): string {
  const out = execFileSync(process.execPath, ['--no-warnings', 'server/src/admin-cli.ts', 'pair', '--name', name], {
    env: { ...process.env, FITNESS_DB: process.env.E2E_DB! },
    encoding: 'utf8',
  });
  const m = /페어링 코드: (\S+)/.exec(out);
  if (!m) throw new Error(`페어링 코드를 읽을 수 없어요: ${out}`);
  return m[1]!;
}

export function cliRevoke(deviceId: string): void {
  execFileSync(process.execPath, ['--no-warnings', 'server/src/admin-cli.ts', 'revoke', deviceId], { env: { ...process.env, FITNESS_DB: process.env.E2E_DB! }, encoding: 'utf8' });
}

export function cliExport(): { exercises: unknown[]; routines: unknown[]; sessions: { id: string; entries: unknown[] }[]; settings: unknown } {
  const out = execFileSync(process.execPath, ['--no-warnings', 'server/src/admin-cli.ts', 'export'], { env: { ...process.env, FITNESS_DB: process.env.E2E_DB! }, encoding: 'utf8' });
  return JSON.parse(out);
}

/** 상태 표시줄 (동기화됨 / 대기 중 / 연결 안 됨 / 등록 안내) */
export function syncStatus(page: Page): Locator {
  return page.locator('.sync-status');
}

/** 설정 화면에서 페어링 코드를 입력해 이 기기를 등록한다 */
export async function pairThisDevice(page: Page, name: string): Promise<void> {
  await page.goto('/#/pair');
  await page.getByLabel('페어링 코드').fill(cliPair(name));
  await page.getByRole('button', { name: '등록', exact: true }).click();
  // 등록이 끝나면 앱이 설정 화면으로 이동한다. 그 이동까지 기다려야 다음 화면 이동과 겹치지 않는다
  await expect(page.getByRole('heading', { name: '설정', level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(syncStatus(page)).toContainText('동기화됨', { timeout: 15_000 });
}

/** 새 브라우저 컨텍스트(= 새 기기)를 만들어 열고 선택적으로 등록한다 */
export async function newDevice(browser: Browser, name: string, opts: { pair?: boolean } = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await context.newPage();
  await openApp(page);
  if (opts.pair !== false) await pairThisDevice(page, name);
  await page.goto('/#/routines');
  return { context, page };
}

/** 이 기기의 deviceId (IndexedDB meta) */
export async function deviceIdOf(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('fitness');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const q = open.result.transaction('meta').objectStore('meta').get('deviceId');
          q.onsuccess = () => resolve(q.result as string);
          q.onerror = () => reject(q.error);
        };
      }),
  );
}
