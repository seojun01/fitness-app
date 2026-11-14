// 성장 통계 계산 (기능 004). 날짜는 기기 현지 기준이므로 시간대를 고정한다.
process.env.TZ = 'Asia/Seoul';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BodyPart, Session, SetEntry } from '../model.ts';
import {
  addDays,
  bodyPartShare,
  buckets,
  calendarMonth,
  dayKey,
  exerciseSeries,
  exercisesByRecency,
  periodRange,
  personalRecords,
  previousRange,
  summarizeRange,
} from '../growth.ts';
import { exerciseRecords } from '../stats.ts';

const BENCH = '00000000-0000-4000-8000-0000000000a1';
const SQUAT = '00000000-0000-4000-8000-0000000000a2';
const PULLUP = '00000000-0000-4000-8000-0000000000a3';
const GONE = '00000000-0000-4000-8000-0000000000a9';

const set = (w: number | null, r: number | null, done = true): SetEntry => ({ setId: crypto.randomUUID(), weightKg: w, reps: r, done });
let n = 0;
/** start 는 현지(서울) 시각 'YYYY-MM-DDTHH:MM', 길이는 분 */
function session(start: string, entries: { ex: string; sets: SetEntry[]; name?: string }[], over: Partial<Session> & { minutes?: number } = {}): Session {
  const { minutes = 60, ...rest } = over;
  const startedAt = new Date(`${start}:00+09:00`).toISOString();
  const endedAt = new Date(Date.parse(startedAt) + minutes * 60_000).toISOString();
  return {
    id: `s${++n}`, status: 'completed', routineId: null, routineName: null, startedAt, endedAt, startedBy: 'd',
    entries: entries.map((e) => ({ entryId: crypto.randomUUID(), exerciseId: e.ex, exerciseName: e.name ?? 'x', sets: e.sets })),
    deleted: false, version: 'v', updatedBy: 'd', ...rest,
  };
}
const NOW = new Date('2026-11-15T12:00:00+09:00'); // 일요일

// ── 날짜·기간 (T004) ──

