// 기본 종목 35개의 텍스트 가이드 (기능 2, research G11). 일반적인 근력 운동 지도 상식에 기반한 참고 자료이며 의학적 조언이 아니다.
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
};

const GUIDES: BuiltinGuide[] = SEED_EXERCISES.flatMap((e) => {
  const t = BY_NAME[e.name];
  return t ? [{ exerciseId: e.id, ...t }] : [];
});
const BY_ID = new Map(GUIDES.map((g) => [g.exerciseId, g]));

export const listBuiltinGuides = (): BuiltinGuide[] => GUIDES;
export const getBuiltinGuide = (exerciseId: string): BuiltinGuide | undefined => BY_ID.get(exerciseId);
