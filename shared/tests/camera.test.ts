import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, fit, project, type Camera, type Vec3 } from '../body/camera.ts';

const right: Vec3 = [1, 0.5, 0];
const front: Vec3 = [0, 0.5, 1];
const up: Vec3 = [0, 1.5, 0];

test('front: 몸의 오른쪽은 화면 오른쪽, 위는 위, 앞은 카메라 쪽(깊이 작음)', () => {
  const [r, f, u, c] = project([right, front, up, [0, 0.5, 0]], VIEWS.front);
  assert.ok(r!.x > c!.x);
  assert.ok(u!.y > c!.y, '수학 좌표: 위가 +');
  assert.ok(f!.depth < c!.depth);
});

test('back: 오른쪽이 화면 왼쪽으로 뒤집히고 앞은 멀어진다', () => {
  const [r, f, c] = project([right, front, [0, 0.5, 0]], VIEWS.back);
  assert.ok(r!.x < c!.x);
  assert.ok(f!.depth > c!.depth);
});

test('side: 몸의 오른쪽에서 본다 (오른쪽이 카메라 쪽), yaw 90 과 같다', () => {
  const [r, c] = project([right, [0, 0.5, 0]], VIEWS.side);
  assert.ok(r!.depth < c!.depth);
  const custom: Camera = { yaw: 90, pitch: 0, distance: VIEWS.side.distance };
  assert.deepEqual(project([front], custom), project([front], VIEWS.side));
});

test('직교 투영: 깊이와 관계없이 같은 x 는 같은 화면 x, pitch 는 −60°~60° 로 제한된다', () => {
  const [n, f] = project([[0.3, 0.5, 0.5], [0.3, 0.5, -0.5]], VIEWS.front);
  assert.equal(n!.x, f!.x);
  assert.ok(n!.depth < f!.depth);
  const a = project([up], { yaw: 0, pitch: 89, distance: 3 });
  const b = project([up], { yaw: 0, pitch: 60, distance: 3 });
  assert.deepEqual(a, b);
});

test('fit: 투영한 점들이 여백을 두고 캔버스 안에 들어온다 (화면 좌표는 y 아래가 +)', () => {
  const pts = project([[-0.5, 0, 0], [0.5, 1, 0], [0, 0.5, 0.3]], VIEWS.front);
  const t = fit(pts, { width: 300, height: 400 }, 16);
  for (const p of pts) {
    const sx = t.x(p.x);
    const sy = t.y(p.y);
    assert.ok(sx >= 16 - 1e-9 && sx <= 284 + 1e-9, `x ${sx}`);
    assert.ok(sy >= 16 - 1e-9 && sy <= 384 + 1e-9, `y ${sy}`);
  }
  assert.ok(t.y(1) < t.y(0), '위쪽 점이 화면에서 위');
});
