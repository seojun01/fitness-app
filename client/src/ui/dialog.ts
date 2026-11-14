// 선택지가 있는 확인 대화상자 (window.confirm 은 쓰지 않는다)
import { h } from './dom.ts';

export interface DialogChoice {
  value: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
}

/** 고른 선택지의 value, Esc 로 닫으면 마지막이 아니라 'cancel' */
export function choose(title: string, message: string, choices: DialogChoice[]): Promise<string> {
  return new Promise((resolve) => {
    const id = `dlg-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'sheet', attrs: { 'aria-labelledby': id } });
    const done = (value: string) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      h('h2', { class: 'sheet-title', text: title, attrs: { id } }),
      h('p', { text: message }),
      h(
        'div',
        { class: 'btn-row' },
        ...choices.map((c) => h('button', { class: `btn${c.primary ? ' btn-primary' : ''}${c.danger ? ' btn-danger' : ''}`, type: 'button', text: c.label, onClick: () => done(c.value) })),
      ),
    );
    dialog.addEventListener('cancel', (ev) => {
      ev.preventDefault();
      done('cancel');
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
