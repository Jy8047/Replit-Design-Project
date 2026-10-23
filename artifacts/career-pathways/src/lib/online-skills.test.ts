import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOnlineSkills } from './online-skills.ts';
import { emptyProfile, normalizeProfile } from './profile.ts';
import { persistConfirmedProfile, persistProfileDraft, readProfileDraft, PROFILE_STORAGE_KEY } from './profile-storage.ts';

test('normalizes mixed English/Chinese delimiters and explicit list lines to a string', () => {
  assert.equal(normalizeOnlineSkills('Research，Writing; Communication；Facilitation,\r\n- Project coordination\n* Learning design\r• Content planning'),
    'Research, Writing, Communication, Facilitation, Project coordination, Learning design, Content planning');
});

test('ignores empty items and deduplicates using PDF-compatible identity, retaining first spelling and order', () => {
  for (const raw of ['', '  ', ',，;；\n\r\n', '- \n* \n• ']) {
    assert.equal(normalizeOnlineSkills(raw), '');
  }
  assert.equal(normalizeOnlineSkills(' Research ; research，Ｒｅｓｅａｒｃｈ\nWriting；Writing,,'),
    'Research, Writing');
});

test('preserves internal punctuation and multiword names without guessing additional skills', () => {
  const raw = 'C++; C#; .NET; UI/UX; R&D; Node.js; problem-solving; Design (advanced); Research & writing';
  assert.equal(normalizeOnlineSkills(raw),
    'C++, C#, .NET, UI/UX, R&D, Node.js, problem-solving, Design (advanced), Research & writing');
  assert.equal(normalizeOnlineSkills('Research and writing / facilitation: advanced'),
    'Research and writing / facilitation: advanced');
});

test('normalization is idempotent and does not change the shared profile reader or infer skills', () => {
  const raw = 'Writing；Research\n- Communication';
  assert.equal(normalizeOnlineSkills(normalizeOnlineSkills(raw)), normalizeOnlineSkills(raw));
  assert.equal(normalizeProfile({ ...emptyProfile, skills: raw })?.skills, raw);
  const profile = { ...emptyProfile, education: { ...emptyProfile.education, major: 'Research' },
    academic_experience: 'Writing', employment_experience: 'Communication' };
  assert.equal(normalizeOnlineSkills(profile.skills), '');
});

test('raw drafts and review normalization cannot replace confirmed skills before explicit confirmation', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const saved = { ...emptyProfile, skills: 'Research', confirmed_by_user: true };
  persistConfirmedProfile(storage, saved);
  const raw = 'Writing；Communication\n- Writing';
  const form = { ...saved, skills: raw, confirmed_by_user: false };
  persistProfileDraft(storage, {
    version: 1, baseProfile: JSON.stringify(saved), form, profileType: 'fresh_graduate', step: 'review',
  });
  assert.equal(readProfileDraft(storage, saved)?.form.skills, raw);
  const preview = { ...form, skills: normalizeOnlineSkills(form.skills) };
  assert.deepEqual(persistConfirmedProfile(storage, preview), { ok: false });
  assert.deepEqual(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)!), saved);
  assert.equal(form.skills, raw);
  assert.deepEqual(persistConfirmedProfile(storage, { ...preview, confirmed_by_user: true }), { ok: true });
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)!).skills, 'Writing, Communication');
});
