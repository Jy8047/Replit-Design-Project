import assert from 'node:assert/strict';
import test from 'node:test';
import type { CareerProfile, Resource } from './learning-resources.ts';
import {
  buildCatalogStudySchedule,
  groupStudySessionsByWeek,
  toggleCatalogSession,
} from './roadmap-catalog.ts';
import type { PersistedState } from './learning-progress.ts';

function resource(id: string, estimatedHours: number): Resource {
  return {
    id,
    skill: 'Python',
    resourceName: `${id} reference`,
    provider: 'Example provider',
    url: `https://example.test/${id}`,
    embedUrl: null,
    estimatedHours,
    cost: 'Free',
    level: 'Beginner',
    kind: 'document',
    category: 'Python',
    embedding: 'external',
    embeddingNote: 'Example resource for a unit test.',
  };
}

function profile(courses: Resource[]): CareerProfile {
  return {
    id: 'test-track',
    targetRole: 'Test track',
    skillGaps: ['Python'],
    skills: [{ skill: 'Python', courses }],
  };
}

test('builds a complete weekly schedule from resource-hour estimates', () => {
  const result = buildCatalogStudySchedule(profile([
    resource('python-basics', 10),
    resource('python-practice', 0.5),
  ]));

  assert.equal(result.unscheduledResourceIds.length, 0);
  assert.equal(result.sessions.reduce((total, session) => total + session.durationMinutes, 0), 630);
  assert.deepEqual(groupStudySessionsByWeek(result.sessions).map(({ week, sessions }) => [week, sessions.length]), [
    [0, 7],
    [1, 4],
  ]);
  assert.equal(new Set(result.sessions.map((session) => session.id)).size, result.sessions.length);
});

test('keeps invalid-duration resources visible as unscheduled instead of inventing a plan', () => {
  const result = buildCatalogStudySchedule(profile([
    resource('valid-course', 1),
    resource('missing-duration', 0),
  ]));

  assert.deepEqual(result.unscheduledResourceIds, ['missing-duration']);
  assert.deepEqual([...new Set(result.sessions.map((session) => session.nodeId))], ['valid-course']);
});

test('marks a resource complete only after all its plan items are checked', () => {
  const sessions = buildCatalogStudySchedule(profile([resource('python-course', 1.5)])).sessions;
  const initial: PersistedState = {
    signature: 'test-track',
    completedIds: [],
    schedule: sessions,
  };
  const first = toggleCatalogSession(initial, sessions[0].id, true, ['python-course']);
  assert.deepEqual(first.completedIds, []);

  const allComplete = toggleCatalogSession(first, sessions[1].id, true, ['python-course']);
  assert.deepEqual(allComplete.completedIds, ['python-course']);

  const reopened = toggleCatalogSession(allComplete, sessions[0].id, false, ['python-course']);
  assert.deepEqual(reopened.completedIds, []);
});
