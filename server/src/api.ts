// /api/* 라우팅: CSRF 헤더 검사 → (페어링 제외) 기기 인증 → 처리기
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authenticate, redeemPairingCode, sessionCookie, tokenFromRequest, type Device, type FailureLimiter } from './auth.ts';
import type { Db } from './db.ts';
import type { EventsHub } from './events.ts';
import { HttpError, readJson, sendJson } from './http.ts';
import { applyChanges, pullChanges, MAX_PAGE } from './sync.ts';
import type { ApiHandler } from './main.ts';

export interface ApiDeps {
  db: Db;
  secureCookie: boolean;
  now: () => Date;
  events: EventsHub;
  limiter: FailureLimiter;
}

interface AuthedRoute {
  method: string;
  path: string;
  handle(req: IncomingMessage, res: ServerResponse, url: URL, device: Device): Promise<void> | void;
}

export function createApi(deps: ApiDeps): ApiHandler {
  const { db, now, events } = deps;

  const authed: AuthedRoute[] = [
    {
      method: 'POST',
      path: '/api/changes',
      async handle(req, res) {
        const result = applyChanges(db, await readJson(req));
        if (result.applied > 0) events.broadcast(result.cursor);
        sendJson(res, 200, result);
      },
    },
    {
      method: 'GET',
      path: '/api/changes',
      handle(_req, res, url) {
        const since = Number(url.searchParams.get('since') ?? 'NaN');
        const rawLimit = Number(url.searchParams.get('limit') ?? MAX_PAGE);
        sendJson(res, 200, pullChanges(db, since, Number.isFinite(rawLimit) ? rawLimit : MAX_PAGE));
      },
    },
    {
      method: 'GET',
      path: '/api/events',
      handle(req, res, _url, device) {
        events.handle(req, res, device.id);
      },
    },
    {
      method: 'GET',
      path: '/api/devices/me',
      handle(_req, res, _url, device) {
        sendJson(res, 200, { deviceId: device.id, deviceName: device.name, createdAt: device.created_at });
      },
    },
  ];

  return async (req, res, url) => {
    const method = req.method ?? 'GET';
    const isPair = method === 'POST' && url.pathname === '/api/pair';
    const route = authed.find((r) => r.method === method && r.path === url.pathname);
    if (!isPair && !route) return false;

    // CSRF: 쓰기 요청은 X-Fitness-Client 헤더가 필수 (SameSite=Strict 쿠키와 함께 방어)
    if (method !== 'GET' && method !== 'HEAD' && req.headers['x-fitness-client'] !== '1') {
      throw new HttpError(403, 'csrf', 'X-Fitness-Client 헤더가 필요해요');
    }

    if (isPair) {
      const body = await readJson<{ code?: unknown; deviceId?: unknown }>(req);
      const out = redeemPairingCode(db, String(body.code ?? ''), String(body.deviceId ?? ''), { now: now(), limiter: deps.limiter });
      sendJson(res, 201, { deviceId: out.deviceId, deviceName: out.deviceName }, { 'Set-Cookie': sessionCookie(out.token, deps.secureCookie) });
      return true;
    }

    const device = authenticate(db, tokenFromRequest(req), now());
    if (!device) throw new HttpError(401, 'unauthorized', '등록된 기기가 아니에요');
    await route!.handle(req, res, url, device);
    return true;
  };
}
