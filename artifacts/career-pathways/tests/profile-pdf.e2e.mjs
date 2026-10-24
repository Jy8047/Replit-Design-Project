// Synthetic-PDF browser journey; uses the local extraction route only.
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fictionalProfile, makeMultiColumnPdf, makePdf } from '../../api-server/tests/cv-fixtures.ts';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const directory = await mkdtemp(join(tmpdir(), 'pivotpath-synthetic-cv-'));
const pdfPath = join(directory, 'fictional-complex-layout.pdf');
const simplePdfPath = join(directory, 'fictional-simple-layout.pdf');
const emptyMappingPath = join(directory, 'fictional-unmappable-text.pdf');
const text = `Jordan Miller | jordan.miller@example.test | +60 12-345 6789
EDUCATION University of Malaya | 2020-2024 | Bachelor of Science in Computer Science
SKILLS Python | SQL | React
`;

try {
  await writeFile(pdfPath, await makeMultiColumnPdf());
  await writeFile(simplePdfPath, await makePdf(text));
  await writeFile(emptyMappingPath, await makePdf('Fictional narrative without recognizable profile fields.'));
  await withProfileBrowser(async browser => {
    const { cdp, evaluate, wait, present, click, setValue, upload } = browser;
    await cdp('Page.navigate', { url: 'http://127.0.0.1:80/profile' });
    await present('button-profile-method-pdf');
    const previousProfile = {
      ...fictionalProfile('career_switcher'),
      skills: 'Research',
      confirmed_by_user: true,
      mapping_provenance: 'simulated',
    };
    await evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('career-pathways-profile', ${JSON.stringify(JSON.stringify(previousProfile))})`);
    await cdp('Page.navigate', { url: 'http://127.0.0.1:80/profile' });
    await present('button-profile-method-pdf');
    await click('button-profile-method-pdf');
    await upload(simplePdfPath);
    await click('checkbox-pdf-consent');

    await click('button-parse-pdf');
    await present('pdf-mapping-not-requested');
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="button-use-pdf-draft"]')`), false);
    assert.equal(await evaluate(`document.querySelector('[data-testid="pdf-extracted-text"]').textContent.includes('EDUCATION University of Malaya')`), true);

    await upload(emptyMappingPath);
    await click('checkbox-pdf-consent');
    await click('checkbox-demo-mapping');
    await click('button-parse-pdf');
    await present('error-pdf-extraction');
    assert.match(await evaluate(`document.querySelector('[data-testid="error-pdf-extraction"]').textContent`), /Fill in Online/u);
    assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('career-pathways-profile'))`), previousProfile);

    await upload(pdfPath);
    await click('checkbox-pdf-consent');
    await click('checkbox-demo-mapping');
    await click('button-parse-pdf');
    await present('button-use-pdf-draft');
    assert.equal(await evaluate(`document.querySelector('[data-testid="pdf-extracted-text"]').textContent.includes('University of Malaya Python')`), true);
    assert.equal(await evaluate(`document.querySelector('[data-testid="simulated-mapping-label"]').textContent.includes('SIMULATED')`), true);
    await click('button-use-pdf-draft');
    await present('form-online-profile');
    assert.equal(await evaluate(`document.querySelector('[data-testid="input-profile-skills"]').value`), 'Python, SQL, React');
    assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('career-pathways-profile'))`), previousProfile);

    await setValue('input-profile-skills', 'Python; SQL; React');
    await click('button-profile-review');
    await present('dialog-profile-review');
    assert.equal(await evaluate(`location.pathname`), '/profile');
    await click('button-confirm-profile');
    await present('status-profile-confirmed');
    const saved = await evaluate(`JSON.parse(localStorage.getItem('career-pathways-profile'))`);
    assert.equal(saved.confirmed_by_user, true);
    assert.equal(saved.mapping_provenance, 'simulated');
    assert.equal(saved.input_method, 'pdf_upload');
    assert.equal(saved.education.school, 'University of Malaya');
    assert.equal(saved.skills, 'Python, SQL, React');
    await cdp('Page.navigate', { url: 'http://127.0.0.1:80/roles' });
    await present('card-role-0');
    const firstScore = await evaluate(`Number(document.querySelector('[data-testid="text-match-score-0"]').textContent.match(/\\d+/)?.[0] ?? 0)`);
    assert.ok(firstScore > 0);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-testid^="card-role-"]')).some(card => {
      const skills = card.querySelector('.role-lists > div:first-child')?.textContent ?? '';
      return /Python|SQL|React/u.test(skills);
    })`), true);
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="status-role-skill-dimension-empty"]')`), false);
    assert.deepEqual(browser.errors, []);
    assert.equal(browser.requests.some(url => /runpod|glm/i.test(url)), false);
  });
  console.log('PASS synthetic PDF upload → text extraction → rules-only draft → edit → review → explicit confirmation');
} finally {
  await rm(directory, { recursive: true, force: true });
}
