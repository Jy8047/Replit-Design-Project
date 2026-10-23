// Real browser UI/storage checks with fictional profiles. No mocked AI success,
// external model requests or access to the real user's browser storage.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { emptyProfile } from '../src/lib/profile.ts';
import { calculateCareerMatches, parseCareerCsv } from '../src/lib/career-data.ts';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const savedKey = 'career-pathways-profile';
const draftKey = 'career-pathways-profile-draft';
const { records, errors } = parseCareerCsv(await readFile(
  new URL('../public/data/skills-occupations.csv', import.meta.url), 'utf8'));
assert.deepEqual(errors, []);
const copy = {
  en: ['Review Your Profile', 'Please review your information before confirming.', 'Back to Edit', 'Cancel', 'Confirm Profile', 'Not provided', 'Close'],
  zh: ['查看您的资料', '请在确认前检查您的信息。', '返回编辑', '取消', '确认资料', '未填写', '关闭'],
  ms: ['Semak Profil Anda', 'Sila semak maklumat anda sebelum mengesahkan.', 'Kembali ke Sunting', 'Batal', 'Sahkan Profil', 'Tidak diberikan', 'Tutup'],
};

let journeys = 0;
await withProfileBrowser(async b => {
  const { cdp, evaluate: ev, wait, present, click, setValue } = b;
  const stored = () => ev(`JSON.parse(localStorage.getItem('${savedKey}'))`);
  const closed = () => wait(`!document.querySelector('[data-testid="dialog-profile-review"]')`);
  const navigate = async path => {
    await cdp('Page.navigate', { url: `http://127.0.0.1:80${path}` });
    await present('link-my-profile');
  };
  const assertMatching = async skills => {
    const expected = calculateCareerMatches(skills, records);
    await wait(`document.querySelectorAll('[data-testid^="card-role-"]').length === ${expected.length}`);
    const actual = await ev(`Array.from(document.querySelectorAll('[data-testid^="card-role-"]')).map(n => ({
      occupation: n.querySelector('h2').textContent,
      score: parseInt(n.querySelector('[data-testid^="text-match-score-"]').textContent, 10)
    }))`);
    // Occupation labels are localized by the UI; score order must remain the
    // algorithm's order. Canonical names are additionally checked in English.
    assert.deepEqual(actual.map(row => row.score), expected.map(row => row.score));
    if (await ev('document.documentElement.lang') === 'en') {
      assert.deepEqual(actual, expected.map(({ occupation, score }) => ({ occupation, score })));
    }
  };
  const open = async () => {
    await click('button-profile-review');
    await present('dialog-profile-review');
    assert.equal(await ev('location.pathname'), '/profile');
    assert.equal(await ev(`!!document.querySelector('[data-testid="form-online-profile"]')`), true);
    assert.equal(await ev(`document.querySelector('[data-testid="dialog-profile-review"]').getAttribute('role')`), 'dialog');
  };
  for (const locale of ['en', 'zh', 'ms']) {
    for (const type of ['fresh_graduate', 'career_switcher']) {
      const mobile = locale !== 'en';
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: mobile ? 390 : 1280, height: mobile ? 844 : 900,
        deviceScaleFactor: 1, mobile,
      });
      const old = {
        ...emptyProfile, profile_type: type, input_method: 'pdf_upload',
        mapping_provenance: 'simulated', confirmed_by_user: true,
        education: { school: 'Fictional School', degree: 'Fictional BA', major: 'Design', key_courses: 'Fictional course' },
        internship_experience: 'Fictional internship',
        personal_experience: 'Fictional volunteering. '.repeat(70),
        interests_and_hobbies: 'Fictional hobbies', other_experience: 'Fictional other notes',
        employment_experience: type === 'career_switcher' ? 'Fictional employment' : '',
        skills: 'Research',
      };
      await navigate('/profile');
      await ev(`localStorage.clear();sessionStorage.clear();localStorage.setItem('career-pathways-locale',${JSON.stringify(locale)});
        localStorage.setItem('${savedKey}',${JSON.stringify(JSON.stringify(old))})`);
      await navigate('/profile');
      await click('button-profile-method-online');
      await click(`button-profile-type-${type}`);
      await click('button-profile-type-continue');
      await setValue('input-profile-skills', 'Communication; Research; Communication');
      await open();
      const [title, description, back, cancel, confirm, missing, closeLabel] = copy[locale];
      const summary = await ev(`document.querySelector('[data-testid="review-profile-summary"]').textContent`);
      assert.ok(summary.includes('Fictional School'));
      assert.ok(summary.includes('Fictional course'));
      assert.ok(summary.includes('Fictional internship'));
      assert.ok(summary.includes('Fictional hobbies'));
      assert.ok(summary.includes('Fictional other notes'));
      assert.equal(summary.includes('Fictional employment'), type === 'career_switcher');
      assert.ok(summary.includes(missing));
      assert.ok(summary.includes('Communication, Research'));
      assert.equal(await ev(`document.querySelector('[data-testid="dialog-profile-review"] h2').textContent`), title);
      assert.ok(await ev(`document.querySelector('[data-testid="dialog-profile-review"]').textContent.includes(${JSON.stringify(description)})`));
      for (const [id, label] of [
        ['button-review-back', back], ['button-review-cancel', cancel],
        ['button-confirm-profile', confirm], ['button-review-close', closeLabel],
      ]) assert.equal(await ev(`document.querySelector('[data-testid="${id}"]').textContent.trim()`), label);
      assert.equal(await ev(`document.querySelectorAll('[data-testid="dialog-profile-review"] pre, [data-testid="dialog-profile-review"] code').length`), 0);
      await present('dialog-simulated-provenance');
      assert.deepEqual(await stored(), old);
      const layout = await ev(`(() => {
        const dialog=document.querySelector('[data-testid="dialog-profile-review"]');
        const body=document.querySelector('[data-testid="review-profile-summary"]');
        const rect=dialog.getBoundingClientRect();
        const button=document.querySelector('[data-testid="button-confirm-profile"]').getBoundingClientRect();
        return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:innerWidth,height:innerHeight,
          scroll:body.scrollHeight>body.clientHeight, footer:button.top>=rect.top&&button.bottom<=rect.bottom};
      })()`);
      assert.ok(layout.left >= 0 && layout.right <= layout.width + 1);
      assert.ok(layout.top >= 0 && layout.bottom <= layout.height + 1);
      assert.ok(layout.scroll && layout.footer, JSON.stringify(layout));
      if (type === 'career_switcher' && locale !== 'ms') {
        const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const path = `/tmp/profile-review-modal-${mobile ? 'mobile' : 'desktop'}.png`;
        await writeFile(path, Buffer.from(shot.data, 'base64'));
        console.log(`Screenshot: ${path}`);
      }
      // All dismissals retain inputs and old confirmation.
      for (const action of ['button-review-back', 'button-review-cancel', 'button-review-close', 'Escape']) {
        if (action === 'Escape') {
          await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        } else await click(action);
        await closed();
        assert.equal(await ev(`document.querySelector('[data-testid="input-profile-skills"]').value`), 'Communication; Research; Communication');
        assert.deepEqual(await stored(), old);
        await open();
      }
      // Genuine pointer interaction with the backdrop, not a background-link
      // .click() that would bypass the modal's pointer isolation.
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 2, y: 2, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 2, y: 2, button: 'left', clickCount: 1 });
      await closed();
      assert.deepEqual(await stored(), old);
      await open();
      // Programmatic late field change verifies confirm-time revalidation;
      // users cannot normally edit the inert form while the modal is open.
      await setValue('input-profile-education-school', '');
      await click('button-confirm-profile');
      await closed();
      assert.deepEqual(await stored(), old);
      assert.equal(await ev(`!!document.querySelector('[data-testid="status-profile-confirmed"]')`), false);
      await setValue('input-profile-education-school', old.education.school);
      await open();
      // Explicitly injected quota failure, not a fake successful persistence.
      await ev(`window.__profileSetItem=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,v){if(k==='${savedKey}')throw new DOMException('Synthetic quota failure','QuotaExceededError');
          return window.__profileSetItem.call(this,k,v)}`);
      try {
        await click('button-confirm-profile');
        await present('error-profile-save');
        assert.ok(await ev(`!!document.querySelector('[data-testid="dialog-profile-review"] [data-testid="error-profile-save"]')`));
        assert.ok(await ev(`(() => {
          const alert=document.querySelector('[data-testid="error-profile-save"]').getBoundingClientRect();
          const dialog=document.querySelector('[data-testid="dialog-profile-review"]').getBoundingClientRect();
          return alert.height>0 && alert.top>=dialog.top && alert.bottom<=dialog.bottom
            && alert.bottom<=innerHeight;
        })()`), 'Save error must be visible without scrolling the summary');
        assert.equal(await ev(`!!document.querySelector('[data-testid="status-profile-confirmed"]')`), false);
        assert.deepEqual(await stored(), old);
        assert.equal(await ev(`JSON.parse(sessionStorage.getItem('${draftKey}')).form.confirmed_by_user`), false);
      } finally {
        await ev('Storage.prototype.setItem=window.__profileSetItem;delete window.__profileSetItem');
      }
      await click('button-review-cancel');
      await closed();
      await click('link-future-role-matches');
      await assertMatching(old.skills);
      await click('link-my-profile');
      await present('form-online-profile');
      await open();
      await click('button-confirm-profile');
      await present('status-profile-confirmed');
      await closed();
      const saved = await stored();
      assert.equal(saved.confirmed_by_user, true);
      assert.equal(saved.skills, 'Communication, Research');
      assert.equal(saved.mapping_provenance, 'simulated');
      assert.equal(saved.input_method, 'pdf_upload');
      assert.equal(saved.other_experience, old.other_experience);
      assert.equal(saved.employment_experience, old.employment_experience);
      assert.equal(await ev(`!!document.querySelector('[data-testid="profile-standard-json"]')`), false);
      await click('link-future-role-matches');
      await assertMatching(saved.skills);
      await navigate('/roles');
      await assertMatching(saved.skills);
      console.log(`PASS modal ${locale}/${type}: summary, dismissal x5, revalidation, failed save isolation, success, provenance, matching, reload`);
      journeys++;
    }
  }
  assert.deepEqual(b.errors, []);
  assert.equal(b.requests.filter(url => /runpod/i.test(url)).length, 0);
});
console.log(`PASS ${journeys}/6 modal browser journeys, no model requests or runtime exceptions`);
