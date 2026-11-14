import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../seed-exercises.ts';
import { getBuiltinGuide, listBuiltinGuides } from '../guides.ts';
import { isMuscleId } from '../muscles.ts';

test('기본 종목 35개 전부에 가이드가 정확히 하나씩 있다', () => {
  const guides = listBuiltinGuides();
  assert.equal(guides.length, SEED_EXERCISES.length);
  assert.equal(new Set(guides.map((g) => g.exerciseId)).size, guides.length);
  for (const e of SEED_EXERCISES) assert.ok(getBuiltinGuide(e.id), e.name);
  assert.equal(getBuiltinGuide(crypto.randomUUID()), undefined);
});

test('요점 3~5개, 실수 2~4개, 각 1~200자, 주동근 1~3개, 보조근 0~4개, 목록 안·겹침·중복 없음', () => {
  for (const g of listBuiltinGuides()) {
    const name = SEED_EXERCISES.find((e) => e.id === g.exerciseId)!.name;
    assert.ok(g.cues.length >= 3 && g.cues.length <= 5, `${name} 요점 ${g.cues.length}`);
    assert.ok(g.mistakes.length >= 2 && g.mistakes.length <= 4, `${name} 실수 ${g.mistakes.length}`);
    for (const t of [...g.cues, ...g.mistakes]) assert.ok(t.trim().length >= 1 && [...t].length <= 200 && t === t.trim(), `${name}: "${t}"`);
    assert.ok(g.primaryMuscles.length >= 1 && g.primaryMuscles.length <= 3, `${name} 주동근`);
    assert.ok(g.secondaryMuscles.length <= 4, `${name} 보조근`);
    for (const m of [...g.primaryMuscles, ...g.secondaryMuscles]) assert.ok(isMuscleId(m), `${name}: ${m}`);
    assert.equal(new Set(g.primaryMuscles).size, g.primaryMuscles.length, name);
    assert.equal(new Set(g.secondaryMuscles).size, g.secondaryMuscles.length, name);
    assert.ok(!g.secondaryMuscles.some((m) => g.primaryMuscles.includes(m)), `${name}: 주동근·보조근 겹침`);
  }
});
