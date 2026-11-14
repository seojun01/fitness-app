// 촉각 피드백. 나중에 네이티브 래퍼(Capacitor 등)의 햅틱으로 바꿀 자리 (헌법 V)
export function vibrate(pattern: number[] = [200, 100, 200]): void {
  try {
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
    /* 지원하지 않으면 조용히 넘어간다 */
  }
}
