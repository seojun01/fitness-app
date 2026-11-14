// 알림 토스트(aria-live). 되돌리기 작업은 5초 이상 보여 준다.
import { h } from './dom.ts';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** 표시 시간(ms). 되돌리기가 있으면 최소 6000 */
  ms?: number;
}

/** 열린 모달 대화상자가 있으면 그 안에 띄운다 (모달 바깥은 누를 수 없으므로) */
function getHost(): HTMLElement {
  const modals = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  const parent: HTMLElement = modals.at(-1) ?? document.body;
  let host = [...parent.children].find((c) => c.classList.contains('toasts')) as HTMLElement | undefined;
  if (!host) {
    host = h('div', { class: 'toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
    parent.appendChild(host);
  }
  return host;
}

export function showToast(message: string, opts: ToastOptions = {}): () => void {
  const ms = opts.actionLabel ? Math.max(opts.ms ?? 6000, 6000) : (opts.ms ?? 3000);
  const el = h('div', { class: 'toast' }, h('span', { text: message }));
  const close = () => el.remove();
  if (opts.actionLabel) {
    el.appendChild(
      h('button', {
        class: 'toast-action',
        type: 'button',
        text: opts.actionLabel,
        onClick: () => {
          close();
          opts.onAction?.();
        },
      }),
    );
  }
  getHost().appendChild(el);
  setTimeout(close, ms);
  return close;
}
