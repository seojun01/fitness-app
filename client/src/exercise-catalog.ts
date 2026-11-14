// 종목 선택의 목록·필터·사용 통계 (기능 5). 필터와 정렬은 순수 함수다.
import type { BuiltinGuide } from '../../shared/guides.ts';
import { groupsFromBodyPart, groupsFromMuscles, GROUP_LABEL, type MuscleGroup } from '../../shared/muscle-groups.ts';
import type { Equipment, Session } from '../../shared/model.ts';
import { getSeedExercise } from '../../shared/seed-exercises.ts';
import { loadGuides } from './guides.ts';
import { BODY_PART_LABEL } from './labels.ts';
import type { StoredExercise, StoredGuideNote } from './store/db.ts';
import { listAllExercises, listAllGuideNotes, listAllSessions } from './store/records.ts';

export type Category = 'all' | 'favorite' | 'frequent' | 'recent' | 'custom';

export interface CatalogItem {
  exercise: StoredExercise;
  equipment: Equipment;
  /** 주동근 → 보조근 순서의 근육 부위 그룹 */
  groups: MuscleGroup[];
  /** 완료 세션에서 쓴 횟수 */
  count: number;
  lastUsed: string | null;
}

export interface CatalogFilter {
  query?: string;
  category?: Category;
  group?: MuscleGroup;
  equipment?: Equipment;
}

/** 레코드의 장비 → 기본 종목 목록의 장비 → 맨몸/기타 (research P3) */
export function equipmentOf(ex: StoredExercise): Equipment {
  return ex.equipment ?? getSeedExercise(ex.id)?.equipment ?? (ex.bodyweight ? 'bodyweight' : 'other');
}

/** 종목별 사용 횟수(세션 단위)와 마지막 사용일. 완료·삭제 안 된 세션만 센다 */
export function usageStats(sessions: Session[]): Map<string, { count: number; lastUsed: string }> {
  const out = new Map<string, { count: number; lastUsed: string }>();
  for (const s of sessions) {
    if (s.status !== 'completed' || s.deleted || !s.endedAt) continue;
    for (const id of new Set(s.entries.map((e) => e.exerciseId))) {
      const cur = out.get(id);
      if (!cur) out.set(id, { count: 1, lastUsed: s.endedAt });
      else out.set(id, { count: cur.count + 1, lastUsed: s.endedAt > cur.lastUsed ? s.endedAt : cur.lastUsed });
    }
  }
  return out;
}

export function buildCatalog(
  exercises: StoredExercise[],
  getGuide: (id: string) => BuiltinGuide | undefined,
  notes: StoredGuideNote[],
  sessions: Session[],
): CatalogItem[] {
  const noteMap = new Map(notes.filter((n) => !n.deleted).map((n) => [n.id, n]));
  const stats = usageStats(sessions);
  return exercises.map((exercise) => {
    const g = getGuide(exercise.id);
    const n = noteMap.get(exercise.id);
    const muscles = g ?? n;
    const fromMuscles = muscles ? groupsFromMuscles(muscles.primaryMuscles, muscles.secondaryMuscles) : [];
    const s = stats.get(exercise.id);
    return {
      exercise,
      equipment: equipmentOf(exercise),
      groups: fromMuscles.length ? fromMuscles : groupsFromBodyPart(exercise.bodyPart),
      count: s?.count ?? 0,
      lastUsed: s?.lastUsed ?? null,
    };
  });
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const byName = (a: CatalogItem, b: CatalogItem) => a.exercise.name.localeCompare(b.exercise.name, 'ko');

export function filterCatalog(items: CatalogItem[], f: CatalogFilter): CatalogItem[] {
  const q = norm(f.query ?? '');
  let out = items.filter(
    (i) =>
      !i.exercise.deleted &&
      (!q || norm(i.exercise.name).includes(q)) &&
      (!f.group || i.groups.includes(f.group)) &&
      (!f.equipment || i.equipment === f.equipment),
  );
  switch (f.category ?? 'all') {
    case 'favorite':
      out = out.filter((i) => i.exercise.favorite === true).sort(byName);
      break;
    case 'frequent':
      out = out.filter((i) => i.count > 0).sort((a, b) => b.count - a.count || (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') || byName(a, b));
      break;
    case 'recent':
      out = out.filter((i) => i.lastUsed).sort((a, b) => b.lastUsed!.localeCompare(a.lastUsed!) || byName(a, b));
      break;
    case 'custom':
      out = out.filter((i) => i.exercise.custom).sort(byName);
      break;
    default:
      out = out.sort(byName);
  }
  return out;
}

/** 화면에 보일 자극 부위 (최대 2개). 그룹이 없으면 부위 이름 */
export function tagLabel(item: CatalogItem): string {
  if (item.groups.length === 0) return BODY_PART_LABEL[item.exercise.bodyPart];
  return item.groups.slice(0, 2).map((g) => GROUP_LABEL[g]).join(', ');
}

export async function loadCatalog(db: IDBDatabase): Promise<CatalogItem[]> {
  const [mod, exercises, notes, sessions] = await Promise.all([loadGuides(), listAllExercises(db), listAllGuideNotes(db), listAllSessions(db)]);
  return buildCatalog(exercises, mod.getBuiltinGuide, notes, sessions);
}
