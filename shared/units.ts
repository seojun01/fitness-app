// kg/lb 변환과 표시 (research R11). 저장은 항상 kg (소수 넷째 자리), 표시는 소수 둘째 자리·끝자리 0 제거.
import type { WeightUnit } from './model.ts';

export const KG_PER_LB = 0.45359237;

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** 입력한 값(해당 단위)을 저장용 kg 로 바꾼다 */
export function toKg(value: number, unit: WeightUnit): number {
  return round(unit === 'kg' ? value : value * KG_PER_LB, 4);
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** 화면 표시용 숫자 문자열. 45.00 → "45", 45.50 → "45.5", 100.25 → "100.25" */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return String(round(fromKg(kg, unit), 2));
}

/** 사용자가 입력한 문자열을 숫자로. 소수 둘째 자리까지, 쉼표 소수점 허용. 올바르지 않으면 null */
export function parseWeightInput(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}
