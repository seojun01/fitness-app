// 내보내기 형식 (data-model.md). 툼스톤과 내부 필드(version, updatedBy)는 넣지 않는다.
import type { AnyRecord, Exercise, GuideNote, Routine, Session, Settings } from './model.ts';

export interface FitnessExport {
  format: 'fitness-export';
  /** 2: guideNotes 추가 (기능 2). v1 필드는 그대로 */
  version: 2;
  exportedAt: string;
  exercises: Omit<Exercise, 'deleted' | 'version' | 'updatedBy'>[];
  routines: Omit<Routine, 'deleted' | 'version' | 'updatedBy'>[];
  sessions: Omit<Session, 'deleted' | 'version' | 'updatedBy'>[];
  settings: Omit<Settings, 'id' | 'deleted' | 'version' | 'updatedBy'> | null;
  guideNotes: Omit<GuideNote, 'deleted' | 'version' | 'updatedBy'>[];
}

/** 내부 필드(deleted, version, updatedBy, 클라이언트의 dirty 표지)를 뺀다 */
function strip<T extends AnyRecord>(r: T): Omit<T, 'deleted' | 'version' | 'updatedBy'> {
  const { deleted: _d, version: _v, updatedBy: _u, dirty: _dirty, ...rest } = r as T & { dirty?: unknown };
  return rest as Omit<T, 'deleted' | 'version' | 'updatedBy'>;
}

export function buildExport(
  data: { exercises: Exercise[]; routines: Routine[]; sessions: Session[]; settings: Settings | null; guideNotes?: GuideNote[] },
  exportedAt: string = new Date().toISOString(),
): FitnessExport {
  const live = <T extends { deleted: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);
  let s: FitnessExport['settings'] = null;
  if (data.settings && !data.settings.deleted) {
    const { id: _id, ...rest } = strip(data.settings);
    s = rest;
  }
  return {
    format: 'fitness-export',
    version: 2,
    exportedAt,
    exercises: live(data.exercises).map(strip),
    routines: live(data.routines).map(strip),
    sessions: live(data.sessions).map(strip),
    settings: s,
    guideNotes: live(data.guideNotes ?? []).map(strip),
  };
}
