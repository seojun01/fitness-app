// 해시 라우터와 앱 셸(상단 바, 본문, 하단 탭 5개)
import type { Ctx } from './context.ts';
import { clear, h } from './ui/dom.ts';
import { errorState, loadingState } from './ui/states.ts';

export interface Screen {
  title: string;
  /** 어느 탭 아래에 속하는지 (강조 표시용) */
  tab: 'routines' | 'history' | 'stats' | 'guides' | 'settings';
  /** 상단 왼쪽 "‹" 뒤로 링크 */
  back?: string;
  /** 운동에 집중하는 화면: 하단 탭을 숨긴다 */
  focus?: boolean;
  /** 같은 경로 패턴에서 매개변수만 바뀔 때 호출된다. true 를 돌려주면 화면을 다시 만들지 않는다 */
  onRoute?(params: Record<string, string>): boolean;
  mount(container: HTMLElement): void | Promise<void>;
  unmount?(): void;
}

export type RouteHandler = (ctx: Ctx, params: Record<string, string>) => Screen | Promise<Screen>;

interface Route {
  parts: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

/** 패턴 예: "/routines/:id" */
export function route(pattern: string, handler: RouteHandler): void {
  routes.push({ parts: pattern.split('/').filter(Boolean), handler });
}

function match(path: string): { handler: RouteHandler; params: Record<string, string> } | null {
  const segs = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    r.parts.forEach((p, i) => {
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]!);
      else if (p !== segs[i]) ok = false;
    });
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

const TABS: { key: Screen['tab']; label: string; href: string }[] = [
  { key: 'routines', label: '루틴', href: '#/routines' },
  { key: 'history', label: '기록', href: '#/history' },
  { key: 'stats', label: '통계', href: '#/stats' },
  { key: 'guides', label: '가이드', href: '#/guides' },
  { key: 'settings', label: '설정', href: '#/settings' },
];

export interface Shell {
  root: HTMLElement;
  main: HTMLElement;
  /** 상단 바의 동기화 상태 자리 */
  statusSlot: HTMLElement;
  navigate(): Promise<void>;
}

export function startApp(ctx: Ctx, mountPoint: HTMLElement): Shell {
  const title = h('h1', { class: 'topbar-title', text: '' });
  const backLink = h('a', { class: 'topbar-back', text: '‹', attrs: { href: '#/routines', 'aria-label': '뒤로' } });
  backLink.hidden = true;
  const statusSlot = h('div', { class: 'sync-status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const main = h('main', { class: 'main', attrs: { id: 'main', tabindex: '-1' } });
  const nav = h(
    'nav',
    { class: 'tabs', attrs: { 'aria-label': '주 메뉴' } },
    ...TABS.map((t) => h('a', { class: 'tab', attrs: { href: t.href, 'data-tab': t.key }, text: t.label })),
  );
  const root = h('div', { class: 'shell' }, h('header', { class: 'topbar' }, h('div', { class: 'topbar-start' }, backLink, title), statusSlot), main, nav);
  clear(mountPoint);
  mountPoint.appendChild(root);

  let current: Screen | null = null;
  let currentHandler: RouteHandler | null = null;
  let token = 0;

  async function navigate(): Promise<void> {
    const my = ++token;
    const path = location.hash.replace(/^#/, '') || '/routines';
    const peek = match(path);
    if (current && peek && peek.handler === currentHandler && current.onRoute?.(peek.params)) return;
    current?.unmount?.();
    current = null;
    clear(main);
    main.appendChild(loadingState());
    const found = match(path) ?? match('/routines');
    try {
      const screen = await found!.handler(ctx, found!.params);
      if (my !== token) return;
      clear(main);
      title.textContent = screen.title;
      document.title = `${screen.title} · 운동 기록`;
      for (const a of nav.querySelectorAll('a')) {
        if (a.getAttribute('data-tab') === screen.tab) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
      current = screen;
      currentHandler = found!.handler;
      backLink.hidden = !screen.back;
      if (screen.back) backLink.setAttribute('href', screen.back);
      if (screen.focus) root.setAttribute('data-focus', 'true');
      else root.removeAttribute('data-focus');
      // 화면마다 전용 컨테이너에 그린다. 이동이 겹쳐 이 화면이 밀려나면 컨테이너가 떨어져 나가므로,
      // 늦게 끝난 비동기 렌더링이 새 화면 위에 덧그려지지 않는다.
      const view = h('div', { class: 'view' });
      main.appendChild(view);
      await screen.mount(view);
      main.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch (err) {
      if (my !== token) return;
      clear(main);
      main.appendChild(errorState(err instanceof Error ? err.message : String(err), () => void navigate()));
    }
  }

  window.addEventListener('hashchange', () => void navigate());
  const shell: Shell = { root, main, statusSlot, navigate };
  return shell;
}
