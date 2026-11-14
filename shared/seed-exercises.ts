// 기본 운동 종목 (research R15). id 는 고정이라 기기마다 같다. 시드는 항상 지는 버전(SEED_VERSION)으로 넣고 서버로 올리지 않는다.
import { SEED_VERSION, type BodyPart, type Exercise } from './model.ts';

const RAW: { id: string; name: string; bodyPart: BodyPart; bodyweight: boolean }[] = [
  { id: '5eed0000-0000-4000-8000-000000000001', name: '벤치 프레스', bodyPart: 'chest', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000002', name: '인클라인 덤벨 프레스', bodyPart: 'chest', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000003', name: '덤벨 플라이', bodyPart: 'chest', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000004', name: '푸시업', bodyPart: 'chest', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-000000000005', name: '케이블 크로스오버', bodyPart: 'chest', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000006', name: '데드리프트', bodyPart: 'back', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000007', name: '풀업', bodyPart: 'back', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-000000000008', name: '랫 풀다운', bodyPart: 'back', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000009', name: '바벨 로우', bodyPart: 'back', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000a', name: '시티드 케이블 로우', bodyPart: 'back', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000b', name: '오버헤드 프레스', bodyPart: 'shoulders', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000c', name: '사이드 레터럴 레이즈', bodyPart: 'shoulders', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000d', name: '페이스 풀', bodyPart: 'shoulders', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000e', name: '프론트 레이즈', bodyPart: 'shoulders', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000000f', name: '덤벨 숄더 프레스', bodyPart: 'shoulders', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000010', name: '스쿼트', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000011', name: '레그 프레스', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000012', name: '루마니안 데드리프트', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000013', name: '런지', bodyPart: 'legs', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-000000000014', name: '레그 컬', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000015', name: '레그 익스텐션', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000016', name: '카프 레이즈', bodyPart: 'legs', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000017', name: '바벨 컬', bodyPart: 'arms', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000018', name: '해머 컬', bodyPart: 'arms', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000019', name: '트라이셉스 푸시다운', bodyPart: 'arms', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000001a', name: '스컬 크러셔', bodyPart: 'arms', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-00000000001b', name: '딥스', bodyPart: 'arms', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-00000000001c', name: '플랭크', bodyPart: 'core', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-00000000001d', name: '크런치', bodyPart: 'core', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-00000000001e', name: '레그 레이즈', bodyPart: 'core', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-00000000001f', name: '러시안 트위스트', bodyPart: 'core', bodyweight: true },
  { id: '5eed0000-0000-4000-8000-000000000020', name: '러닝머신', bodyPart: 'cardio', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000021', name: '사이클', bodyPart: 'cardio', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000022', name: '로잉 머신', bodyPart: 'cardio', bodyweight: false },
  { id: '5eed0000-0000-4000-8000-000000000023', name: '줄넘기', bodyPart: 'cardio', bodyweight: true },
];

export const SEED_EXERCISES: Exercise[] = RAW.map((r) => ({ ...r, custom: false, deleted: false, version: SEED_VERSION, updatedBy: 'seed' }));

