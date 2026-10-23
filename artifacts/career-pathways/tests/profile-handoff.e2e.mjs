// Requires the existing web/API workflows and local Chromium, no new services.
// Only genuine PDF/API/rule-mapping responses; no fake AI success interception.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { makePdf } from '../../api-server/tests/cv-fixtures.ts';
import { calculateCareerMatches, parseCareerCsv } from '../src/lib/career-data.ts';
import { normalizeProfile, emptyProfile } from '../src/lib/profile.ts';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const { records, errors } = parseCareerCsv(await readFile(new URL('../public/data/skills-occupations.csv', import.meta.url), 'utf8'));
assert.deepEqual(errors, []);
const savedKey = 'career-pathways-profile';
const draftKey = 'career-pathways-profile-draft';
const temp = await mkdtemp('/tmp/futurepath-handoff-pdf-');
const profiles = [
  { type: 'fresh_graduate', skills: 'Communication, Facilitation', edited: 'Learning design, Content planning, Learning evaluation', employment: '' },
  { type: 'career_switcher', skills: 'Project coordination, Research', edited: 'Stakeholder support, Communication', employment: 'Fictional employment only' },
];
try {
  await withProfileBrowser(async b => {
    const { cdp, evaluate: ev, wait, present, click, setValue, upload } = b;
    const navigate = async path => {
      await cdp('Page.navigate', { url: `http://127.0.0.1:80${path}` });
      await present('link-my-profile');
    };
    const stored = () => ev(`JSON.parse(localStorage.getItem('${savedKey}'))`);
    const checkMatching = async skills => {
      const expected = calculateCareerMatches(skills, records);
      await wait(`document.querySelectorAll('[data-testid^="text-match-score-"]').length === ${expected.length}`);
      const actual = await ev(`Array.from(document.querySelectorAll('[data-testid^="card-role-"]')).map(card => ({
        occupation: card.querySelector('h2').textContent,
        score: parseInt(card.querySelector('[data-testid^="text-match-score-"]').textContent, 10)
      }))`);
      assert.deepEqual(actual, expected.map(({ occupation, score }) => ({ occupation, score })));
      return actual;
    };
    await navigate('/profile');
    for (const fixture of profiles) {
      const base = {
        ...emptyProfile, confirmed_by_user: true, skills: 'Research',
        education: { school: 'Previous Fictional School', degree: 'BA', major: 'Design', key_courses: '' },
      };
      await ev(`localStorage.setItem('${savedKey}', ${JSON.stringify(JSON.stringify(base))});sessionStorage.clear()`);
      await navigate('/profile');
      const file = `${temp}/${fixture.type}.pdf`;
      await writeFile(file, await makePdf([
        'FICTIONAL PROFILE FOR RULE-MAPPING TEST ONLY',
        'Name: Fictional Student', 'School: Fictional University',
        'Degree: Bachelor', 'Major: Computing', `Skills: ${fixture.skills}`,
        'Professional Certificates: None',
        ...(fixture.employment ? [`Employment Experience: ${fixture.employment}`] : []),
      ].join('\n')));
      await click('button-profile-method-pdf');
      if (fixture.type === 'fresh_graduate') {
        for (const [name, bytes, expected] of [
          ['fictional.docx', await makePdf(), 'extension'],
          ['fictional.jpg', Buffer.from('synthetic image'), 'extension'],
          ['empty.pdf', Buffer.alloc(0), 'empty'],
          ['oversized.pdf', Buffer.alloc(10 * 1024 * 1024 + 1), 'size'],
          ['false-header.pdf', Buffer.from('This is not PDF content'), 'signature'],
        ]) {
          const invalid = `${temp}/${name}`;
          await writeFile(invalid, bytes);
          await upload(invalid, 'error-pdf-validation');
          const words = { extension: 'does not have a .pdf extension', empty: 'empty', size: '10 MB', signature: 'valid PDF header' };
          await wait(`document.querySelector('[data-testid="error-pdf-validation"]').textContent.includes(${JSON.stringify(words[expected])})`);
          assert.deepEqual(await stored(), base);
        }
        console.log('PASS browser rejects DOCX/JPG/empty/oversized/fake PDF without replacing confirmation');
      }
      await upload(file);
      await setValue('select-pdf-profile-type', fixture.type);
      // Real text extraction alone must not generate or commit any profile.
      await click('checkbox-pdf-consent');
      await click('button-parse-pdf');
      await present('pdf-extracted-text');
      assert.match(await ev(`document.querySelector('[data-testid="pdf-extracted-text"]').textContent`), /Fictional University/);
      assert.equal(await ev(`!!document.querySelector('[data-testid="pdf-draft-json"]')`), false);
      assert.deepEqual(await stored(), base);
      // This sends a second real request, selecting only the offline rule mapper.
      await click('checkbox-demo-mapping');
      await click('button-parse-pdf');
      await present('button-use-pdf-draft');
      const raw = JSON.parse(await ev(`document.querySelector('[data-testid="pdf-draft-json"]').textContent`));
      assert.equal(raw.profile_type, fixture.type);
      assert.equal(raw.skills, fixture.skills);
      assert.equal(raw.confirmed_by_user, false);
      assert.equal(raw.mapping_provenance, 'simulated');
      assert.equal(raw.employment_experience, fixture.employment);
      assert.equal(raw.academic_experience, '');
      assert.equal(raw.professional_certificates, 'None');
      assert.deepEqual(normalizeProfile(raw), raw);
      await click('button-use-pdf-draft');
      await present('form-online-profile');
      await setValue('input-profile-skills', fixture.edited);
      await setValue('input-profile-education-school', 'Edited Fictional University');
      if (fixture.employment) await setValue('input-profile-employment_experience', 'Edited fictional employment');
      await wait(`JSON.parse(sessionStorage.getItem('${draftKey}')).form.skills === ${JSON.stringify(fixture.edited)}`);
      const draft = await ev(`JSON.parse(sessionStorage.getItem('${draftKey}')).form`);
      assert.equal(draft.confirmed_by_user, false);
      assert.equal(draft.mapping_provenance, 'simulated');
      assert.equal(draft.input_method, 'pdf_upload');
      await navigate('/profile');
      await present('form-online-profile');
      assert.equal(await ev(`document.querySelector('[data-testid="input-profile-skills"]').value`), fixture.edited);
      await present('profile-simulated-provenance');
      assert.deepEqual(await stored(), base);
      // Navigating to the actual consumer while editing must use OLD confirmation.
      await click('link-future-role-matches');
      const before = await checkMatching(base.skills);
      assert.deepEqual(await stored(), base);
      await click('link-my-profile');
      await present('form-online-profile');
      await click('button-profile-review');
      await present('button-confirm-profile');
      assert.equal(await ev(`document.querySelector('[data-testid="text-profile-input-method"]').textContent`), 'PDF upload');
      await present('profile-simulated-provenance');
      assert.deepEqual(await stored(), base);
      await click('button-confirm-profile');
      await present('status-profile-confirmed');
      const confirmed = await stored();
      assert.equal(confirmed.confirmed_by_user, true);
      assert.equal(confirmed.skills, fixture.edited);
      assert.equal(confirmed.mapping_provenance, 'simulated');
      assert.equal(confirmed.education.school, 'Edited Fictional University');
      assert.equal(confirmed.input_method, 'pdf_upload');
      assert.equal(confirmed.employment_experience, fixture.employment ? 'Edited fictional employment' : '');
      assert.equal(confirmed.professional_certificates, 'None');
      assert.equal(await ev(`sessionStorage.getItem('${draftKey}')`), null);
      assert.deepEqual(normalizeProfile(confirmed), confirmed);
      await click('link-future-role-matches');
      const after = await checkMatching(fixture.edited);
      assert.notDeepEqual(before, after);
      // Full-page reload exercises readProfile -> normalize -> real matching.
      await navigate('/roles');
      assert.deepEqual(await checkMatching(fixture.edited), after);
      await click('link-my-profile');
      await present('profile-simulated-provenance');
      console.log(`PASS ${fixture.type}: genuine PDF -> rules -> edit -> unconfirmed isolation -> confirm -> matching -> reload`);
    }
    for (const type of ['fresh_graduate', 'career_switcher']) {
      await ev('localStorage.clear();sessionStorage.clear()');
      await navigate('/profile');
      await click('button-profile-method-online');
      await click(`button-profile-type-${type}`);
      await click('button-profile-type-continue');
      await present('form-online-profile');
      // Required blanks must prevent review and must not create a saved profile.
      await click('button-profile-review');
      assert.equal(await ev(`!!document.querySelector('[data-testid="button-confirm-profile"]')`), false);
      assert.equal(await stored(), null);
      for (const [id, value] of [
        ['education-school', 'None'], ['education-degree', '无'], ['education-major', 'Tiada'],
        ['education-key_courses', 'Fictional courses'],
        ['internship_experience', 'Fictional internship'],
        ['academic_experience', 'Fictional study project'],
        ['professional_certificates', 'None'],
        ['personal_experience', 'Fictional volunteering'],
        ['interests_and_hobbies', 'Fictional hobbies'],
        ['skills', 'Communication, Research'],
      ]) await setValue(`input-profile-${id}`, value);
      if (type === 'career_switcher') {
        await setValue('input-profile-employment_experience', 'Fictional employment retained');
        // Back to identity selection: cannot hide and save employment as graduate.
        await ev(`document.querySelector('[data-testid="form-online-profile"] button[type="button"]').click()`);
        await click('button-profile-type-fresh_graduate');
        await present('profile-employment-resolution');
        assert.equal(await ev(`document.querySelector('[data-testid="button-profile-type-continue"]').disabled`), true);
        assert.equal(await stored(), null);
        await click('button-keep-employment');
        await click('button-profile-type-continue');
        assert.equal(await ev(`document.querySelector('[data-testid="input-profile-employment_experience"]').value`), 'Fictional employment retained');
        // Explicit removal is a separate user action and affects only the draft.
        await ev(`document.querySelector('[data-testid="form-online-profile"] button[type="button"]').click()`);
        await click('button-profile-type-fresh_graduate');
        await click('button-clear-employment');
        await wait(`!document.querySelector('[data-testid="profile-employment-resolution"]')`);
        assert.equal(await stored(), null);
        assert.equal(await ev(`JSON.parse(sessionStorage.getItem('${draftKey}')).form.employment_experience`), '');
        await click('button-profile-type-career_switcher');
        await click('button-profile-type-continue');
        await setValue('input-profile-employment_experience', 'Fictional employment retained');
      } else {
        assert.equal(await ev(`!!document.querySelector('[data-testid="input-profile-employment_experience"]')`), false);
      }
      await navigate('/profile');
      await present('form-online-profile');
      assert.equal(await ev(`document.querySelector('[data-testid="input-profile-education-degree"]').value`), '无');
      await click('button-profile-review');
      await present('button-confirm-profile');
      assert.equal(await ev(`document.querySelector('[data-testid="text-profile-input-method"]').textContent`), 'Online form');
      assert.equal(await stored(), null);
      await click('button-confirm-profile');
      await present('status-profile-confirmed');
      const online = await stored();
      assert.equal(online.profile_type, type);
      assert.equal(online.input_method, 'online_form');
      assert.equal(online.confirmed_by_user, true);
      assert.equal(online.mapping_provenance, undefined);
      assert.equal(online.education.degree, '无');
      assert.equal(online.education.school, 'None');
      assert.equal(online.education.major, 'Tiada');
      assert.equal(online.employment_experience, type === 'career_switcher' ? 'Fictional employment retained' : '');
      assert.deepEqual(Object.keys(online).sort(), Object.keys(emptyProfile).sort());
      assert.deepEqual(normalizeProfile(online), online);
      await click('link-future-role-matches');
      await checkMatching(online.skills);
      await navigate('/roles');
      await checkMatching(online.skills);
      console.log(`PASS ${type}: online form fields -> validation -> confirmation -> normalized JSON -> matching -> reload`);
    }
    // A legacy/untrusted unconfirmed storage record must never feed matching.
    await ev(`localStorage.setItem('${savedKey}', ${JSON.stringify(JSON.stringify({
      ...emptyProfile, skills: 'Communication, Research', confirmed_by_user: false, mapping_provenance: 'simulated',
    }))});sessionStorage.clear()`);
    await navigate('/roles');
    await checkMatching('');
    console.log('PASS unconfirmed storage does not become matching input');
    assert.deepEqual(b.errors, []);
    assert.equal(b.requests.filter(url => /runpod/i.test(url)).length, 0);
    const uploads = b.requests.filter(url => url.includes('/api/profile/extract-pdf'));
    assert.equal(uploads.length, 4);
    assert.ok(uploads.every(url => url.includes('map_profile=false')));
    assert.equal(uploads.filter(url => url.includes('mapping_mode=demo')).length, 2);
    console.log('PASS 4 genuine local API uploads, no RunPod requests, no runtime exceptions, no intercepted success responses');
  });
} finally {
  await rm(temp, { recursive: true, force: true });
}
