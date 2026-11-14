// DOM 헬퍼. 문자열은 항상 텍스트 노드/textContent 로만 넣는다 (innerHTML 금지, 헌법 기술 제약).
export type Child = Node | string | number | null | undefined | false;

export type Props = {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'attrs') {
      for (const [a, av] of Object.entries(v as Record<string, unknown>)) {
        if (av === undefined || av === false) continue;
        el.setAttribute(a, av === true ? '' : String(av));
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else (el as unknown as Record<string, unknown>)[k] = v; // value, checked, disabled, hidden, type, ...
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: Node): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replaceChildren(el: Node, ...children: Child[]): void {
  clear(el);
  append(el, children);
}
