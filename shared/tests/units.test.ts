import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeight, fromKg, parseWeightInput, toKg } from '../units.ts';

test('lb → kg 는 kg = lb × 0.45359237, 소수 넷째 자리 반올림', () => {
  assert.equal(toKg(45, 'lb'), 20.4117);
  assert.equal(toKg(100, 'lb'), 45.3592);
  assert.equal(toKg(60, 'kg'), 60);
});

test('표시는 소수 둘째 자리까지, 불필요한 끝자리 0 제거', () => {
  assert.equal(formatWeight(45, 'kg'), '45');
  assert.equal(formatWeight(45.5, 'kg'), '45.5');
  assert.equal(formatWeight(2.25, 'kg'), '2.25');
  assert.equal(formatWeight(toKg(45, 'lb'), 'lb'), '45');
  assert.equal(formatWeight(0, 'kg'), '0');
});

test('SC-006: lb 입력(소수 둘째 자리)이 저장→표시 왕복에서 그대로 보인다', () => {
  for (let c = 1; c <= 220_460; c++) {
    const lb = c / 100;
    assert.equal(formatWeight(toKg(lb, 'lb'), 'lb'), String(lb), `${lb} lb`);
  }
  for (const lb of [45, 45.5, 100.25, 0.01]) assert.equal(formatWeight(toKg(lb, 'lb'), 'lb'), String(lb));
});

test('kg 입력(소수 둘째 자리)도 왕복에서 같다', () => {
  for (let c = 0; c <= 100_000; c += 7) {
    const kg = c / 100;
    assert.equal(formatWeight(toKg(kg, 'kg'), 'kg'), String(kg));
  }
});

test('단위를 바꿔 표시해도 저장된 kg 값은 변하지 않는다', () => {
  const kg = toKg(100.25, 'lb');
  assert.equal(formatWeight(kg, 'lb'), '100.25');
  assert.equal(formatWeight(kg, 'kg'), '45.47');
  assert.equal(formatWeight(kg, 'lb'), '100.25');
  assert.ok(Math.abs(fromKg(kg, 'lb') - 100.25) < 0.001);
});

test('입력 문자열 파싱: 소수 둘째 자리까지, 쉼표 허용', () => {
  assert.equal(parseWeightInput('45'), 45);
  assert.equal(parseWeightInput(' 45.5 '), 45.5);
  assert.equal(parseWeightInput('45,25'), 45.25);
  assert.equal(parseWeightInput('45.123'), null);
  assert.equal(parseWeightInput('-3'), null);
  assert.equal(parseWeightInput(''), null);
  assert.equal(parseWeightInput('abc'), null);
});
