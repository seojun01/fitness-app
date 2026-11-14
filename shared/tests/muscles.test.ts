import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_PARTS } from '../model.ts';
import { BODY_PART_MUSCLES, MUSCLES, MUSCLE_IDS } from '../body/muscles.ts';
import { SEGMENT_IDS } from '../body/skeleton.ts';

test('근육 17종이 한국어 이름, 강조할 뼈 구간, 면(앞/뒤)을 가진다', () => {
  assert.deepEqual([...MUSCLE_IDS].sort(), ['abs', 'biceps', 'calves', 'erectors', 'forearms', 'frontDelts', 'glutes', 'hamstrings', 'lats', 'obliques', 'pectorals', 'quads', 'rearDelts', 'rhomboids', 'sideDelts', 'traps', 'triceps'].sort());
  for (const id of MUSCLE_IDS) {
    const m = MUSCLES[id];
    assert.match(m.name, /[가-힣]/, id);
    assert.ok(m.segments.length > 0, id);
    for (const s of m.segments) assert.ok(SEGMENT_IDS.includes(s), `${id}: 모르는 구간 ${s}`);
    assert.ok(m.face === 'front' || m.face === 'back' || m.face === 'side', id);
  }
});

test('모든 부위에 대표 강조 근육이 있다 (직접 만든 종목의 정지 그림용)', () => {
  for (const part of BODY_PARTS) {
    const list = BODY_PART_MUSCLES[part];
    assert.ok(Array.isArray(list), part);
    for (const m of list) assert.ok(MUSCLE_IDS.includes(m), `${part}: ${m}`);
  }
  assert.ok(BODY_PART_MUSCLES.chest.includes('pectorals'));
  assert.ok(BODY_PART_MUSCLES.legs.includes('quads'));
});
