// 몇 개 중 하나 고르기 (기간·지표). 실제 라디오 버튼이라 화면 낭독기·키보드가 그대로 동작한다.
import { h } from './dom.ts';

let seq = 0;
export function segmented<T extends string>(legend: string, options: readonly { value: T; label: string }[], value: T, onChange: (v: T) => void): HTMLFieldSetElement {
  const name = `seg-${++seq}`;
  return h(
    'fieldset',
    { class: 'chip-group segmented', attrs: { role: 'radiogroup', 'aria-label': legend } },
    ...options.map((o) =>
      h('label', { class: 'chip' }, h('input', { type: 'radio', name, value: o.value, checked: o.value === value, onChange: () => onChange(o.value) }), h('span', { text: o.label })),
    ),
  );
}
