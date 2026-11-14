import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLES, MUSCLE_IDS, isMuscleId, muscleNames } from '../muscles.ts';

test('근육 17종이 모두 한국어 이름을 가진다', () => {
  assert.deepEqual([...MUSCLE_IDS].sort(), ['abs', 'biceps', 'calves', 'erectors', 'forearms', 'frontDelts', 'glutes', 'hamstrings', 'lats', 'obliques', 'pectorals', 'quads', 'rearDelts', 'rhomboids', 'sideDelts', 'traps', 'triceps'].sort());
  for (const id of MUSCLE_IDS) assert.match(MUSCLES[id], /^[가-힣 ]+$/, id);
});

test('isMuscleId 는 목록 밖의 값과 프로토타입 속성을 거부한다', () => {
  assert.equal(isMuscleId('quads'), true);
  assert.equal(isMuscleId('neck'), false);
  assert.equal(isMuscleId('toString'), false);
  assert.equal(isMuscleId(3), false);
});

test('muscleNames 는 한국어 이름을 쉼표로 잇는다', () => {
  assert.equal(muscleNames(['pectorals', 'triceps']), '대흉근, 삼두근');
  assert.equal(muscleNames([]), '');
});
