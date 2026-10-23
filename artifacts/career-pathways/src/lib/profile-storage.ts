import { normalizeProfile, type Profile, type ProfileType } from './profile.ts';

export const PROFILE_STORAGE_KEY = 'career-pathways-profile';
export const PROFILE_DRAFT_KEY = 'career-pathways-profile-draft';
export type ProfileSaveResult = { ok: true } | { ok: false };
type WritableStorage = Pick<Storage, 'setItem'>;
type ReadableStorage = Pick<Storage, 'getItem'>;

export type ProfileDraft = {
  version: 1;
  baseProfile: string;
  form: Profile;
  profileType: ProfileType | '';
  step: 'type' | 'form' | 'review';
};

export function employmentNeedsResolution(type: ProfileType | '', experience: string): boolean {
  return type === 'fresh_graduate' && experience.trim().length > 0;
}

export function persistConfirmedProfile(storage: WritableStorage, profile: Profile): ProfileSaveResult {
  // The shared persistence boundary must enforce confirmation independently of UI.
  if (profile.confirmed_by_user !== true) return { ok: false };
  try {
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function persistProfileDraft(storage: WritableStorage, draft: ProfileDraft): ProfileSaveResult {
  try {
    storage.setItem(PROFILE_DRAFT_KEY, JSON.stringify({
      ...draft,
      form: { ...draft.form, confirmed_by_user: false },
    }));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function readProfileDraft(storage: ReadableStorage, savedProfile: Profile | null): ProfileDraft | null {
  try {
    const raw = storage.getItem(PROFILE_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== 1 || draft.baseProfile !== JSON.stringify(savedProfile)) return null;
    const form = normalizeProfile(draft.form);
    if (!form) return null;
    if (JSON.stringify({ ...form, confirmed_by_user: true }) === JSON.stringify(savedProfile)) return null;
    const profileType = draft.profileType === 'career_switcher' || draft.profileType === 'fresh_graduate' ? draft.profileType : '';
    return {
      version: 1,
      baseProfile: draft.baseProfile,
      form: { ...form, confirmed_by_user: false },
      profileType,
      step: !profileType || employmentNeedsResolution(profileType, form.employment_experience)
        ? 'type'
        : draft.step === 'type' || draft.step === 'review' ? draft.step : 'form',
    };
  } catch {
    return null;
  }
}

export function removeProfileDraft(storage: Pick<Storage, 'removeItem'>): ProfileSaveResult {
  try {
    storage.removeItem(PROFILE_DRAFT_KEY);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
