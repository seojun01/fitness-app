// 입력 검증 오류. 화면이 field 로 어느 입력에 안내를 붙일지 정한다.
import type { FieldError } from '../../shared/model.ts';

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

const MESSAGES: Record<string, string> = {
  name: '이름은 1~60자로 입력해 주세요',
  items: '종목은 최대 50개까지 넣을 수 있어요',
  targetSets: '목표 세트는 1~20 사이여야 해요',
  weightKg: '무게는 0 이상 1000kg 이하로 입력해 주세요',
  reps: '횟수는 1~999 사이의 정수로 입력해 주세요',
  sets: '세트는 종목당 최대 50개까지 만들 수 있어요',
  entries: '종목은 세션당 최대 50개까지 넣을 수 있어요',
  memo: '메모는 500자까지 쓸 수 있어요',
  restSeconds: '휴식 시간은 15초~10분이에요',
};

export function messageForField(field: string): string {
  const key = Object.keys(MESSAGES).find((k) => field === k || field.endsWith(`.${k}`) || field.includes(`${k}[`) || field.endsWith(k));
  return key ? MESSAGES[key]! : '입력값이 올바르지 않아요';
}

export function toValidationError(errs: FieldError[]): ValidationError {
  const first = errs[0]!;
  return new ValidationError(first.field, messageForField(first.field));
}
