// 인체 모델 그리기: Canvas 2D, 굵은 둥근 선분 + 머리 원, 깊이 순(뒤→앞) 정렬 (research G2, G4)
import { fit, project, type Camera, type FitTransform, type Vec3 } from '../../../../shared/body/camera.ts';
import { MUSCLES, type MuscleId } from '../../../../shared/body/muscles.ts';
import type { Solved } from '../../../../shared/body/pose.ts';
import { propSegments, type Prop } from '../../../../shared/body/props.ts';
import { BONES, HEAD_RADIUS, type SegmentId } from '../../../../shared/body/skeleton.ts';

export interface Colors {
  body: string;
  head: string;
  primary: string;
  secondary: string;
  equipment: string;
  floor: string;
}

/** CSS 변수(라이트/다크 토큰)에서 색을 읽는다 */
export function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    body: v('--figure', '#9aa4ab'),
    head: v('--figure-head', '#aeb7bd'),
    primary: v('--muscle-primary', '#e5484d'),
    secondary: v('--muscle-secondary', '#f5a3a5'),
    equipment: v('--equipment', '#3b4247'),
    floor: v('--border', '#d5dbe0'),
  };
}

export interface DrawItem {
  id: SegmentId | 'head' | `prop${number}`;
  kind: 'bone' | 'head' | 'prop';
  a: Vec3;
  b: Vec3;
  width: number;
  plate?: boolean;
  depth: number;
}

/** 그릴 것들을 카메라에서 먼 것부터 정렬한다 */
export function buildDrawList(pts: Solved, camera: Camera, props: Prop[]): DrawItem[] {
  const items: DrawItem[] = [];
  for (const b of BONES) items.push({ id: b.id, kind: 'bone', a: pts[b.a], b: pts[b.b], width: b.width, depth: 0 });
  items.push({ id: 'head', kind: 'head', a: pts.head, b: pts.head, width: HEAD_RADIUS, depth: 0 });
  let n = 0;
  for (const prop of props) for (const s of propSegments(prop, pts)) items.push({ id: `prop${n++}`, kind: 'prop', a: s.a, b: s.b, width: s.width, plate: s.plate, depth: 0 });
  const proj = project(items.flatMap((i) => [i.a, i.b]), camera);
  items.forEach((it, i) => (it.depth = (proj[i * 2]!.depth + proj[i * 2 + 1]!.depth) / 2));
  return items.sort((x, y) => y.depth - x.depth);
}

/** 여러 포즈(동작 전체 샘플)와 기구가 모두 들어오는 화면 변환. 매 프레임 다시 맞추면 몸이 흔들리므로 동작마다 한 번 계산한다 */
export function fitForPoses(samples: Solved[], props: Prop[], camera: Camera, size: { width: number; height: number }, margin = 12): FitTransform {
  const pts: Vec3[] = [];
  for (const s of samples) {
    for (const v of Object.values(s)) pts.push(v);
    pts.push([s.head[0], s.head[1] + HEAD_RADIUS, s.head[2]]);
    for (const prop of props) for (const seg of propSegments(prop, s)) pts.push(seg.a, seg.b);
  }
  return fit(project(pts, camera), size, margin);
}

export interface DrawOptions {
  camera: Camera;
  size: { width: number; height: number };
  dpr: number;
  colors: Colors;
  highlight: { primary: MuscleId[]; secondary: MuscleId[] };
  props: Prop[];
  fit: FitTransform;
}

function segmentsOf(muscles: MuscleId[]): Set<SegmentId> {
  return new Set(muscles.flatMap((m) => MUSCLES[m].segments));
}

export function drawFrame(ctx: CanvasRenderingContext2D, pts: Solved, o: DrawOptions): void {
  const { fit: f, colors } = o;
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.clearRect(0, 0, o.size.width, o.size.height);
  ctx.lineCap = 'round';
  const primary = segmentsOf(o.highlight.primary);
  const secondary = segmentsOf(o.highlight.secondary);
  for (const s of primary) secondary.delete(s);

  for (const it of buildDrawList(pts, o.camera, o.props)) {
    const [pa, pb] = project([it.a, it.b], o.camera);
    const ax = f.x(pa!.x);
    const ay = f.y(pa!.y);
    const bx = f.x(pb!.x);
    const by = f.y(pb!.y);
    if (it.kind === 'head') {
      ctx.beginPath();
      ctx.arc(ax, ay, it.width * f.scale, 0, Math.PI * 2);
      ctx.fillStyle = colors.head;
      ctx.fill();
      continue;
    }
    const w = Math.max(1, it.width * f.scale);
    const line = (style: string, width: number) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    if (it.kind === 'prop') {
      line(colors.equipment, w);
      continue;
    }
    line(colors.body, w);
    const seg = it.id as SegmentId;
    if (primary.has(seg)) line(colors.primary, w * 0.6);
    else if (secondary.has(seg)) line(colors.secondary, w * 0.6);
  }
}
