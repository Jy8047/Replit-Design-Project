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
const sectionHeadings = new Set([
  ...fields, ...education, ...Object.keys(aliases),
  "education", "experience", "work experience", "professional experience",
  "employment", "work history", "projects", "summary", "references", "certifications",
].map(keyFor));

/**
 * Demonstration only, NOT GLM/OCR/NLP. Non-skill fields use their first labelled
 * line. Skills merge explicit labels and list continuations: bullets, delimited
 * lists, or single-token names. Blank lines, headings, any new label and ambiguous
 * unmarked multiword prose end a skill block. Another Skills label reopens it.
 * Uncollected text remains available in the extraction preview for manual review.
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
  const skills: string[] = [];
  const seenSkills = new Set<string>();
  const addSkills = (value: string) => {
    for (const item of value.split(/[,，;；]/u)) {
      const skill = item.trim();
      const identity = skill.normalize("NFKC").toLowerCase();
      if (!skill || seenSkills.has(identity)) continue;
      seenSkills.add(identity);
      skills.push(skill);
    }
  };
  let collectingSkills = false;
  for (const line of text.split(/\r\n?|\n/u)) {
    const match = line.match(/^\s*([^:：\n]{1,50})[:：]\s*(.*?)\s*$/u);
    if (!match) {
      if (!collectingSkills) continue;
      const trimmed = line.trim();
      const bullet = trimmed.match(/^[-*•]\s+(.+)$/u);
      const heading = trimmed.replace(/^#{1,6}\s+/u, "").replace(/^[-*•]\s+/u, "");
      if (!trimmed || /[:：]/u.test(trimmed) || sectionHeadings.has(keyFor(heading))) {
        collectingSkills = false;
        continue;
      }
      // Do not guess that an unmarked multiword sentence is a skill. Multiword
      // names are accepted on labelled lines, in bullet lists or delimited lists.
      if (bullet || /[,，;；]/u.test(trimmed)
        || /^[\p{L}\p{N}][\p{L}\p{N}+#./&()_-]*$/u.test(trimmed)) {
        addSkills(bullet ? bullet[1] : trimmed);
      } else collectingSkills = false;
      continue;
    }
    collectingSkills = false;
    const label = keyFor(match[1]);
    const key = aliases[label] ?? labels.get(label);
    if (key === "skills") {
      addSkills(match[2]);
      collectingSkills = true;
      continue;
    }
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (education.includes(key as typeof education[number])) {
      (profile.education as Record<string, string>)[key] = match[2];
    } else profile[key] = match[2];
  }
  profile.skills = skills.join(", ");
  const validated = validateExtractedProfile(profile, text, type);
  return { ...validated, mapping_provenance: "simulated" };
}
