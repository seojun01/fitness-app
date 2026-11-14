// 앱 아이콘 PNG 생성 (외부 패키지 없이 node:zlib 로 직접 인코딩).
// 어두운 배경(앱 테마) 위에 주황빛 덤벨을 비스듬히 그린다. 모서리를 가리는 마스커블 아이콘을 고려해 가운데 70% 안에 그린다.
// 사용: node scripts/make-icons.mjs  → client/public/icons/
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG_CENTER = [38, 38, 42]; // 가운데가 살짝 밝은 배경
const BG_EDGE = [15, 15, 16]; // #0f0f10 (앱 배경)
const FG_TOP = [255, 122, 82]; // 위쪽이 밝은 주황
const FG_BOTTOM = [229, 81, 47]; // #e5512f
const BAR = [214, 214, 220]; // 손잡이 봉은 밝은 회색
const ANGLE = (-32 * Math.PI) / 180;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** 둥근 사각형의 부호 있는 거리 (중심 기준 좌표, 반폭 bw·반높이 bh, 모서리 r) */
function roundRect(px, py, bw, bh, r) {
  const qx = Math.abs(px) - bw + r;
  const qy = Math.abs(py) - bh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const s = size;
  const cos = Math.cos(ANGLE);
  const sin = Math.sin(ANGLE);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // 필터 없음
    for (let x = 0; x < size; x++) {
      // 가운데 기준 좌표를 아이콘 크기로 나누고, 덤벨 방향으로 회전
      const cx = (x + 0.5) / s - 0.5;
      const cy = (y + 0.5) / s - 0.5;
      const u = cx * cos - cy * sin;
      const v = cx * sin + cy * cos;
      const px = 1 / s; // 픽셀 하나의 크기 (안티앨리어싱)
      // 덤벨: 가운데 봉, 안쪽 큰 원판, 바깥 작은 원판, 끝 마개 (좌우 대칭)
      const au = Math.abs(u);
      const bar = roundRect(u, v, 0.335, 0.03, 0.03); // 봉은 끝까지 지나가 원판 사이 틈으로 보인다
      const plates = Math.min(
        roundRect(au - 0.165, v, 0.04, 0.2, 0.03), // 안쪽 큰 원판
        roundRect(au - 0.245, v, 0.028, 0.145, 0.024), // 바깥 작은 원판
      );
      const aPlate = Math.max(0, Math.min(1, 0.5 - plates / px));
      const aBar = Math.max(0, Math.min(1, 0.5 - bar / px));
      // 배경: 가운데가 살짝 밝은 원형 그라데이션
      let c = mix(BG_CENTER, BG_EDGE, Math.min(1, Math.hypot(cx, cy) / 0.7));
      c = mix(c, BAR, aBar * (1 - aPlate));
      const plateColor = mix(FG_TOP, FG_BOTTOM, Math.min(1, Math.max(0, (v + 0.2) / 0.4)));
      c = mix(c, plateColor, aPlate);
      const i = row + 1 + x * 4;
      for (let k = 0; k < 3; k++) raw[i + k] = Math.round(c[k]);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('client/public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`client/public/icons/${name}`, makePng(size));
  console.log('wrote', name);
}
