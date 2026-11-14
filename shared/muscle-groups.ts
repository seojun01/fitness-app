// 종목 선택의 근육 부위 필터 (기능 5, research P2). 근육 17종을 12개 그룹으로 묶는다.
import type { BodyPart } from './model.ts';
import type { MuscleId } from './muscles.ts';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'triceps' | 'biceps' | 'forearms' | 'abs' | 'glutes' | 'hamstrings' | 'quads' | 'traps' | 'calves';

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'triceps', 'biceps', 'forearms', 'abs', 'glutes', 'hamstrings', 'quads', 'traps', 'calves'];

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  triceps: '삼두',
  biceps: '이두',
  forearms: '전완',
  abs: '복근',
  glutes: '둔근',
  hamstrings: '햄스트링',
  quads: '대퇴사두',
  traps: '승모',
  calves: '종아리',
};

const GROUP_OF: Record<MuscleId, MuscleGroup> = {
  pectorals: 'chest',
  lats: 'back',
  rhomboids: 'back',
  erectors: 'back',
  frontDelts: 'shoulders',
  sideDelts: 'shoulders',
  rearDelts: 'shoulders',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'abs',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  quads: 'quads',
  traps: 'traps',
  calves: 'calves',
};

export const groupOf = (m: MuscleId): MuscleGroup => GROUP_OF[m];

/** 주동근 → 보조근 순서로 그룹을 모은다 (중복 없음) */
export function groupsFromMuscles(primary: MuscleId[], secondary: MuscleId[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  for (const m of [...primary, ...secondary]) {
    const g = GROUP_OF[m];
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

/** 근육 정보가 없는 직접 만든 종목: 부위로 정하는 기본 그룹 */
export function groupsFromBodyPart(part: BodyPart): MuscleGroup[] {
  switch (part) {
    case 'chest':
      return ['chest'];
    case 'back':
      return ['back'];
    case 'shoulders':
      return ['shoulders'];
    case 'legs':
      return ['quads', 'glutes', 'hamstrings', 'calves'];
    case 'arms':
      return ['biceps', 'triceps', 'forearms'];
    case 'core':
      return ['abs'];
    default:
      return [];
  }
}
