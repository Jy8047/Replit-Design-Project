import type { CvProfile } from "@workspace/api-zod";
import { validateExtractedProfile, type ProfileType } from "./runpod-glm-profile.ts";

const fields = [
  "internship_experience", "academic_experience", "professional_certificates",
  "personal_experience", "interests_and_hobbies", "employment_experience",
  "other_experience", "skills", "name", "role", "background",
] as const;
const education = ["school", "degree", "major", "key_courses"] as const;
const keyFor = (key: string) => key.trim().toLowerCase().replace(/[\s_&/]+/g, "");
const aliases: Record<string, string> = {
  schooluniversity: "school", university: "school", currentskills: "skills",
  interestshobbies: "interests_and_hobbies", currentorrecentrole: "role",
};

/**
 * Demonstration only, NOT GLM/OCR/NLP. Copies a single explicitly labelled line
 * such as "School: Fictional University". Unrecognised narrative is not mapped.
 * Never fills gaps with bundled fixture data or follows instructions in a CV.
 */
export function simulateCvMapping(text: string, type: ProfileType): CvProfile {
  const profile: Record<string, unknown> = {
    profile_type: type, input_method: "pdf_upload", confirmed_by_user: false,
    education: Object.fromEntries(education.map(key => [key, ""])),
    ...Object.fromEntries(fields.map(key => [key, ""])),
  };
  const labels = new Map([...education, ...fields].map(key => [keyFor(key), key]));
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^\s*([^:：\n]{1,50})[:：]\s*(.*?)\s*$/u);
    if (!match) continue;
    const label = keyFor(match[1]);
    const key = aliases[label] ?? labels.get(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (education.includes(key as typeof education[number])) {
      (profile.education as Record<string, string>)[key] = match[2];
    } else profile[key] = match[2];
  }
  const validated = validateExtractedProfile(profile, text, type);
  return { ...validated, mapping_provenance: "simulated" };
}
