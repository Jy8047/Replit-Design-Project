import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDF_EXTRACTION_MESSAGES } from './pdf-extraction-messages.ts';

test('language and extraction errors clearly offer the online profile form', async () => {
  assert.match(PDF_EXTRACTION_MESSAGES.UNSUPPORTED_LANGUAGE, /Chinese or English/u);
  assert.match(PDF_EXTRACTION_MESSAGES.UNSUPPORTED_LANGUAGE, /Fill in Online/u);
  assert.match(PDF_EXTRACTION_MESSAGES.INSUFFICIENT_TEXT, /Chinese or English/u);
  assert.match(PDF_EXTRACTION_MESSAGES.INSUFFICIENT_TEXT, /Fill in Online/u);
  const panel = await readFile(new URL('../components/pdf-extraction-panel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /CORRUPT_PDF:.*Fill in Online/u);
  assert.match(panel, /PDF_EXTRACTION_MESSAGES/u);
  assert.match(panel, /button-switch-to-online/u);
  const failureHandler = panel.split('} catch (failure) {')[1]?.split('} finally {')[0];
  assert.ok(failureHandler);
  assert.match(failureHandler, /setError/u);
  assert.doesNotMatch(failureHandler, /onUseDraft|persistProfileDraft|onSave/u);
  const translations = await readFile(new URL('./i18n.tsx', import.meta.url), 'utf8');
  assert.match(translations, /PDF resumes must contain primarily extractable Chinese or English text/u);
  assert.match(translations, /Not enough clear Chinese or English text was extracted/u);
});
