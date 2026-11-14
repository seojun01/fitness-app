// 근육 목록과 강조할 뼈 구간 (research G4)
import type { BodyPart } from '../model.ts';
import type { SegmentId } from './skeleton.ts';

export type MuscleId =
  | 'pectorals' | 'lats' | 'traps' | 'rhomboids' | 'frontDelts' | 'sideDelts' | 'rearDelts'
  | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'erectors' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

export interface MuscleDef {
  name: string;
  segments: SegmentId[];
  /** 주로 보이는 면 (글 설명과 3D 에서 어느 쪽을 볼지 안내) */
  face: 'front' | 'back' | 'side';
}

const both = (s: string): SegmentId[] => [`l${s}`, `r${s}`] as SegmentId[];

export const MUSCLES: Record<MuscleId, MuscleDef> = {
  pectorals: { name: '대흉근', segments: ['upperTorso', ...both('Clavicle')], face: 'front' },
  lats: { name: '광배근', segments: ['midTorso', 'upperTorso'], face: 'back' },
  traps: { name: '승모근', segments: ['neck', 'upperTorso'], face: 'back' },
  rhomboids: { name: '능형근', segments: ['upperTorso'], face: 'back' },
  frontDelts: { name: '전면 삼각근', segments: both('Clavicle'), face: 'front' },
  sideDelts: { name: '측면 삼각근', segments: both('Clavicle'), face: 'side' },
  rearDelts: { name: '후면 삼각근', segments: both('Clavicle'), face: 'back' },
  biceps: { name: '이두근', segments: both('UpperArm'), face: 'front' },
  triceps: { name: '삼두근', segments: both('UpperArm'), face: 'back' },
  forearms: { name: '전완근', segments: both('Forearm'), face: 'front' },
  abs: { name: '복직근', segments: ['abdomen', 'midTorso'], face: 'front' },
  obliques: { name: '복사근', segments: ['abdomen'], face: 'side' },
  erectors: { name: '척추기립근', segments: ['abdomen', 'midTorso'], face: 'back' },
  glutes: { name: '둔근', segments: both('HipBone'), face: 'back' },
  quads: { name: '대퇴사두근', segments: both('Thigh'), face: 'front' },
  hamstrings: { name: '햄스트링', segments: both('Thigh'), face: 'back' },
  calves: { name: '종아리', segments: both('Shin'), face: 'back' },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

export const isMuscleId = (v: unknown): v is MuscleId => typeof v === 'string' && v in MUSCLES;

/** 부위별 대표 근육: 동작 애니메이션이 없는 종목(직접 만든 종목)의 정지 그림에서 강조한다 */
export const BODY_PART_MUSCLES: Record<BodyPart, MuscleId[]> = {
  chest: ['pectorals'],
  back: ['lats', 'rhomboids'],
  shoulders: ['frontDelts', 'sideDelts'],
  legs: ['quads', 'glutes', 'hamstrings'],
  arms: ['biceps', 'triceps'],
  core: ['abs', 'obliques'],
  cardio: ['quads', 'calves'],
  other: [],
};
