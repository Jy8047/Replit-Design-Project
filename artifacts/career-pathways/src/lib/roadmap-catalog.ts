import type { PersistedState } from './learning-progress.ts';
import type { CareerProfile } from './learning-resources.ts';
import { planCourse, type StudySession } from './study-schedule.ts';

export const DEFAULT_SESSION_START_MINUTES = 9 * 60;
export const DEFAULT_SESSION_HOURS = 1;

export function buildCatalogStudySchedule(
  profile: Pick<CareerProfile, 'skills'>,
): { sessions: StudySession[]; unscheduledResourceIds: string[] } {
  let sessions: StudySession[] = [];
  const unscheduledResourceIds: string[] = [];
  const seen = new Set<string>();

  for (const skill of profile.skills) {
    for (const resource of skill.courses) {
      if (seen.has(resource.id)) continue;
      seen.add(resource.id);

      if (!resource.id || !Number.isFinite(resource.estimatedHours) || resource.estimatedHours <= 0) {
        unscheduledResourceIds.push(resource.id || skill.skill);
        continue;
      }

      const result = planCourse(
        resource.id,
        resource.estimatedHours,
        sessions,
        0,
        DEFAULT_SESSION_START_MINUTES,
        DEFAULT_SESSION_HOURS,
      );
      if (result.ok) sessions = result.sessions;
      else unscheduledResourceIds.push(resource.id);
    }
  }

  return { sessions, unscheduledResourceIds };
}

export function groupStudySessionsByWeek(
  sessions: readonly StudySession[],
): Array<{ week: number; sessions: StudySession[] }> {
  const grouped = new Map<number, StudySession[]>();
  for (const session of sessions) {
    const weekSessions = grouped.get(session.week) ?? [];
    weekSessions.push(session);
    grouped.set(session.week, weekSessions);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([week, weekSessions]) => ({
      week,
      sessions: weekSessions.sort((left, right) =>
        left.day - right.day || left.startMinutes - right.startMinutes,
      ),
    }));
}

export function toggleCatalogSession(
  state: PersistedState,
  sessionId: string,
  completed: boolean,
  resourceIds: readonly string[],
): PersistedState {
  const schedule = state.schedule.map((session) =>
    session.id === sessionId ? { ...session, completed } : session,
  );
  const completedIds = resourceIds.filter((resourceId) => {
    const resourceSessions = schedule.filter((session) => session.nodeId === resourceId);
    return resourceSessions.length > 0 && resourceSessions.every((session) => session.completed);
  });
  return { ...state, schedule, completedIds };
}
