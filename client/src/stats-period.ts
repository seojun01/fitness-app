// 통계 기간 선택: 이 기기에서만 기억한다 (기능 004, research S3). 테마처럼 화면 상태라 동기화하지 않는다.
import type { Period } from '../../shared/growth.ts';

export const PERIOD_KEY = 'fitness.statsPeriod';
export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: '4w', label: '4주' },
  { value: '3m', label: '3개월' },
  { value: '1y', label: '1년' },
  { value: 'all', label: '전체' },
];

export function readPeriod(): Period {
  try {
    const v = globalThis.localStorage?.getItem(PERIOD_KEY);
    return v === '3m' || v === '1y' || v === 'all' || v === '4w' ? v : '4w';
  } catch {
    return '4w';
  }
}

export function savePeriod(p: Period): void {
  try {
    globalThis.localStorage?.setItem(PERIOD_KEY, p);
  } catch {
    /* 저장하지 못해도 이번 화면에서는 그대로 쓴다 */
  }
}
