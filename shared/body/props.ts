// 기구: 몸(관절 좌표)이나 세계 좌표에 붙는 선분 목록으로 그린다 (research G2)
import type { Vec3 } from './camera.ts';
import type { Solved } from './pose.ts';

export type Prop =
  | { kind: 'barbell' }
  | { kind: 'dumbbells' }
  | { kind: 'bench'; y?: number; z0?: number; z1?: number }
  | { kind: 'inclineBench'; angle: number }
  | { kind: 'pullupBar'; y: number; z?: number }
  | { kind: 'cable'; anchor: Vec3 }
  | { kind: 'floor' }
  | { kind: 'box'; y: number; z0: number; z1: number }
  | { kind: 'rope' }
  | { kind: 'bike' }
  | { kind: 'rower' };

export interface PropSegment {
  a: Vec3;
  b: Vec3;
  /** 굵기(키 대비) */
  width: number;
  /** 원판·손잡이처럼 굵은 끝 */
  plate?: boolean;
}

const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

export function propSegments(prop: Prop, p: Solved): PropSegment[] {
  switch (prop.kind) {
    case 'barbell': {
      // 두 손을 잇는 봉을 양쪽으로 늘리고 끝에 원판
      const c = mid(p.lHand, p.rHand);
      const half = 0.42;
      const a: Vec3 = [c[0] - half, c[1], c[2]];
      const b: Vec3 = [c[0] + half, c[1], c[2]];
      return [
        { a, b, width: 0.018 },
        { a: [a[0], a[1] - 0.09, a[2]], b: [a[0], a[1] + 0.09, a[2]], width: 0.035, plate: true },
        { a: [b[0], b[1] - 0.09, b[2]], b: [b[0], b[1] + 0.09, b[2]], width: 0.035, plate: true },
      ];
    }
    case 'dumbbells':
      return (['lHand', 'rHand'] as const).map((h) => {
        const c = p[h];
        return { a: [c[0] - 0.07, c[1], c[2]], b: [c[0] + 0.07, c[1], c[2]], width: 0.05, plate: true };
      });
    case 'bench': {
      const y = prop.y ?? 0.42;
      const z0 = prop.z0 ?? -0.55;
      const z1 = prop.z1 ?? 0.45;
      return [
        { a: [0, y, z0], b: [0, y, z1], width: 0.09 },
        { a: [0, 0, z0 + 0.1], b: [0, y, z0 + 0.1], width: 0.04 },
        { a: [0, 0, z1 - 0.1], b: [0, y, z1 - 0.1], width: 0.04 },
      ];
    }
    case 'inclineBench': {
      const r = (prop.angle * Math.PI) / 180;
      const seat: Vec3 = [0, 0.42, 0.05];
      const top: Vec3 = [0, 0.42 + Math.sin(r) * 0.75, 0.05 - Math.cos(r) * 0.75];
      return [
        { a: seat, b: top, width: 0.09 },
        { a: [0, 0.42, 0.05], b: [0, 0.42, 0.4], width: 0.09 },
        { a: [0, 0, 0.1], b: [0, 0.42, 0.1], width: 0.04 },
      ];
    }
    case 'pullupBar': {
      const z = prop.z ?? 0;
      return [{ a: [-0.5, prop.y, z], b: [0.5, prop.y, z], width: 0.02 }];
    }
    case 'cable': {
      const c = mid(p.lHand, p.rHand);
      return [
        { a: prop.anchor, b: c, width: 0.008 },
        { a: [prop.anchor[0], 0, prop.anchor[2]], b: [prop.anchor[0], Math.max(prop.anchor[1], 1.1), prop.anchor[2]], width: 0.05 },
      ];
    }
    case 'floor':
      return [{ a: [0, 0, -0.9], b: [0, 0, 0.9], width: 0.01 }];
    case 'box':
      return [
        { a: [0, prop.y, prop.z0], b: [0, prop.y, prop.z1], width: 0.06 },
        { a: [0, 0, prop.z0], b: [0, prop.y, prop.z0], width: 0.04 },
        { a: [0, 0, prop.z1], b: [0, prop.y, prop.z1], width: 0.04 },
      ];
    case 'rope': {
      // 손에서 발 아래를 지나는 줄: 손 → 바닥 앞 → 손 (단순화)
      const below: Vec3 = [0, Math.max(0.005, Math.min(p.lToe[1], p.rToe[1]) - 0.01), (p.lToe[2] + p.rToe[2]) / 2 + 0.05];
      return [
        { a: p.lHand, b: [below[0] - 0.15, below[1], below[2]], width: 0.008 },
        { a: [below[0] - 0.15, below[1], below[2]], b: [below[0] + 0.15, below[1], below[2]], width: 0.008 },
        { a: [below[0] + 0.15, below[1], below[2]], b: p.rHand, width: 0.008 },
      ];
    }
    case 'bike':
      return [
        { a: [0, 0.42, -0.05], b: [0, 0.18, 0.15], width: 0.04 },
        { a: [0, 0.18, 0.15], b: [0, 0.75, 0.4], width: 0.04 },
        { a: [0, 0.05, 0.15], b: [0, 0.3, 0.15], width: 0.12, plate: true },
      ];
    case 'rower':
      return [
        { a: [0, 0.12, -0.6], b: [0, 0.12, 0.75], width: 0.05 },
        { a: [0, 0.12, 0.75], b: [0, 0.35, 0.8], width: 0.07 },
      ];
  }
}
