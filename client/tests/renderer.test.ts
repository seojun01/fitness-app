import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, project } from '../../shared/body/camera.ts';
import { solve, STANDING } from '../../shared/body/pose.ts';
import { BONES } from '../../shared/body/skeleton.ts';
import { buildDrawList, drawFrame, fitForPoses, type Colors } from '../src/ui/guide/renderer.ts';

const COLORS: Colors = { body: '#b0b0b0', head: '#c0c0c0', primary: '#ff0000', secondary: '#ff9999', equipment: '#333333', floor: '#888888' };

/** 호출을 기록하는 가짜 2D 컨텍스트 */
function fakeCtx() {
  const calls: { op: string; style?: string; width?: number }[] = [];
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    setTransform() {},
    clearRect() { calls.push({ op: 'clear' }); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    stroke() { calls.push({ op: 'stroke', style: String(ctx.strokeStyle), width: ctx.lineWidth }); },
    fill() { calls.push({ op: 'fill', style: String(ctx.fillStyle) }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

test('뼈 구간마다 선분 하나를 그리고 머리는 원으로 채운다', () => {
  const pts = solve(STANDING);
  const size = { width: 200, height: 300 };
  const { ctx, calls } = fakeCtx();
  drawFrame(ctx, pts, { camera: VIEWS.front, size, dpr: 2, colors: COLORS, highlight: { primary: [], secondary: [] }, props: [], fit: fitForPoses([pts], [], VIEWS.front, size) });
  assert.equal(calls[0]!.op, 'clear');
  assert.equal(calls.filter((c) => c.op === 'stroke' && c.style === COLORS.body).length, BONES.length);
  assert.equal(calls.filter((c) => c.op === 'fill' && c.style === COLORS.head).length, 1);
});

test('깊이 순서: 오른쪽에서 볼 때 왼팔(먼 쪽)을 먼저, 오른팔(가까운 쪽)을 나중에 그린다', () => {
  const pts = solve(STANDING);
  const order = buildDrawList(pts, VIEWS.side, []).map((d) => d.id);
  assert.ok(order.indexOf('lUpperArm') < order.indexOf('rUpperArm'));
  assert.ok(order.indexOf('lThigh') < order.indexOf('rThigh'));
  const back = buildDrawList(pts, VIEWS.front, []).map((d) => d.id);
  assert.equal(back.length, order.length);
});

test('주동근은 진한 색, 보조근은 옅은 색으로 해당 구간 위에 겹쳐 그린다', () => {
  const pts = solve(STANDING);
  const size = { width: 200, height: 300 };
  const { ctx, calls } = fakeCtx();
  drawFrame(ctx, pts, { camera: VIEWS.front, size, dpr: 1, colors: COLORS, highlight: { primary: ['quads'], secondary: ['glutes', 'calves'] }, props: [], fit: fitForPoses([pts], [], VIEWS.front, size) });
  assert.equal(calls.filter((c) => c.style === COLORS.primary).length, 2, '허벅지 양쪽');
  assert.equal(calls.filter((c) => c.style === COLORS.secondary).length, 4, '골반 양쪽 + 정강이 양쪽');
});

test('기구도 그리고, fit 은 모든 포즈와 기구가 캔버스 안에 들어오게 한다', () => {
  const a = solve(STANDING);
  const b = solve({ ...STANDING, joints: { rShoulder: { flex: 170, abd: 0, twist: 0 }, lShoulder: { flex: 170, abd: 0, twist: 0 } } });
  const size = { width: 160, height: 160 };
  const fit = fitForPoses([a, b], [{ kind: 'barbell' }], VIEWS.front, size);
  const { ctx, calls } = fakeCtx();
  drawFrame(ctx, b, { camera: VIEWS.front, size, dpr: 1, colors: COLORS, highlight: { primary: [], secondary: [] }, props: [{ kind: 'barbell' }], fit });
  assert.equal(calls.filter((c) => c.style === COLORS.equipment).length, 3, '봉 + 원판 2');
  const [hand] = project([b.rHand], VIEWS.front);
  assert.ok(fit.y(hand!.y) >= 0 && fit.y(hand!.y) <= 160, '들어 올린 손도 캔버스 안');
});
