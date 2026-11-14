import type { BodyPart, Equipment } from '../../shared/model.ts';

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  legs: '하체',
  arms: '팔',
  core: '코어',
  cardio: '유산소',
  other: '기타',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: '맨몸',
  dumbbell: '덤벨',
  barbell: '바벨',
  smith: '스미스머신',
  machine: '머신',
  cable: '케이블',
  band: '밴드',
  kettlebell: '케틀벨',
  cardio: '유산소',
  other: '기타',
};
