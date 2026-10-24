import { appendSession, type StudySession } from './study-schedule';
export const STORAGE_KEY = 'learning-path-engine:v1';
export type ScheduleEntry = StudySession;

export interface PersistedState {
  signature: string;
  completedIds: string[];
  schedule: ScheduleEntry[];
}

export function readPersistedState(
  signature: string, storage: Storage | null, validIds?: ReadonlySet<string>, courseHours?: ReadonlyMap<string, number>,
) {
  const empty: PersistedState = { signature, completedIds: [], schedule: [] };
  if (!storage) return { available: false, state: empty };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { available: true, state: empty };
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    if (saved.signature !== signature) return { available: true, state: empty };
    const completedIds = Array.isArray(saved.completedIds)
      ? [...new Set(saved.completedIds.filter((id): id is string => typeof id === 'string' && (!validIds || validIds.has(id))))]
      : [];
    return {
      available: true,
      state: {
        signature,
        completedIds,
        schedule: migrateSessions(saved.schedule, validIds, courseHours).map(entry =>
          completedIds.includes(entry.nodeId) ? { ...entry, completed: true } : entry),
      },
    };
  } catch {
    return { available: false, state: empty };
  }
}

function migrateSessions(value: unknown, validIds?: ReadonlySet<string>, courseHours?: ReadonlyMap<string, number>): StudySession[] {
  if (!Array.isArray(value)) return [];
  let result: StudySession[] = [];
  const allocated = new Map<string, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.nodeId !== 'string' || (validIds && !validIds.has(entry.nodeId))) continue;
    const week = entry.week === undefined ? 0 : entry.week;
    const day = entry.day;
    const legacy = !('id' in entry) && !('sessionId' in entry) &&
      !('durationHours' in entry) && !('durationMinutes' in entry) && !('startMinutes' in entry);
    const startMinutes = entry.startMinutes === undefined && typeof entry.hour === 'number' ? entry.hour * 60 : entry.startMinutes;
    const savedDuration = legacy ? 60
      : entry.durationMinutes === undefined && typeof entry.durationHours === 'number'
        ? entry.durationHours * 60 : entry.durationMinutes;
    const id = legacy ? `${entry.nodeId}:w${week}:d${day}:m${startMinutes}` : entry.id ?? entry.sessionId;
    if (typeof id !== 'string' || typeof week !== 'number' || typeof day !== 'number' ||
      typeof startMinutes !== 'number' || typeof savedDuration !== 'number') continue;
    let durationMinutes = savedDuration;
    const limit = courseHours?.get(entry.nodeId);
    // Only start-only reminders lack an explicit duration. Never truncate a
    // real appointment when restoring either modern session schema.
    if (legacy && limit !== undefined) durationMinutes = Math.min(durationMinutes, Math.max(0, Math.round(limit * 60) - (allocated.get(entry.nodeId) ?? 0)));
    const next = appendSession(result, { id, nodeId: entry.nodeId, week, day, startMinutes, durationMinutes, completed: entry.completed === true });
    if (!next) continue;
    allocated.set(entry.nodeId, (allocated.get(entry.nodeId) ?? 0) + durationMinutes);
    result = next;
  }
  return result;
}

export function writePersistedState(state: PersistedState, storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
