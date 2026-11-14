// 모든 화면에서 쓰는 로딩·빈·오류 상태 (FR-015)
import { h } from './dom.ts';

export function loadingState(label = '불러오는 중…'): HTMLElement {
  return h('div', { class: 'state state-loading', attrs: { role: 'status' } }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), h('span', { text: label }));
}

export interface EmptyOptions {
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}

export function emptyState(o: EmptyOptions): HTMLElement {
  return h(
    'div',
    { class: 'state state-empty' },
    h('p', { class: 'state-title', text: o.title }),
    o.hint ? h('p', { class: 'state-hint', text: o.hint }) : null,
    o.action ? h('button', { class: 'btn btn-primary', type: 'button', text: o.action.label, onClick: o.action.onClick }) : null,
  );
}

export function errorState(message: string, onRetry?: () => void): HTMLElement {
  return h(
    'div',
    { class: 'state state-error', attrs: { role: 'alert' } },
    h('p', { class: 'state-title', text: '문제가 생겼어요' }),
    h('p', { class: 'state-hint', text: message }),
    onRetry ? h('button', { class: 'btn', type: 'button', text: '다시 시도', onClick: onRetry }) : null,
  );
}
