import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, FileUser, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeading } from '@/components/page-heading';
import { PdfExtractionPanel } from '@/components/pdf-extraction-panel';
import { useI18n } from '@/lib/i18n';
import { hasCurrentSkills, normalizeOnlineSkills } from '@/lib/online-skills';
import {
  emptyProfile,
  hasPdfEndMarker,
  hasPdfSignature,
  validatePdfMetadata,
  validateProfile,
  type Profile,
  type ProfileType,
} from '@/lib/profile';
import {
  employmentNeedsResolution,
  persistProfileDraft,
  readProfileDraft,
  removeProfileDraft,
  type ProfileDraft,
  type ProfileSaveResult,
} from '@/lib/profile-storage';

type Step = 'method' | 'type' | 'form' | 'review' | 'success';
type Props = { profile: Profile | null; onSave: (profile: Profile) => ProfileSaveResult; onDelete: () => void };
type TextKey =
  | 'name' | 'role' | 'skills' | 'background' | 'other_experience'
  | 'internship_experience' | 'academic_experience' | 'professional_certificates'
  | 'personal_experience' | 'interests_and_hobbies' | 'employment_experience';

const baseFields: { key: TextKey; label: string; hint: string; multiline?: boolean }[] = [
  { key: 'internship_experience', label: 'Internship Experience', hint: 'Describe an internship, or enter None.', multiline: true },
  { key: 'academic_experience', label: 'Academic Experience', hint: 'Research, academic projects, or a thesis; or enter None.', multiline: true },
  { key: 'professional_certificates', label: 'Professional Certificates', hint: 'List certificates, or enter None.', multiline: true },
  { key: 'personal_experience', label: 'Personal Experience', hint: 'Volunteering, clubs, or organizing; or enter None.', multiline: true },
  { key: 'interests_and_hobbies', label: 'Interests & Hobbies', hint: 'What topics or activities interest you? Enter None if you prefer.', multiline: true },
];

const additionalFields: { key: TextKey; label: string; hint: string; placeholder?: string; required?: boolean; multiline?: boolean }[] = [
  { key: 'skills', label: 'Current Skills', hint: 'Separate skills with commas (, ，), semicolons (; ；), or one skill per line. Optional list markers: - * •. Matching changes only after confirmation.', placeholder: 'Enter your current skills (e.g. Python, SQL, Communication)', required: true, multiline: true },
  { key: 'role', label: 'Current or Recent Role', hint: 'For example: Community program coordinator.' },
  { key: 'name', label: 'Name (optional)', hint: 'A name you would like to use; a real name is not required.' },
  { key: 'background', label: 'Career Background', hint: 'Other context you want to retain from your existing profile.', multiline: true },
  { key: 'other_experience', label: 'Other Experience Notes', hint: 'Additional experience notes from an earlier profile; or enter None.', multiline: true },
];

function errorForPdf(reason: string, t: (value: string) => string): string {
  const messages: Record<string, string> = {
    empty: 'This PDF is empty. Choose a non-empty PDF or fill in the profile online.',
    type: 'The file MIME type is not application/pdf. Choose a PDF file only.',
    extension: 'This file does not have a .pdf extension. Choose a PDF file only.',
    size: 'The file is larger than the 10 MB limit. Choose a smaller PDF.',
    signature: 'This file does not have a valid PDF header. It may be damaged or not a PDF.',
    'end-marker': 'This PDF appears incomplete or damaged because its end marker is missing. Choose another file or fill in the profile online.',
  };
  return t(messages[reason] ?? 'This file could not be validated as a PDF.');
}

