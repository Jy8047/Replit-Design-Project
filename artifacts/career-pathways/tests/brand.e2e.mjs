// Run against existing local workflows; isolated fictional data, no model calls.
// node --experimental-strip-types artifacts/career-pathways/tests/brand.e2e.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { makePdf } from '../../api-server/tests/cv-fixtures.ts';
import { calculateCareerMatches, combineCareerDatasets } from '../src/lib/career-data.ts';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const { records, errors } = combineCareerDatasets(
  await readFile(new URL('../public/data/skills-occupations.csv', import.meta.url), 'utf8'),
  await readFile(new URL('../public/data/official-occupations.csv', import.meta.url), 'utf8'),
);
assert.deepEqual(errors, []);
const savedKey = 'career-pathways-profile';
const temp = await mkdtemp('/tmp/pivotpath-brand-test-');
const copies = [
  ['en', 'Navigate Change. Shape Your Future.', 'An AI-powered career intelligence and future-readiness platform.'],
  ['zh', '洞见变化，规划未来。', '一个以人工智能辅助职业匹配、技能差距分析和未来职业发展规划的平台。'],
  ['ms', 'Kenali Perubahan, Rancang Masa Depan.', 'Platform kecerdasan kerjaya dan kesiapsiagaan masa depan yang dibantu oleh kecerdasan buatan.'],
];
try {
  await withProfileBrowser(async b => {
    const { cdp, evaluate: ev, wait, present, click, setValue, upload } = b;
    const navigate = async path => {
      await cdp('Page.navigate', { url: `http://127.0.0.1:80${path}` });
      await present('link-my-profile');
      await wait(`document.title.includes('PivotPath AI')`);
    };
    const stored = () => ev(`JSON.parse(localStorage.getItem('${savedKey}'))`);
    const checkMatching = async skills => {
      const expected = calculateCareerMatches(skills, records);
      await wait(`document.querySelectorAll('[data-testid^="card-role-"]').length === ${expected.length}`);
      const actual = await ev(`Array.from(document.querySelectorAll('[data-testid^="card-role-"]')).map(card => ({
        occupation: card.querySelector('h2').textContent,
        score: parseInt(card.querySelector('[data-testid^="text-match-score-"]').textContent, 10)
      }))`);
      assert.deepEqual(actual, expected.map(({ occupation, score }) => ({ occupation, score })));
    };
    await navigate('/');
    await ev(`localStorage.setItem('career-pathways-title', 'Fictional legacy custom name');localStorage.setItem('brand-test-sentinel','preserve')`);
    for (const [locale, slogan, description] of copies) {
      await click(`button-language-${locale}`);
      await navigate('/');
      await wait(`document.body.textContent.includes(${JSON.stringify(slogan)})`);
      assert.equal(await ev(`document.body.textContent.includes(${JSON.stringify(description)})`), true);
      assert.equal(await ev(`getComputedStyle(document.querySelector('.eyebrow')).textTransform`), 'none');
      for (const route of ['/', '/profile', '/skills', '/roles', '/roadmap', '/impact', '/scenarios', '/settings']) {
        await navigate(route);
        assert.equal(await ev(`document.querySelector('[data-testid="text-workspace-title"]').textContent`), 'PivotPath AI');
        assert.equal(await ev(`document.querySelector('footer').textContent.includes(${JSON.stringify(slogan)})`), true);
        assert.equal(await ev(`document.querySelector('meta[name="description"]').content`), description);
        assert.equal(await ev(`document.querySelector('meta[property="og:description"]').content`), description);
        assert.equal(await ev(`/FuturePath|Career Pathways|Fictional legacy custom name/.test(document.body.textContent)`), false);
      }
      assert.equal(await ev(`!!document.querySelector('#workspace-name, [data-testid="button-save-title"]')`), false);
      await present('button-reset-workspace');
      assert.equal(await ev(`localStorage.getItem('career-pathways-title')`), 'Fictional legacy custom name');
      assert.equal(await ev(`localStorage.getItem('brand-test-sentinel')`), 'preserve');
      console.log(`PASS ${locale}: exact slogan/description, 8 routes, metadata, fixed name, no rename controls or data clearing`);
    }
    await click('button-language-en');
    await navigate('/profile');
    await click('button-profile-method-online');
    await click('button-profile-type-fresh_graduate');
    await click('button-profile-type-continue');
    for (const [field, value] of [['education-school', 'Fictional University'], ['education-degree', 'BSc'], ['education-major', 'Computing']]) {
      await setValue(`input-profile-${field}`, value);
    }
    await click('button-profile-review');
    await present('error-profile-skills');
    assert.equal(await ev(`!!document.querySelector('[data-testid="dialog-profile-review"]')`), false);
    await setValue('input-profile-skills', 'Python, SQL');
    await click('button-profile-review');
    await present('dialog-profile-review');
    assert.equal(await stored(), null);
    await click('button-review-back');
    await wait(`!document.querySelector('[data-testid="dialog-profile-review"]')`);
    assert.equal(await ev(`document.querySelector('[data-testid="input-profile-skills"]').value`), 'Python, SQL');
    await click('button-profile-review');
    await click('button-review-cancel');
    await wait(`!document.querySelector('[data-testid="dialog-profile-review"]')`);
    assert.equal(await stored(), null);
    await click('button-profile-review');
    await click('button-confirm-profile');
    await present('status-profile-confirmed');
    const online = await stored();
    assert.equal(online.confirmed_by_user, true);
    assert.equal(online.input_method, 'online_form');
    assert.equal(online.skills, 'Python, SQL');
    await click('link-future-role-matches');
    await checkMatching(online.skills);
    console.log('PASS online graduate: required skills, edit/back/cancel, explicit confirmation, 52-role matching');

    const file = `${temp}/fictional-career-switcher.pdf`;
    await writeFile(file, await makePdf([
      'FICTIONAL CV FOR BRAND REGRESSION TEST ONLY',
      'School: Fictional College', 'Degree: Bachelor', 'Major: Research',
      'Skills: Communication, Research', 'Employment Experience: Fictional employment',
    ].join('\n')));
    await navigate('/profile');
    await click('button-profile-method-pdf');
    await upload(file);
    await setValue('select-pdf-profile-type', 'career_switcher');
    await click('checkbox-pdf-consent');
    await click('checkbox-demo-mapping');
    await click('button-parse-pdf');
    await present('pdf-extracted-text');
    assert.match(await ev(`document.querySelector('[data-testid="pdf-extracted-text"]').textContent`), /Fictional College/);
    await click('button-use-pdf-draft');
    await present('profile-simulated-provenance');
    await setValue('input-profile-skills', 'Communication, Facilitation');
    assert.deepEqual(await stored(), online);
    await click('button-profile-review');
    await present('dialog-simulated-provenance');
    assert.deepEqual(await stored(), online);
    await click('button-confirm-profile');
    await present('status-profile-confirmed');
    const pdf = await stored();
    assert.equal(pdf.mapping_provenance, 'simulated');
    assert.equal(pdf.confirmed_by_user, true);
    assert.equal(pdf.profile_type, 'career_switcher');
    assert.equal(pdf.employment_experience, 'Fictional employment');
    assert.equal(pdf.input_method, 'pdf_upload');
    assert.equal(pdf.skills, 'Communication, Facilitation');
    await click('link-future-role-matches');
    await checkMatching(pdf.skills);
    await navigate('/roles');
    await checkMatching(pdf.skills);
    console.log('PASS career switcher: real local PDF extraction -> simulated mapping -> edit -> old-profile isolation -> confirm -> matching -> reload');
    assert.deepEqual(b.errors, []);
    assert.equal(b.requests.filter(url => /runpod/i.test(url)).length, 0);
    const uploads = b.requests.filter(url => url.includes('/api/profile/extract-pdf'));
    assert.equal(uploads.length, 1);
    assert.ok(uploads[0].includes('mapping_mode=demo'));
    console.log('PASS no runtime exceptions; one real local PDF request; no intercepted success, model or RunPod requests');
  });
} finally {
  await rm(temp, { recursive: true, force: true });
}
