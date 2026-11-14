// 인체 모델의 뼈대 (research G1). 키 1.0 으로 정규화한 평균 성인 비율.
// 좌표계: 오른손, y 위, x 몸의 오른쪽, z 몸의 정면. 바닥 y = 0.
import type { Vec3 } from './camera.ts';

export type JointId =
  | 'pelvis' | 'spine' | 'chest' | 'neck' | 'head'
  | 'lShoulder' | 'rShoulder' | 'lElbow' | 'rElbow' | 'lWrist' | 'rWrist'
  | 'lHip' | 'rHip' | 'lKnee' | 'rKnee' | 'lAnkle' | 'rAnkle';

/** FK 결과에 더하는 끝점(관절이 아니라 회전은 없다) */
export type EndId = 'lHand' | 'rHand' | 'lToe' | 'rToe';
export type PointId = JointId | EndId;

export interface JointDef {
  parent: JointId | null;
  /** 부모 관절 기준 위치(부모가 회전하지 않았을 때) */
  offset: Vec3;
  /** 굽힘(flex)을 x 축 회전으로 바꿀 때의 부호: 어깨·팔꿈치·고관절은 앞으로(−), 무릎은 뒤로(+) */
  flexSign: 1 | -1;
  /** 벌림(abd) 부호: 오른쪽 +, 왼쪽 − (바깥으로 벌리면 양수) */
  abdSign: 1 | -1;
}

export const ROOT: JointId = 'pelvis';
export const ROOT_HEIGHT = 0.53;
export const HEAD_RADIUS = 0.07;

const side = (s: 'l' | 'r'): 1 | -1 => (s === 'r' ? 1 : -1);

function limbs(s: 'l' | 'r'): Record<string, JointDef> {
  const x = side(s);
  return {
    [`${s}Shoulder`]: { parent: 'chest', offset: [0.11 * x, 0.07, 0], flexSign: -1, abdSign: x },
    [`${s}Elbow`]: { parent: `${s}Shoulder` as JointId, offset: [0, -0.19, 0], flexSign: -1, abdSign: x },
    [`${s}Wrist`]: { parent: `${s}Elbow` as JointId, offset: [0, -0.16, 0], flexSign: -1, abdSign: x },
    [`${s}Hip`]: { parent: 'pelvis', offset: [0.07 * x, -0.03, 0], flexSign: -1, abdSign: x },
    [`${s}Knee`]: { parent: `${s}Hip` as JointId, offset: [0, -0.235, 0], flexSign: 1, abdSign: x },
    [`${s}Ankle`]: { parent: `${s}Knee` as JointId, offset: [0, -0.225, 0], flexSign: -1, abdSign: x },
  };
}

export const JOINTS: Record<JointId, JointDef> = {
  pelvis: { parent: null, offset: [0, ROOT_HEIGHT, 0], flexSign: 1, abdSign: 1 },
  spine: { parent: 'pelvis', offset: [0, 0.08, 0], flexSign: 1, abdSign: 1 },
  chest: { parent: 'spine', offset: [0, 0.14, 0], flexSign: 1, abdSign: 1 },
  neck: { parent: 'chest', offset: [0, 0.1, 0], flexSign: 1, abdSign: 1 },
  head: { parent: 'neck', offset: [0, 0.08, 0], flexSign: 1, abdSign: 1 },
  ...(limbs('l') as Record<string, JointDef>),
  ...(limbs('r') as Record<string, JointDef>),
} as Record<JointId, JointDef>;

/** 부모가 먼저 오는 순서 (FK 계산 순서) */
export const JOINT_IDS: JointId[] = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'lShoulder', 'lElbow', 'lWrist', 'rShoulder', 'rElbow', 'rWrist',
  'lHip', 'lKnee', 'lAnkle', 'rHip', 'rKnee', 'rAnkle',
];

/** 끝점: 어느 관절에 붙어 있고, 그 관절 기준 어디인지 */
export const ENDS: Record<EndId, { parent: JointId; offset: Vec3 }> = {
  lHand: { parent: 'lWrist', offset: [0, -0.07, 0] },
  rHand: { parent: 'rWrist', offset: [0, -0.07, 0] },
  lToe: { parent: 'lAnkle', offset: [0, -0.03, 0.1] },
  rToe: { parent: 'rAnkle', offset: [0, -0.03, 0.1] },
};

