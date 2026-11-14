import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BONES } from '../body/skeleton.ts';
import { poseAt, solve, STANDING, boneLengths, type Motion, type Pose } from '../body/pose.ts';

const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const base = boneLengths(solve(STANDING));

test('어떤 관절 회전에서도 모든 뼈 길이가 그대로다', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < 200; i++) {
    const pose: Pose = { root: { x: rnd(), y: 0.5 + rnd() * 0.2, z: rnd(), yaw: rnd() * 180, pitch: rnd() * 90, roll: rnd() * 30 }, joints: {} };
    for (const j of ['spine', 'chest', 'neck', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle'] as const) {
      pose.joints[j] = { flex: rnd() * 120, abd: rnd() * 60, twist: rnd() * 60 };
    }
    const lens = boneLengths(solve(pose));
    for (const [k, v] of Object.entries(base)) assert.ok(Math.abs(lens[k]! - v) < 1e-9, `${k}`);
  }
  assert.ok(BONES.length >= 16);
});

test('무릎을 90° 굽히면 정강이가 허벅지에 수직이고 발목이 뒤로 간다', () => {
  const p = solve({ ...STANDING, joints: { rKnee: { flex: 90, abd: 0, twist: 0 } } });
  const thigh = [p.rKnee[0] - p.rHip[0], p.rKnee[1] - p.rHip[1], p.rKnee[2] - p.rHip[2]];
  const shin = [p.rAnkle[0] - p.rKnee[0], p.rAnkle[1] - p.rKnee[1], p.rAnkle[2] - p.rKnee[2]];
  const dot = thigh[0]! * shin[0]! + thigh[1]! * shin[1]! + thigh[2]! * shin[2]!;
  assert.ok(Math.abs(dot) < 1e-9);
  assert.ok(p.rAnkle[2] < p.rKnee[2] - 0.1, '정강이는 뒤로 접힌다');
});

test('어깨 flex 90° 는 팔을 앞으로, abd 90° 는 바깥으로 든다 (좌우 모두)', () => {
  const f = solve({ ...STANDING, joints: { rShoulder: { flex: 90, abd: 0, twist: 0 }, lShoulder: { flex: 90, abd: 0, twist: 0 } } });
  assert.ok(f.rWrist[2] > 0.3 && Math.abs(f.rWrist[1] - f.rShoulder[1]) < 1e-9);
  assert.ok(f.lWrist[2] > 0.3);
  const a = solve({ ...STANDING, joints: { rShoulder: { flex: 0, abd: 90, twist: 0 }, lShoulder: { flex: 0, abd: 90, twist: 0 } } });
  assert.ok(a.rWrist[0] > a.rShoulder[0] + 0.3, '오른팔은 +x 로');
  assert.ok(a.lWrist[0] < a.lShoulder[0] - 0.3, '왼팔은 −x 로');
});

test('허리 flex 는 상체를 앞으로 숙이고, 골반 pitch −90 은 등을 대고 눕는다', () => {
  const bend = solve({ ...STANDING, joints: { spine: { flex: 60, abd: 0, twist: 0 } } });
  assert.ok(bend.head[2] > 0.2);
  const supine = solve({ ...STANDING, root: { ...STANDING.root, pitch: -90 } });
  assert.ok(supine.head[2] < -0.3, '머리는 −z');
  const toFront = supine.rToe[1] - supine.rAnkle[1];
  assert.ok(toFront > 0.05, '발끝(몸의 앞)은 위를 향한다');
});

const motion = (frames: [number, Pose][], extra: Partial<Motion> = {}): Motion => ({ keyframes: frames.map(([t, pose]) => ({ t, pose })), durationMs: 2000, view: 'side', props: [], poster: 0.5, ...extra });
const bent = (deg: number): Pose => ({ ...STANDING, joints: { rKnee: { flex: deg, abd: 0, twist: 0 } } });

test('poseAt: 경계, 이징, 반복', () => {
  const m = motion([[0, bent(0)], [0.5, bent(100)], [1, bent(0)]]);
  assert.equal(poseAt(m, 0).joints.rKnee!.flex, 0);
  assert.equal(poseAt(m, 0.5).joints.rKnee!.flex, 100);
  assert.ok(Math.abs(poseAt(m, 0.999999).joints.rKnee!.flex) < 1e-3, 't→1 은 처음으로 돌아온다');
  assert.equal(poseAt(m, 1.25).joints.rKnee!.flex, poseAt(m, 0.25).joints.rKnee!.flex, '주기로 반복');
  const q = poseAt(m, 0.125).joints.rKnee!.flex; // 구간 1/4 지점: sine in-out 이면 선형(25)보다 작다
  assert.ok(q > 0 && q < 25, `이징 ${q}`);
  assert.equal(poseAt(m, 0.25).joints.rKnee!.flex, 50, '구간 가운데는 절반');
});

test('구간별 템포: 내리기 2 : 올리기 1 은 키프레임 t 로 표현한다', () => {
  const m = motion([[0, bent(0)], [2 / 3, bent(90)], [1, bent(0)]]);
  assert.equal(poseAt(m, 1 / 3).joints.rKnee!.flex, 45, '내리는 구간 가운데');
  assert.equal(poseAt(m, 5 / 6).joints.rKnee!.flex, 45, '올리는 구간 가운데');
});

test('poseAt 은 루트도 보간하고 생략한 관절은 0 이다', () => {
  const a: Pose = { root: { ...STANDING.root, y: 0.5 }, joints: {} };
  const b: Pose = { root: { ...STANDING.root, y: 0.3 }, joints: { lHip: { flex: 80, abd: 0, twist: 0 } } };
  const mid = poseAt(motion([[0, a], [0.5, b], [1, a]]), 0.25);
  assert.equal(mid.root.y, 0.4);
  assert.equal(mid.joints.lHip!.flex, 40);
});

void dist;
