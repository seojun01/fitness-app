// 클라이언트 번들: client/src/main.ts(+지연 로딩 청크), client/src/sw.ts → client/dist/
import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'client/dist';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync('client/public', OUT, { recursive: true });

const common = { bundle: true, target: 'es2022', sourcemap: true, logLevel: 'warning' };

// 앱 본체 (ES module). 가이드 데이터처럼 import() 로 부르는 모듈은 별도 청크가 된다 (research G5).
// styles.css 는 main.ts 가 import 하며 main.css 로 함께 나온다.
await build({
  ...common,
  entryPoints: { main: 'client/src/main.ts' },
  outdir: OUT,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
});

// 서비스 워커가 설치할 때 미리 캐시할 파일: 소스맵을 뺀 산출물 전부 + 앱 시작 주소
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}
const precache = ['/'];
for (const f of files(OUT)) {
  if (f.endsWith('.map') || f.endsWith('index.html')) continue;
  precache.push('/' + relative(OUT, f).split(sep).join('/'));
}

// 서비스 워커는 모듈 서비스 워커 지원이 불균일하므로 IIFE 로 만든다.
await build({
  ...common,
  entryPoints: { sw: 'client/src/sw.ts' },
  outdir: OUT,
  format: 'iife',
  // 배포마다 캐시 이름이 달라지게 해서 이전 앱 셸 캐시가 정리되도록 한다
  define: { __BUILD_ID__: JSON.stringify(String(Date.now())), __PRECACHE__: JSON.stringify(precache.sort()) },
});

console.log(`build ok → ${OUT} (사전 캐시 ${precache.length}개)`);
