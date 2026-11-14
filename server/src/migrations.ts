// PRAGMA user_version 기반 마이그레이션. 스키마를 바꾸면 MIGRATIONS 에 단계를 추가한다.
import type { DatabaseSync } from 'node:sqlite';

type Migration = (db: DatabaseSync) => void;

const MIGRATIONS: Migration[] = [
  // v1: 초기 스키마 (specs/001-routine-workout-logging/data-model.md "서버 SQLite 스키마")
  (db) => {
    db.exec(`
      CREATE TABLE records (
        type    TEXT NOT NULL,
        id      TEXT NOT NULL,
        version TEXT NOT NULL,
        deleted INTEGER NOT NULL,
        body    TEXT NOT NULL,
        seq     INTEGER NOT NULL UNIQUE,
        PRIMARY KEY (type, id)
      );
      CREATE INDEX records_seq_idx ON records(seq);

      CREATE TABLE devices (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        token_hash   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL,
        last_seen_at TEXT,
        revoked_at   TEXT
      );

      CREATE TABLE pairing_codes (
        code_hash   TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        expires_at  TEXT NOT NULL,
        used_at     TEXT
      );

      CREATE TABLE server_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  },
  // v2: 휴식 종료 알림 (specs/006-rest-end-notification/plan.md). 기기마다 구독 1개, 예약 1개
  (db) => {
    db.exec(`
      CREATE TABLE push_subscriptions (
        device_id  TEXT PRIMARY KEY,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        enabled    INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE rest_alarms (
        device_id  TEXT PRIMARY KEY,
        ends_at    TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX rest_alarms_ends_idx ON rest_alarms(ends_at);
    `);
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function getUserVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/** 아직 적용되지 않은 단계만 순서대로 적용한다 (이미 최신이면 아무 일도 하지 않는다). */
export function migrate(db: DatabaseSync): void {
  for (let v = getUserVersion(db); v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      MIGRATIONS[v]!(db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
