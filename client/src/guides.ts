// 운동 가이드 (기능 2): 기본 가이드(지연 로딩) + 직접 만든 종목의 노트
import type { BuiltinGuide } from '../../shared/guides.ts';
import { isBuiltinExerciseId, validateRecord, type BodyPart, type GuideNote } from '../../shared/model.ts';
import type { MuscleId } from '../../shared/muscles.ts';
import type { Ctx } from './context.ts';
import { ValidationError, toValidationError } from './errors.ts';
import type { StoredExercise, StoredGuideNote } from './store/db.ts';
import { getExercise, getGuideNote, listAllExercises, listAllGuideNotes, saveRecords } from './store/records.ts';

type GuidesModule = typeof import('../../shared/guides.ts');
let loading: Promise<GuidesModule> | null = null;

/** 기본 가이드 데이터를 한 번만 불러온다 (별도 청크, 서비스 워커가 미리 캐시) */
export function loadGuides(): Promise<GuidesModule> {
  loading ??= import('../../shared/guides.ts');
  return loading;
}

export type ResolvedGuide =
  | { kind: 'builtin'; guide: BuiltinGuide; exercise: StoredExercise | undefined }
  | { kind: 'note'; note: StoredGuideNote; exercise: StoredExercise }
  | { kind: 'none'; exercise: StoredExercise | undefined };

/** 종목의 가이드: 기본 종목 → 기본 가이드, 직접 만든 종목 → 살아 있는 노트, 없으면 none. 삭제된 종목은 none */
export async function resolveGuide(db: IDBDatabase, exerciseId: string): Promise<ResolvedGuide> {
  const exercise = await getExercise(db, exerciseId);
  if (exercise?.deleted) return { kind: 'none', exercise };
  if (isBuiltinExerciseId(exerciseId)) {
    const guide = (await loadGuides()).getBuiltinGuide(exerciseId);
    return guide ? { kind: 'builtin', guide, exercise } : { kind: 'none', exercise };
  }
  const note = await getGuideNote(db, exerciseId);
  return note && !note.deleted && exercise ? { kind: 'note', note, exercise } : { kind: 'none', exercise };
}

export interface NoteInput {
  cues: string[];
  mistakes: string[];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
}

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter((x) => x.length > 0);

/** 직접 만든 종목의 노트를 저장한다. 모두 비면 툼스톤("가이드 없음"). 기본 종목이면 거부 */
export async function saveGuideNote(ctx: Ctx, exerciseId: string, input: NoteInput): Promise<StoredGuideNote | undefined> {
  if (isBuiltinExerciseId(exerciseId)) throw new ValidationError('id', '기본 종목의 가이드는 고칠 수 없어요');
  const rec = { id: exerciseId, cues: clean(input.cues), mistakes: clean(input.mistakes), primaryMuscles: [...input.primaryMuscles], secondaryMuscles: [...input.secondaryMuscles], deleted: false };
  const empty = rec.cues.length + rec.mistakes.length + rec.primaryMuscles.length + rec.secondaryMuscles.length === 0;
  if (empty) {
    const cur = await getGuideNote(ctx.db, exerciseId);
    if (!cur || cur.deleted) return undefined;
    return (await saveRecords(ctx, { guideNotes: [{ id: exerciseId, deleted: true } as never] })).guideNotes[0];
  }
  const errs = validateRecord('guideNote', { ...rec, version: 'v', updatedBy: 'x' });
  if (errs.length) throw toValidationError(errs);
  return (await saveRecords(ctx, { guideNotes: [rec as GuideNote] })).guideNotes[0];
}

export interface GuideEntry {
  exercise: StoredExercise;
  /** 기본 가이드나 노트가 있다 */
  hasGuide: boolean;
  primaryMuscles: MuscleId[];
}

/** 가이드 탭 목록: 삭제되지 않은 종목, 부위 필터, 이름 부분 일치(공백·대소문자 무시) */
export async function listGuideEntries(db: IDBDatabase, filter: { bodyPart?: BodyPart; query?: string } = {}): Promise<GuideEntry[]> {
  const [mod, exercises, notes] = await Promise.all([loadGuides(), listAllExercises(db), listAllGuideNotes(db)]);
  const noteMap = new Map(notes.filter((n) => !n.deleted).map((n) => [n.id, n]));
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const q = norm(filter.query ?? '');
  return exercises
    .filter((e) => !e.deleted && (!filter.bodyPart || e.bodyPart === filter.bodyPart) && (!q || norm(e.name).includes(q)))
    .map((exercise) => {
      const b = mod.getBuiltinGuide(exercise.id);
      const n = noteMap.get(exercise.id);
      return { exercise, hasGuide: !!(b || n), primaryMuscles: b?.primaryMuscles ?? n?.primaryMuscles ?? [] };
    })
    .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name, 'ko'));
}
