import { hasCurrentSkills } from './online-skills.ts';

export type ProfileType = 'fresh_graduate' | 'career_switcher';
export type ProfileInputMethod = 'pdf_upload' | 'online_form';

export type Profile = {
  mapping_provenance?: 'simulated';
  profile_type: ProfileType;
  input_method: ProfileInputMethod;
  education: {
    school: string;
    degree: string;
    major: string;
    key_courses: string;
  };
  internship_experience: string;
  academic_experience: string;
  professional_certificates: string;
  personal_experience: string;
  interests_and_hobbies: string;
  employment_experience: string;
  other_experience: string;
  skills: string;
  name: string;
  role: string;
  background: string;
  confirmed_by_user: boolean;
};

export const emptyProfile: Profile = {
  profile_type: 'fresh_graduate',
  input_method: 'online_form',
  education: { school: '', degree: '', major: '', key_courses: '' },
  internship_experience: '',
  academic_experience: '',
  professional_certificates: '',
  personal_experience: '',
  interests_and_hobbies: '',
  employment_experience: '',
  other_experience: '',
  skills: '',
  name: '',
  role: '',
  background: '',
  confirmed_by_user: false,
};

const text = (value: unknown): string => typeof value === 'string' ? value : '';

export function normalizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const educationSource = source.education && typeof source.education === 'object'
    ? source.education as Record<string, unknown>
    : {};
  const profileType: ProfileType = source.profile_type === 'career_switcher' ? 'career_switcher' : 'fresh_graduate';
  const inputMethod: ProfileInputMethod = source.input_method === 'pdf_upload' ? 'pdf_upload' : 'online_form';
  return {
    ...emptyProfile,
    ...(source.mapping_provenance === 'simulated' ? { mapping_provenance: 'simulated' as const } : {}),
    profile_type: profileType,
    input_method: inputMethod,
    education: {
      school: text(educationSource.school),
      degree: text(educationSource.degree),
      major: text(educationSource.major),
      key_courses: text(educationSource.key_courses),
    },
    internship_experience: text(source.internship_experience),
    academic_experience: text(source.academic_experience),
    professional_certificates: text(source.professional_certificates),
    personal_experience: text(source.personal_experience),
    interests_and_hobbies: text(source.interests_and_hobbies ?? source.interests),
    employment_experience: text(source.employment_experience ?? (profileType === 'career_switcher' ? source.experience : '')),
    other_experience: text(source.other_experience ?? source.experience),
    skills: text(source.skills),
    name: text(source.name),
    role: text(source.role),
    background: text(source.background),
    confirmed_by_user: source.confirmed_by_user === true,
  };
}

const explicitNone = /^(none|无|沒有|没有|tidak ada|tiada)$/i;

export function validateProfile(profile: Profile): string[] {
  const missing: string[] = [];
  for (const [key, value] of Object.entries({
    school: profile.education.school,
    degree: profile.education.degree,
    major: profile.education.major,
  })) {
    if (!value.trim()) missing.push(key);
    else if (!explicitNone.test(value.trim()) && value.trim().length < 2) missing.push(key);
  }
  if (!hasCurrentSkills(profile.skills)) missing.push('skills');
  return missing;
}

export type PdfValidationResult =
  | { valid: true }
  | { valid: false; reason: 'empty' | 'type' | 'extension' | 'size' | 'signature' };

export const MAX_PROFILE_PDF_BYTES = 10 * 1024 * 1024;

export function validatePdfMetadata(file: Pick<File, 'name' | 'type' | 'size'>): PdfValidationResult {
  if (file.size <= 0) return { valid: false, reason: 'empty' };
  if (!file.name.toLowerCase().endsWith('.pdf')) return { valid: false, reason: 'extension' };
  if (file.type !== 'application/pdf') return { valid: false, reason: 'type' };
  if (file.size > MAX_PROFILE_PDF_BYTES) return { valid: false, reason: 'size' };
  return { valid: true };
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

export function hasPdfEndMarker(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes).includes('%%EOF');
}
