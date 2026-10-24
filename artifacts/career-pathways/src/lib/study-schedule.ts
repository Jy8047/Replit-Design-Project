export interface StudySession {
  id: string;
  nodeId: string;
  week: number;
  day: number;
  startMinutes: number;
  durationMinutes: number;
  completed: boolean;
}

export type PlanResult = { ok: true; sessions: StudySession[] } | { ok: false; error: string };
export const DAY_START = 8 * 60;
export const DAY_END = 22 * 60;

export function isValidSessionTime(week: number, day: number, startMinutes: number, durationMinutes: number): boolean {
  return Number.isInteger(week) && week >= 0 && week < 52 &&
    Number.isInteger(day) && day >= 0 && day < 7 &&
    Number.isInteger(startMinutes) && startMinutes >= DAY_START &&
    Number.isInteger(durationMinutes) && durationMinutes > 0 &&
    startMinutes + durationMinutes <= DAY_END;
}

export function sessionsOverlap(a: StudySession, b: StudySession): boolean {
  return a.week === b.week && a.day === b.day &&
    a.startMinutes < b.startMinutes + b.durationMinutes &&
    b.startMinutes < a.startMinutes + a.durationMinutes;
}

export function appendSession(entries: StudySession[], entry: StudySession): StudySession[] | null {
  if (!entry.id || !entry.nodeId ||
    !isValidSessionTime(entry.week, entry.day, entry.startMinutes, entry.durationMinutes) ||
    entries.some(existing => existing.id === entry.id || sessionsOverlap(existing, entry))) return null;
  return [...entries, entry];
}

export function removeSession(entries: StudySession[], sessionId: string): StudySession[] {
  return entries.filter(entry => entry.id !== sessionId);
}

export function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

/** Atomic plan: preserve finished sessions and split remaining study across days. */
export function planCourse(
  nodeId: string, totalHours: number, existing: readonly StudySession[],
  day: number, startMinutes: number, sessionHours: number,
): PlanResult {
  const sessionMinutes = Math.round(sessionHours * 60);
  if (!Number.isInteger(day) || day < 0 || day > 6 ||
      !Number.isInteger(startMinutes) || startMinutes % 15 !== 0 ||
      startMinutes < DAY_START || startMinutes >= DAY_END ||
      !Number.isFinite(sessionHours) || sessionHours < 0.25 || sessionHours > 8 ||
      sessionMinutes % 15 !== 0 || !Number.isFinite(totalHours) || totalHours <= 0) {
    return { ok: false, error: 'Choose a day, a 15-minute start time (08:00–21:45), and 0.25–8 hours per session in 0.25-hour steps.' };
  }
  const retained = existing.filter(session => session.nodeId !== nodeId || session.completed);
  const doneMinutes = retained.filter(session => session.nodeId === nodeId).reduce((sum, session) => sum + session.durationMinutes, 0);
  let remaining = Math.max(0, Math.round(totalHours * 60) - doneMinutes);
  if (!remaining) return { ok: false, error: 'This course is already complete.' };
  if (startMinutes + Math.min(sessionMinutes, remaining) > DAY_END) {
    return { ok: false, error: 'The study session would end after 22:00. Choose an earlier start or a shorter session.' };
  }
  const planned: StudySession[] = [];
  for (let absoluteDay = day; remaining > 0 && absoluteDay < 52 * 7; absoluteDay++) {
    const durationMinutes = Math.min(remaining, sessionMinutes);
    const week = Math.floor(absoluteDay / 7);
    const weekday = absoluteDay % 7;
    const overlaps = retained.some(session =>
      session.week === week && session.day === weekday &&
      startMinutes < session.startMinutes + session.durationMinutes &&
      startMinutes + durationMinutes > session.startMinutes,
    );
    if (overlaps) continue;
    planned.push({
      id: `${nodeId}:w${week}:d${weekday}:m${startMinutes}`,
      nodeId, week, day: weekday, startMinutes, durationMinutes, completed: false,
    });
    remaining -= durationMinutes;
  }
  if (remaining) return { ok: false, error: 'Not enough free time within 52 weeks. No changes were saved.' };
  return { ok: true, sessions: [...retained, ...planned] };
}

export function courseProgress(
  nodeId: string, totalHours: number, sessions: readonly StudySession[], manuallyComplete: boolean,
) {
  const completedHours = manuallyComplete ? totalHours : Math.min(totalHours,
    sessions.filter(session => session.nodeId === nodeId && session.completed)
      .reduce((sum, session) => sum + session.durationMinutes / 60, 0));
  return { totalHours, completedHours, percentage: totalHours ? Math.round(completedHours / totalHours * 100) : 0 };
}
