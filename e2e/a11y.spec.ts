import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { addExerciseByName, createRoutineViaUi, navTo, openApp, row } from './helpers.ts';

/** axe 위반 0, 가로 스크롤 없음, 터치 영역 44px 이상 (헌법 I·IV, quickstart V15) */
async function audit(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(150); // 화면 전환이 끝나길 기다린다
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, `${label}: axe 위반`).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: 가로 스크롤`).toBeLessThanOrEqual(0);

  const small = await page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('button, a[href], select, summary, input:not([type="hidden"])');
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      let box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // 라디오·체크박스는 감싸는 label 전체가 눌리는 영역이다
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) box = (el.closest('label') ?? el).getBoundingClientRect();
      if (box.width < 44 - 0.5 || box.height < 44 - 0.5) out.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20)}] ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    return out;
  });
  expect(small, `${label}: 터치 영역이 44px 미만`).toEqual([]);
}

test.describe('접근성·반응형 (WCAG 2.1 AA, 320px)', () => {
  test('모든 화면의 axe 위반 0, 가로 스크롤 없음, 터치 영역 44px 이상', async ({ page }) => {
    // 빈 상태
    await openApp(page, '#/routines');
    await audit(page, '루틴 목록(빈 상태)');
    await navTo(page, '기록');
    await audit(page, '기록 목록(빈 상태)');
    await navTo(page, '설정');
    await audit(page, '설정');
    await page.goto('/#/pair');
    await audit(page, '홈서버 연결');

    // 루틴 편집 + 종목 선택
    await page.goto('/#/routines/new');
    await audit(page, '새 루틴');
    await page.getByLabel('루틴 이름').fill('접근성 루틴');
    await addExerciseByName(page, '벤치 프레스');
    await addExerciseByName(page, '푸시업');
    await audit(page, '루틴 편집(종목 있음)');
    await page.getByRole('button', { name: '종목 추가' }).click();
    await expect(page.getByRole('dialog', { name: '종목 선택' })).toBeVisible();
    await audit(page, '종목 선택');
    await page.getByRole('dialog', { name: '종목 선택' }).getByText('직접 종목 만들기').click();
    await audit(page, '종목 선택(직접 만들기 펼침)');
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '닫기' }).click();
    await page.getByRole('button', { name: '저장', exact: true }).click();

    // 목록(루틴 있음), 세션 진행, 요약
    await expect(row(page, '접근성 루틴')).toBeVisible();
    await audit(page, '루틴 목록');
    await row(page, '접근성 루틴').getByRole('button', { name: '접근성 루틴 시작' }).click();
    await page.getByLabel('벤치 프레스 1세트 무게').fill('60');
    await page.getByLabel('벤치 프레스 1세트 횟수').fill('10');
    await page.getByRole('button', { name: '벤치 프레스 1세트 완료', exact: true }).click();
    await page.getByLabel('벤치 프레스 2세트 횟수').fill('0'); // 검증 오류 안내도 점검
    await expect(page.getByRole('alert').filter({ hasText: '횟수는' })).toBeVisible();
    await audit(page, '세션 진행(검증 오류 포함)');
    await page.getByLabel('벤치 프레스 2세트 횟수').fill('');
    await page.getByRole('button', { name: '세션 종료' }).click();
    await expect(page.getByRole('heading', { name: '운동 요약', level: 1 })).toBeVisible();
    await audit(page, '운동 요약');
    await page.getByRole('button', { name: '확인' }).click();

    // 기록
    await navTo(page, '기록');
    await audit(page, '기록 목록');
    await page.getByRole('list', { name: '운동 기록' }).getByRole('listitem').first().getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: '기록 상세', level: 1 })).toBeVisible();
    await audit(page, '기록 상세');
    await page.getByRole('link', { name: '벤치 프레스 이력' }).click();
    await expect(page.getByRole('heading', { name: '벤치 프레스', level: 1 })).toBeVisible();
    await audit(page, '종목 이력');
  });

  test('동기화 상태·검증 오류는 aria-live 영역으로 안내된다', async ({ page }) => {
    await openApp(page, '#/routines');
    await expect(page.locator('.sync-status')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.sync-status')).toHaveAttribute('role', 'status');
    await page.goto('/#/routines/new');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('이름은 1~60자'); // role=alert 는 암묵적으로 aria-live=assertive
  });

  test('색에만 의존하지 않는다: 완료된 세트는 체크 표시와 aria-pressed 로도 구분된다', async ({ page }) => {
    await createRoutineViaUi(page, '색 루틴', ['스쿼트']);
    await row(page, '색 루틴').getByRole('button', { name: '색 루틴 시작' }).click();
    const done = page.getByRole('button', { name: '스쿼트 1세트 완료', exact: true });
    await expect(done).toHaveText('✓');
    await expect(done).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('접근성: 기능 3 화면 (어두운·밝은 테마 모두)', () => {
  for (const mode of ['dark', 'light'] as const) {
    test(`${mode}: 루틴 상세, 진행 화면(기록·메모 펼침, 휴식 타이머 진행 중), 설정`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem('fitness.theme', m), mode);
      await createRoutineViaUi(page, '접근성 B', ['데드리프트', '풀업']);
      await row(page, '접근성 B').getByRole('button', { name: '접근성 B', exact: true }).click();
      await audit(page, `${mode} 루틴 상세`);
      await page.getByRole('button', { name: '▶ 시작' }).click();
      await page.getByLabel('데드리프트 1세트 무게').fill('100');
      await page.getByLabel('데드리프트 1세트 횟수').fill('5');
      await page.getByRole('button', { name: '데드리프트 1세트 완료', exact: true }).click();
      await page.locator('summary', { hasText: '메모' }).click();
      await page.locator('summary', { hasText: '기록' }).click();
      await audit(page, `${mode} 진행 화면`);
      await page.getByRole('link', { name: '뒤로' }).click();
      await audit(page, `${mode} 메인(진행 중 배너)`);
      await navTo(page, '설정');
      await audit(page, `${mode} 설정`);
    });
  }
});

test.describe('접근성: 기능 2 가이드 화면 (두 테마)', () => {
  for (const mode of ['dark', 'light'] as const) {
    test(`${mode}: 가이드 탭·가이드 화면·가이드 시트·노트 편집`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem('fitness.theme', m), mode);
      await openApp(page, '#/guides');
      await expect(page.getByRole('list', { name: '가이드 목록' })).toBeVisible();
      await audit(page, `${mode} 가이드 탭`);
      await page.getByRole('list', { name: '가이드 목록' }).getByRole('button', { name: '스쿼트', exact: true }).click();
      await expect(page.locator('.guide ol')).toBeVisible();
      await audit(page, `${mode} 가이드 화면`);
      await createRoutineViaUi(page, '가이드 루틴', ['데드리프트']);
      await row(page, '가이드 루틴').getByRole('button', { name: '가이드 루틴 시작' }).click();
      await page.getByRole('button', { name: '데드리프트 가이드' }).click();
      await expect(page.getByRole('dialog', { name: '데드리프트' }).locator('ol')).toBeVisible();
      await audit(page, `${mode} 가이드 시트`);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '종목 추가', exact: true }).click();
      const picker = page.getByRole('dialog', { name: '종목 선택' });
      await picker.getByText('직접 종목 만들기').click();
      await picker.getByLabel('종목 이름').fill('접근성 종목');
      await picker.getByRole('button', { name: '만들기' }).click();
      await page.getByRole('button', { name: '접근성 종목 가이드' }).click();
      await page.getByRole('dialog', { name: '접근성 종목' }).getByRole('button', { name: '가이드 작성' }).click();
      await expect(page.getByLabel('자세 요점 (한 줄에 하나)')).toBeVisible();
      await audit(page, `${mode} 노트 편집`);
    });
  }
});
