// 화면 테마: 어둡게(기본)·밝게·시스템 설정 따르기. 이 기기에만 저장한다 (기능 3, research W6)
export type Theme = 'dark' | 'light' | 'system';
export const THEME_KEY = 'fitness.theme';

export interface ThemeStorage {
  get(): string | null;
  set(value: string): void;
}

export const browserThemeStorage: ThemeStorage = {
  get: () => globalThis.localStorage?.getItem(THEME_KEY) ?? null,
  set: (v) => globalThis.localStorage?.setItem(THEME_KEY, v),
};

export function readTheme(storage: ThemeStorage = browserThemeStorage): Theme {
  try {
    const v = storage.get();
    return v === 'light' || v === 'system' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme, root: Pick<Element, 'setAttribute' | 'removeAttribute'> = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function saveTheme(theme: Theme, storage: ThemeStorage = browserThemeStorage): void {
  try {
    storage.set(theme);
  } catch {
    /* 저장 못 해도 이번 화면에는 적용된다 */
  }
  applyTheme(theme);
}
