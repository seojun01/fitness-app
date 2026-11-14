// 근육 목록 (기능 2 research G4'). 기본 가이드와 사용자 가이드 노트가 같은 목록을 쓴다.
export type MuscleId =
  | 'pectorals' | 'lats' | 'traps' | 'rhomboids' | 'frontDelts' | 'sideDelts' | 'rearDelts'
  | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'erectors' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

/** 한국어 이름 (화면 표시 순서) */
export const MUSCLES: Record<MuscleId, string> = {
  pectorals: '대흉근',
  lats: '광배근',
  traps: '승모근',
  rhomboids: '능형근',
  frontDelts: '전면 삼각근',
  sideDelts: '측면 삼각근',
  rearDelts: '후면 삼각근',
  biceps: '이두근',
  triceps: '삼두근',
  forearms: '전완근',
  abs: '복직근',
  obliques: '복사근',
  erectors: '척추기립근',
  glutes: '둔근',
  quads: '대퇴사두근',
  hamstrings: '햄스트링',
  calves: '종아리',
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

export const isMuscleId = (v: unknown): v is MuscleId => typeof v === 'string' && Object.hasOwn(MUSCLES, v);

export const muscleNames = (ids: MuscleId[]): string => ids.map((m) => MUSCLES[m]).join(', ');
