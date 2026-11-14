#!/usr/bin/env node
// fitness-admin: 홈서버 안에서만 실행하는 관리 CLI. HTTP 를 거치지 않고 DB 에 직접 접근한다.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Exercise, Routine, Session, Settings } from '../../shared/model.ts';
import { buildExport } from '../../shared/export.ts';
import { MAX_DEVICE_NAME, createPairingCode, revokeDevice, validDeviceName } from './auth.ts';
import { openDb, type Db } from './db.ts';
import { liveRecords } from './sync.ts';

const USAGE = `사용법: fitness-admin <명령>
  pair --name <이름>      새 기기를 등록할 일회용 페어링 코드를 발급한다 (10분간 유효)
  devices                  등록된 기기 목록
  revoke <deviceId>        기기의 접근 권한을 해제한다
  export [--out <파일>]    모든 운동 데이터를 JSON 으로 내보낸다 (파일을 주지 않으면 stdout)
  backup <파일>            SQLite 온라인 백업을 만든다 (서비스를 멈추지 않아도 된다)`;

const fmtTime = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function cmdPair(db: Db, args: string[]): number {
  const i = args.indexOf('--name');
  const name = i >= 0 ? (args[i + 1] ?? '').trim() : '';
  if (!validDeviceName(name)) {
    console.error(`기기 이름은 1~${MAX_DEVICE_NAME}자여야 해요.\n${USAGE}`);
    return 2;
  }
  const code = createPairingCode(db, name);
  console.log(`페어링 코드: ${code} (10분간 유효, 1회용)`);
  return 0;
}

function cmdDevices(db: Db): number {
  const rows = db.prepare('SELECT id, name, created_at, last_seen_at, revoked_at FROM devices ORDER BY created_at').all() as {
    id: string;
    name: string;
    created_at: string;
    last_seen_at: string | null;
    revoked_at: string | null;
  }[];
  const lines = [['ID', '이름', '등록 시각', '마지막 동기화', '상태']];
  for (const r of rows) lines.push([r.id, r.name, fmtTime(r.created_at), fmtTime(r.last_seen_at), r.revoked_at ? '해제' : '활성']);
  const widths = lines[0]!.map((_, c) => Math.max(...lines.map((l) => l[c]!.length)));
  for (const l of lines) console.log(l.map((cell, c) => cell.padEnd(widths[c]!)).join('  ').trimEnd());
  return 0;
}

function cmdRevoke(db: Db, args: string[]): number {
  const id = args[0];
  if (!id) {
    console.error(USAGE);
    return 2;
  }
  const dev = db.prepare('SELECT name FROM devices WHERE id = ?').get(id) as { name: string } | undefined;
  if (!dev || !revokeDevice(db, id)) {
    console.error(`그런 기기가 없어요: ${id}`);
    return 1;
  }
  console.log(`해제됨: ${dev.name} (${id.slice(0, 4)}…)`);
  return 0;
}

function cmdExport(db: Db, args: string[]): number {
  const i = args.indexOf('--out');
  const out = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0 && !out) {
    console.error(USAGE);
    return 2;
  }
  const settings = liveRecords<Settings>(db, 'settings')[0] ?? null;
  const data = buildExport({
    exercises: liveRecords<Exercise>(db, 'exercise'),
    routines: liveRecords<Routine>(db, 'routine'),
    sessions: liveRecords<Session>(db, 'session'),
    settings,
  });
  const json = JSON.stringify(data, null, 2);
  if (out) writeFileSync(out, json + '\n');
  else console.log(json);
  return 0;
}

function cmdBackup(db: Db, args: string[]): number {
  const dest = args[0];
  if (!dest) {
    console.error(USAGE);
    return 2;
  }
  if (existsSync(dest)) {
    console.error(`이미 있는 파일이에요. 덮어쓰지 않아요: ${dest}`);
    return 1;
  }
  try {
    db.prepare('VACUUM INTO ?').run(dest); // 실행 중인 DB 에서도 일관된 사본을 만든다
  } catch (err) {
    console.error(`백업하지 못했어요: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  console.log(`백업함: ${dest}`);
  return 0;
}

export function run(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (cmd !== 'pair' && cmd !== 'devices' && cmd !== 'revoke' && cmd !== 'export' && cmd !== 'backup') {
    console.error(USAGE);
    return 2;
  }
  const db = openDb();
  try {
    if (cmd === 'pair') return cmdPair(db, rest);
    if (cmd === 'devices') return cmdDevices(db);
    if (cmd === 'export') return cmdExport(db, rest);
    if (cmd === 'backup') return cmdBackup(db, rest);
    return cmdRevoke(db, rest);
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
