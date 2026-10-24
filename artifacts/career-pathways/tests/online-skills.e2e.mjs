// Run with the existing web workflow; uses isolated local Chromium, no API calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyProfile } from '../src/lib/profile.ts';
import { combineCareerDatasets, rankCareerMatchesForDisplay } from '../src/lib/career-data.ts';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const { records } = combineCareerDatasets(
  await readFile(new URL('../public/data/skills-occupations.csv', import.meta.url), 'utf8'),
  await readFile(new URL('../public/data/official-occupations.csv', import.meta.url), 'utf8'),
);
const key = 'career-pathways-profile';
// Textareas use LF even when pasted content originally has CRLF.
const raw = ' Communication；communication，\n- Facilitation;\n• Project coordination\n* C++ / C# & .NET';
const normalized = 'Communication, Facilitation, Project coordination, C++ / C# & .NET';

await withProfileBrowser(async ({ cdp, evaluate: ev, present, click, setValue, wait, errors }) => {
  const navigate = async path => {
    await cdp('Page.navigate', { url: `http://127.0.0.1:80${path}` });
    await present('link-my-profile');
  };
  const saved = () => ev(`JSON.parse(localStorage.getItem('${key}'))`);
  const matches = async skills => {
    const expected = rankCareerMatchesForDisplay(skills, records).slice(0, 8);
    await wait(`document.querySelectorAll('[data-testid^="text-match-score-"]').length === ${expected.length}`);
    assert.deepEqual(await ev(`Array.from(document.querySelectorAll('[data-testid^="card-role-"]')).map(card => ({
      occupation: card.querySelector('h2').textContent,
      score: parseInt(card.querySelector('[data-testid^="text-match-score-"]').textContent, 10)
    }))`), expected.map(({ occupation, score }) => ({ occupation, score })));
  };
  await navigate('/profile');
  for (const type of ['fresh_graduate', 'career_switcher']) {
    const base = { ...emptyProfile, profile_type: type, confirmed_by_user: true, skills: 'Research',
      education: { ...emptyProfile.education, school: 'Fictional School', degree: 'BA', major: 'Writing' } };
    await ev(`localStorage.setItem('${key}', ${JSON.stringify(JSON.stringify(base))}); sessionStorage.clear()`);
    await navigate('/profile');
    await click('button-profile-method-online');
    await click(`button-profile-type-${type}`);
    await click('button-profile-type-continue');
    await setValue('input-profile-skills', raw);
    await click('button-profile-review');
    await present('preview-normalized-skills');
    assert.equal(await ev(`document.querySelector('[data-testid="preview-normalized-skills"] .profile-review-row span').textContent`), normalized);
    assert.ok((await ev(`Array.from(document.querySelectorAll('.profile-review-row span')).map(n => n.textContent)`)).includes(raw));
    assert.deepEqual(await saved(), base);
    // Navigate as a full page load: background sidebar links are correctly
    // inert while the review dialog is open.
    await navigate('/roles');
    await matches(base.skills);
    await click('link-my-profile');
    await present('button-confirm-profile');
    // Full reload restores the raw review draft, not the normalized candidate.
    await navigate('/profile');
    await present('button-confirm-profile');
    await click('button-review-back');
    await present('input-profile-skills');
    assert.equal(await ev(`document.querySelector('[data-testid="input-profile-skills"]').value`), raw);
    await click('button-profile-review');
    // A failed save must also retain raw input and the old confirmation.
    await ev(`window.originalStorageSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        if (k === '${key}') throw new Error('Synthetic quota failure');
        return window.originalStorageSet.call(this, k, v);
      }`);
    await click('button-confirm-profile');
    await present('error-profile-save');
    assert.deepEqual(await saved(), base);
    await ev('Storage.prototype.setItem = window.originalStorageSet');
    await click('button-confirm-profile');
    await present('status-profile-confirmed');
    assert.equal((await saved()).skills, normalized);
    assert.equal((await saved()).confirmed_by_user, true);
    assert.equal((await saved()).input_method, 'online_form');
    await click('link-future-role-matches');
    await matches(normalized);
    await navigate('/roles');
    await matches(normalized);
    console.log(`PASS ${type}: raw preview/reload/edit, failed save isolation, explicit confirmation, actual matching`);
  }
  assert.deepEqual(errors, []);
});