test('dayKey: 기기 현지 날짜 (자정 직전·직후)', () => {
  assert.equal(dayKey(new Date('2026-11-14T23:59:00+09:00').toISOString()), '2026-11-14');
  assert.equal(dayKey(new Date('2026-11-15T00:01:00+09:00').toISOString()), '2026-11-15');
  assert.equal(dayKey('2026-11-14T15:30:00.000Z'), '2026-11-15', 'UTC 15:30 = 서울 다음 날 00:30');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('periodRange: 4주 = 오늘 포함 28일, 3개월·1년 = 달력 기준, 전체 = 첫 기록부터', () => {
  assert.deepEqual(periodRange('4w', NOW), { start: '2026-10-19', end: '2026-11-15', days: 28 });
  assert.deepEqual(periodRange('3m', NOW), { start: '2026-08-16', end: '2026-11-15', days: 92 });
  assert.deepEqual(periodRange('1y', NOW), { start: '2025-11-16', end: '2026-11-15', days: 365 });
  // 말일: 5/31 의 3개월 전은 2/28(없는 날은 말일로) → 다음 날 3/1
  assert.equal(periodRange('3m', new Date('2026-05-31T09:00:00+09:00'))!.start, '2026-03-01');
  assert.deepEqual(periodRange('all', NOW, '2026-11-01'), { start: '2026-11-01', end: '2026-11-15', days: 15 });
  assert.equal(periodRange('all', NOW), null, '기록이 없으면 전체 기간도 없다');
});

test('previousRange: 바로 앞, 같은 일수', () => {
  assert.deepEqual(previousRange({ start: '2026-10-19', end: '2026-11-15', days: 28 }), { start: '2026-09-21', end: '2026-10-18', days: 28 });
});

// ── 요약·막대 (T012) ──

test('summarizeRange: 완료 세션만, 볼륨은 완료 세트 무게×횟수, 시간은 끝−시작', () => {
  const s = [
    session('2026-11-10T19:00', [{ ex: BENCH, sets: [set(60, 10), set(60, 8), set(70, 5, false), set(null, null)] }], { minutes: 50 }),
    session('2026-11-14T19:00', [{ ex: SQUAT, sets: [set(100, 5)] }], { minutes: 30 }),
    session('2026-11-12T19:00', [{ ex: SQUAT, sets: [set(999, 1)] }], { deleted: true }),
    { ...session('2026-11-13T19:00', [{ ex: SQUAT, sets: [set(999, 1)] }]), status: 'active', endedAt: null },
    session('2026-10-01T19:00', [{ ex: SQUAT, sets: [set(999, 1)] }]), // 기간 밖
  ] as Session[];
  assert.deepEqual(summarizeRange(s, periodRange('4w', NOW)!), { sessions: 2, volumeKg: 600 + 480 + 500, durationSec: 80 * 60 });
  // 끝이 시작보다 앞서는 깨진 기록은 0초
  const broken = { ...session('2026-11-11T10:00', []), endedAt: new Date('2026-11-11T09:00:00+09:00').toISOString() };
  assert.equal(summarizeRange([broken], periodRange('4w', NOW)!).durationSec, 0);
});

test('buckets: 월요일 시작 주별, 운동 안 한 주는 0, 기간 밖 날은 세지 않는다', () => {
  const s = [
    session('2026-11-16T09:00', [{ ex: BENCH, sets: [set(1, 1)] }]), // 미래(기간 밖)
    session('2026-11-15T09:00', [{ ex: BENCH, sets: [set(50, 10)] }]), // 일요일 → 11/9 주
    session('2026-11-09T09:00', [{ ex: BENCH, sets: [set(50, 10)] }]), // 월요일
    session('2026-11-08T23:30', [{ ex: BENCH, sets: [set(40, 10)] }]), // 일요일 밤 → 11/2 주
    session('2026-10-18T09:00', [{ ex: BENCH, sets: [set(1, 1)] }]), // 기간 시작 전날(같은 주지만 밖)
  ];
  const b = buckets(s, periodRange('4w', NOW)!);
  assert.equal(b.unit, 'week');
  assert.deepEqual(b.items.map((x) => [x.start, x.label, x.sessions, x.volumeKg]), [
    ['2026-10-19', '10/19', 0, 0],
    ['2026-10-26', '10/26', 0, 0],
    ['2026-11-02', '11/2', 1, 400],
    ['2026-11-09', '11/9', 2, 1000],
  ]);
  // 기간이 수요일에 시작하면 그 주(월요일)부터 막대가 있다
  const mid = buckets([], { start: '2026-11-11', end: '2026-11-15', days: 5 });
  assert.deepEqual(mid.items.map((x) => x.start), ['2026-11-09']);
});

test('buckets: 371일을 넘으면 월별, 라벨 YY.M', () => {
  const s = [session('2025-01-20T09:00', [{ ex: BENCH, sets: [set(10, 10)] }]), session('2026-11-02T09:00', [{ ex: BENCH, sets: [set(20, 10)] }])];
  const r = periodRange('all', NOW, '2025-01-20')!;
  const b = buckets(s, r);
  assert.equal(b.unit, 'month');
  assert.equal(b.items.length, 23); // 2025-01 ~ 2026-11
  assert.deepEqual([b.items[0]!.label, b.items[0]!.sessions, b.items[0]!.volumeKg], ['25.1', 1, 100]);
  assert.deepEqual([b.items.at(-1)!.label, b.items.at(-1)!.sessions], ['26.11', 1]);
  assert.equal(b.items[5]!.sessions, 0);
});

// ── 부위 비중 (T017) ──

test('bodyPartShare: 완료 세트 수 비중, 8부위 모두, 많은 순·0세트는 아래, 모르는 종목은 기타', () => {
  const ex = new Map<string, { bodyPart: BodyPart }>([[BENCH, { bodyPart: 'chest' }], [SQUAT, { bodyPart: 'legs' }], [PULLUP, { bodyPart: 'back' }]]);
  const s = [
    session('2026-11-10T09:00', [{ ex: BENCH, sets: [set(60, 10), set(60, 10), set(60, 10), set(60, 10, false)] }, { ex: SQUAT, sets: [set(100, 5)] }]),
    session('2026-11-12T09:00', [{ ex: BENCH, sets: [set(60, 10), set(60, 10), set(60, 10)] }, { ex: SQUAT, sets: [set(100, 5), set(100, 5)] }, { ex: GONE, sets: [set(0, 10)] }]),
  ];
  const share = bodyPartShare(s, ex, periodRange('4w', NOW)!);
  assert.equal(share.length, 8);
  assert.deepEqual(share.slice(0, 3).map((p) => [p.part, p.sets, Math.round(p.ratio * 100)]), [['chest', 6, 60], ['legs', 3, 30], ['other', 1, 10]]);
  assert.deepEqual(share.slice(3).map((p) => [p.part, p.sets]), [['back', 0], ['shoulders', 0], ['arms', 0], ['core', 0], ['cardio', 0]]);
  assert.equal(share[0]!.volumeKg, 3600);
  assert.deepEqual(share[0]!.exerciseIds, [BENCH]);
  assert.deepEqual(share[2]!.exerciseIds, [GONE]);
  assert.ok(bodyPartShare([], ex, periodRange('4w', NOW)!).every((p) => p.ratio === 0 && p.sets === 0));
});

// ── 종목 추이·PR (T006) ──

test('exerciseSeries: 세션당 점 하나(같은 세션 중복 종목은 합침), 날짜순, 지표 계산', () => {
  const s = [
    session('2026-11-12T09:00', [{ ex: BENCH, sets: [set(70, 5), set(70, 3)] }]),
    session('2026-11-03T09:00', [{ ex: BENCH, sets: [set(60, 10)] }, { ex: SQUAT, sets: [set(100, 5)] }, { ex: BENCH, sets: [set(65, 6), set(80, 1, false)] }]),
    session('2026-11-05T09:00', [{ ex: BENCH, sets: [set(60, 5, false)] }]), // 완료 세트 없음 → 점 없음
  ];
  const r = exerciseSeries(BENCH, s, periodRange('4w', NOW)!);
  assert.equal(r.grouped, false);
  assert.equal(r.bodyweightLike, false);
  assert.deepEqual(r.points.map((p) => p.day), ['2026-11-03', '2026-11-12']);
  const p0 = r.points[0]!;
  assert.equal(p0.e1rmKg, 80); // 60×(1+10/30)=80, 65×(1+6/30)=78
  assert.equal(p0.maxWeightKg, 65);
  assert.equal(p0.volumeKg, 600 + 390);
  assert.equal(p0.totalReps, 16);
  assert.equal(p0.maxReps, 10);
  assert.equal(p0.sets.length, 2);
  assert.equal(r.points[1]!.e1rmKg, 81.7); // 70×(1+5/30)=81.666…
  assert.deepEqual(exerciseSeries(BENCH, s, { start: '2026-11-04', end: '2026-11-15', days: 12 }).points.length, 1, '기간 밖 점은 뺀다');
});

test('exerciseSeries: 점이 60개를 넘으면 주별 최고값으로 묶는다', () => {
  const s: Session[] = [];
  for (let i = 0; i < 70; i++) {
    const d = addDays('2026-07-01', i);
    s.push(session(`${d}T09:00`, [{ ex: BENCH, sets: [set(50 + i, 5)] }]));
  }
  const r = exerciseSeries(BENCH, s, periodRange('1y', NOW)!);
  assert.equal(r.grouped, true);
  assert.ok(r.points.length <= 12);
  assert.equal(r.points[0]!.day, '2026-06-29', '그 주 월요일');
  assert.equal(r.points[0]!.maxWeightKg, 50 + 4, '7/1~7/5 중 최대');
  assert.deepEqual(r.points[0]!.sets, []);
  assert.equal(r.points.at(-1)!.maxWeightKg, 119);
});

test('exerciseSeries: 무게가 모두 0이면 맨몸처럼 다룬다', () => {
  const s = [session('2026-11-10T09:00', [{ ex: PULLUP, sets: [set(0, 8), set(0, 6)] }])];
  const r = exerciseSeries(PULLUP, s, periodRange('4w', NOW)!);
  assert.equal(r.bodyweightLike, true);
  assert.equal(r.points[0]!.totalReps, 14);
  assert.equal(exerciseSeries(PULLUP, [], periodRange('4w', NOW)!).bodyweightLike, false);
});

test('personalRecords: 전체 기간, 같은 값이면 먼저 달성한 날, 진행 화면 기록과 같은 값', () => {
  const a = session('2025-03-01T09:00', [{ ex: BENCH, sets: [set(80, 5)] }]);
  const b = session('2026-11-01T09:00', [{ ex: BENCH, sets: [set(80, 5), set(60, 12)] }]);
  const c = session('2026-11-10T09:00', [{ ex: BENCH, sets: [set(75, 8)] }]);
  const pr = personalRecords(BENCH, [c, b, a]);
  assert.deepEqual(pr.maxWeight, { value: 80, day: '2025-03-01', sessionId: a.id });
  assert.deepEqual(pr.e1rm, { value: 95, day: '2026-11-10', sessionId: c.id }); // 75×(1+8/30)=95
  assert.deepEqual(pr.sessionVolume, { value: 1120, day: '2026-11-01', sessionId: b.id });
  assert.deepEqual(pr.maxReps, { value: 12, day: '2026-11-01', sessionId: b.id });
  assert.deepEqual(pr.sessionReps, { value: 17, day: '2026-11-01', sessionId: b.id });
  const rec = exerciseRecords(BENCH, [a, b, c]);
  assert.equal(pr.e1rm!.value, rec.best1rmKg);
  assert.equal(pr.maxWeight!.value, rec.maxWeightKg);
  const none = personalRecords(SQUAT, [a]);
  assert.deepEqual(none, { e1rm: null, maxWeight: null, sessionVolume: null, maxReps: null, sessionReps: null });
  // 맨몸: 무게 기록은 없고 횟수 기록만
  const bw = personalRecords(PULLUP, [session('2026-11-10T09:00', [{ ex: PULLUP, sets: [set(0, 8)] }])]);
  assert.equal(bw.e1rm, null);
  assert.equal(bw.maxWeight, null);
  assert.equal(bw.sessionVolume, null);
  assert.equal(bw.maxReps!.value, 8);
});

test('exercisesByRecency: 완료 세트가 있는 종목만, 최근 순, 마지막 이름', () => {
  const s = [
    session('2026-11-01T09:00', [{ ex: BENCH, sets: [set(60, 5)], name: '벤치' }, { ex: SQUAT, sets: [set(100, 5, false)] }]),
    session('2026-11-10T09:00', [{ ex: PULLUP, sets: [set(0, 8)], name: '풀업' }]),
    session('2026-11-05T09:00', [{ ex: BENCH, sets: [set(60, 5)], name: '벤치 프레스' }]),
  ];
  assert.deepEqual(exercisesByRecency(s), [
    { exerciseId: PULLUP, name: '풀업', lastDay: '2026-11-10', sessions: 1 },
    { exerciseId: BENCH, name: '벤치 프레스', lastDay: '2026-11-05', sessions: 2 },
  ]);
});

// ── 달력 (T021) ──

test('calendarMonth: 월요일 시작 격자, 앞뒤 달은 세지 않음, 운동 일수', () => {
  const a = session('2026-11-03T09:00', [{ ex: BENCH, sets: [set(60, 5)] }]);
  const b = session('2026-11-03T19:00', [{ ex: BENCH, sets: [set(60, 5)] }]);
  const c = session('2026-11-10T09:00', [{ ex: BENCH, sets: [set(60, 5)] }]);
  const d = session('2026-10-31T09:00', [{ ex: BENCH, sets: [set(60, 5)] }]); // 앞 달
  const cal = calendarMonth([c, b, a, d], 2026, 11);
  assert.equal(cal.weeks.length, 6); // 11/1 이 일요일 → 10/26 부터 12/6 까지
  assert.equal(cal.weeks[0]![0]!.day, '2026-10-26');
  assert.equal(cal.weeks[0]![6]!.day, '2026-11-01');
  assert.equal(cal.weeks[0]![5]!.inMonth, false);
  assert.deepEqual(cal.weeks[0]![5]!.sessionIds, [], '앞 달 날짜는 세지 않는다');
  const nov3 = cal.weeks.flat().find((x) => x.day === '2026-11-03')!;
  assert.deepEqual(nov3.sessionIds, [a.id, b.id]);
  assert.equal(cal.activeDays, 2);
  assert.equal(calendarMonth([], 2027, 2).weeks.length, 4, '2027년 2월은 월요일 시작 28일 → 4주');
  assert.equal(calendarMonth([], 2028, 2).weeks.flat().filter((x) => x.inMonth).length, 29, '윤년');
});
