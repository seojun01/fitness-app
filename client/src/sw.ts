// 서비스 워커: 앱 셸을 캐시해 오프라인에서도 앱이 열린다. /api/* 는 절대 캐시하지 않는다.
declare const __BUILD_ID__: string;
/** 빌드가 넣어 주는 사전 캐시 목록: 앱 셸, 지연 로딩 청크(가이드 데이터 등), 아이콘 (scripts/build.mjs) */
declare const __PRECACHE__: string[];

interface SwScope {
  addEventListener(type: string, listener: (event: any) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
}
const sw = self as unknown as SwScope;

const CACHE = `fitness-shell-${__BUILD_ID__}`;
const SHELL = __PRECACHE__;

sw.addEventListener('install', (event) => {
  // 새 버전의 앱 파일은 HTTP 캐시를 건너뛰고 서버에서 받는다 (묵은 파일이 새 캐시에 들어가지 않게)
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fitness-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (event) => {
  const req: Request = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // 데이터는 캐시하지 않는다

  // 캐시 우선 + 백그라운드 갱신: 오프라인이어도 앱이 바로 열린다
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = req.mode === 'navigate' ? '/' : req;
      const cached = await cache.match(key);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) void cache.put(key, res.clone());
          return res;
        })
        .catch(() => undefined);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) ?? new Response('오프라인이에요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })(),
  );
});
