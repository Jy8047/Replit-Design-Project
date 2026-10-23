import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile } from './profile.ts';
import {
  employmentNeedsResolution,
  persistConfirmedProfile,
  persistProfileDraft,
  readProfileDraft,
  removeProfileDraft,
  PROFILE_DRAFT_KEY,
  PROFILE_STORAGE_KEY,
  type ProfileDraft,
} from './profile-storage.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const draft: ProfileDraft = {
  version: 1,
  baseProfile: 'null',
  form: { ...emptyProfile, education: { ...emptyProfile.education, school: 'Fictional Draft School' }, confirmed_by_user: true },
  profileType: 'fresh_graduate',
  step: 'form',
};

test('employment requires an explicit resolution before becoming a graduate profile', () => {
  assert.equal(employmentNeedsResolution('fresh_graduate', 'Fictional role'), true);
  assert.equal(employmentNeedsResolution('fresh_graduate', 'None'), true);
  assert.equal(employmentNeedsResolution('fresh_graduate', '  '), false);
  assert.equal(employmentNeedsResolution('career_switcher', 'Fictional role'), false);
});

test('a tab draft round-trips as unconfirmed without modifying the confirmed profile key', () => {
  const storage = memoryStorage();
  assert.deepEqual(persistProfileDraft(storage, draft), { ok: true });
  const restored = readProfileDraft(storage, null);
  assert.ok(restored);
  assert.equal(restored.form.education.school, 'Fictional Draft School');
  assert.equal(restored.form.confirmed_by_user, false);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), null);
  assert.deepEqual(removeProfileDraft(storage), { ok: true });
  assert.equal(readProfileDraft(storage, null), null);
});

test('an extracted PDF draft preserves its input provenance and employment without confirming it', () => {
  const storage = memoryStorage();
  persistProfileDraft(storage, {
    ...draft, profileType: 'career_switcher',
    form: { ...draft.form, profile_type: 'career_switcher', input_method: 'pdf_upload', employment_experience: 'Fictional work', confirmed_by_user: true },
  });
  const restored = readProfileDraft(storage, null);
  assert.equal(restored?.form.input_method, 'pdf_upload');
  assert.equal(restored?.form.employment_experience, 'Fictional work');
  assert.equal(restored?.form.confirmed_by_user, false);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), null);
});

test('draft restoration requires resolving retained employment before preview', () => {
  const storage = memoryStorage();
  persistProfileDraft(storage, { ...draft, form: { ...draft.form, employment_experience: 'Fictional work' }, step: 'review' });
  assert.equal(readProfileDraft(storage, null)?.step, 'type');
});

test('old drafts cannot override a different or newly confirmed profile', () => {
  const storage = memoryStorage();
  persistProfileDraft(storage, draft);
  const saved = { ...emptyProfile, confirmed_by_user: true };
  assert.equal(readProfileDraft(storage, saved), null);
  persistProfileDraft(storage, { ...draft, form: saved, baseProfile: JSON.stringify(saved) });
  assert.equal(readProfileDraft(storage, saved), null);
});

test('storage quota or access errors return failure without throwing or changing the old profile', () => {
  const saved = JSON.stringify({ ...emptyProfile, skills: 'Research', confirmed_by_user: true });
  const storage = {
    getItem: () => saved,
    setItem: () => { throw new Error('Synthetic quota failure'); },
    removeItem: () => { throw new Error('Synthetic access failure'); },
  };
  assert.deepEqual(persistConfirmedProfile(storage, { ...emptyProfile, skills: 'Writing' }), { ok: false });
  assert.equal(storage.getItem(), saved);
  assert.deepEqual(persistProfileDraft(storage, draft), { ok: false });
  assert.deepEqual(removeProfileDraft(storage), { ok: false });
  assert.equal(readProfileDraft({ getItem: () => { throw new Error('Synthetic denied access'); } }, null), null);
});

test('invalid draft data is ignored and successful confirmation writes the expected key', () => {
  const storage = memoryStorage();
  storage.setItem(PROFILE_DRAFT_KEY, 'invalid json');
  assert.equal(readProfileDraft(storage, null), null);
  assert.deepEqual(persistConfirmedProfile(storage, { ...emptyProfile, confirmed_by_user: true }), { ok: true });
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)!).confirmed_by_user, true);
});
