// 앱이 시작될 때 만든 동기화 서비스를 화면이 가져다 쓰는 자리
import type { Realtime } from './sync/events.ts';
import type { SyncEngine } from './sync/engine.ts';

export const services: { engine?: SyncEngine; realtime?: Realtime } = {};