export type Range = [number, number];
export interface JointRange {
  flex: Range;
  abd: Range;
  twist: Range;
}

const RANGE_BY_KIND: Record<string, JointRange> = {
  spine: { flex: [-30, 90], abd: [-40, 40], twist: [-45, 45] },
  chest: { flex: [-30, 60], abd: [-30, 30], twist: [-45, 45] },
  neck: { flex: [-45, 60], abd: [-40, 40], twist: [-70, 70] },
  head: { flex: [-30, 30], abd: [-30, 30], twist: [-30, 30] },
  Shoulder: { flex: [-60, 180], abd: [-30, 180], twist: [-90, 90] },
  Elbow: { flex: [0, 150], abd: [0, 0], twist: [-90, 90] },
  Wrist: { flex: [-70, 80], abd: [-20, 30], twist: [-90, 90] },
  Hip: { flex: [-30, 130], abd: [-30, 60], twist: [-45, 45] },
  Knee: { flex: [0, 150], abd: [0, 0], twist: [-10, 10] },
  Ankle: { flex: [-50, 30], abd: [-20, 20], twist: [0, 0] },
};

/** 관절 가동 범위(도). 키프레임과 보간값은 이 안이어야 한다 (contracts/guide-content.md) */
export const RANGES = Object.fromEntries(
  JOINT_IDS.filter((j) => j !== 'pelvis').map((j) => [j, RANGE_BY_KIND[j] ?? RANGE_BY_KIND[j.slice(1)]!]),
) as Record<Exclude<JointId, 'pelvis'>, JointRange> & Record<JointId, JointRange>;

// ── 그릴 뼈 구간 ─────────────────────────────────────────────────────

export type SegmentId =
  | 'abdomen' | 'midTorso' | 'upperTorso' | 'neck'
  | 'lClavicle' | 'rClavicle' | 'lUpperArm' | 'rUpperArm' | 'lForearm' | 'rForearm' | 'lHand' | 'rHand'
  | 'lHipBone' | 'rHipBone' | 'lThigh' | 'rThigh' | 'lShin' | 'rShin' | 'lFoot' | 'rFoot';

export interface Bone {
  id: SegmentId;
  a: PointId;
  b: PointId;
  /** 그릴 굵기(키 대비) */
  width: number;
}

const sideBones = (s: 'l' | 'r'): Bone[] => [
  { id: `${s}Clavicle` as SegmentId, a: 'chest', b: `${s}Shoulder` as PointId, width: 0.07 },
  { id: `${s}UpperArm` as SegmentId, a: `${s}Shoulder` as PointId, b: `${s}Elbow` as PointId, width: 0.055 },
  { id: `${s}Forearm` as SegmentId, a: `${s}Elbow` as PointId, b: `${s}Wrist` as PointId, width: 0.045 },
  { id: `${s}Hand` as SegmentId, a: `${s}Wrist` as PointId, b: `${s}Hand` as PointId, width: 0.04 },
  { id: `${s}HipBone` as SegmentId, a: 'pelvis', b: `${s}Hip` as PointId, width: 0.09 },
  { id: `${s}Thigh` as SegmentId, a: `${s}Hip` as PointId, b: `${s}Knee` as PointId, width: 0.075 },
  { id: `${s}Shin` as SegmentId, a: `${s}Knee` as PointId, b: `${s}Ankle` as PointId, width: 0.06 },
  { id: `${s}Foot` as SegmentId, a: `${s}Ankle` as PointId, b: `${s}Toe` as PointId, width: 0.04 },
];

export const BONES: Bone[] = [
  { id: 'abdomen', a: 'pelvis', b: 'spine', width: 0.13 },
  { id: 'midTorso', a: 'spine', b: 'chest', width: 0.15 },
  { id: 'upperTorso', a: 'chest', b: 'neck', width: 0.14 },
  { id: 'neck', a: 'neck', b: 'head', width: 0.05 },
  ...sideBones('l'),
  ...sideBones('r'),
];

export const SEGMENT_IDS: SegmentId[] = BONES.map((b) => b.id);
