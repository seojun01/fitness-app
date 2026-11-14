// 클라이언트 동기화 엔진 테스트용: 실제 서버의 동기화 로직(server/src/sync.ts)을 fetch 대역으로 연결한다.
import { openDb, type Db } from '../../../server/src/db.ts';
import { HttpError } from '../../../server/src/http.ts';
import { applyChanges, pullChanges } from '../../../server/src/sync.ts';

export interface FakeServerHooks {
  /** true 이면 모든 요청이 네트워크 오류로 실패한다 */
  offline?: boolean;
  /** true 이면 401 */
  unauthorized?: boolean;
  /** 한 번에 줄 수 있는 pull 최대 개수 (페이지 나누기 테스트) */
  maxLimit?: number;
  /** true 이면 다음 push 를 서버가 반영하지만 응답은 잃어버린다 (네트워크 오류) */
  loseNextPushResponse?: boolean;
}

export interface FakeServer {
  db: Db;
  hooks: FakeServerHooks;
  fetch: typeof fetch;
  calls: { method: string; path: string; body?: any }[];
}

export function createFakeServer(db: Db = openDb(':memory:')): FakeServer {
  const hooks: FakeServerHooks = {};
  const calls: FakeServer['calls'] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://fake');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    if (hooks.offline) throw new TypeError('Failed to fetch');
    if (hooks.unauthorized) return json(401, { error: 'unauthorized', message: 'unauthorized' });
    try {
      if (url.pathname === '/api/changes' && method === 'POST') {
        const result = applyChanges(db, body);
        if (hooks.loseNextPushResponse) {
          hooks.loseNextPushResponse = false;
          throw new TypeError('Failed to fetch');
        }
        return json(200, result);
      }
      if (url.pathname === '/api/changes' && method === 'GET') {
        const since = Number(url.searchParams.get('since'));
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), hooks.maxLimit ?? 1000);
        return json(200, pullChanges(db, since, limit));
      }
      return json(404, { error: 'not_found' });
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, details: e.details });
      throw e;
    }
  }) as typeof fetch;

  return { db, hooks, fetch: fetchImpl, calls };
}
