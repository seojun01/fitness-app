// 휴식 종료 예약을 1초마다 확인해 만기된 기기에 "휴식 끝" 푸시를 보낸다.
import type { Db } from './db.ts';
import type { PushSender } from './webpush.ts';

/** 서버가 멈췄다가 늦게 돌면, 이만큼 넘게 지난 예약은 보내지 않고 버린다 (이미 의미 없는 알림) */
export const MAX_LATE_MS = 2 * 60_000;

export interface Scheduler {
  /** 만기 예약을 처리하고 보낸 개수를 돌려준다 (테스트는 직접 부른다) */
  tick(): Promise<number>;
  start(intervalMs?: number): void;
  stop(): void;
}

interface DueRow {
  device_id: string;
  ends_at: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  enabled: number | null;
}

export function createScheduler(deps: { db: Db; now: () => Date; getSender: () => PushSender }): Scheduler {
  const { db } = deps;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  async function tick(): Promise<number> {
    if (running) return 0; // 앞선 tick 이 아직 보내는 중
    running = true;
    try {
      const now = deps.now();
      const rows = db
        .prepare(
          `SELECT a.device_id, a.ends_at, s.endpoint, s.p256dh, s.auth, s.enabled
             FROM rest_alarms a LEFT JOIN push_subscriptions s ON s.device_id = a.device_id
            WHERE a.ends_at <= ?`,
        )
        .all(now.toISOString()) as unknown as DueRow[];
      let sent = 0;
      for (const r of rows) {
        // 보내기 전에 지운다: 보내는 동안 새 예약이 들어오면 그 예약은 남는다
        const del = db.prepare('DELETE FROM rest_alarms WHERE device_id = ? AND ends_at = ?').run(r.device_id, r.ends_at);
        if (Number(del.changes) === 0) continue;
        if (!r.endpoint || r.enabled !== 1) continue;
        if (now.getTime() - Date.parse(r.ends_at) > MAX_LATE_MS) continue;
        let sender: PushSender;
        try {
          sender = deps.getSender();
        } catch (err) {
          console.error('[push] 보내기를 준비하지 못했어요:', err);
          return sent;
        }
        const result = await sender.send({ endpoint: r.endpoint, p256dh: r.p256dh!, auth: r.auth! }, { v: 1, kind: 'rest-end' });
        if (result === 'ok') sent++;
        else if (result === 'gone') db.prepare('DELETE FROM push_subscriptions WHERE device_id = ? AND endpoint = ?').run(r.device_id, r.endpoint);
        else console.error(`[push] 휴식 알림을 보내지 못했어요 (${result})`);
      }
      return sent;
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start(intervalMs = 1000) {
      if (timer) return;
      timer = setInterval(() => void tick().catch((err) => console.error('[push] 예약 처리 오류:', err)), intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
