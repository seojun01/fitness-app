// 휴식 타이머: 끝나는 시각 기준 상태 기계 (기능 3, research W2). 기기별 임시 상태라 localStorage 에 둔다.
import { REST_DEFAULT, REST_MAX, REST_MIN, REST_STEP } from '../../shared/model.ts';

export interface TimerStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

type Stored =
  | { state: 'idle' }
  | { state: 'running'; endsAt: number; totalMs: number }
  | { state: 'paused'; remainingMs: number; totalMs: number }
  | { state: 'done'; totalMs: number };

export interface TimerView {
  state: Stored['state'];
  remainingMs: number;
  totalMs: number;
  /** 다음 휴식에 쓸 기본 시간(초) */
  baseSeconds: number;
}

export interface RestTimer {
  view(): TimerView;
  /** 시간을 확인해 0 이 되었으면 done 으로 바꾼다(화면 갱신마다 부른다) */
  tick(): TimerView;
  start(seconds?: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /** 진행 중이면 남은 시간을, 멈춰 있으면 기본 시간을 바꾼다 (초) */
  adjust(deltaSeconds: number): void;
  setBase(seconds: number): void;
}

export const TIMER_KEY = 'fitness.restTimer';

export const browserStorage: TimerStorage = {
  get: (k) => globalThis.localStorage?.getItem(k) ?? null,
  set: (k, v) => globalThis.localStorage?.setItem(k, v),
};

const clampBase = (s: number) => Math.min(REST_MAX, Math.max(REST_MIN, Math.round(s / REST_STEP) * REST_STEP));

function parse(raw: string | null): Stored {
  try {
    const v = raw ? (JSON.parse(raw) as Stored) : null;
    if (!v) return { state: 'idle' };
    if (v.state === 'running' && Number.isFinite(v.endsAt) && Number.isFinite(v.totalMs)) return v;
    if (v.state === 'paused' && Number.isFinite(v.remainingMs) && Number.isFinite(v.totalMs)) return v;
    if (v.state === 'done') return { state: 'done', totalMs: Number(v.totalMs) || 0 };
  } catch {
    /* 깨진 값 */
  }
  return { state: 'idle' };
}

export function createRestTimer(opts: {
  now?: () => number;
  storage?: TimerStorage;
  onDone?: () => void;
  onBaseChange?: (seconds: number) => void;
  baseSeconds?: number;
} = {}): RestTimer {
  const now = opts.now ?? (() => Date.now());
  const storage = opts.storage ?? browserStorage;
  let base = clampBase(opts.baseSeconds ?? REST_DEFAULT);
  let s: Stored;
  try {
    s = parse(storage.get(TIMER_KEY));
  } catch {
    s = { state: 'idle' };
  }

  const save = () => {
    try {
      storage.set(TIMER_KEY, JSON.stringify(s));
    } catch {
      /* 저장 못 해도 화면은 동작한다 */
    }
  };
  const remaining = () => (s.state === 'running' ? Math.max(0, s.endsAt - now()) : s.state === 'paused' ? s.remainingMs : 0);
  const view = (): TimerView => ({
    state: s.state,
    remainingMs: s.state === 'idle' ? base * 1000 : remaining(),
    totalMs: s.state === 'idle' ? base * 1000 : s.totalMs,
    baseSeconds: base,
  });
  const finish = () => {
    s = { state: 'done', totalMs: s.state === 'idle' ? 0 : s.totalMs };
    save();
    opts.onDone?.();
  };

  return {
    view,
    tick() {
      if (s.state === 'running' && s.endsAt - now() <= 0) finish();
      return view();
    },
    start(seconds) {
      const total = (seconds ?? base) * 1000;
      s = { state: 'running', endsAt: now() + total, totalMs: total };
      save();
    },
    pause() {
      if (s.state !== 'running') return;
      s = { state: 'paused', remainingMs: remaining(), totalMs: s.totalMs };
      save();
    },
    resume() {
      if (s.state !== 'paused') return;
      s = { state: 'running', endsAt: now() + s.remainingMs, totalMs: s.totalMs };
      save();
    },
    stop() {
      s = { state: 'idle' };
      save();
    },
    adjust(delta) {
      const ms = delta * 1000;
      if (s.state === 'running') {
        s = { ...s, endsAt: s.endsAt + ms, totalMs: Math.max(0, s.totalMs + ms) };
        save();
        if (s.endsAt - now() <= 0) finish();
        return;
      }
      if (s.state === 'paused') {
        const left = s.remainingMs + ms;
        s = { ...s, remainingMs: Math.max(0, left), totalMs: Math.max(0, s.totalMs + ms) };
        save();
        if (left <= 0) finish();
        return;
      }
      const next = clampBase(base + delta);
      if (next === base) return;
      base = next;
      opts.onBaseChange?.(base);
    },
    setBase(seconds) {
      base = clampBase(seconds);
    },
  };
}
