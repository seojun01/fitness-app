import { test, expect, type Page } from '@playwright/test';
import { createRoutineViaUi, row } from './helpers.ts';

/** 진행 화면 본문에서 손가락으로 민 것처럼 pointer 이벤트를 보낸다 (from 위치의 요소에서 시작) */
async function swipe(page: Page, dx: number, opts: { dy?: number; from?: string } = {}): Promise<void> {
  await page.evaluate(
    ({ dx, dy, from }) => {
      const host = document.querySelector<HTMLElement>('.entry-page')!;
      const target = (from ? document.querySelector<HTMLElement>(from) : host.querySelector<HTMLElement>('.entry-head'))!;
      const r = target.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (type: string, cx: number, cy: number) => new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: cx, clientY: cy, isPrimary: true });
      target.dispatchEvent(ev('pointerdown', x, y));
      target.dispatchEvent(ev('pointerup', x + dx, y + dy));
    },
    { dx, dy: opts.dy ?? 0, from: opts.from },
  );
}
const title = (page: Page) => page.locator('.entry-page h2').first();

test.describe('진행 화면: 스와이프·한 줄 상단 바·운동 변경', () => {
  test.beforeEach(async ({ page }) => {
    await createRoutineViaUi(page, '스와이프 루틴', ['벤치 프레스', '스쿼트', '풀업']);
    await row(page, '스와이프 루틴').getByRole('button', { name: '스와이프 루틴 시작' }).click();
    await expect(title(page)).toHaveText('벤치 프레스');
  });

  test('왼쪽으로 밀면 다음 운동, 오른쪽으로 밀면 이전 운동. 끝에서는 그대로, 짧거나 세로로 민 것·입력 칸에서 시작한 것은 무시', async ({ page }) => {
    await swipe(page, 120);
    await expect(title(page)).toHaveText('벤치 프레스'); // 처음에서 오른쪽: 그대로
    await swipe(page, -120);
    await expect(title(page)).toHaveText('스쿼트');
    await expect(page).toHaveURL(/#\/session\/1$/);
    await swipe(page, -30); // 너무 짧다
    await swipe(page, -80, { dy: 200 }); // 세로 스크롤
    await swipe(page, -120, { from: 'input[aria-label="스쿼트 1세트 무게"]' }); // 입력 칸에서 시작
    await expect(title(page)).toHaveText('스쿼트');
    await swipe(page, -120);
    await expect(title(page)).toHaveText('풀업');
    await swipe(page, -120);
    await expect(title(page)).toHaveText('풀업'); // 마지막에서 왼쪽: 그대로
    await swipe(page, 120);
    await expect(title(page)).toHaveText('스쿼트');
    await expect(page.getByRole('navigation', { name: '종목 진행' }).getByRole('button', { name: /2번째 종목: 스쿼트/ })).toHaveAttribute('aria-current', 'step');
  });

  test('상단 바는 한 줄: 뒤로·경과 시간·진행 점·종목 추가·종료, 앱 상단 바는 숨긴다', async ({ page }) => {
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.getByRole('heading', { name: '운동 중', level: 1 })).toBeAttached();
    const head = page.locator('.session-head');
    const box = (await head.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(56);
    for (const loc of [head.getByRole('link', { name: '뒤로' }), head.getByLabel('경과 시간'), head.getByRole('button', { name: '종목 추가' }), head.getByRole('button', { name: '세션 종료' })]) {
      const b = (await loc.boundingBox())!;
      expect(Math.abs(b.y + b.height / 2 - (box.y + box.height / 2))).toBeLessThan(8); // 같은 줄
    }
    await head.getByRole('link', { name: '뒤로' }).click();
    await expect(page.getByRole('heading', { name: '루틴', level: 1 })).toBeVisible();
  });

  test('⋯ → 다른 운동으로 변경: 고른 운동으로 바뀌고 세트 수·자리는 그대로, 완료한 세트가 있으면 먼저 확인', async ({ page }) => {
    // 세트가 비어 있으면 바로 고른다
    await page.getByRole('button', { name: '벤치 프레스 더보기' }).click();
    await page.getByRole('button', { name: '다른 운동으로 변경' }).click();
    const picker = page.getByRole('dialog', { name: '변경할 종목 선택' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button', { name: '벤치 프레스', exact: true })).toHaveCount(0); // 지금 종목은 목록에서 뺀다
    await picker.getByRole('searchbox', { name: '종목 검색' }).fill('인클라인 덤벨');
    await picker.getByRole('button', { name: '인클라인 덤벨 프레스', exact: true }).click();
    await picker.getByRole('button', { name: '이 운동으로 변경' }).click();
    await expect(title(page)).toHaveText('인클라인 덤벨 프레스');
    await expect(page.getByLabel(/인클라인 덤벨 프레스 \d세트 무게/)).toHaveCount(3);
    await expect(page).toHaveURL(/#\/session$|#\/session\/0$/);

    // 완료한 세트가 있으면 확인 → 취소하면 그대로
    await page.getByLabel('인클라인 덤벨 프레스 1세트 무게').fill('20');
    await page.getByLabel('인클라인 덤벨 프레스 1세트 횟수').fill('10');
    await page.getByRole('button', { name: '인클라인 덤벨 프레스 1세트 완료', exact: true }).click();
    await expect(page.getByRole('button', { name: '인클라인 덤벨 프레스 1세트 완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '인클라인 덤벨 프레스 더보기' }).click();
    await page.getByRole('button', { name: '다른 운동으로 변경' }).click();
    const confirm = page.getByRole('dialog', { name: '다른 운동으로 변경할까요?' });
    await expect(confirm).toContainText('완료한 1세트');
    await confirm.getByRole('button', { name: '취소' }).click();
    await expect(title(page)).toHaveText('인클라인 덤벨 프레스');
    await expect(page.getByLabel('인클라인 덤벨 프레스 1세트 무게')).toHaveValue('20');

    // 확인 → 변경 → 완료 표시는 지워진다
    await page.getByRole('button', { name: '인클라인 덤벨 프레스 더보기' }).click();
    await page.getByRole('button', { name: '다른 운동으로 변경' }).click();
    await page.getByRole('dialog', { name: '다른 운동으로 변경할까요?' }).getByRole('button', { name: '변경' }).click();
    await page.getByRole('dialog', { name: '변경할 종목 선택' }).getByRole('button', { name: '딥스', exact: true }).click();
    await page.getByRole('dialog', { name: '변경할 종목 선택' }).getByRole('button', { name: '이 운동으로 변경' }).click();
    await expect(title(page)).toHaveText('딥스');
    await expect(page.getByRole('button', { name: '딥스 1세트 완료', exact: true })).toHaveAttribute('aria-pressed', 'false');
    // 다음 운동은 그대로
    await swipe(page, -120);
    await expect(title(page)).toHaveText('스쿼트');
  });
});
