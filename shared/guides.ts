// 기본 종목 전부(기능 5 이후 91개)의 텍스트 가이드 (기능 2, research G11). 일반적인 근력 운동 지도 상식에 기반한 참고 자료이며 의학적 조언이 아니다.
// 클라이언트는 이 모듈을 import() 로 지연 로딩한다 (별도 청크, 서비스 워커가 미리 캐시).
import type { MuscleId } from './muscles.ts';
import { SEED_EXERCISES } from './seed-exercises.ts';

export interface BuiltinGuide {
  exerciseId: string;
  cues: string[];
  mistakes: string[];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
}

type Text = Omit<BuiltinGuide, 'exerciseId'>;

/** 종목 이름 → 가이드 (id 는 기본 종목 목록에서 찾는다) */
const BY_NAME: Record<string, Text> = {
  // ── 가슴 ──
  '벤치 프레스': {
    cues: ['벤치에 누워 눈이 바 바로 아래에 오게 하고, 발은 바닥에 단단히 붙인다', '어깨뼈를 모아 아래로 내려 가슴을 살짝 들어 올린다', '바를 가슴 중간(유두 근처)으로 천천히 내린다', '팔꿈치는 몸통과 45~70° 정도로 벌린 채 밀어 올린다', '내릴 때 숨을 들이쉬고, 밀어 올리며 내쉰다'],
    mistakes: ['팔꿈치를 옆으로 90°까지 벌려 어깨에 부담을 준다', '엉덩이가 벤치에서 뜬다', '바를 가슴에 튕겨 반동으로 올린다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '인클라인 덤벨 프레스': {
    cues: ['벤치 등받이를 30~45°로 세운다', '덤벨을 가슴 위쪽 옆에서 시작하고 손목은 곧게 편다', '덤벨이 살짝 모이는 궤도로 위로 밀어 올린다', '가슴이 늘어나는 느낌이 들 때까지 천천히 내린다'],
    mistakes: ['등받이를 너무 세워 어깨 운동이 된다', '덤벨끼리 부딪히며 위에서 힘이 풀린다', '내리는 구간을 빠르게 떨어뜨린다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '덤벨 플라이': {
    cues: ['벤치에 누워 덤벨을 가슴 위로 들고 손바닥을 마주 보게 한다', '팔꿈치를 살짝 굽힌 각도를 끝까지 유지한다', '큰 원을 그리듯 양옆으로 천천히 내린다', '가슴을 모은다는 느낌으로 같은 궤도로 올린다'],
    mistakes: ['팔꿈치를 완전히 펴서 관절에 부담을 준다', '너무 깊게 내려 어깨 앞쪽이 과하게 늘어난다', '무게를 무겁게 잡아 프레스 동작이 된다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts'],
  },
  '푸시업': {
    cues: ['손을 어깨너비보다 조금 넓게 짚고 머리부터 발끝까지 일직선을 만든다', '배와 엉덩이에 힘을 주어 허리가 처지지 않게 한다', '가슴이 바닥 가까이 갈 때까지 내려간다', '팔꿈치는 몸통에서 45° 정도로 둔다'],
    mistakes: ['허리가 처지거나 엉덩이가 솟는다', '목만 앞으로 내밀어 가동 범위를 줄인다', '팔꿈치를 옆으로 활짝 벌린다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['triceps', 'frontDelts', 'abs'],
  },
  '케이블 크로스오버': {
    cues: ['양쪽 케이블 사이에서 한 발을 앞으로 내딛고 상체를 살짝 숙인다', '팔꿈치를 약간 굽힌 채 손잡이를 앞쪽 아래로 모은다', '손이 모였을 때 가슴을 1초 정도 조인다', '팔이 뒤로 끌려가지 않게 천천히 돌아온다'],
    mistakes: ['팔꿈치를 굽혔다 폈다 하며 미는 동작이 된다', '몸통을 흔들어 반동을 쓴다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts'],
  },
  // ── 등 ──
  '데드리프트': {
    cues: ['바가 발 중앙 위에 오게 서고, 정강이에 바가 닿을 정도로 다가간다', '엉덩이를 뒤로 빼며 바를 잡고, 등은 곧게 편 채 가슴을 든다', '바를 몸에 붙인 채 다리로 바닥을 밀어 일어선다', '위에서는 엉덩이를 조이며 똑바로 서고, 같은 궤도로 내린다', '들기 전에 숨을 들이마셔 배에 힘을 준다'],
    mistakes: ['허리를 둥글게 말고 든다', '바가 몸에서 멀어진다', '위에서 상체를 뒤로 과하게 젖힌다'],
    primaryMuscles: ['hamstrings', 'glutes', 'erectors'],
    secondaryMuscles: ['quads', 'lats', 'traps', 'forearms'],
  },
  '풀업': {
    cues: ['어깨너비보다 조금 넓게 바를 잡고 매달린다', '어깨를 먼저 아래로 내린 뒤 당기기 시작한다', '가슴을 바 쪽으로 끌어올린다는 느낌으로 턱이 바를 넘을 때까지 당긴다', '팔이 거의 펴질 때까지 천천히 내려온다'],
    mistakes: ['다리를 흔들어 반동으로 올라간다', '턱만 내밀어 바를 넘긴다', '절반만 내려와 가동 범위가 짧다'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rhomboids', 'rearDelts'],
  },
  '랫 풀다운': {
    cues: ['허벅지를 패드에 고정하고 바를 어깨너비보다 넓게 잡는다', '상체를 살짝 뒤로 기울이고 가슴을 든다', '팔꿈치를 옆구리로 끌어내린다는 느낌으로 바를 쇄골 쪽으로 당긴다', '위로 돌아갈 때 어깨가 끝까지 늘어나게 천천히 올린다'],
    mistakes: ['바를 목 뒤로 당긴다', '상체를 크게 젖혀 몸무게로 당긴다', '팔 힘으로만 당긴다'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rhomboids', 'rearDelts'],
  },
  '바벨 로우': {
    cues: ['무릎을 살짝 굽히고 엉덩이를 뒤로 빼 상체를 45° 정도 숙인다', '등을 곧게 편 채 바를 배꼽 쪽으로 당긴다', '당긴 끝에서 어깨뼈를 모은다', '상체 각도를 유지한 채 천천히 내린다'],
    mistakes: ['상체를 일으키며 반동으로 당긴다', '허리가 둥글게 말린다', '바를 가슴 쪽으로 높게 당긴다'],
    primaryMuscles: ['lats', 'rhomboids'],
    secondaryMuscles: ['rearDelts', 'biceps', 'erectors'],
  },
  '시티드 케이블 로우': {
    cues: ['발판에 발을 대고 무릎을 살짝 굽힌 채 허리를 세워 앉는다', '손잡이를 배꼽 쪽으로 당기며 가슴을 편다', '당긴 끝에서 어깨뼈를 뒤로 모은다', '팔이 펴질 때까지 천천히 보내되 등은 둥글게 말지 않는다'],
    mistakes: ['상체를 앞뒤로 크게 흔든다', '어깨를 으쓱 올리며 당긴다'],
    primaryMuscles: ['lats', 'rhomboids'],
    secondaryMuscles: ['biceps', 'rearDelts'],
  },
  // ── 어깨 ──
  '오버헤드 프레스': {
    cues: ['바를 쇄골 높이에 두고 손은 어깨너비보다 조금 넓게 잡는다', '엉덩이와 배에 힘을 주어 몸을 단단히 고정한다', '바가 얼굴 앞을 지나도록 머리를 살짝 뒤로 빼며 머리 위로 민다', '바가 머리 위에 오면 머리를 다시 앞으로 넣는다'],
    mistakes: ['허리를 과하게 젖혀 가슴으로 민다', '바가 앞으로 멀리 나간다', '다리 반동을 쓴다'],
    primaryMuscles: ['frontDelts', 'sideDelts'],
    secondaryMuscles: ['triceps', 'traps', 'abs'],
  },
  '사이드 레터럴 레이즈': {
    cues: ['덤벨을 옆에 들고 팔꿈치를 살짝 굽힌다', '팔꿈치가 손보다 먼저 올라간다는 느낌으로 옆으로 든다', '어깨 높이까지 올리고 잠시 멈춘다', '천천히 내리며 긴장을 유지한다'],
    mistakes: ['어깨를 으쓱하며 승모근으로 든다', '무거운 무게로 몸을 흔든다', '어깨보다 훨씬 높이 든다'],
    primaryMuscles: ['sideDelts'],
    secondaryMuscles: ['traps', 'frontDelts'],
  },
  '페이스 풀': {
    cues: ['케이블을 얼굴 높이에 두고 로프를 엄지가 뒤로 향하게 잡는다', '로프를 얼굴 쪽으로 당기며 양손을 귀 옆으로 벌린다', '당긴 끝에서 어깨뼈를 모으고 팔을 바깥으로 돌린다', '천천히 돌아간다'],
    mistakes: ['허리를 젖혀 몸으로 당긴다', '로프를 목이나 가슴 쪽으로 낮게 당긴다'],
    primaryMuscles: ['rearDelts'],
    secondaryMuscles: ['rhomboids', 'traps'],
  },
  '프론트 레이즈': {
    cues: ['덤벨을 허벅지 앞에 들고 팔꿈치를 살짝 굽힌다', '팔을 앞으로 들어 어깨 높이까지 올린다', '몸통은 움직이지 않는다', '천천히 내린다'],
    mistakes: ['상체를 뒤로 젖히며 반동을 쓴다', '어깨보다 훨씬 높이 든다'],
    primaryMuscles: ['frontDelts'],
    secondaryMuscles: ['sideDelts', 'pectorals'],
  },
  '덤벨 숄더 프레스': {
    cues: ['등받이를 세운 벤치에 앉아 덤벨을 귀 옆 높이에 둔다', '손목을 팔꿈치 바로 위에 두고 위로 민다', '위에서 팔을 끝까지 잠그지 않는다', '귀 높이까지 천천히 내린다'],
    mistakes: ['허리를 등받이에서 떼고 젖힌다', '덤벨을 너무 앞쪽으로 민다'],
    primaryMuscles: ['frontDelts', 'sideDelts'],
    secondaryMuscles: ['triceps', 'traps'],
  },
  // ── 하체 ──
  '스쿼트': {
    cues: ['발을 어깨너비로 벌리고 발끝은 살짝 바깥을 향한다', '숨을 들이마셔 배에 힘을 주고, 의자에 앉듯 엉덩이를 뒤로 빼며 내려간다', '무릎은 발끝 방향과 같게 유지한다', '허벅지가 바닥과 평행하거나 그보다 조금 깊게 내려간 뒤 발바닥 전체로 밀고 일어선다'],
    mistakes: ['무릎이 안쪽으로 모인다', '뒤꿈치가 뜬다', '허리가 둥글게 말린다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'erectors', 'abs'],
  },
  '레그 프레스': {
    cues: ['등과 엉덩이를 등받이에 붙이고 발을 발판 가운데에 어깨너비로 둔다', '무릎이 가슴 쪽으로 오도록 천천히 내린다', '발바닥 전체로 밀어 올린다', '위에서 무릎을 완전히 잠그지 않는다'],
    mistakes: ['너무 깊게 내려 엉덩이가 등받이에서 뜬다', '무릎을 쾅 소리 나게 펴서 잠근다', '무릎이 안쪽으로 모인다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
  },
  '루마니안 데드리프트': {
    cues: ['바를 허벅지 앞에 들고 무릎을 살짝 굽힌다', '엉덩이를 뒤로 밀며 상체를 숙이고, 바는 허벅지를 따라 내린다', '허벅지 뒤가 늘어나는 느낌이 들 때까지 내리되 등은 곧게 편다', '엉덩이를 앞으로 밀며 일어선다'],
    mistakes: ['무릎을 많이 굽혀 스쿼트가 된다', '등이 둥글게 말린다', '바가 몸에서 떨어진다'],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['erectors', 'forearms'],
  },
  '런지': {
    cues: ['한 발을 크게 앞으로 내딛는다', '상체를 세운 채 뒷무릎이 바닥 가까이 갈 때까지 내려간다', '앞무릎은 발끝 방향을 향하게 한다', '앞발 뒤꿈치로 밀어 처음 자세로 돌아온다'],
    mistakes: ['보폭이 너무 좁아 앞무릎이 많이 나간다', '상체가 앞으로 쏠린다', '앞무릎이 안쪽으로 모인다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves'],
  },
  '레그 컬': {
    cues: ['무릎 관절을 기계 회전축에 맞추고 패드를 발목 위에 둔다', '뒤꿈치를 엉덩이 쪽으로 끌어당긴다', '끝에서 잠시 멈춰 허벅지 뒤를 조인다', '천천히 펴되 무게를 내려놓지 않는다'],
    mistakes: ['엉덩이를 들며 반동을 쓴다', '내리는 구간을 빠르게 떨어뜨린다'],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
  },
  '레그 익스텐션': {
    cues: ['무릎 관절을 기계 회전축에 맞추고 등을 등받이에 붙인다', '다리를 펴며 허벅지 앞을 조인다', '위에서 1초 멈춘다', '천천히 내린다'],
    mistakes: ['엉덩이가 들리며 반동을 쓴다', '무거운 무게로 빠르게 차올린다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
  },
  '카프 레이즈': {
    cues: ['발 앞쪽을 발판 끝에 올리고 뒤꿈치를 아래로 내린다', '발끝으로 최대한 높이 올라간다', '위에서 1~2초 멈춘다', '종아리가 늘어날 때까지 천천히 내린다'],
    mistakes: ['반동으로 튕기듯 빠르게 반복한다', '무릎을 굽혔다 펴며 다리 힘을 쓴다'],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },
  // ── 팔 ──
  '바벨 컬': {
    cues: ['바를 어깨너비로 잡고 팔꿈치를 옆구리에 붙인다', '팔꿈치를 고정한 채 바를 어깨 쪽으로 감아올린다', '위에서 이두근을 조인다', '팔이 거의 펴질 때까지 천천히 내린다'],
    mistakes: ['상체를 뒤로 젖히며 반동을 쓴다', '팔꿈치가 앞으로 나온다', '내리는 구간을 빠르게 떨어뜨린다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  '해머 컬': {
    cues: ['덤벨을 손바닥이 서로 마주 보게 잡는다', '팔꿈치를 옆구리에 고정하고 망치를 들듯 들어 올린다', '손목은 곧게 유지한다', '천천히 내린다'],
    mistakes: ['몸을 흔들어 반동을 쓴다', '팔꿈치가 앞뒤로 움직인다'],
    primaryMuscles: ['biceps', 'forearms'],
    secondaryMuscles: [],
  },
  '트라이셉스 푸시다운': {
    cues: ['케이블 앞에 서서 상체를 살짝 숙이고 팔꿈치를 옆구리에 붙인다', '팔꿈치만 움직여 손잡이를 아래로 끝까지 민다', '아래에서 팔 뒤쪽을 조인다', '팔꿈치 높이까지 천천히 돌아온다'],
    mistakes: ['팔꿈치가 벌어지거나 앞으로 나온다', '어깨와 몸통으로 눌러 내린다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['forearms'],
  },
  '스컬 크러셔': {
    cues: ['벤치에 누워 바를 가슴 위로 들고 팔을 살짝 머리 쪽으로 기울인다', '팔꿈치를 고정한 채 바를 이마 위쪽으로 천천히 내린다', '팔꿈치를 펴며 처음 위치로 민다', '팔꿈치가 바깥으로 벌어지지 않게 한다'],
    mistakes: ['팔꿈치가 양옆으로 벌어진다', '어깨가 움직여 프레스 동작이 된다', '무게를 너무 빠르게 내린다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  '딥스': {
    cues: ['평행봉을 잡고 팔을 편 채 몸을 들어 올린다', '어깨를 내린 채 팔꿈치를 뒤로 굽히며 내려간다', '팔꿈치가 90° 정도 될 때까지 내려간다', '손바닥으로 밀어 올라온다'],
    mistakes: ['너무 깊게 내려가 어깨 앞쪽에 부담을 준다', '어깨를 으쓱 올린 채 움직인다', '다리를 흔들어 반동을 쓴다'],
    primaryMuscles: ['triceps', 'pectorals'],
    secondaryMuscles: ['frontDelts'],
  },
  // ── 코어 ──
  '플랭크': {
    cues: ['팔꿈치를 어깨 바로 아래에 두고 엎드린다', '머리부터 발뒤꿈치까지 일직선을 만든다', '배꼽을 당기고 엉덩이를 살짝 조인다', '숨을 참지 말고 고르게 쉰다'],
    mistakes: ['허리가 처진다', '엉덩이가 너무 높이 솟는다', '숨을 참는다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'erectors', 'glutes'],
  },
  '크런치': {
    cues: ['누워서 무릎을 굽히고 발바닥을 바닥에 둔다', '손은 가슴에 모으거나 귀 옆에 가볍게 댄다', '갈비뼈를 골반 쪽으로 말아 어깨뼈가 뜰 정도로 올라온다', '천천히 내려가며 배의 긴장을 유지한다'],
    mistakes: ['손으로 목을 잡아당긴다', '반동으로 상체를 끝까지 일으킨다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  '레그 레이즈': {
    cues: ['누워서 손을 엉덩이 옆이나 아래에 둔다', '허리를 바닥에 붙인 채 다리를 모아 들어 올린다', '다리가 수직이 될 때까지 올린다', '허리가 뜨지 않는 높이까지 천천히 내린다'],
    mistakes: ['다리를 내릴 때 허리가 바닥에서 뜬다', '반동으로 다리를 휘두른다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  '러시안 트위스트': {
    cues: ['앉아서 무릎을 굽히고 상체를 45° 정도 뒤로 기울인다', '등을 곧게 편 채 가슴을 든다', '어깨와 몸통 전체를 좌우로 번갈아 돌린다', '천천히 조절하며 돌린다'],
    mistakes: ['팔만 좌우로 흔든다', '등이 둥글게 말린다'],
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
  },
  // ── 유산소 ──
  '러닝머신': {
    cues: ['처음 3~5분은 걷기로 몸을 데운다', '상체를 세우고 시선은 앞을 본다', '발은 몸 바로 아래에 가볍게 디딘다', '대화가 가능한 정도의 속도부터 시작한다'],
    mistakes: ['손잡이를 붙잡고 기대어 걷는다', '보폭을 너무 크게 해 뒤꿈치로 세게 내딛는다'],
    primaryMuscles: ['quads', 'calves'],
    secondaryMuscles: ['hamstrings', 'glutes'],
  },
  '사이클': {
    cues: ['페달이 가장 아래일 때 무릎이 살짝 굽도록 안장 높이를 맞춘다', '상체를 편하게 세우고 핸들을 가볍게 잡는다', '페달을 원을 그리듯 일정하게 돌린다', '처음 몇 분은 낮은 강도로 시작한다'],
    mistakes: ['안장이 너무 낮아 무릎이 많이 굽는다', '상체를 좌우로 흔든다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings', 'calves'],
  },
  '로잉 머신': {
    cues: ['다리 → 몸통 → 팔 순서로 당긴다', '다리를 다 편 뒤 상체를 살짝 뒤로 기울이며 손잡이를 명치 쪽으로 당긴다', '돌아갈 때는 팔 → 몸통 → 다리 순서로 돌아간다', '등을 곧게 편 채 움직인다'],
    mistakes: ['팔부터 당겨 다리 힘을 쓰지 못한다', '등을 둥글게 말고 당긴다'],
    primaryMuscles: ['quads', 'lats'],
    secondaryMuscles: ['glutes', 'hamstrings', 'biceps', 'rhomboids'],
  },
  '줄넘기': {
    cues: ['손잡이를 허리 옆에 두고 손목으로 줄을 돌린다', '발 앞쪽으로 가볍게 낮게 뛴다', '무릎을 살짝 굽혀 착지 충격을 흡수한다', '처음에는 짧게 여러 번 나눠 한다'],
    mistakes: ['팔 전체를 크게 돌린다', '너무 높이 뛰어 쉽게 지친다', '뒤꿈치로 착지한다'],
    primaryMuscles: ['calves'],
    secondaryMuscles: ['quads', 'forearms'],
  },
  // ── 기능 5에서 추가한 기본 종목 ──
  // 가슴
  '스미스 머신 벤치 프레스': {
    cues: ['벤치를 바가 가슴 중간 위로 내려오는 위치에 둔다', '어깨뼈를 모아 내리고 발을 바닥에 단단히 둔다', '바를 가슴 중간까지 천천히 내린다', '팔꿈치를 45~70°로 두고 밀어 올린다'],
    mistakes: ['벤치 위치가 맞지 않아 바가 목이나 배 쪽으로 내려온다', '안전 걸쇠를 확인하지 않고 시작한다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '스미스 머신 인클라인 벤치 프레스': {
    cues: ['등받이를 30~45°로 세우고 바가 쇄골 아래로 내려오게 벤치를 맞춘다', '어깨뼈를 모아 가슴을 든다', '바를 가슴 위쪽으로 천천히 내린다', '팔꿈치를 너무 벌리지 않고 밀어 올린다'],
    mistakes: ['등받이를 너무 세워 어깨 운동이 된다', '엉덩이가 벤치에서 뜬다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '인클라인 바벨 벤치 프레스': {
    cues: ['등받이를 30~45°로 세우고 눈이 바 아래에 오게 눕는다', '어깨뼈를 모아 내리고 가슴을 든다', '바를 쇄골 아래 가슴 위쪽으로 내린다', '내릴 때 숨을 들이쉬고 밀며 내쉰다'],
    mistakes: ['바를 가슴 중간까지 내려 궤도가 흔들린다', '팔꿈치를 옆으로 활짝 벌린다', '허리를 크게 띄운다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '디클라인 벤치 프레스': {
    cues: ['발을 패드에 걸어 몸을 고정하고 머리가 아래로 오게 눕는다', '바를 가슴 아래쪽으로 천천히 내린다', '팔꿈치를 몸통 쪽으로 살짝 모아 밀어 올린다', '처음에는 가벼운 무게로 균형을 익힌다'],
    mistakes: ['바를 목 쪽으로 내린다', '보조자 없이 무거운 무게를 쓴다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['triceps', 'frontDelts'],
  },
  '덤벨 벤치 프레스': {
    cues: ['덤벨을 허벅지에 올린 채 누우며 가슴 옆으로 가져온다', '어깨뼈를 모으고 손목을 곧게 편다', '덤벨이 살짝 모이는 궤도로 밀어 올린다', '가슴이 늘어날 때까지 천천히 내린다'],
    mistakes: ['덤벨을 너무 깊이 내려 어깨에 부담을 준다', '양손 높이가 달라진다', '위에서 덤벨을 부딪친다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '체스트 프레스 머신': {
    cues: ['손잡이가 가슴 중간 높이에 오도록 의자를 맞춘다', '등을 등받이에 붙이고 어깨뼈를 모은다', '팔꿈치를 완전히 잠그기 직전까지 민다', '가슴이 늘어날 때까지 천천히 돌아온다'],
    mistakes: ['의자가 낮거나 높아 어깨가 들린다', '무게를 쾅 소리 나게 내려놓는다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts', 'triceps'],
  },
  '펙 덱 플라이': {
    cues: ['손잡이가 가슴 높이에 오도록 의자를 맞춘다', '팔꿈치를 살짝 굽힌 채 고정한다', '가슴을 모은다는 느낌으로 손잡이를 앞으로 모은다', '가슴이 늘어날 정도까지만 천천히 벌린다'],
    mistakes: ['너무 뒤까지 벌려 어깨 앞쪽에 부담을 준다', '팔꿈치를 굽혔다 폈다 하며 민다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts'],
  },
  '인클라인 덤벨 플라이': {
    cues: ['등받이를 30° 정도 세우고 덤벨을 가슴 위로 든다', '팔꿈치를 살짝 굽힌 각도를 끝까지 유지한다', '큰 원을 그리듯 양옆으로 천천히 내린다', '가슴 위쪽을 모은다는 느낌으로 올린다'],
    mistakes: ['팔꿈치를 완전히 편다', '무거운 무게로 프레스처럼 민다'],
    primaryMuscles: ['pectorals'],
    secondaryMuscles: ['frontDelts'],
  },
  // 등
  '어시스티드 머신 풀업': {
    cues: ['무릎이나 발을 패드에 올리고 보조 무게를 정한다(무거울수록 쉽다)', '어깨를 먼저 내린 뒤 가슴을 손잡이 쪽으로 당긴다', '턱이 손잡이 위로 올라갈 때까지 당긴다', '팔이 거의 펴질 때까지 천천히 내려온다'],
    mistakes: ['반동으로 튕겨 올라간다', '내려올 때 힘을 풀고 떨어진다'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rhomboids'],
  },
  '친업': {
    cues: ['손바닥이 나를 향하게 어깨너비로 바를 잡는다', '어깨를 내리고 가슴을 바 쪽으로 끌어올린다', '턱이 바를 넘을 때까지 당긴다', '팔이 거의 펴질 때까지 천천히 내려온다'],
    mistakes: ['다리를 흔들어 반동을 쓴다', '절반만 내려와 가동 범위가 짧다'],
    primaryMuscles: ['lats', 'biceps'],
    secondaryMuscles: ['rhomboids', 'forearms'],
  },
  '원암 덤벨 로우': {
    cues: ['한 손과 한 무릎을 벤치에 올리고 등을 곧게 편다', '덤벨을 엉덩이 쪽으로 끌어당긴다', '팔꿈치를 몸통 가까이 붙여 뒤로 보낸다', '팔이 펴질 때까지 천천히 내린다'],
    mistakes: ['몸통을 비틀며 들어 올린다', '어깨를 으쓱 올려 당긴다'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['rhomboids', 'biceps', 'rearDelts'],
  },
  '티바 로우': {
    cues: ['바를 다리 사이에 두고 손잡이를 잡은 뒤 상체를 45° 정도 숙인다', '등을 곧게 편 채 손잡이를 가슴 아래로 당긴다', '당긴 끝에서 어깨뼈를 모은다', '상체 각도를 유지하며 천천히 내린다'],
    mistakes: ['상체를 일으키며 반동으로 당긴다', '허리가 둥글게 말린다'],
    primaryMuscles: ['lats', 'rhomboids'],
    secondaryMuscles: ['biceps', 'rearDelts', 'erectors'],
  },
  '시티드 머신 로우': {
    cues: ['가슴을 패드에 대고 손잡이가 팔을 뻗은 위치에 오게 의자를 맞춘다', '손잡이를 몸통 쪽으로 당기며 가슴을 편다', '당긴 끝에서 어깨뼈를 모은다', '팔이 펴질 때까지 천천히 보낸다'],
    mistakes: ['가슴을 패드에서 떼며 몸으로 당긴다', '어깨를 으쓱 올린다'],
    primaryMuscles: ['lats', 'rhomboids'],
    secondaryMuscles: ['biceps', 'rearDelts'],
  },
  '스트레이트 암 풀다운': {
    cues: ['케이블 앞에서 상체를 살짝 숙이고 바를 어깨너비로 잡는다', '팔꿈치를 살짝 굽힌 채 고정한다', '바를 허벅지 쪽으로 큰 원을 그리며 내린다', '광배근이 늘어나는 높이까지 천천히 올린다'],
    mistakes: ['팔꿈치를 굽혔다 폈다 하며 푸시다운이 된다', '상체를 크게 숙였다 폈다 한다'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['triceps', 'abs'],
  },
  '백 익스텐션': {
    cues: ['골반이 패드 끝에 오게 서고 발목을 고정한다', '등을 곧게 편 채 엉덩이를 축으로 상체를 숙인다', '몸이 일직선이 될 때까지 올라온다', '천천히 내려간다'],
    mistakes: ['위에서 허리를 과하게 젖힌다', '반동으로 빠르게 반복한다'],
    primaryMuscles: ['erectors'],
    secondaryMuscles: ['glutes', 'hamstrings'],
  },
  '바벨 슈러그': {
    cues: ['바를 허벅지 앞에 들고 팔을 편다', '어깨를 귀 쪽으로 곧장 끌어올린다', '위에서 1초 멈춘다', '천천히 내린다'],
    mistakes: ['어깨를 앞뒤로 돌린다', '팔꿈치를 굽혀 당긴다'],
    primaryMuscles: ['traps'],
    secondaryMuscles: ['forearms'],
  },
  '덤벨 슈러그': {
    cues: ['덤벨을 몸 옆에 들고 팔을 편다', '어깨를 귀 쪽으로 곧장 끌어올린다', '위에서 1초 멈춘다', '천천히 내린다'],
    mistakes: ['어깨를 돌린다', '고개를 앞으로 내민다'],
    primaryMuscles: ['traps'],
    secondaryMuscles: ['forearms'],
  },
  // 어깨
  '스미스 머신 오버헤드 프레스': {
    cues: ['벤치를 바가 얼굴 앞을 지나는 위치에 두고 등받이를 세운다', '바를 턱 높이에서 시작한다', '머리 위로 곧게 민다', '턱 높이까지 천천히 내린다'],
    mistakes: ['허리를 등받이에서 떼고 젖힌다', '바를 목 뒤로 내린다'],
    primaryMuscles: ['frontDelts', 'sideDelts'],
    secondaryMuscles: ['triceps', 'traps'],
  },
  '아놀드 프레스': {
    cues: ['덤벨을 손바닥이 나를 향하게 턱 앞에 든다', '밀어 올리며 손바닥이 앞을 향하도록 돌린다', '머리 위에서 팔을 거의 편다', '같은 궤도로 돌리며 천천히 내린다'],
    mistakes: ['허리를 젖히며 민다', '너무 빠르게 돌려 궤도가 흔들린다'],
    primaryMuscles: ['frontDelts', 'sideDelts'],
    secondaryMuscles: ['triceps'],
  },
  '머신 숄더 프레스': {
    cues: ['손잡이가 어깨 높이에 오도록 의자를 맞춘다', '등을 등받이에 붙인다', '팔꿈치를 잠그기 직전까지 위로 민다', '어깨 높이까지 천천히 내린다'],
    mistakes: ['의자가 낮아 시작 위치가 너무 깊다', '허리를 띄운다'],
    primaryMuscles: ['frontDelts', 'sideDelts'],
    secondaryMuscles: ['triceps'],
  },
  '벤트 오버 리어 델트 레이즈': {
    cues: ['엉덩이를 뒤로 빼 상체를 거의 바닥과 평행하게 숙인다', '덤벨을 늘어뜨리고 팔꿈치를 살짝 굽힌다', '양팔을 옆으로 벌려 어깨 높이까지 든다', '천천히 내린다'],
    mistakes: ['상체를 일으키며 반동을 쓴다', '어깨뼈만 모아 등 운동이 된다'],
    primaryMuscles: ['rearDelts'],
    secondaryMuscles: ['rhomboids', 'traps'],
  },
  '리버스 펙 덱': {
    cues: ['가슴을 패드에 대고 손잡이가 어깨 높이에 오게 맞춘다', '팔꿈치를 살짝 굽힌 채 손잡이를 잡는다', '양팔을 뒤로 벌려 몸통과 일직선까지 보낸다', '천천히 돌아온다'],
    mistakes: ['어깨를 으쓱 올린다', '너무 무거운 무게로 몸을 흔든다'],
    primaryMuscles: ['rearDelts'],
    secondaryMuscles: ['rhomboids', 'traps'],
  },
  '케이블 레터럴 레이즈': {
    cues: ['케이블을 가장 낮게 두고 반대쪽 손으로 손잡이를 잡는다', '팔꿈치를 살짝 굽힌 채 옆으로 든다', '어깨 높이까지 올리고 잠시 멈춘다', '천천히 내리며 긴장을 유지한다'],
    mistakes: ['몸통을 기울여 반동을 쓴다', '어깨를 으쓱 올린다'],
    primaryMuscles: ['sideDelts'],
    secondaryMuscles: ['traps'],
  },
  '업라이트 로우': {
    cues: ['바를 어깨너비 정도로 잡고 허벅지 앞에 든다', '팔꿈치가 손보다 높게 가도록 바를 몸에 붙여 끌어올린다', '바가 가슴 아래에 오면 멈춘다', '천천히 내린다'],
    mistakes: ['손을 너무 좁게 잡아 어깨에 부담을 준다', '턱 높이까지 과하게 올린다'],
    primaryMuscles: ['sideDelts', 'traps'],
    secondaryMuscles: ['frontDelts', 'biceps'],
  },
  // 하체
  '프론트 스쿼트': {
    cues: ['바를 어깨 앞쪽(쇄골 위)에 올리고 팔꿈치를 높이 든다', '상체를 세운 채 엉덩이를 내리며 앉는다', '무릎은 발끝 방향으로 보낸다', '팔꿈치를 계속 든 채 발바닥 전체로 밀고 일어선다'],
    mistakes: ['팔꿈치가 떨어져 바가 앞으로 굴러간다', '상체가 앞으로 무너진다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'abs', 'erectors'],
  },
  '고블릿 스쿼트': {
    cues: ['덤벨 한 개를 세워 가슴 앞에 두 손으로 든다', '발을 어깨너비로 두고 엉덩이를 내리며 앉는다', '팔꿈치가 무릎 안쪽을 지나도록 깊게 내려간다', '상체를 세운 채 일어선다'],
    mistakes: ['덤벨이 가슴에서 떨어지며 상체가 숙여진다', '뒤꿈치가 뜬다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs'],
  },
  '불가리안 스플릿 스쿼트': {
    cues: ['뒷발을 벤치에 올리고 앞발은 크게 앞으로 둔다', '상체를 세운 채 뒷무릎을 바닥 쪽으로 내린다', '앞무릎은 발끝 방향으로 둔다', '앞발 뒤꿈치로 밀어 일어선다'],
    mistakes: ['앞발이 벤치에 너무 가까워 무릎이 많이 나간다', '몸이 좌우로 흔들린다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  '스미스 머신 스쿼트': {
    cues: ['바를 등 위쪽에 얹고 발을 바보다 살짝 앞에 둔다', '엉덩이를 뒤로 빼며 앉는다', '무릎은 발끝 방향으로 둔다', '발바닥 전체로 밀고 일어선다'],
    mistakes: ['발을 바 바로 아래 두어 무릎이 많이 나간다', '안전 걸쇠 높이를 정하지 않는다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  '핵 스쿼트': {
    cues: ['등과 어깨를 패드에 붙이고 발을 발판 가운데에 둔다', '무릎을 굽혀 천천히 내려간다', '허벅지가 발판과 평행할 즈음까지 내려간다', '발바닥 전체로 밀어 올라온다'],
    mistakes: ['위에서 무릎을 잠근다', '엉덩이가 패드에서 뜬다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
  },
  '힙 쓰러스트': {
    cues: ['어깨뼈 아래를 벤치에 대고 바를 골반 위에 둔다(패드 사용)', '발은 어깨너비로 두고 정강이가 수직이 되게 한다', '엉덩이를 밀어 올려 무릎부터 어깨까지 일직선을 만든다', '위에서 엉덩이를 조이고 천천히 내린다'],
    mistakes: ['위에서 허리를 과하게 젖힌다', '발이 너무 앞에 있어 햄스트링으로 민다'],
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings', 'quads'],
  },
  '덤벨 루마니안 데드리프트': {
    cues: ['덤벨을 허벅지 앞에 들고 무릎을 살짝 굽힌다', '엉덩이를 뒤로 밀며 덤벨을 다리 앞을 따라 내린다', '허벅지 뒤가 늘어날 때까지 내리되 등은 곧게 편다', '엉덩이를 앞으로 밀며 일어선다'],
    mistakes: ['등이 둥글게 말린다', '덤벨이 몸에서 멀어진다'],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['erectors', 'forearms'],
  },
  '힙 어브덕션 머신': {
    cues: ['등을 등받이에 붙이고 패드를 무릎 바깥쪽에 댄다', '무릎을 바깥으로 벌린다', '끝에서 엉덩이 옆을 조이며 잠시 멈춘다', '천천히 모은다'],
    mistakes: ['상체를 앞으로 숙이며 반동을 쓴다', '무게를 탁 놓아 돌아온다'],
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
  },
  '시티드 카프 레이즈': {
    cues: ['패드를 무릎 위에 대고 발 앞쪽을 발판에 둔다', '발끝으로 최대한 높이 올라간다', '위에서 1~2초 멈춘다', '종아리가 늘어날 때까지 천천히 내린다'],
    mistakes: ['튕기듯 빠르게 반복한다', '가동 범위를 짧게 쓴다'],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },
  '스텝업': {
    cues: ['무릎 높이 정도의 단 앞에 서서 한 발을 단 위에 올린다', '올린 발 뒤꿈치로 밀어 몸을 들어 올린다', '단 위에서 똑바로 선다', '천천히 내려오고 같은 발로 반복한다'],
    mistakes: ['아래쪽 발로 바닥을 차 반동을 쓴다', '앞무릎이 안쪽으로 모인다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves'],
  },
  '케틀벨 스윙': {
    cues: ['발을 어깨너비보다 넓게 두고 케틀벨을 두 손으로 잡는다', '엉덩이를 뒤로 빼며 케틀벨을 다리 사이로 보낸다', '엉덩이를 강하게 앞으로 밀어 케틀벨을 가슴 높이까지 띄운다', '팔은 힘을 빼고 줄처럼 둔다'],
    mistakes: ['스쿼트처럼 무릎을 많이 굽혀 앉는다', '팔로 들어 올린다', '등이 둥글게 말린다'],
    primaryMuscles: ['glutes', 'hamstrings'],
    secondaryMuscles: ['erectors', 'abs', 'forearms'],
  },
  // 팔
  '덤벨 컬': {
    cues: ['덤벨을 손바닥이 앞을 향하게 들고 팔꿈치를 옆구리에 붙인다', '팔꿈치를 고정한 채 덤벨을 어깨 쪽으로 감아올린다', '위에서 이두근을 조인다', '팔이 거의 펴질 때까지 천천히 내린다'],
    mistakes: ['몸을 흔들어 반동을 쓴다', '팔꿈치가 앞으로 나온다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  '인클라인 덤벨 컬': {
    cues: ['등받이를 45~60°로 세우고 팔을 아래로 늘어뜨린다', '팔꿈치를 고정한 채 덤벨을 감아올린다', '위에서 잠시 멈춘다', '팔이 펴질 때까지 천천히 내린다'],
    mistakes: ['어깨가 앞으로 나오며 팔꿈치가 움직인다', '무거운 무게로 가동 범위를 줄인다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  '프리처 컬': {
    cues: ['겨드랑이를 패드 위쪽에 걸치고 팔 뒤쪽을 패드에 붙인다', '바(또는 이지 바)를 어깨 쪽으로 감아올린다', '위에서 이두근을 조인다', '팔이 거의 펴질 때까지 천천히 내린다'],
    mistakes: ['아래에서 팔을 완전히 펴며 힘을 푼다', '엉덩이를 들며 몸으로 당긴다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  '케이블 컬': {
    cues: ['케이블을 가장 낮게 두고 바를 손바닥이 위로 향하게 잡는다', '팔꿈치를 옆구리에 붙인 채 감아올린다', '위에서 잠시 멈춘다', '긴장을 유지하며 천천히 내린다'],
    mistakes: ['상체를 뒤로 젖힌다', '팔꿈치가 앞으로 나온다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  '컨센트레이션 컬': {
    cues: ['벤치에 앉아 팔꿈치를 허벅지 안쪽에 댄다', '덤벨을 어깨 쪽으로 감아올린다', '위에서 이두근을 조인다', '천천히 내린다'],
    mistakes: ['몸통을 들어 올리며 반동을 쓴다', '손목을 꺾는다'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
  },
  '덤벨 오버헤드 트라이셉스 익스텐션': {
    cues: ['덤벨 한 개를 두 손으로 머리 위에 든다', '팔꿈치를 앞을 향하게 고정하고 덤벨을 머리 뒤로 내린다', '팔꿈치를 펴며 머리 위로 올린다', '허리가 젖혀지지 않게 배에 힘을 준다'],
    mistakes: ['팔꿈치가 양옆으로 벌어진다', '허리를 젖힌다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  '케이블 오버헤드 트라이셉스 익스텐션': {
    cues: ['케이블을 등지고 서서 로프를 머리 뒤에서 잡는다', '팔꿈치를 귀 옆에 고정한다', '팔꿈치를 펴며 로프를 앞위로 민다', '팔 뒤가 늘어날 때까지 천천히 돌아온다'],
    mistakes: ['팔꿈치가 앞뒤로 움직인다', '상체를 숙였다 폈다 한다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  '클로즈 그립 벤치 프레스': {
    cues: ['바를 어깨너비 정도로 좁게 잡는다', '팔꿈치를 몸통 가까이 붙인 채 바를 가슴 아래쪽으로 내린다', '팔 뒤쪽으로 민다는 느낌으로 밀어 올린다', '손목을 곧게 유지한다'],
    mistakes: ['손을 너무 좁게 잡아 손목에 부담을 준다', '팔꿈치가 옆으로 벌어진다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['pectorals', 'frontDelts'],
  },
  '덤벨 킥백': {
    cues: ['한 손과 무릎을 벤치에 대고 등을 평평하게 한다', '위팔을 몸통과 나란히 고정한다', '팔꿈치를 펴 덤벨을 뒤로 보낸다', '천천히 굽힌다'],
    mistakes: ['위팔이 아래로 떨어진다', '반동으로 덤벨을 휘두른다'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  '리스트 컬': {
    cues: ['벤치에 앉아 팔뚝을 허벅지에 올리고 손목만 무릎 밖으로 낸다', '손바닥이 위를 향하게 덤벨을 잡는다', '손목을 말아 덤벨을 들어 올린다', '천천히 내린다'],
    mistakes: ['팔뚝이 허벅지에서 뜬다', '무거운 무게로 빠르게 튕긴다'],
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
  },
  // 코어
  '행잉 레그 레이즈': {
    cues: ['바에 매달려 어깨를 내리고 몸을 고정한다', '다리를 모아 들어 올리며 골반을 말아 올린다', '다리가 바닥과 평행하거나 그보다 높게 올린다', '흔들리지 않게 천천히 내린다'],
    mistakes: ['몸을 흔들어 반동을 쓴다', '다리만 들고 골반을 말지 않는다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'forearms'],
  },
  '케이블 크런치': {
    cues: ['케이블 앞에 무릎을 꿇고 로프를 머리 옆에 잡는다', '엉덩이는 고정하고 갈비뼈를 골반 쪽으로 말아 내린다', '끝에서 배를 조인다', '천천히 돌아온다'],
    mistakes: ['엉덩이를 뒤로 앉으며 몸무게로 당긴다', '팔로 당긴다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  '사이드 플랭크': {
    cues: ['옆으로 누워 팔꿈치를 어깨 바로 아래에 둔다', '엉덩이를 들어 머리부터 발까지 일직선을 만든다', '배와 엉덩이에 힘을 주고 버틴다', '숨을 고르게 쉰다'],
    mistakes: ['엉덩이가 처진다', '몸이 앞이나 뒤로 기운다'],
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs', 'glutes'],
  },
  '앱 롤아웃': {
    cues: ['무릎을 꿇고 휠을 어깨 아래에 둔다', '배에 힘을 주고 허리가 처지지 않게 휠을 앞으로 굴린다', '버틸 수 있는 만큼만 나간다', '배로 당겨 돌아온다'],
    mistakes: ['허리가 처진다', '처음부터 너무 멀리 나간다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['lats', 'obliques'],
  },
  '마운틴 클라이머': {
    cues: ['손을 어깨 아래에 짚고 푸시업 자세를 만든다', '한쪽 무릎을 가슴 쪽으로 당긴다', '다리를 번갈아 빠르게 바꾼다', '엉덩이 높이를 일정하게 유지한다'],
    mistakes: ['엉덩이가 솟거나 처진다', '어깨가 손보다 뒤로 빠진다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['quads', 'frontDelts'],
  },
  '데드버그': {
    cues: ['누워서 팔을 위로 뻗고 무릎을 90°로 든다', '허리를 바닥에 붙인 채 한쪽 팔과 반대쪽 다리를 천천히 뻗는다', '바닥에 닿기 직전까지만 뻗는다', '돌아와 반대쪽으로 바꾼다'],
    mistakes: ['허리가 바닥에서 뜬다', '빠르게 휘두른다'],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  // 유산소
  '일립티컬': {
    cues: ['발판에 발 전체를 올리고 손잡이를 가볍게 잡는다', '상체를 세운다', '처음 몇 분은 낮은 저항으로 시작한다', '일정한 속도로 밟는다'],
    mistakes: ['손잡이에 기대 체중을 싣는다', '발끝으로만 밟는다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves'],
  },
  '스텝밀': {
    cues: ['손잡이는 균형을 잡을 정도로만 가볍게 잡는다', '상체를 세우고 발 전체로 계단을 딛는다', '대화가 가능한 속도부터 시작한다', '숨을 고르게 쉰다'],
    mistakes: ['손잡이에 매달려 오른다', '발끝으로만 딛는다'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['calves', 'hamstrings'],
  },
  '버피': {
    cues: ['선 자세에서 쪼그려 앉아 손을 바닥에 짚는다', '두 발을 뒤로 보내 푸시업 자세를 만든다', '발을 손 쪽으로 당겨 일어나며 가볍게 뛴다', '처음에는 천천히 정확하게 한다'],
    mistakes: ['허리가 처진 채 발을 뒤로 보낸다', '착지할 때 무릎이 안쪽으로 모인다'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['pectorals', 'glutes', 'abs'],
  },
  // 밴드
  '밴드 풀 어파트': {
    cues: ['밴드를 어깨너비로 잡고 팔을 어깨 높이로 앞으로 뻗는다', '팔꿈치를 편 채 밴드를 양옆으로 벌린다', '끝에서 어깨뼈를 모은다', '천천히 돌아온다'],
    mistakes: ['어깨를 으쓱 올린다', '허리를 젖힌다'],
    primaryMuscles: ['rearDelts'],
    secondaryMuscles: ['rhomboids', 'traps'],
  },
  '밴드 로우': {
    cues: ['밴드를 발이나 기둥에 걸고 양 끝을 잡는다', '등을 곧게 편 채 손을 배꼽 쪽으로 당긴다', '당긴 끝에서 어깨뼈를 모은다', '천천히 보낸다'],
    mistakes: ['상체를 젖히며 당긴다', '어깨를 으쓱 올린다'],
    primaryMuscles: ['lats', 'rhomboids'],
    secondaryMuscles: ['biceps', 'rearDelts'],
  },
};

const GUIDES: BuiltinGuide[] = SEED_EXERCISES.flatMap((e) => {
  const t = BY_NAME[e.name];
  return t ? [{ exerciseId: e.id, ...t }] : [];
});
const BY_ID = new Map(GUIDES.map((g) => [g.exerciseId, g]));

export const listBuiltinGuides = (): BuiltinGuide[] => GUIDES;
export const getBuiltinGuide = (exerciseId: string): BuiltinGuide | undefined => BY_ID.get(exerciseId);
