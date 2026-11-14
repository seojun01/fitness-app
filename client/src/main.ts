import './styles.css';
import { applyTheme, readTheme } from './theme.ts';
import { startApp } from './app.ts';
import { createCtx } from './context.ts';
import './routes.ts';
import { services } from './services.ts';
import { openFitnessDb } from './store/db.ts';
import { createSyncEngine } from './sync/engine.ts';
import { startRealtime } from './sync/events.ts';
import { promptIfStale } from './ui/resume-prompt.ts';
import { renderSyncStatus } from './ui/sync-indicator.ts';
import { ensureSeed } from './store/records.ts';

async function boot(): Promise<void> {
  applyTheme(readTheme()); // index.html 의 인라인 스크립트가 먼저 적용하지만, 같은 규칙을 다시 맞춘다
  const mount = document.getElementById('app')!;
  const db = await openFitnessDb();
  await ensureSeed(db);
  const ctx = await createCtx(db);
  const shell = startApp(ctx, mount);

  // 동기화: 홈서버에 등록된 기기만 서버와 통신한다. 등록하지 않아도 앱은 이 기기에서 완전히 동작한다.
  const engine = createSyncEngine(ctx);
  services.engine = engine;
  engine.onStatus((st) => renderSyncStatus(shell.statusSlot, st));
  engine.start();
  void engine.status().then((st) => renderSyncStatus(shell.statusSlot, st));
  services.realtime = startRealtime(db, engine);

  await shell.navigate();
  void promptIfStale(ctx);
  // 홈 화면에 설치한 웹 앱은 저장소가 지워지지 않도록 영구 저장을 요청한다
  void navigator.storage?.persist?.().catch(() => undefined);
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

boot().catch((err) => {
  const mount = document.getElementById('app');
  if (mount) mount.textContent = `앱을 시작하지 못했어요: ${err instanceof Error ? err.message : String(err)}`;
});
