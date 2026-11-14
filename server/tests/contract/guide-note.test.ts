import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer, mkExercise, mkTombstone, type TestServer } from '../helpers/server.ts';

let s: TestServer;
let cookie: string;
before(async () => {
  s = await startTestServer();
  cookie = (await s.pair()).cookie;
});
after(async () => {
  await s.close();
});

let n = 0;
const mkNote = (id: string, over: Record<string, unknown> = {}) => ({
  id, cues: ['허리를 곧게 편다'], mistakes: ['반동을 쓴다'], primaryMuscles: ['quads'], secondaryMuscles: ['glutes'],
  deleted: false, version: `001762950896789-${String(++n).padStart(6, '0')}-dev`, updatedBy: 'dev', ...over,
});
const push = (changes: unknown[]) => s.api('/api/changes', { cookie, body: { changes } });
const pull = async () => (await (await s.api('/api/changes?since=0', { cookie })).json()) as { changes: { type: string; record: Record<string, unknown> }[]; cursor: number };

test('계약 1: 직접 만든 종목의 guideNote 를 push → pull 하면 같은 레코드', async () => {
  const ex = mkExercise();
  const nt = mkNote(ex.id);
  assert.equal((await push([{ type: 'exercise', record: ex }, { type: 'guideNote', record: nt }])).status, 200);
  const got = (await pull()).changes.find((c) => c.type === 'guideNote' && c.record.id === ex.id);
  assert.deepEqual(got?.record, nt);
});

test('계약 2: 기본 종목 id 의 guideNote 는 400 builtin_exercise 이고 같이 보낸 레코드도 롤백', async () => {
  const before = (await pull()).cursor;
  const good = mkExercise();
  const res = await push([{ type: 'exercise', record: good }, { type: 'guideNote', record: mkNote('5eed0000-0000-4000-8000-000000000010') }]);
  assert.equal(res.status, 400);
  const body = (await res.json()) as { details: { field: string; rule: string }[] };
  assert.ok(body.details.some((d) => d.field === 'id' && d.rule === 'builtin_exercise'));
  assert.equal((await pull()).cursor, before);
});

test('계약 3: 잘못된 노트(요점 11개, 201자, 공백뿐, 모르는 근육, 겹침, 중복)는 400', async () => {
  const id = crypto.randomUUID();
  for (const over of [
    { cues: Array(11).fill('a') },
    { cues: ['가'.repeat(201)] },
    { mistakes: ['   '] },
    { primaryMuscles: ['neck'] },
    { primaryMuscles: ['quads'], secondaryMuscles: ['quads'] },
    { secondaryMuscles: ['abs', 'abs'] },
  ]) {
    const res = await push([{ type: 'guideNote', record: mkNote(id, over) }]);
    assert.equal(res.status, 400, JSON.stringify(over));
  }
});

test('계약 4: guideNote 툼스톤(최소 필드)은 deleted=true 로만 나온다', async () => {
  const id = crypto.randomUUID();
  await push([{ type: 'guideNote', record: mkNote(id) }]);
  const tomb = mkTombstone(id, { version: '009999999999999-000000-dev' }); // 노트보다 확실히 나중
  assert.equal((await push([{ type: 'guideNote', record: tomb }])).status, 200);
  const got = (await pull()).changes.filter((c) => c.type === 'guideNote' && c.record.id === id).at(-1);
  assert.deepEqual(got?.record, tomb);
});

test('계약 5: fitness-admin export 는 version 2 이고 살아 있는 guideNotes 만 포함한다', async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), 'fitness-gn-')), 'f.db');
  const srv = await startTestServer({ dbPath: dbFile });
  try {
    const { cookie: c } = await srv.pair();
    const ex = mkExercise();
    const gone = crypto.randomUUID();
    await srv.api('/api/changes', { cookie: c, body: { changes: [{ type: 'exercise', record: ex }, { type: 'guideNote', record: mkNote(ex.id) }, { type: 'guideNote', record: mkNote(gone) }] } });
    await srv.api('/api/changes', { cookie: c, body: { changes: [{ type: 'guideNote', record: mkTombstone(gone, { version: '009999999999999-000000-dev' }) }] } });
    const r = spawnSync(process.execPath, ['--no-warnings', 'server/src/admin-cli.ts', 'export'], { env: { ...process.env, FITNESS_DB: dbFile }, encoding: 'utf8' });
    const data = JSON.parse(r.stdout);
    assert.equal(data.version, 2);
    assert.deepEqual(data.guideNotes.map((x: { id: string }) => x.id), [ex.id]);
    assert.deepEqual(Object.keys(data.guideNotes[0]).sort(), ['cues', 'id', 'mistakes', 'primaryMuscles', 'secondaryMuscles']);
  } finally {
    await srv.close();
  }
});
