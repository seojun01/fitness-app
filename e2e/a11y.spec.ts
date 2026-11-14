import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { addExerciseByName, createCustomInPicker, createRoutineViaUi, navTo, openApp, row, seedSessions } from './helpers.ts';

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
      // 진행 점: 종목이 많으면 좁아진다. 같은 이동을 스와이프·"다음 운동" 버튼으로 할 수 있다 (WCAG 2.5.8 대체 수단 예외)
      if (el.classList.contains('dot')) continue;
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
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '⊕ 커스텀 운동 추가' }).click();
    await audit(page, '커스텀 운동 추가');
    await page.getByRole('dialog', { name: '커스텀 운동 추가' }).getByRole('button', { name: '취소' }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '벤치 프레스', exact: true }).click();
    await page.getByRole('dialog', { name: '종목 선택' }).getByRole('group', { name: '장비' }).getByRole('button', { name: '케이블' }).click();
    await audit(page, '종목 선택(필터·선택)');
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
      await createCustomInPicker(page, '접근성 종목');
      await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '+ 1 운동 추가' }).click();
      await page.getByRole('button', { name: '접근성 종목 가이드' }).click();
      await page.getByRole('dialog', { name: '접근성 종목' }).getByRole('button', { name: '가이드 작성' }).click();
      await expect(page.getByLabel('자세 요점 (한 줄에 하나)')).toBeVisible();
      await audit(page, `${mode} 노트 편집`);
    });
  }
});

test.describe('접근성: 기능 4 통계 화면 (두 테마)', () => {
  const BENCH = '5eed0000-0000-4000-8000-000000000001';
  for (const mode of ['dark', 'light'] as const) {
    test(`${mode}: 통계 탭(빈·데이터), 종목 차트, 차트 대화상자, 그날 목록`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem('fitness.theme', m), mode);
      await openApp(page, '#/stats');
      await expect(page.getByText('운동을 기록하면 여기에 통계가 쌓여요')).toBeVisible();
      await audit(page, `${mode} 통계(빈 상태)`);
      const bench = (w: number) => ({ ex: BENCH, name: '벤치 프레스', sets: [[w, 5], [w, 5]] as [number, number][] });
      await seedSessions(page, [{ daysAgo: 0, hour: 7, entries: [bench(60)] }, { daysAgo: 0, hour: 19, entries: [bench(62)] }, { daysAgo: 9, entries: [bench(55)] }]);
      await page.evaluate(() => (location.hash = '#/routines'));
      await page.evaluate(() => (location.hash = '#/stats'));
      await expect(page.getByRole('region', { name: '기간 요약' })).toBeVisible();
      await page.getByRole('region', { name: '부위별 비중' }).getByRole('button', { name: /^가슴/ }).click();
      await page.getByRole('region', { name: '주별 운동' }).getByText('표로 보기').click();
      await page.getByRole('group', { name: '막대 고르기' }).first().focus();
      await page.keyboard.press('End');
      await audit(page, `${mode} 통계(데이터)`);
      await page.getByRole('region', { name: '운동 달력' }).getByRole('button', { name: /운동 2회/ }).click();
      await expect(page.getByRole('list', { name: '이날 운동 기록' })).toBeVisible();
      await audit(page, `${mode} 그날 목록`);
      await page.evaluate((id) => (location.hash = `#/stats/exercise/${id}`), BENCH);
      await page.getByRole('group', { name: '점 고르기' }).focus();
      await page.keyboard.press('End');
      await page.getByText('표로 보기').click();
      await audit(page, `${mode} 종목 차트`);
      await page.getByRole('link', { name: '루틴' }).click();
      await page.getByRole('button', { name: /자유운동/ }).click();
      await page.getByRole('button', { name: '첫 종목 추가' }).click();
      await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '벤치 프레스', exact: true }).click();
      await page.getByRole('dialog', { name: '종목 선택' }).getByRole('button', { name: '+ 1 운동 추가' }).click();
      await page.locator('summary', { hasText: /^기록$/ }).click();
      await page.getByRole('button', { name: '벤치 프레스 차트 보기' }).click();
      await expect(page.getByRole('dialog', { name: '벤치 프레스 차트' }).getByRole('region', { name: '개인 최고 기록' })).toBeVisible();
      await audit(page, `${mode} 차트 대화상자`);
    });
  }
});
