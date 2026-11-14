import { test, expect } from '@playwright/test';
import { navTo, openApp } from './helpers.ts';

const theme = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('기능 3 US6: 어두운 화면', () => {
  test('F14: 처음엔 어둡고, 설정에서 밝게·시스템으로 바꾸면 즉시 반영되고 유지된다', async ({ page }) => {
    await openApp(page, '#/routines');
    expect(await theme(page)).toBe('dark');
    expect(await bg(page)).toBe('rgb(15, 15, 16)');
    await navTo(page, '설정');
    await page.getByRole('radio', { name: '밝게' }).check();
    expect(await theme(page)).toBe('light');
    expect(await bg(page)).toBe('rgb(246, 246, 247)');
    await page.reload();
    expect(await theme(page)).toBe('light');
    await expect(page.getByRole('radio', { name: '밝게' })).toBeChecked();
    await page.getByRole('radio', { name: '시스템 설정 따르기' }).check();
    expect(await theme(page)).toBeNull();
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await bg(page)).toBe('rgb(15, 15, 16)');
  });
});
