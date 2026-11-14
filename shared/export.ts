// 내보내기 형식 (data-model.md). 툼스톤과 내부 필드(version, updatedBy)는 넣지 않는다.
import type { AnyRecord, Exercise, Routine, Session, Settings } from './model.ts';

export interface FitnessExport {
  format: 'fitness-export';
  version: 1;
  exportedAt: string;
  exercises: Omit<Exercise, 'deleted' | 'version' | 'updatedBy'>[];
  routines: Omit<Routine, 'deleted' | 'version' | 'updatedBy'>[];
  sessions: Omit<Session, 'deleted' | 'version' | 'updatedBy'>[];
  settings: { weightUnit: Settings['weightUnit'] } | null;
}

/** 내부 필드(deleted, version, updatedBy, 클라이언트의 dirty 표지)를 뺀다 */
function strip<T extends AnyRecord>(r: T): Omit<T, 'deleted' | 'version' | 'updatedBy'> {
  const { deleted: _d, version: _v, updatedBy: _u, dirty: _dirty, ...rest } = r as T & { dirty?: unknown };
  return rest as Omit<T, 'deleted' | 'version' | 'updatedBy'>;
}

export function buildExport(
  data: { exercises: Exercise[]; routines: Routine[]; sessions: Session[]; settings: Settings | null },
  exportedAt: string = new Date().toISOString(),
): FitnessExport {
  const live = <T extends { deleted: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);
  const s = data.settings && !data.settings.deleted ? { weightUnit: data.settings.weightUnit } : null;
  return {
    format: 'fitness-export',
    version: 1,
    exportedAt,
    exercises: live(data.exercises).map(strip),
    routines: live(data.routines).map(strip),
    sessions: live(data.sessions).map(strip),
    settings: s,
  };
}
