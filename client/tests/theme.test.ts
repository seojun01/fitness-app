import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, readTheme, type ThemeStorage } from '../src/theme.ts';

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    el: { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) },
    attrs,
  };
}
const mem = (init?: string): ThemeStorage & { v?: string } => {
  const s = { v: init, get: () => s.v ?? null, set: (x: string) => void (s.v = x) };
  return s;
};

test('저장값이 없으면 어둡게', () => {
  assert.equal(readTheme(mem()), 'dark');
  const r = fakeRoot();
  applyTheme(readTheme(mem()), r.el);
  assert.equal(r.attrs.get('data-theme'), 'dark');
});

test('밝게는 data-theme=light, 시스템은 속성을 뺀다', () => {
  const r = fakeRoot();
  applyTheme('light', r.el);
  assert.equal(r.attrs.get('data-theme'), 'light');
  applyTheme('system', r.el);
  assert.equal(r.attrs.has('data-theme'), false);
});

test('잘못된 저장값·저장소 예외에도 기본값', () => {
  assert.equal(readTheme(mem('purple')), 'dark');
  assert.equal(readTheme({ get: () => { throw new Error('막힘'); }, set: () => {} }), 'dark');
  assert.equal(readTheme(mem('system')), 'system');
});
