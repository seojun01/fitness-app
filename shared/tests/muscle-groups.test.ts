import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLE_IDS } from '../muscles.ts';
import { GROUP_LABEL, MUSCLE_GROUPS, groupOf, groupsFromBodyPart, groupsFromMuscles } from '../muscle-groups.ts';

test('근육 부위 그룹 12개가 근육 17종을 빠짐없이, 겹침 없이 나눈다', () => {
  assert.deepEqual(MUSCLE_GROUPS, ['chest', 'back', 'shoulders', 'triceps', 'biceps', 'forearms', 'abs', 'glutes', 'hamstrings', 'quads', 'traps', 'calves']);
  for (const m of MUSCLE_IDS) assert.ok(MUSCLE_GROUPS.includes(groupOf(m)), m);
  assert.equal(groupOf('lats'), 'back');
  assert.equal(groupOf('erectors'), 'back');
  assert.equal(groupOf('obliques'), 'abs');
  assert.equal(groupOf('rearDelts'), 'shoulders');
  for (const g of MUSCLE_GROUPS) assert.match(GROUP_LABEL[g], /^[가-힣]+$/);
});

test('groupsFromMuscles: 주동근 → 보조근 순서, 중복 없음', () => {
  assert.deepEqual(groupsFromMuscles(['lats'], ['biceps', 'rhomboids', 'rearDelts']), ['back', 'biceps', 'shoulders']);
  assert.deepEqual(groupsFromMuscles(['pectorals'], ['frontDelts', 'triceps']), ['chest', 'shoulders', 'triceps']);
  assert.deepEqual(groupsFromMuscles([], []), []);
});

test('groupsFromBodyPart: 직접 만든 종목의 기본 그룹', () => {
  assert.deepEqual(groupsFromBodyPart('legs'), ['quads', 'glutes', 'hamstrings', 'calves']);
  assert.deepEqual(groupsFromBodyPart('arms'), ['biceps', 'triceps', 'forearms']);
  assert.deepEqual(groupsFromBodyPart('core'), ['abs']);
  assert.deepEqual(groupsFromBodyPart('chest'), ['chest']);
  assert.deepEqual(groupsFromBodyPart('cardio'), []);
  assert.deepEqual(groupsFromBodyPart('other'), []);
});
