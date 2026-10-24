import { ExtractCvPdfResponse } from "@workspace/api-zod";
import type { CvProfile } from "@workspace/api-zod";
import { CvError } from "./cv-errors.ts";

export type ProfileType = "fresh_graduate" | "career_switcher";

const textFields = [
  "internship_experience", "academic_experience", "professional_certificates",
  "personal_experience", "interests_and_hobbies", "employment_experience",
  "other_experience", "skills", "name", "role", "background",
] as const;
const educationFields = ["school", "degree", "major", "key_courses"] as const;
const fold = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

/**
 * Validate the shared extracted-profile contract and require every nonempty
 * value to be an exact text span. This is schema/evidence validation, not AI.
 */
export function validateExtractedProfile(value: unknown, text: string, type: ProfileType): CvProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CvError("INVALID_PROFILE");
  const object = value as Record<string, unknown>;
  const expected = ["profile_type", "input_method", "education", ...textFields, "confirmed_by_user"];
  if (Object.keys(object).length !== expected.length || Object.keys(object).some(key => !expected.includes(key))
    || object.profile_type !== type || object.input_method !== "pdf_upload" || object.confirmed_by_user !== false) {
    throw new CvError("INVALID_PROFILE");
  }
  const education = object.education;
  if (!education || typeof education !== "object" || Array.isArray(education)
    || Object.keys(education).length !== 4 || Object.keys(education).some(key => !educationFields.includes(key as typeof educationFields[number]))) {
    throw new CvError("INVALID_PROFILE");
  }
  const result = ExtractCvPdfResponse.safeParse({
    status: "TEXT_EXTRACTED", text, pages: 1, profile: value, mapping: "NOT_REQUESTED", mapping_provenance: "none",
  });
  if (!result.success || !result.data.profile) throw new CvError("INVALID_PROFILE");
  const profile = result.data.profile;
  const source = fold(text);
  for (const [key, raw] of [...Object.entries(profile.education), ...textFields.map(key => [key, profile[key]])]) {
    const parts = key === "skills" ? raw.split(/[,，]/u) : [raw];
    if (parts.some(part => fold(part) && !source.includes(fold(part)))) throw new CvError("INVALID_PROFILE");
  }
  return profile;
}
