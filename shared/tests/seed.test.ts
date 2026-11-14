import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../seed-exercises.ts';
import { SEED_VERSION, validateRecord } from '../model.ts';
import { merge } from '../merge.ts';

test('기본 종목은 약 40개이고 id 가 중복되지 않는다', () => {
  assert.ok(SEED_EXERCISES.length >= 35 && SEED_EXERCISES.length <= 45);
  assert.equal(new Set(SEED_EXERCISES.map((e) => e.id)).size, SEED_EXERCISES.length);
});

test('모든 기본 종목이 검증을 통과하고 시드 버전을 가진다', () => {
  for (const e of SEED_EXERCISES) {
    assert.deepEqual(validateRecord('exercise', e), [], e.name);
    assert.equal(e.version, SEED_VERSION);
    assert.equal(e.custom, false);
  }
});

test('시드 버전은 어떤 실제 레코드에도 진다 (삭제한 시드가 되살아나지 않는다)', () => {
  const seed = SEED_EXERCISES[0]!;
  const tombstone = { ...seed, deleted: true, version: '001762950896789-000000-dev' };
  assert.equal(merge(tombstone, seed), tombstone);
  assert.equal(merge(seed, tombstone), tombstone);
});

test('모든 부위(가슴·등·어깨·하체·팔·코어·유산소)에 종목이 있다', () => {
  const parts = new Set(SEED_EXERCISES.map((e) => e.bodyPart));
  for (const p of ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio']) assert.ok(parts.has(p as never), p);
});
