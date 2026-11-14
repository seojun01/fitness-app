import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, mkExercise, mkRoutine, mkSession, mkSettings, mkTombstone, type TestServer } from '../helpers/server.ts';

let s: TestServer;
let cookie: string;
before(async () => {
  s = await startTestServer();
  cookie = (await s.pair()).cookie;
});
after(async () => {
  await s.close();
});

const push = (changes: unknown[]) => s.api('/api/changes', { cookie, body: { changes } });
const pull = async (since = 0, limit?: number) => {
  const res = await s.api(`/api/changes?since=${since}${limit ? `&limit=${limit}` : ''}`, { cookie });
  return (await res.json()) as { changes: { type: string; record: Record<string, any> }[]; cursor: number; hasMore: boolean };
};

test('계약 6: 네 종류의 레코드를 push 한 뒤 pull(since=0)하면 seq 순서로 같은 레코드가 나온다', async () => {
  const srv = await startTestServer();
  const { cookie } = await srv.pair();
  const ex = mkExercise();
  const ro = mkRoutine();
  const se = mkSession();
  const st = mkSettings();
  const res = await srv.api('/api/changes', {
    cookie,
    body: { changes: [{ type: 'exercise', record: ex }, { type: 'routine', record: ro }, { type: 'session', record: se }, { type: 'settings', record: st }] },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { applied: 4, ignored: 0, cursor: 4 });
  const page = (await (await srv.api('/api/changes?since=0', { cookie })).json()) as { changes: { type: string; record: unknown }[]; cursor: number; hasMore: boolean };
  assert.deepEqual(page.changes.map((c) => c.type), ['exercise', 'routine', 'session', 'settings']);
  assert.deepEqual(page.changes.map((c) => c.record), [ex, ro, se, st]);
  assert.equal(page.cursor, 4);
  assert.equal(page.hasMore, false);
  await srv.close();
});

test('계약 7: 같은 id 에 더 작은 version 을 push 하면 ignored=1 이고 저장값은 바뀌지 않는다', async () => {
  const newer = mkRoutine({ name: '새 이름' });
  await push([{ type: 'routine', record: newer }]);
  const older = { ...newer, name: '옛 이름', version: '000000000000001-000000-dev' };
  const res = await push([{ type: 'routine', record: older }]);
  assert.deepEqual(await res.clone().json().then((j: any) => ({ applied: j.applied, ignored: j.ignored })), { applied: 0, ignored: 1 });
  const stored = (await pull()).changes.find((c) => c.record.id === newer.id)!;
  assert.equal(stored.record.name, '새 이름');
});

test('계약 8: 같은 push 를 두 번 보내면 두 번째는 applied=0', async () => {
  const body = [{ type: 'session', record: mkSession() }];
  const a = (await (await push(body)).json()) as { applied: number; cursor: number };
  const b = (await (await push(body)).json()) as { applied: number; ignored: number; cursor: number };
  assert.equal(a.applied, 1);
  assert.equal(b.applied, 0);
  assert.equal(b.ignored, 1);
  assert.equal(b.cursor, a.cursor);
});

test('계약 9: 검증 실패는 400 이고 전체가 롤백된다', async () => {
  const entry = (sets: unknown[]) => [{ entryId: crypto.randomUUID(), exerciseId: crypto.randomUUID(), exerciseName: 'x', sets }];
  const set = (o: Record<string, unknown>) => ({ setId: crypto.randomUUID(), weightKg: 50, reps: 5, done: true, ...o });
  const cases: [string, unknown][] = [
    ['종목 이름 0자', { type: 'exercise', record: mkExercise({ name: '' }) }],
    ['루틴 이름 61자', { type: 'routine', record: mkRoutine({ name: 'a'.repeat(61) }) }],
    ['reps 0', { type: 'session', record: mkSession({ entries: entry([set({ reps: 0 })]) }) }],
    ['reps 소수', { type: 'session', record: mkSession({ entries: entry([set({ reps: 2.5 })]) }) }],
    ['reps 1000', { type: 'session', record: mkSession({ entries: entry([set({ reps: 1000 })]) }) }],
    ['weightKg 음수', { type: 'session', record: mkSession({ entries: entry([set({ weightKg: -1 })]) }) }],
    ['weightKg 1001', { type: 'session', record: mkSession({ entries: entry([set({ weightKg: 1001 })]) }) }],
    ['completed 인데 endedAt 없음', { type: 'session', record: mkSession({ endedAt: null }) }],
    ['endedAt < startedAt', { type: 'session', record: mkSession({ endedAt: '2026-11-14T09:00:00.000Z' }) }],
    ['알 수 없는 type', { type: 'task', record: mkExercise() }],
  ];
  for (const [label, bad] of cases) {
    const before = (await pull()).cursor;
    const good = mkExercise();
    const res = await push([{ type: 'exercise', record: good }, bad]);
    assert.equal(res.status, 400, label);
    const body = (await res.json()) as { error: string; details: unknown[] };
    assert.equal(body.error, 'validation', label);
    assert.ok(body.details.length > 0, label);
    const after = await pull();
    assert.equal(after.cursor, before, `${label}: 롤백되어 cursor 가 그대로여야 한다`);
    assert.ok(!after.changes.some((c) => c.record.id === good.id), `${label}: 같이 보낸 유효 레코드도 반영되지 않아야 한다`);
  }
});

test('빈 changes 와 501개는 400', async () => {
  assert.equal((await push([])).status, 400);
  assert.equal((await push(Array.from({ length: 501 }, () => ({ type: 'exercise', record: mkExercise() })))).status, 400);
});

test('계약 10: limit 로 페이지를 나눠도 빠지거나 중복되지 않는다', async () => {
  const srv = await startTestServer();
  const { cookie } = await srv.pair();
  const recs = Array.from({ length: 25 }, (_, i) => ({ type: ['exercise', 'routine', 'session', 'settings'][i % 3]!, record: [mkExercise, mkRoutine, mkSession][i % 3]!() }));
  await srv.api('/api/changes', { cookie, body: { changes: recs } });
  const seen: string[] = [];
  let since = 0;
  for (let guard = 0; guard < 20; guard++) {
    const page = (await (await srv.api(`/api/changes?since=${since}&limit=7`, { cookie })).json()) as { changes: { record: { id: string } }[]; cursor: number; hasMore: boolean };
    seen.push(...page.changes.map((c) => c.record.id));
    since = page.cursor;
    if (!page.hasMore) break;
  }
  assert.deepEqual(seen, recs.map((r) => (r.record as { id: string }).id));
  await srv.close();
});

test('계약 12: 툼스톤(최소 필드)을 push 하면 이후 pull 에서 내용 없이 deleted=true 로만 나온다', async () => {
  const se = mkSession();
  await push([{ type: 'session', record: se }]);
  const tomb = mkTombstone(se.id);
  const res = await push([{ type: 'session', record: tomb }]);
  assert.equal(((await res.json()) as { applied: number }).applied, 1);
  const stored = (await pull()).changes.filter((c) => c.record.id === se.id).at(-1)!;
  assert.deepEqual(stored.record, tomb);
  assert.equal((stored.record as Record<string, unknown>).entries, undefined);
});

test('종류가 다르면 같은 id 라도 별개 레코드다', async () => {
  const id = crypto.randomUUID();
  await push([{ type: 'exercise', record: mkExercise({ id }) }, { type: 'routine', record: mkRoutine({ id }) }]);
  const mine = (await pull()).changes.filter((c) => c.record.id === id);
  assert.deepEqual(mine.map((c) => c.type).sort(), ['exercise', 'routine']);
});

test('since 가 올바르지 않으면 400', async () => {
  assert.equal((await s.api('/api/changes?since=abc', { cookie })).status, 400);
  assert.equal((await s.api('/api/changes?since=-1', { cookie })).status, 400);
});

test('필드 추가(record-fields 1): memo 가 있는 종목과 restSeconds 가 있는 설정이 그대로 오간다', async () => {
  const srv = await startTestServer();
  try {
    const { cookie } = await srv.pair();
    const ex = mkExercise({ memo: '의자 높이 4' });
    const st = mkSettings({ restSeconds: 90 });
    const res = await srv.api('/api/changes', { cookie, body: { changes: [{ type: 'exercise', record: ex }, { type: 'settings', record: st }] } });
    assert.equal(res.status, 200);
    const page = (await (await srv.api('/api/changes?since=0', { cookie })).json()) as { changes: { record: unknown }[] };
    assert.deepEqual(page.changes.map((c) => c.record), [ex, st]);
  } finally {
    await srv.close();
  }
});

test('필드 추가(record-fields 2): memo 501자, restSeconds 10·601·50·문자열은 400 이고 롤백된다', async () => {
  const cases = [
    { type: 'exercise', record: mkExercise({ memo: 'x'.repeat(501) }) },
    { type: 'settings', record: mkSettings({ restSeconds: 10 }) },
    { type: 'settings', record: mkSettings({ restSeconds: 601 }) },
    { type: 'settings', record: mkSettings({ restSeconds: 50 }) },
    { type: 'settings', record: mkSettings({ restSeconds: '60' }) },
  ];
  for (const bad of cases) {
    const before = (await pull()).cursor;
    const good = mkRoutine();
    const res = await push([{ type: 'routine', record: good }, bad]);
    assert.equal(res.status, 400, JSON.stringify(bad.record).slice(0, 60));
    assert.equal((await pull()).cursor, before);
  }
});

test('필드 추가(record-fields 3): 두 필드가 없는 레코드도 계속 받는다', async () => {
  const res = await push([{ type: 'exercise', record: mkExercise() }, { type: 'settings', record: mkSettings() }]);
  assert.equal(res.status, 200);
});