export function ProfilePage({ profile, onSave, onDelete }: Props) {
  const { t } = useI18n();
  const [restoredDraft] = useState<ProfileDraft | null>(() => {
    try { return readProfileDraft(sessionStorage, profile); } catch { return null; }
  });
  const [step, setStep] = useState<Step>(restoredDraft?.step ?? 'method');
  const [method, setMethod] = useState<'pdf_upload' | 'online_form' | ''>(restoredDraft ? 'online_form' : '');
  const [profileType, setProfileType] = useState<ProfileType | ''>(restoredDraft?.profileType ?? '');
  const [form, setForm] = useState<Profile>(() => restoredDraft?.form ?? profile ?? emptyProfile);
  const [dirty, setDirty] = useState(Boolean(restoredDraft));
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'error'>(restoredDraft ? 'saved' : 'idle');
  const [draftCleanupError, setDraftCleanupError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const draftBase = useRef(restoredDraft?.baseProfile ?? JSON.stringify(profile));
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [skillsError, setSkillsError] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const unresolvedEmployment = employmentNeedsResolution(profileType, form.employment_experience);

  useEffect(() => {
    if (!dirty) return;
    const draft: ProfileDraft = {
      version: 1,
      baseProfile: draftBase.current,
      form: { ...form, profile_type: profileType || form.profile_type, confirmed_by_user: false },
      profileType,
      step: unresolvedEmployment ? 'type' : step === 'review' ? 'review' : step === 'form' ? 'form' : 'type',
    };
    try {
      setDraftStatus(persistProfileDraft(sessionStorage, draft).ok ? 'saved' : 'error');
    } catch {
      setDraftStatus('error');
    }
  }, [dirty, form, profileType, step, unresolvedEmployment]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  const clearTemporaryDraft = (): boolean => {
    try { return removeProfileDraft(sessionStorage).ok; } catch { return false; }
  };

  const discardDraft = () => {
    if (!window.confirm(t('Discard this unconfirmed draft? Your last confirmed profile will not be changed.'))) return;
    if (!clearTemporaryDraft()) {
      setDraftCleanupError(true);
      return;
    }
    setDirty(false);
    setDraftStatus('idle');
    setDraftCleanupError(false);
    setSaveError(false);
    setValidationError('');
    setSkillsError(false);
    setForm(profile ?? emptyProfile);
    setProfileType('');
    setMethod('');
    setStep('method');
    setSaved(false);
    draftBase.current = JSON.stringify(profile);
  };

  const chooseMethod = (next: 'pdf_upload' | 'online_form') => {
    setMethod(next);
    if (next === 'online_form') {
      setProfileType(profileType || profile?.profile_type || '');
      setStep('type');
    } else {
      setStep('method');
    }
  };

  const update = (key: TextKey, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setDirty(true);
    setSaveError(false);
    setSaved(false);
    setValidationError('');
    if (key === 'skills' && hasCurrentSkills(value)) setSkillsError(false);
  };
  const updateEducation = (key: keyof Profile['education'], value: string) => {
    setForm(current => ({ ...current, education: { ...current.education, [key]: value } }));
    setDirty(true);
    setSaveError(false);
    setSaved(false);
    setValidationError('');
  };

  const handleFile = async (file?: File) => {
    setPdfError('');
    setPdf(null);
    if (!file) return;
    const result = validatePdfMetadata(file);
    if (!result.valid) {
      setPdfError(errorForPdf(result.reason, t));
      return;
    }
    try {
      const [headerBuffer, tailBuffer] = await Promise.all([
        file.slice(0, 5).arrayBuffer(),
        file.slice(Math.max(0, file.size - 1024)).arrayBuffer(),
      ]);
      const signature = new Uint8Array(headerBuffer);
      if (!hasPdfSignature(signature)) {
        setPdfError(errorForPdf('signature', t));
        return;
      }
      if (!hasPdfEndMarker(new Uint8Array(tailBuffer))) {
        setPdfError(errorForPdf('end-marker', t));
        return;
      }
      setPdf(file);
    } catch {
      setPdfError(t('The selected PDF could not be read. Choose another file or fill in the profile online.'));
    }
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const openOnlineForm = () => {
    setMethod('online_form');
    setProfileType(profileType || profile?.profile_type || '');
    setStep('type');
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (unresolvedEmployment) { setStep('type'); return; }
    const draft: Profile = { ...form, profile_type: profileType || 'fresh_graduate', confirmed_by_user: false };
    const missing = validateProfile(draft);
    const hasEducationErrors = missing.some(key => key !== 'skills');
    setSkillsError(missing.includes('skills'));
    setValidationError(hasEducationErrors
      ? t('Please enter School / University, Degree, and Major. You may enter “None” or “无” when a field does not apply.')
      : '');
    if (missing.length) return;
    setForm(draft);
    setSkillsError(false);
    setSaveError(false);
    setStep('review');
  };

  const confirmProfile = () => {
    if (unresolvedEmployment) { setStep('type'); return; }
    const missing = validateProfile(form);
    if (missing.length) {
      setSkillsError(missing.includes('skills'));
      setValidationError(missing.some(key => key !== 'skills')
        ? t('Please enter School / University, Degree, and Major. You may enter “None” or “无” when a field does not apply.')
        : '');
      setStep('form');
      return;
    }
    setSkillsError(false);
    setValidationError('');
    const confirmed: Profile = {
      ...form,
      skills: normalizeOnlineSkills(form.skills),
      profile_type: profileType || 'fresh_graduate',
      confirmed_by_user: true,
    };
    let result: ProfileSaveResult;
    try { result = onSave(confirmed); } catch { result = { ok: false }; }
    if (!result.ok) {
      setSaveError(true);
      return;
    }
    setSaveError(false);
    setDirty(false);
    setDraftStatus('idle');
    setDraftCleanupError(!clearTemporaryDraft());
    draftBase.current = JSON.stringify(confirmed);
    setForm(confirmed);
    setSaved(true);
    setStep('success');
  };

  const heading = <PageHeading
    kicker={t('Your starting point')}
    title={t('Personal Profile')}
    description={t('Tell us about yourself so we can understand your current skills and career background.')}
  >
    {profile && <button className="btn btn-danger" onClick={() => {
      if (window.confirm(t('Delete your complete profile from this device? This cannot be undone.'))) {
        onDelete();
        setDraftCleanupError(!clearTemporaryDraft());
        setDirty(false);
        setDraftStatus('idle');
        draftBase.current = JSON.stringify(null);
        setForm(emptyProfile);
        setStep('method');
        setProfileType('');
        setMethod('');
        setSaved(false);
        setSaveError(false);
        setSkillsError(false);
      }
    }} data-testid="button-delete-profile"><Trash2 size={15}/>{t('Delete profile')}</button>}
  </PageHeading>;

  const renderField = (field: { key: TextKey; label: string; hint: string; placeholder?: string; required?: boolean; multiline?: boolean }) => {
    const value = form[field.key];
    const isSkills = field.key === 'skills';
    return <div key={field.key} className="profile-form-field">
      <label className="label" htmlFor={`profile-${field.key}`}>{t(field.label)}{field.required && <span className="profile-required"> · {t('required')}</span>}</label>
      {field.multiline
        ? <textarea id={`profile-${field.key}`} rows={3} className="field" placeholder={t(field.placeholder ?? field.hint)} value={value} aria-required={field.required || undefined} aria-invalid={isSkills ? skillsError : undefined} aria-describedby={isSkills && skillsError ? 'error-profile-skills' : undefined} onChange={event => update(field.key, event.target.value)} data-testid={`input-profile-${field.key}`}/>
        : <input id={`profile-${field.key}`} className="field" placeholder={t(field.placeholder ?? field.hint)} value={value} onChange={event => update(field.key, event.target.value)} data-testid={`input-profile-${field.key}`}/>}
      {field.key === 'skills' && <p className="profile-section-hint">{t(field.hint)}</p>}
      {isSkills && skillsError && <p id="error-profile-skills" className="profile-error" role="alert" data-testid="error-profile-skills">{t('Please enter at least one current skill.')}</p>}
    </div>;
  };

  return <div className="profile-page">
    {heading}
    {dirty && <div className="profile-inline-notice" data-testid="status-profile-draft">
      <p role={draftStatus === 'error' ? 'alert' : 'status'}>
        {t(draftStatus === 'error'
          ? 'Temporary draft storage is unavailable. Keep this page open and copy your entries before leaving. Closing or refreshing may lose your changes.'
          : draftStatus === 'saved'
            ? 'Unconfirmed draft saved in this browser tab. Refreshing or changing pages restores it. It is not used for matching until confirmed. PDF files are not saved.'
            : 'You have unconfirmed changes. Keep this page open until the draft is saved or the profile is confirmed.')}
        {restoredDraft && draftStatus === 'saved' && <> {t('Your unconfirmed draft has been restored.')}</>}
      </p>
      <button type="button" className="btn" onClick={discardDraft} data-testid="button-discard-profile-draft">{t('Discard draft')}</button>
    </div>}
    {draftCleanupError && <p className="profile-error" role="alert" data-testid="error-profile-draft-cleanup">{t('The temporary draft could not be removed. Your entries have been kept. Check browser storage permissions before trying again.')}</p>}
    {form.mapping_provenance === 'simulated' && <div className="profile-inline-notice" role="note" data-testid="profile-simulated-provenance"><p>{t('This profile contains a simulated rule-mapped draft, not AI output. Confirmation records your review; it does not turn the simulation into verified facts.')}</p></div>}
    {profile && <div className="profile-saved-strip" data-testid="status-profile-saved-summary">
      <ShieldCheck size={17}/><span>{t(profile.confirmed_by_user ? 'A confirmed profile is saved in this browser only. You can edit it at any time.' : 'This profile was saved earlier. Review and confirm it to mark the details as checked by you.')}</span>
      {profile.confirmed_by_user && <span className="tag"><Check size={12}/>{t('Profile saved')}</span>}
    </div>}

    {step === 'method' && <section className="panel profile-step" aria-labelledby="profile-method-heading">
      <div className="profile-step-heading"><span className="profile-step-number">01</span><div><h2 id="profile-method-heading">{t('Choose how to add your profile')}</h2><p>{t('Choose an input method. PDF processing requires separate consent before any upload.')}</p></div></div>
      <div className="profile-choice-grid">
        <button type="button" className="profile-choice" onClick={() => chooseMethod('pdf_upload')} aria-pressed={method === 'pdf_upload'} data-testid="button-profile-method-pdf">
          <span className="profile-choice-icon"><Upload size={19}/></span><span><strong>{t('Upload CV')}</strong><small>{t('Select one PDF file. Maximum size: 10 MB.')}</small></span><ArrowRight size={17}/>
        </button>
        <button type="button" className="profile-choice" onClick={() => chooseMethod('online_form')} aria-pressed={method === 'online_form'} data-testid="button-profile-method-online">
          <span className="profile-choice-icon"><FileUser size={19}/></span><span><strong>{t('Fill in Online')}</strong><small>{t('Enter and review your profile details yourself.')}</small></span><ArrowRight size={17}/>
        </button>
      </div>
      {method === 'pdf_upload' && <div className="profile-pdf-flow">
        <div
          className={`profile-dropzone ${pdf ? 'has-file' : ''}`}
          onDragOver={event => event.preventDefault()}
          onDrop={onDrop}
          data-testid="profile-pdf-dropzone"
        >
          <input ref={fileInput} type="file" accept=".pdf,application/pdf" onChange={onFileChange} hidden data-testid="input-profile-pdf"/>
          <span className="profile-choice-icon"><Upload size={20}/></span>
          <strong>{t('Drop a PDF here or choose a file')}</strong>
          <span>{t('PDF only · Maximum file size 10 MB')}</span>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} data-testid="button-choose-pdf">{t(pdf ? 'Choose a different PDF' : 'Choose PDF')}</button>
        </div>
        {pdf && <div className="profile-file-row" data-testid="status-pdf-selected">
          <FileText size={18}/><div><strong>{pdf.name}</strong><small>{(pdf.size / 1024).toFixed(1)} KB · {t('PDF format checked locally')}</small></div>
          <button type="button" className="profile-icon-button" aria-label={t('Remove selected file')} onClick={() => { setPdf(null); if (fileInput.current) fileInput.current.value = ''; }} data-testid="button-remove-pdf"><X size={17}/></button>
        </div>}
        {pdfError && <p className="profile-error" role="alert" data-testid="error-pdf-validation">{pdfError}</p>}
        <PdfExtractionPanel file={pdf} onOnline={openOnlineForm} onUseDraft={next => {
          if (dirty && !window.confirm(t('Replace the current unconfirmed draft with these extracted fields? Your confirmed profile will not change.'))) return;
          setForm({ ...next, confirmed_by_user: false });
          setProfileType(next.profile_type);
          setDirty(true);
          setSaved(false);
          setSaveError(false);
          setValidationError('');
          setSkillsError(false);
          setStep(employmentNeedsResolution(next.profile_type, next.employment_experience) ? 'type' : 'form');
        }}/>
      </div>}
    </section>}

    {step === 'type' && <section className="panel profile-step" aria-labelledby="profile-type-heading">
      <div className="profile-step-heading"><span className="profile-step-number">02</span><div><h2 id="profile-type-heading">{t('Choose the profile type that fits you')}</h2><p>{t('The form fields will adapt to your selection. Switching keeps entered information.')}</p></div></div>
      <div className="profile-choice-grid">
        {([
          ['fresh_graduate', 'Fresh Graduate', 'For someone starting out after study.'],
          ['career_switcher', 'Career Switcher', 'For someone bringing experience from another role or field.'],
        ] as const).map(([value, label, detail]) => <button key={value} type="button" className="profile-choice" onClick={() => {
          setProfileType(value);
          setForm(current => ({ ...current, profile_type: value }));
          setDirty(true);
          setSaveError(false);
        }} aria-pressed={profileType === value} data-testid={`button-profile-type-${value}`}>
          <span className="profile-choice-icon"><FileUser size={19}/></span><span><strong>{t(label)}</strong><small>{t(detail)}</small></span>{profileType === value && <Check size={17}/>}
        </button>)}
      </div>
      {unresolvedEmployment && <div className="profile-inline-notice" data-testid="profile-employment-resolution">
        <p>{t('Employment Experience is still present from a Career Switcher profile. It cannot be hidden and saved as Fresh Graduate. Choose whether to keep it as Career Switcher or remove it from this draft.')}</p>
        <ReviewRow label="Employment Experience" value={form.employment_experience} t={t}/>
        <div className="profile-actions">
          <button type="button" className="btn" onClick={() => {
            setProfileType('career_switcher');
            setForm(current => ({ ...current, profile_type: 'career_switcher' }));
            setDirty(true);
          }} data-testid="button-keep-employment">{t('Keep as Career Switcher')}</button>
          <button type="button" className="btn btn-danger" onClick={() => {
            if (window.confirm(t('Remove Employment Experience from this draft? Your saved profile is unchanged until you confirm.'))) {
              update('employment_experience', '');
            }
          }} data-testid="button-clear-employment">{t('Remove Employment Experience')}</button>
        </div>
      </div>}
      <div className="profile-actions">
        <button type="button" className="btn" onClick={() => setStep('method')}><ArrowLeft size={14}/>{t('Back')}</button>
        <button type="button" className="btn btn-primary" disabled={!profileType || unresolvedEmployment} onClick={() => setStep('form')} data-testid="button-profile-type-continue">{t('Continue')}<ArrowRight size={14}/></button>
      </div>
    </section>}

    {(step === 'form' || step === 'review') && <form className="panel profile-step" onSubmit={submitForm} data-testid="form-online-profile">
      <div className="profile-step-heading"><span className="profile-step-number">03</span><div><h2>{t(profileType === 'career_switcher' ? 'Career Switcher Profile' : 'Fresh Graduate Profile')}</h2><p>{t('Required fields are School / University, Degree, Major, and Current Skills. Enter None or 无 for education fields that do not apply. Other experience fields are optional.')}</p></div></div>
      <div className="profile-form-section"><h3>{t('Education')}</h3><div className="profile-form-grid">
        {([
          ['school', 'School / University', 'Enter your school or university, or None.'],
          ['degree', 'Degree', 'Enter your degree, or None.'],
          ['major', 'Major', 'Enter your major, or None.'],
          ['key_courses', 'Key Courses', 'List relevant courses, or None.'],
        ] as const).map(([key, label, hint]) => <div key={key} className="profile-form-field">
          <label className="label" htmlFor={`profile-education-${key}`}>{t(label)}{key !== 'key_courses' && <span className="profile-required"> · {t('required')}</span>}</label>
          <input id={`profile-education-${key}`} className="field" placeholder={t(hint)} value={form.education[key]} onChange={event => updateEducation(key, event.target.value)} data-testid={`input-profile-education-${key}`}/>
        </div>)}
      </div></div>
      <div className="profile-form-section"><h3>{t('Experience and interests')}</h3><div className="profile-form-grid">{baseFields.map(renderField)}</div></div>
      {profileType === 'career_switcher' && <div className="profile-form-section">
        <h3>{t('Employment Experience')}</h3><div className="profile-form-grid">
          {renderField({ key: 'employment_experience', label: 'Employment Experience', hint: 'For example: role, industry, main responsibilities, outcomes, and dates. Enter None if not applicable.', multiline: true })}
        </div>
      </div>}
      <div className="profile-form-section"><h3>{t('Career details and matching')}</h3>
        <p className="profile-section-hint">{t('Current Skills are used by the existing career matching feature. The other fields retain useful details from earlier profile versions.')}</p>
        <div className="profile-form-grid">{additionalFields.map(renderField)}</div>
      </div>
      {validationError && <p className="profile-error" role="alert" data-testid="error-profile-validation">{validationError}</p>}
      <div className="profile-actions">
        <button type="button" className="btn" onClick={() => setStep('type')}><ArrowLeft size={14}/>{t('Back')}</button>
        <button type="submit" className="btn btn-primary" data-testid="button-profile-review">{t('Review Profile')}<ArrowRight size={14}/></button>
      </div>
    </form>}

    <Dialog open={step === 'review'} onOpenChange={open => { if (!open) setStep('form'); }}>
      <DialogContent closeLabel={t('Close')} closeTestId="button-review-close" className="flex w-[calc(100%-2rem)] max-w-2xl flex-col gap-3 overflow-hidden p-0" data-testid="dialog-profile-review">
        <div className="px-6 pt-6 pr-12">
          <DialogHeader><DialogTitle>{t('Review Your Profile')}</DialogTitle><DialogDescription>{t('Please review your information before confirming.')}</DialogDescription></DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6" data-testid="review-profile-summary">
          {form.mapping_provenance === 'simulated' && <div className="profile-inline-notice" role="note" data-testid="dialog-simulated-provenance"><p>{t('This profile contains a simulated rule-mapped draft, not AI output. Confirmation records your review; it does not turn the simulation into verified facts.')}</p></div>}
          <div className="profile-review-meta"><span className="tag">{t(profileType === 'career_switcher' ? 'Career Switcher' : 'Fresh Graduate')}</span><span className="tag" data-testid="text-profile-input-method">{t(form.input_method === 'pdf_upload' ? 'PDF upload' : 'Online form')}</span></div>
          <div className="profile-review-group"><h3>{t('Profile Type')}</h3>
            <ReviewRow label="Profile Type" value={t(profileType === 'career_switcher' ? 'Career Switcher' : profileType === 'fresh_graduate' ? 'Fresh Graduate' : '')} t={t}/>
          </div>
          <div className="profile-review-group"><h3>{t('Education')}</h3>
            {([
              ['School / University', form.education.school], ['Degree', form.education.degree],
              ['Major', form.education.major], ['Key Courses', form.education.key_courses],
            ] as const).map(([label, value]) => <ReviewRow key={label} label={label} value={value} t={t}/>)}
          </div>
          <div className="profile-review-group"><h3>{t('Experience and interests')}</h3>
            {([
              ['Internship Experience', form.internship_experience], ['Academic Experience', form.academic_experience],
              ['Professional Certificates', form.professional_certificates], ['Personal Experience', form.personal_experience],
              ['Interests & Hobbies', form.interests_and_hobbies], ['Other Experience Notes', form.other_experience],
            ] as const).map(([label, value]) => <ReviewRow key={label} label={label} value={value} t={t}/>)}
          </div>
          {profileType === 'career_switcher' && <div className="profile-review-group"><h3>{t('Employment Experience')}</h3>
            <ReviewRow label="Employment Experience" value={form.employment_experience} t={t}/>
          </div>}
          <div className="profile-review-group"><h3>{t('Career details and matching')}</h3>
            {additionalFields.filter(field => field.key !== 'other_experience').map(field => <ReviewRow key={field.key} label={field.label} value={form[field.key]} t={t}/>)}
            <div data-testid="preview-normalized-skills">
              <ReviewRow label="Skills after confirmation" value={normalizeOnlineSkills(form.skills)} t={t}/>
              <p className="profile-section-hint">{t('Current Skills above preserves your original input. The list below is used for matching only after you confirm. Empty and duplicate items are removed; education and experience do not add skills.')}</p>
            </div>
          </div>
          <div className="profile-confirm-note"><ShieldCheck size={17}/><p>{t('Your entries are personal information provided by you. Confirming records that you reviewed them; it does not independently verify the claims.')}</p></div>
        </div>
        {saveError && <div className="shrink-0 px-6"><p className="profile-error" role="alert" data-testid="error-profile-save">{t('Your profile could not be saved. Your entries are still here and your last saved profile has not changed. Check browser storage permissions or available space, then try Confirm Profile again.')}</p></div>}
        <div className="profile-actions px-6 pb-6">
          <button type="button" className="btn" onClick={() => setStep('form')} data-testid="button-review-back"><ArrowLeft size={14}/>{t('Back to Edit')}</button>
          <button type="button" className="btn" onClick={() => setStep('form')} data-testid="button-review-cancel">{t('Cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={confirmProfile} data-testid="button-confirm-profile">{t('Confirm Profile')}<Check size={15}/></button>
        </div>
      </DialogContent>
    </Dialog>

    {step === 'success' && <section className="panel profile-step profile-success" role="status" data-testid="status-profile-confirmed">
      <span className="profile-success-icon"><Check size={24}/></span>
      <h2>{t('Profile confirmed and saved')}</h2>
      <p>{t('Your standardized profile is saved in this browser and your Current Skills remain connected to role matching.')}</p>
      <div className="profile-actions">
        <button type="button" className="btn" onClick={() => { setForm(profile ?? form); setProfileType(profile?.profile_type ?? profileType); setStep('type'); }}>{t('Edit Profile')}</button>
        <button type="button" className="btn btn-primary" onClick={() => setStep('method')}>{t('Done')}<Check size={15}/></button>
      </div>
    </section>}

    <p className="profile-privacy-note">{t('Confirmed profiles are saved on this device. PDF text extraction and optional rule-based simulation run on this app server. No external AI service is used. Avoid unnecessary sensitive details.')}</p>
    {saved && <span className="sr-only" data-testid="status-profile-saved">{t('Saved locally')}</span>}
    <style>{`
      .profile-page{max-width:920px}.profile-saved-strip{display:flex;align-items:center;gap:9px;padding:11px 14px;border:1px solid #dce5d9;background:#f1f5ec;color:#4b6651;border-radius:11px;margin:-8px 0 18px;font-size:12px}.profile-saved-strip .tag{margin-left:auto;gap:5px}
      .profile-step{margin-bottom:18px}.profile-step-heading{display:flex;align-items:flex-start;gap:13px;margin-bottom:22px}.profile-step-number{font:500 11px 'IBM Plex Mono',monospace;color:#55745d;background:#edf1e7;border-radius:9px;padding:8px 9px}.profile-step-heading h2{font:700 19px Manrope,sans-serif;color:#30483b;margin:0 0 6px}.profile-step-heading p{font-size:12px;line-height:1.55;color:#747a70;margin:0;max-width:680px}
      .profile-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.profile-choice{width:100%;display:flex;align-items:center;text-align:left;gap:12px;border:1px solid #dfe2d8;background:#fffdf8;border-radius:13px;padding:16px;color:#30483b;cursor:pointer;min-height:82px}.profile-choice:hover,.profile-choice[aria-pressed="true"]{border-color:#6a876f;background:#f4f6ef;box-shadow:0 0 0 2px #6a876f1c}.profile-choice>span:nth-child(2){flex:1}.profile-choice strong,.profile-choice small{display:block}.profile-choice strong{font-size:14px;margin-bottom:5px}.profile-choice small{font-size:11px;line-height:1.45;color:#737a70}.profile-choice-icon{width:36px;height:36px;flex:none;border-radius:11px;background:#edf1e8;color:#54745b;display:grid;place-items:center}
      .profile-pdf-flow{margin-top:20px}.profile-dropzone{min-height:190px;border:1px dashed #a9b6a6;background:#fafaf5;border-radius:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:20px;color:#4c6552}.profile-dropzone.has-file{border-style:solid;background:#f5f7f0}.profile-dropzone strong{font-size:13px}.profile-dropzone>span:not(.profile-choice-icon){font-size:11px;color:#7d8379}.profile-file-row{display:flex;align-items:center;gap:11px;padding:12px;margin-top:12px;border:1px solid #dfe3da;border-radius:10px;background:#fffdf8;color:#4e6955}.profile-file-row div{flex:1;min-width:0}.profile-file-row strong,.profile-file-row small{display:block;overflow-wrap:anywhere}.profile-file-row strong{font-size:12px}.profile-file-row small{font-size:10px;color:#7d8379;margin-top:3px}.profile-icon-button{width:34px;height:34px;border:1px solid #e1e2d9;background:white;color:#667064;border-radius:8px;display:grid;place-items:center;cursor:pointer}.profile-parser-note,.profile-confirm-note{display:flex;align-items:flex-start;gap:9px;border-radius:10px;background:#f5f2e8;color:#78694e;padding:12px 13px;margin-top:13px}.profile-parser-note svg,.profile-confirm-note svg{flex:none;margin-top:1px}.profile-parser-note p,.profile-confirm-note p{margin:0;font-size:11px;line-height:1.6}.profile-inline-notice{margin-top:14px;padding:13px;border-radius:10px;background:#fff6e8;border:1px solid #eee0c6}.profile-inline-notice p{font-size:12px;color:#705d3b;line-height:1.55;margin:0 0 10px}.profile-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:22px}.profile-actions .btn:disabled{opacity:.48;cursor:not-allowed;transform:none}
      .profile-form-section{border-top:1px solid #e5e5dc;padding-top:18px;margin-top:20px}.profile-form-section h3,.profile-review-group h3{font:700 14px Manrope,sans-serif;color:#425747;margin:0 0 13px}.profile-section-hint{font-size:11px;line-height:1.5;color:#777e73;margin:-5px 0 14px}.profile-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 17px}.profile-form-field{min-width:0}.profile-form-field .field{font-size:13px}.profile-required{color:#a06542;font-size:10px;font-weight:600}.profile-required-mark{color:#dc2626;font-size:16px;font-weight:700;margin-left:5px}.profile-error{font-size:12px;color:#a43e35;background:#fff4f1;border:1px solid #e9c9c2;padding:10px 12px;border-radius:9px}.profile-review-meta{display:flex;gap:8px;flex-wrap:wrap}.profile-review-group{border-top:1px solid #e5e5dc;margin-top:19px;padding-top:16px}.profile-review-row{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);gap:12px;padding:8px 0;border-bottom:1px solid #eeeee7;font-size:12px}.profile-review-row strong{color:#586559}.profile-review-row span{color:#303f35;white-space:pre-wrap;overflow-wrap:anywhere}.profile-success{text-align:center}.profile-success-icon{margin:3px auto 10px;width:48px;height:48px;border-radius:15px;background:#eaf1e7;color:#4d7455;display:grid;place-items:center}.profile-success h2{font:700 21px Manrope;color:#30483b;margin:10px 0 7px}.profile-success>p{font-size:12px;color:#70776d;line-height:1.55}.profile-json{max-height:300px;overflow:auto;text-align:left;background:#f4f4ed;border:1px solid #e2e4d9;border-radius:10px;padding:14px;color:#475348;font:11px/1.55 'IBM Plex Mono',monospace;white-space:pre-wrap;overflow-wrap:anywhere}.profile-success .profile-actions{justify-content:center}.profile-privacy-note{font-size:10px;line-height:1.6;color:#81877b;margin:14px 0}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:620px){.profile-choice-grid,.profile-form-grid{grid-template-columns:1fr}.profile-step{padding:17px}.profile-step-heading h2{font-size:17px}.profile-review-row{grid-template-columns:1fr;gap:3px}.profile-saved-strip{flex-wrap:wrap}.profile-saved-strip .tag{margin-left:0}}
    `}</style>
  </div>;
}

function ReviewRow({ label, value, t }: { label: string; value: string; t: (value: string) => string }) {
  return <div className="profile-review-row"><strong>{t(label)}</strong><span>{value.trim() ? value : t('Not provided')}</span></div>;
}
