import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer, mkExercise, mkRoutine, mkSession, mkSettings, mkTombstone } from '../helpers/server.ts';

const CLI = 'server/src/admin-cli.ts';

function cli(db: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ['--no-warnings', CLI, ...args], { env: { ...process.env, FITNESS_DB: db }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const tmp = () => join(mkdtempSync(join(tmpdir(), 'fitness-cli-')), 'f.db');

test('pair: 코드를 출력하고, 이름이 비었거나 50자를 넘으면 종료 코드 2', () => {
  const db = tmp();
  const ok = cli(db, 'pair', '--name', 'iPhone');
  assert.equal(ok.code, 0);
  assert.match(ok.out, /^페어링 코드: [A-Z2-9]{4}-[A-Z2-9]{4} \(10분간 유효, 1회용\)/);
  assert.equal(cli(db, 'pair', '--name', '').code, 2);
  assert.equal(cli(db, 'pair').code, 2);
  assert.equal(cli(db, 'pair', '--name', 'a'.repeat(51)).code, 2);
  assert.equal(cli(db, 'pair', '--name', 'a'.repeat(50)).code, 0);
});

test('devices / revoke', async () => {
  const dbFile = tmp();
  const srv = await startTestServer({ dbPath: dbFile });
  const { deviceId, cookie } = await srv.pair('내 폰');
  const list = cli(dbFile, 'devices');
  assert.equal(list.code, 0);
  assert.match(list.out, /내 폰/);
  assert.match(list.out, /활성/);
  const rev = cli(dbFile, 'revoke', deviceId);
  assert.equal(rev.code, 0);
  assert.match(rev.out, /해제됨: 내 폰/);
  assert.match(cli(dbFile, 'devices').out, /해제/);
  assert.equal((await srv.api('/api/changes?since=0', { cookie })).status, 401);
  assert.equal(cli(dbFile, 'revoke', crypto.randomUUID()).code, 1);
  assert.equal(cli(dbFile, 'revoke').code, 2);
  await srv.close();
});

test('export: 툼스톤과 내부 필드를 빼고 내보낸다', async () => {
  const dbFile = tmp();
  const srv = await startTestServer({ dbPath: dbFile });
  const { cookie } = await srv.pair();
  const ex = mkExercise();
  const gone = mkSession();
  await srv.api('/api/changes', {
    cookie,
    body: { changes: [{ type: 'exercise', record: ex }, { type: 'routine', record: mkRoutine() }, { type: 'session', record: gone }, { type: 'settings', record: mkSettings({ weightUnit: 'lb' }) }] },
  });
  await srv.api('/api/changes', { cookie, body: { changes: [{ type: 'session', record: mkTombstone(gone.id) }] } });
  const out = join(mkdtempSync(join(tmpdir(), 'fitness-exp-')), 'out.json');
  const r = cli(dbFile, 'export', '--out', out);
  assert.equal(r.code, 0);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(data.format, 'fitness-export');
  assert.equal(data.version, 1);
  assert.equal(data.exercises.length, 1);
  assert.equal(data.routines.length, 1);
  assert.equal(data.sessions.length, 0);
  assert.deepEqual(data.settings, { weightUnit: 'lb' });
  assert.equal(data.exercises[0].version, undefined);
  assert.equal(data.exercises[0].updatedBy, undefined);
  assert.equal(data.exercises[0].deleted, undefined);
  const stdout = cli(dbFile, 'export');
  assert.equal(JSON.parse(stdout.out).exercises[0].id, ex.id);
  await srv.close();
});

test('backup: 사본을 만들고 이미 있는 파일은 덮어쓰지 않는다', () => {
  const db = tmp();
  cli(db, 'pair', '--name', 'x');
  const dest = join(mkdtempSync(join(tmpdir(), 'fitness-bk-')), 'backup.db');
  assert.equal(cli(db, 'backup', dest).code, 0);
  assert.ok(existsSync(dest));
  assert.equal(cli(db, 'backup', dest).code, 1);
  assert.equal(cli(db, 'backup').code, 2);
});

test('알 수 없는 명령은 사용법과 종료 코드 2', () => {
  const r = spawnSync(process.execPath, ['--no-warnings', CLI, 'nope'], { env: { ...process.env, FITNESS_DB: tmp() }, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /사용법/);
});

