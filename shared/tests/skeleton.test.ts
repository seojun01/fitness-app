import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOINTS, JOINT_IDS, ROOT, RANGES, HEAD_RADIUS, type JointId } from '../body/skeleton.ts';
import { solve, STANDING } from '../body/pose.ts';

test('관절 17개가 골반을 뿌리로 하는 트리를 이룬다', () => {
  assert.equal(JOINT_IDS.length, 17);
  assert.equal(ROOT, 'pelvis');
  assert.equal(JOINTS.pelvis.parent, null);
  for (const id of JOINT_IDS) {
    // 부모를 따라가면 순환 없이 골반에 닿는다
    const seen = new Set<JointId>();
    let cur: JointId | null = id;
    while (cur) {
      assert.ok(!seen.has(cur), `${id}: 순환`);
      seen.add(cur);
      cur = JOINTS[cur].parent;
    }
    assert.ok(seen.has('pelvis'), id);
  }
  for (const side of ['l', 'r']) for (const j of ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle']) assert.ok(JOINT_IDS.includes(`${side}${j}` as JointId));
  for (const j of ['spine', 'chest', 'neck', 'head']) assert.ok(JOINT_IDS.includes(j as JointId));
});

test('기본 서 있는 자세: 머리 꼭대기 ≈ 1.0, 발목 ≈ 0.04, 좌우 대칭', () => {
  const p = solve(STANDING);
  assert.ok(Math.abs(p.head[1] + HEAD_RADIUS - 1.0) < 0.01, `머리 꼭대기 ${p.head[1] + HEAD_RADIUS}`);
  assert.ok(Math.abs(p.lAnkle[1] - 0.04) < 0.005);
  assert.ok(Math.abs(p.rAnkle[1] - 0.04) < 0.005);
  assert.ok(p.rShoulder[0] > 0 && p.lShoulder[0] < 0, '오른쪽이 +x');
  assert.ok(Math.abs(p.rShoulder[0] + p.lShoulder[0]) < 1e-9);
  assert.ok(p.rToe[2] > p.rAnkle[2], '발끝은 앞(+z)을 향한다');
});

test('관절 가동 범위가 정의되어 있다 (contracts/guide-content.md)', () => {
  assert.deepEqual(RANGES.lKnee.flex, [0, 150]);
  assert.deepEqual(RANGES.rElbow.flex, [0, 150]);
  assert.deepEqual(RANGES.lShoulder.flex, [-60, 180]);
  for (const id of JOINT_IDS) {
    if (id === 'pelvis') continue;
    for (const axis of ['flex', 'abd', 'twist'] as const) {
      const [lo, hi] = RANGES[id][axis];
      assert.ok(lo <= 0 && 0 <= hi, `${id}.${axis}: 0(기본 자세)을 포함해야 한다`);
    }
  }
});
