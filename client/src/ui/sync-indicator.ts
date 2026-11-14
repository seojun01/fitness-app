// 상단 바의 동기화 상태 표시 (aria-live)
import { describeStatus } from '../sync/status.ts';
import type { SyncStatus } from '../sync/engine.ts';
import { clear, h } from './dom.ts';

export function renderSyncStatus(slot: HTMLElement, s: SyncStatus): void {
  const view = describeStatus(s);
  clear(slot);
  slot.append(h('span', { text: view.text }));
  if (view.link) slot.append(' ', h('a', { attrs: { href: view.link.href }, text: view.link.label }));
}
