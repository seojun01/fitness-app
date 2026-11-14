// 개발·성능 확인용: 서버 DB 에 완료 세션을 심는다 (기본 500개). 페어링한 기기가 동기화로 받아 기록 목록 성능(SC-005)을 확인한다.
// 사용: FITNESS_DB=/tmp/fitness-perf.db node scripts/seed-sessions.mjs [개수]
import { openDb } from '../server/src/db.ts';
import { applyChanges } from '../server/src/sync.ts';
import { SEED_EXERCISES } from '../shared/seed-exercises.ts';

const count = Number(process.argv[2] ?? 500);
if (!Number.isInteger(count) || count < 1) {
  console.error('사용법: node scripts/seed-sessions.mjs [개수]');
  process.exit(2);
}
const db = openDb();
const day = 86_400_000;
const start = Date.UTC(2025, 0, 1, 9, 0, 0);
const wall = Date.now();

const changes = [];
for (let i = 0; i < count; i++) {
  const ex = SEED_EXERCISES[i % SEED_EXERCISES.length];
  const startedAt = new Date(start + i * day);
  changes.push({
    type: 'session',
    record: {
      id: crypto.randomUUID(),
      status: 'completed',
      routineId: null,
      routineName: `시드 루틴 ${i % 5}`,
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + 3_600_000).toISOString(),
      startedBy: 'seed-script',
      entries: [
        {
          entryId: crypto.randomUUID(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [0, 1, 2].map((k) => ({ setId: crypto.randomUUID(), weightKg: 40 + (i % 20) + k * 2.5, reps: 10 - k, done: true })),
        },
      ],
      deleted: false,
      version: `${String(wall).padStart(15, '0')}-${String(i).padStart(6, '0')}-seed-script`,
      updatedBy: 'seed-script',
    },
  });
}
let applied = 0;
for (let i = 0; i < changes.length; i += 500) applied += applyChanges(db, { changes: changes.slice(i, i + 500) }).applied;
console.log(`세션 ${applied}개를 심었어요 (${process.env.FITNESS_DB ?? '기본 DB'})`);
db.close();
