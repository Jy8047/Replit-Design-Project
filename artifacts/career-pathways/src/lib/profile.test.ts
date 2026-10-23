import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProfile,
  hasPdfEndMarker,
  hasPdfSignature,
  MAX_PROFILE_PDF_BYTES,
  normalizeProfile,
  validatePdfMetadata,
  validateProfile,
} from './profile.ts';

test('normalizes a confirmed online profile into the shared schema', () => {
  const profile = normalizeProfile({
    profile_type: 'career_switcher',
    input_method: 'online_form',
    education: { school: 'Example College', degree: 'BA', major: 'Design', key_courses: 'Research' },
    skills: 'Research, Writing',
    employment_experience: 'Fictional role and duties',
    confirmed_by_user: true,
  });
  assert.ok(profile);
  assert.deepEqual(Object.keys(profile).sort(), Object.keys(emptyProfile).sort());
  assert.equal(profile.profile_type, 'career_switcher');
  assert.equal(profile.education.major, 'Design');
  assert.equal(profile.skills, 'Research, Writing');
  assert.equal(profile.confirmed_by_user, true);
});

test('PDF and online input metadata normalize to the same profile contract', () => {
  const online = normalizeProfile({ ...emptyProfile, input_method: 'online_form' });
  const pdf = normalizeProfile({ ...emptyProfile, input_method: 'pdf_upload' });
  assert.ok(online && pdf);
  assert.deepEqual(Object.keys(pdf).sort(), Object.keys(online).sort());
  assert.equal(pdf.input_method, 'pdf_upload');
  assert.equal(online.input_method, 'online_form');
});

test('preserves existing profile data when migrating from the previous simple profile shape', () => {
  const profile = normalizeProfile({
    name: 'Sample User',
    role: 'Coordinator',
    skills: 'Research, Facilitation',
    experience: 'Fictional work notes',
    interests: 'Learning design',
    background: 'Fictional context',
  });
  assert.ok(profile);
  assert.equal(profile.skills, 'Research, Facilitation');
  assert.equal(profile.role, 'Coordinator');
  assert.equal(profile.other_experience, 'Fictional work notes');
  assert.equal(profile.interests_and_hobbies, 'Learning design');
  assert.equal(profile.confirmed_by_user, false);
});

test('validates required education fields while allowing explicit None values', () => {
  const missing = validateProfile(emptyProfile);
  assert.deepEqual(missing.sort(), ['degree', 'major', 'school']);

  const explicitNone = {
    ...emptyProfile,
    education: { school: 'None', degree: '无', major: 'Tidak ada', key_courses: '' },
  };
  assert.deepEqual(validateProfile(explicitNone), []);

  const valid = {
    ...emptyProfile,
    education: { school: 'Example University', degree: 'BA', major: 'Design', key_courses: '' },
  };
  assert.deepEqual(validateProfile(valid), []);
});

test('rejects missing, non-PDF, wrong-MIME, empty, and oversized uploads', () => {
  assert.deepEqual(validatePdfMetadata({ name: 'empty.pdf', type: 'application/pdf', size: 0 }), { valid: false, reason: 'empty' });
  assert.deepEqual(validatePdfMetadata({ name: 'resume.docx', type: 'application/pdf', size: 10 }), { valid: false, reason: 'extension' });
  assert.deepEqual(validatePdfMetadata({ name: 'resume.pdf', type: 'image/jpeg', size: 10 }), { valid: false, reason: 'type' });
  assert.deepEqual(validatePdfMetadata({ name: 'resume.pdf', type: 'application/pdf', size: MAX_PROFILE_PDF_BYTES + 1 }), { valid: false, reason: 'size' });
});

test('accepts correctly labelled PDF metadata and checks the real PDF header', () => {
  assert.deepEqual(validatePdfMetadata({ name: 'sample.PDF', type: 'application/pdf', size: 128 }), { valid: true });
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true);
  assert.equal(hasPdfSignature(new Uint8Array([0x50, 0x44, 0x46, 0x2d])), false);
  assert.equal(hasPdfEndMarker(new TextEncoder().encode('%%EOF')), true);
  assert.equal(hasPdfEndMarker(new TextEncoder().encode('truncated data')), false);
});

test('invalid non-object profile data is rejected safely', () => {
  assert.equal(normalizeProfile(null), null);
  assert.equal(normalizeProfile([]), null);
  assert.equal(normalizeProfile('not a profile'), null);
});
