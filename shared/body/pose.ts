// 포즈·동작과 정방향 운동학(FK) (research G1, G3). 순수 함수만 둔다.
import type { Vec3, ViewName } from './camera.ts';
import { BONES, ENDS, JOINTS, JOINT_IDS, ROOT_HEIGHT, type JointId, type PointId } from './skeleton.ts';
import type { Prop } from './props.ts';

export interface JointRot {
  /** 굽힘(도) */
  flex: number;
  /** 벌림(도, 바깥이 +) */
  abd: number;
  /** 비틀기(도) */
  twist: number;
}

export interface Root {
  x: number;
  y: number;
  z: number;
  /** 몸 전체의 방향(도) */
  yaw: number;
  /** 앞으로 기울기(도). −90 = 등을 대고 누움, +90 = 엎드림 */
  pitch: number;
  /** 옆으로 기울기(도) */
  roll: number;
}

export interface Pose {
  root: Root;
  /** 생략한 관절은 기본 자세(0, 0, 0) */
  joints: Partial<Record<JointId, JointRot>>;
}

export interface Keyframe {
  /** 0 ≤ t ≤ 1, 오름차순. 첫 값 0, 마지막 값 1 */
  t: number;
  pose: Pose;
}

export interface Motion {
  keyframes: Keyframe[];
  /** 한 번 반복하는 데 걸리는 시간 */
  durationMs: number;
  /** 2D 보기의 기본 시점 */
  view: ViewName;
  props: Prop[];
  /** 대표 자세를 고를 t (정지 화면·미리보기·동작 줄이기) */
  poster: number;
  /** 서 있는 동작: 발이 바닥을 뚫으면 안 된다 */
  standing?: boolean;
}

export const STANDING: Pose = { root: { x: 0, y: ROOT_HEIGHT, z: 0, yaw: 0, pitch: 0, roll: 0 }, joints: {} };
export const ZERO: JointRot = { flex: 0, abd: 0, twist: 0 };

// ── 3×3 회전 행렬 ───────────────────────────────────────────────────
type M3 = [number, number, number, number, number, number, number, number, number];
const RAD = Math.PI / 180;

function rx(deg: number): M3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function ry(deg: number): M3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rz(deg: number): M3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function mul(a: M3, b: M3): M3 {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return o;
}
function apply(m: M3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** 관절 회전 → 부모 기준 회전 행렬. 비틀기 → 굽힘 → 벌림 순서로 적용한다 */
function local(id: JointId, r: JointRot): M3 {
  const d = JOINTS[id];
  return mul(rz(d.abdSign * r.abd), mul(rx(d.flexSign * r.flex), ry(d.abdSign * r.twist)));
}

export type Solved = Record<PointId, Vec3>;

/** FK: 관절·끝점의 월드 좌표 */
export function solve(pose: Pose): Solved {
  const out = {} as Solved;
  const rot = {} as Record<JointId, M3>;
  const { root } = pose;
  for (const id of JOINT_IDS) {
    const def = JOINTS[id];
    const r = pose.joints[id] ?? ZERO;
    if (def.parent === null) {
      out[id] = [root.x, root.y, root.z];
      rot[id] = mul(ry(root.yaw), mul(rx(root.pitch), mul(rz(root.roll), local(id, r))));
    } else {
      const pr = rot[def.parent];
      out[id] = add(out[def.parent], apply(pr, def.offset));
      rot[id] = mul(pr, local(id, r));
    }
  }
  for (const [id, e] of Object.entries(ENDS) as [keyof typeof ENDS, (typeof ENDS)[keyof typeof ENDS]][]) {
    out[id] = add(out[e.parent], apply(rot[e.parent], e.offset));
  }
  return out;
}

/** 뼈 구간별 길이 (테스트: 어떤 포즈에서도 변하지 않아야 한다) */
export function boneLengths(p: Solved): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BONES) {
    const a = p[b.a];
    const c = p[b.b];
    out[b.id] = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  }
  return out;
}

// ── 보간 ────────────────────────────────────────────────────────────

/** sine in-out. 부동소수점 끝자리를 정리해 구간 가운데가 정확히 0.5 가 되게 한다 */
const ease = (u: number) => Math.round(((1 - Math.cos(Math.PI * u)) / 2) * 1e12) / 1e12;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function mix(a: Pose, b: Pose, k: number): Pose {
  const joints: Partial<Record<JointId, JointRot>> = {};
  const keys = new Set([...Object.keys(a.joints), ...Object.keys(b.joints)] as JointId[]);
  for (const id of keys) {
    const ja = a.joints[id] ?? ZERO;
    const jb = b.joints[id] ?? ZERO;
    joints[id] = { flex: lerp(ja.flex, jb.flex, k), abd: lerp(ja.abd, jb.abd, k), twist: lerp(ja.twist, jb.twist, k) };
  }
  const ra = a.root;
  const rb = b.root;
  return {
    root: { x: lerp(ra.x, rb.x, k), y: lerp(ra.y, rb.y, k), z: lerp(ra.z, rb.z, k), yaw: lerp(ra.yaw, rb.yaw, k), pitch: lerp(ra.pitch, rb.pitch, k), roll: lerp(ra.roll, rb.roll, k) },
    joints,
  };
}

/** t(주기에 대해 반복)에서의 포즈. 키프레임 사이는 sine in-out 으로 보간한다 */
export function poseAt(motion: Motion, t: number): Pose {
  const kf = motion.keyframes;
  let u = t - Math.floor(t);
  if (u < 0) u += 1;
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i]!;
    const b = kf[i + 1]!;
    if (u >= a.t && u <= b.t) {
      const span = b.t - a.t;
      return mix(a.pose, b.pose, span <= 0 ? 0 : ease((u - a.t) / span));
    }
  }
  return kf[0]!.pose;
}
