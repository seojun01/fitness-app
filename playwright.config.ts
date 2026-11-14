import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// e2e 테스트가 같은 DB 에 `fitness-admin pair` 로 페어링 코드를 만들 수 있도록 경로를 환경 변수로 공유한다.
const db = (process.env.E2E_DB ??= join(tmpdir(), `fitness-e2e-${process.pid}.db`));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8091',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // 모바일 뷰포트(390×844)와 320px 폭 점검
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'narrow-320', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } }, testMatch: /a11y\.spec\.ts/ },
  ],
  webServer: {
    command: 'node scripts/build.mjs && node server/src/main.ts',
    url: 'http://localhost:8091/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      FITNESS_DEV: '1',
      FITNESS_DB: db,
      PORT: '8091',
      HOST: '127.0.0.1',
    },
  },
});
