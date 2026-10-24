import { useEffect, useRef, useState } from 'react';
import { extractCvPdf, setBaseUrl, type CvExtractionResult } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import type { Profile, ProfileType } from '@/lib/profile';

const messages: Record<string, string> = {
  LIVE_MAPPING_BLOCKED: 'External model mapping is not available in this project. Use local extraction or simulated mapping.',
  OCR_REQUIRED: 'No extractable text was found. OCR is required but is not implemented. Use the online form.',
  RATE_LIMITED: 'The request limit was reached. Do not retry repeatedly; try the online form.',
  INVALID_PROFILE: 'No usable profile fields could be verified in the extracted text. Try simulated rules mapping again or switch to Fill in Online. Your confirmed profile is unchanged.',
  TEXT_TOO_LARGE: 'The extracted text exceeds the processing limit. Use a shorter CV or the online form.',
  ENCRYPTED_PDF: 'Encrypted or password-protected PDFs are not supported. Use an unencrypted PDF.',
  CORRUPT_PDF: 'This PDF could not be parsed. It may be damaged or unsupported.',
  PDF_TIMEOUT: 'PDF processing exceeded the time limit. Use a simpler PDF or the online form.',
  PAGE_LIMIT: 'PDFs must contain between 1 and 30 pages.',
  FILE_TOO_LARGE: 'The file is larger than the 10 MB limit. Choose a smaller PDF.',
  PDF_ONLY: 'Only PDF files are accepted.',
  EMPTY_FILE: 'This PDF is empty. Choose a non-empty PDF or fill in the profile online.',
  BUSY: 'The server is busy or the request limit was reached. Try the online form.',
  CONSENT_REQUIRED: 'Please confirm the data-processing consent before continuing.',
};
export function PdfExtractionPanel({ file, onUseDraft, onOnline }: {
  file: File | null;
  onUseDraft: (profile: Profile) => void;
  onOnline: () => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<ProfileType>('fresh_graduate');
  const [consent, setConsent] = useState(false);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CvExtractionResult | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setResult(null); setError(''); setBusy(false); setConsent(false); setDemo(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [file]);
  const parse = async () => {
    if (!file || !consent || busy) return;
    setBusy(true); setError(''); setResult(null);
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ''));
      const value = await extractCvPdf(file, { profile_type: type, map_profile: 'false', mapping_mode: demo ? 'demo' : 'none' }, {
        headers: { 'X-CV-Consent': 'local-extraction' },
        signal: controller.signal,
      });
      if (value.profile && (value.mapping !== 'SIMULATED' || value.mapping_provenance !== 'simulated'
        || value.profile.mapping_provenance !== 'simulated' || value.profile.confirmed_by_user !== false)) {
        throw new Error('Unlabelled profile response rejected');
      }
      if (request.current === controller) setResult(value);
    } catch (failure) {
      if (request.current !== controller) return;
      const code = (failure as { data?: { code?: string } })?.data?.code;
      setError(code && messages[code] ? messages[code] : 'The upload could not be completed. Your confirmed profile and draft are unchanged.');
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  return <div className="profile-pdf-flow" data-testid="pdf-extraction-panel">
    <div className="profile-inline-notice" role="note" data-testid="public-demo-notice"><p>{t('This project does not use an AI model or GPU service. Local PDF extraction and rule-based simulation are available; no external model service is called.')}</p></div>
    <div className="profile-parser-note"><p>{t('PDF bytes are sent to this app server for text extraction only. Files and raw text are not saved on the server. OCR is not implemented. Nothing changes your confirmed profile until you confirm.')}</p></div>
      <label className="profile-form-field">{t('Profile Type')}
       <select className="field" value={type} disabled={busy} onChange={event => { setType(event.target.value as ProfileType); setResult(null); }} data-testid="select-pdf-profile-type">
        <option value="fresh_graduate">{t('Fresh Graduate')}</option>
        <option value="career_switcher">{t('Career Switcher')}</option>
      </select>
    </label>
    <p><label><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} data-testid="checkbox-pdf-consent"/> {t('I agree to send this PDF to the app server for text extraction. Use a fictional CV for testing.')}</label></p>
    <p><label><input type="checkbox" checked={demo} disabled={busy} onChange={event => { setDemo(event.target.checked); setResult(null); }} data-testid="checkbox-demo-mapping"/> {t('Enable simulated mapping (rules only, not AI). Recognizable headings, bullets, labels, and clearly separated columns may create a partial editable draft; no external model is used.')}</label></p>
    {demo && <p>{t('The rules parser supports explicit field labels and recognizable section headings, bullets, or clearly separated columns. Results may be partial; review every field and fill missing information manually.')}</p>}
    <div className="profile-actions">
      <button type="button" className="btn btn-primary" disabled={!file || !consent || busy} onClick={() => void parse()} data-testid="button-parse-pdf">{t(busy ? 'Extracting…' : 'Continue / Parse CV')}</button>
      <button type="button" className="btn" disabled={busy} onClick={onOnline} data-testid="button-switch-to-online">{t('Switch to Fill in Online')}</button>
    </div>
    {error && <p role="alert" className="profile-error" data-testid="error-pdf-extraction">{t(error)}</p>}
    {result && <div className="profile-inline-notice" data-testid="pdf-extraction-result">
      <p role="status">{t(result.status === 'OCR_REQUIRED' ? messages.OCR_REQUIRED : 'Actual PDF text extracted. Check it against your CV; reading order and characters may be imperfect.')}</p>
      {messages[result.mapping] && result.status !== 'OCR_REQUIRED' && <p>{t(messages[result.mapping])}</p>}
      {result.text && <details open><summary>{t('Extracted PDF text (not saved)')}</summary><div className="profile-extracted-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, lineHeight: 1.6 }} data-testid="pdf-extracted-text">{result.text}</div></details>}
      {result.status === 'TEXT_EXTRACTED' && !result.profile && result.mapping === 'NOT_REQUESTED' && <p role="status" data-testid="pdf-mapping-not-requested">{t('No editable profile draft was created because simulated mapping was not selected. Enable rules-only mapping and try again, or switch to Fill in Online. Your confirmed profile is unchanged.')}</p>}
      {result.profile && <>
        <p data-testid="simulated-mapping-label">{t('SIMULATED MAPPING — not AI output. Values are identified by local rules. Review and edit every field before confirmation.')}</p>
        <p data-testid="pdf-rules-review-hint">{t('The local rules parser identified these fields automatically. Review each one and manually fill any fields it missed.')}</p>
        <button type="button" className="btn btn-primary" onClick={() => onUseDraft(result.profile!)} data-testid="button-use-pdf-draft">{t('Review and edit extracted draft')}</button>
      </>}
    </div>}
  </div>;
}
