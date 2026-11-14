// 직교 투영. 시점은 방위각(yaw)·고도각(pitch)으로 정한다 (research G2). 3D 원근 보기는 범위에서 뺐다.
export type Vec3 = [number, number, number];

export interface Camera {
  /** 몸 둘레 회전(도). 0 = 정면에서, 90 = 몸의 오른쪽에서, 180 = 뒤에서 */
  yaw: number;
  /** 위에서 내려다보는 각도(도). −60~60 으로 제한된다 */
  pitch: number;
  /** 바라보는 점에서 카메라까지 거리(키 단위). 직교 투영이라 크기에는 영향이 없고 깊이 계산에만 쓴다 */
  distance: number;
  /** 바라보는 점 (기본: 몸 가운데) */
  target?: Vec3;
}

export type ViewName = 'front' | 'side' | 'back' | 'top45';

export const VIEWS: Record<ViewName, Camera> = {
  front: { yaw: 0, pitch: 0, distance: 3 },
  side: { yaw: 90, pitch: 0, distance: 3 },
  back: { yaw: 180, pitch: 0, distance: 3 },
  top45: { yaw: 35, pitch: 25, distance: 3 },
};

export const PITCH_LIMIT = 60;
const DEFAULT_TARGET: Vec3 = [0, 0.5, 0];
const RAD = Math.PI / 180;

export interface Projected {
  /** 투영 좌표(수학 좌표: 위가 +). 화면 좌표는 fit() 으로 바꾼다 */
  x: number;
  y: number;
  /** 카메라에서의 거리. 작을수록 가깝다 (그리는 순서를 정한다) */
  depth: number;
}

export function clampPitch(p: number): number {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
}

export function project(points: Vec3[], cam: Camera): Projected[] {
  const [tx, ty, tz] = cam.target ?? DEFAULT_TARGET;
  const yaw = -cam.yaw * RAD;
  const pitch = clampPitch(cam.pitch) * RAD;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return points.map(([px, py, pz]) => {
    const x0 = px - tx;
    const y0 = py - ty;
    const z0 = pz - tz;
    // Ry(−yaw)
    const x1 = x0 * cy + z0 * sy;
    const z1 = -x0 * sy + z0 * cy;
    // Rx(pitch)
    const y2 = y0 * cp - z1 * sp;
    const z2 = y0 * sp + z1 * cp;
    return { x: x1, y: y2, depth: cam.distance - z2 };
  });
}

export interface FitTransform {
  /** 키 1.0 이 화면에서 몇 픽셀인지 */
  scale: number;
  x(v: number): number;
  y(v: number): number;
}

/** 점들의 경계 상자가 여백을 두고 캔버스 가운데에 오도록 하는 변환 (화면 좌표: y 아래가 +) */
export function fit(points: { x: number; y: number }[], size: { width: number; height: number }, margin = 12): FitTransform {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    minX = -0.5;
    maxX = 0.5;
    minY = 0;
    maxY = 1;
  }
  const bw = Math.max(1e-6, maxX - minX);
  const bh = Math.max(1e-6, maxY - minY);
  const scale = Math.min((size.width - 2 * margin) / bw, (size.height - 2 * margin) / bh);
  const cx = (minX + maxX) / 2;
  const cyy = (minY + maxY) / 2;
  return {
    scale,
    x: (v) => size.width / 2 + (v - cx) * scale,
    y: (v) => size.height / 2 - (v - cyy) * scale,
  };
}
