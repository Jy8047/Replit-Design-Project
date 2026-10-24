import type { CvProfile } from "@workspace/api-zod";
import { validateExtractedProfile, type ProfileType } from "./cv-profile.ts";
import { simulateCvMappingLegacy } from "./cv-demo-mapping-legacy.ts";
import { CV_SKILL_VOCABULARY } from "./cv-skill-vocabulary.ts";

export type MappingMethod = "rules-v2" | "demo-fallback";
export interface MatchedSummary {
  skills: number;
  education: number;
  basics: number;
}
export type SmartCvProfile = CvProfile & {
  mapping_method: MappingMethod;
  matched_summary: MatchedSummary;
};

export type CvSectionKind =
  | "education"
  | "experience"
  | "employment"
  | "internship"
  | "projects"
  | "skills"
  | "leadership";

export interface CvSectionRange {
  kind: CvSectionKind;
  heading: string;
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  text: string;
}

export interface CvBasics {
  name: string;
  email: string;
  phone: string;
}

export interface CvEducationFields {
  school: string;
  degree: string;
  major: string;
  graduationYear: string;
  graduationYearText: string;
}

type SkillMatch = { canonical: string; sourceText: string };
const maxSkills = 20;
const maxFieldLength = 8000;
const normalizedAlias = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const skillLookup = new Map<string, { canonical: string; length: number }>();
for (const entry of CV_SKILL_VOCABULARY) {
  for (const alias of entry.aliases) {
    const key = normalizedAlias(alias);
    const previous = skillLookup.get(key);
    if (!previous || alias.length > previous.length) {
      skillLookup.set(key, { canonical: entry.canonical, length: alias.length });
    }
  }
}

const headingKinds: Readonly<Record<string, CvSectionKind>> = {
  education: "education",
  "academic background": "education",
  "educational background": "education",
  experience: "experience",
  "professional experience": "employment",
  "work experience": "employment",
  "employment history": "employment",
  "employment experience": "employment",
  employment: "employment",
  internship: "internship",
  internships: "internship",
  "internship experience": "internship",
  projects: "projects",
  "selected projects": "projects",
  "project experience": "projects",
  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
  "key skills": "skills",
  leadership: "leadership",
  "leadership experience": "leadership",
  "教育经历": "education",
  "教育背景": "education",
  "工作经历": "employment",
  "工作经验": "employment",
  "项目经历": "projects",
  "项目经验": "projects",
  "技能": "skills",
  "专业技能": "skills",
  "领导经历": "leadership",
  "领导力": "leadership",
  "实习经历": "internship",
};

function splitLines(text: string): { line: string; start: number; end: number; next: number }[] {
  const lines: { line: string; start: number; end: number; next: number }[] = [];
  const newline = /\r\n?|\n/gu;
  let start = 0;
  for (const match of text.matchAll(newline)) {
    const end = match.index ?? start;
    const next = end + match[0].length;
    lines.push({ line: text.slice(start, end), start, end, next });
    start = next;
  }
  lines.push({ line: text.slice(start), start, end: text.length, next: text.length });
  return lines;
}

function headingFromLine(line: string): { kind: CvSectionKind; heading: string; colon: number; inline: string } | null {
  const trimmed = line.trim();
  const prefixRemoved = trimmed.replace(/^(?:#{1,6}\s*|[-*•▪◦]\s*)/u, "");
  const colon = Math.max(prefixRemoved.indexOf(":"), prefixRemoved.indexOf("："));
  const rawHeading = (colon >= 0 ? prefixRemoved.slice(0, colon) : prefixRemoved)
    .replace(/[|｜—–-]+\s*$/u, "")
    .trim();
  const key = rawHeading.toLowerCase().replace(/\s+/gu, " ");
  const kind = headingKinds[key];
  if (!kind) return null;
  return {
    kind,
    heading: rawHeading,
    colon,
    inline: colon >= 0 ? prefixRemoved.slice(colon + 1).trim() : "",
  };
}

/** Find recognized section headings and return source character ranges for each body. */
export function extractSections(text: string): CvSectionRange[] {
  const lines = splitLines(text);
  const headings = lines.flatMap((record, index) => {
    const parsed = headingFromLine(record.line);
    if (!parsed) return [];
    let contentStart = record.next;
    if (parsed.colon >= 0 && parsed.inline) {
      const colonInLine = Math.max(record.line.indexOf(":"), record.line.indexOf("："));
      contentStart = record.start + colonInLine + 1;
      while (contentStart < record.end && /\s/u.test(text[contentStart])) contentStart++;
    }
    return [{ ...parsed, start: record.start, contentStart, lineIndex: index }];
  });
  return headings.map((heading, index) => {
    const end = headings[index + 1]?.start ?? text.length;
    const content = text.slice(heading.contentStart, end);
    return {
      kind: heading.kind,
      heading: heading.heading,
      start: heading.start,
      end,
      contentStart: heading.contentStart,
      contentEnd: end,
      text: content.trim(),
    };
  });
}

function resolveSkillPhrase(value: string): SkillMatch | null {
  const cleaned = value
    .trim()
    .replace(/^[•·▪◦*-]+\s*/u, "")
    .replace(/^(?:(?:technical|core|key|current)\s+)?skills?\s*[:：-]\s*/iu, "")
    .replace(/^(?:技能|专业技能)\s*[:：-]\s*/u, "")
    .trim();
  const match = skillLookup.get(normalizedAlias(cleaned));
  return match ? { canonical: match.canonical, sourceText: cleaned } : null;
}

function matchesInChunk(value: string): SkillMatch[] {
  const exact = resolveSkillPhrase(value);
  if (exact) return [exact];

  // "Python and SQL" is a list only when every side is a known vocabulary item.
  const conjunction = value.trim().split(/\s+(?:and|&|和|与)\s+/iu);
  if (conjunction.length > 1) {
    const matches = conjunction.map(resolveSkillPhrase);
    if (matches.every((match): match is SkillMatch => match !== null)) return matches;
  }
  return [];
}

function extractSkillMatches(text: string): SkillMatch[] {
  const found: SkillMatch[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r\n?|\n/u)) {
    for (const chunk of line.split(/[,，、;；/]+/u)) {
      for (const match of matchesInChunk(chunk)) {
        const identity = normalizedAlias(match.canonical);
        if (seen.has(identity)) continue;
        seen.add(identity);
        found.push(match);
        if (found.length >= maxSkills) return found;
      }
    }
  }
  return found;
}

/** Match only vocabulary-backed skill phrases, case-insensitively, in list-like text. */
export function extractSkills(text: string): string[] {
  return extractSkillMatches(text).map(match => match.canonical);
}

/** Extract contact strings for review; email and phone are not added to the shared Profile schema. */
export function extractBasics(text: string): CvBasics {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] ?? "";
  const phoneCandidates = text.match(/(?<![\p{L}\p{N}])\+?\d[\d\s().-]{5,}\d(?![\p{L}\p{N}])/gu) ?? [];
  const phone = phoneCandidates.find(candidate => {
    const digits = candidate.replace(/\D/gu, "");
    return digits.length >= 7 && digits.length <= 15
      && !/^(?:19|20)\d{2}[-/](?:19|20)\d{2}$/u.test(candidate.trim());
  })?.trim() ?? "";
  const name = splitLines(text).map(({ line }) => line.trim()).find(line => {
    if (!line || /[@|｜]/u.test(line) || /\d{6,}/u.test(line) || /[:：]/u.test(line)) return false;
    return !headingFromLine(line);
  }) ?? "";
  return { name, email, phone };
}

const schoolPattern = /(?:university|college|institute|大学|学院)/iu;
const degreeStartPattern = /^\s*(?:(?:degree|qualification)\s*[:：]\s*)?(?:Bachelor|Master|Diploma|Foundation|Ph\.?\s?D\.?|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?S\.?|M\.?\s?A\.?|BSc|MSc|学士|硕士)/iu;
const degreePattern = /(?:\b(?:Bachelor(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|Master(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|Diploma|Foundation|BSc|MSc)\b|(?<![\p{L}\p{N}])(?:Ph\.?\s?D\.?|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?S\.?|M\.?\s?A\.?)(?![\p{L}\p{N}])|学士|硕士)/iu;

function cleanCapture(value: string): string {
  return value.replace(/\b(?:19|20)\d{2}\b.*$/u, "")
    .replace(/[,，;；|｜].*$/u, "")
    .trim();
}

/** Extract source-backed education facts without inferring a major from experience. */
export function extractEducation(text: string): CvEducationFields {
  const educationSection = extractSections(text).find(section => section.kind === "education");
  const source = educationSection?.text || text;
  const lines = splitLines(source).map(record => record.line.trim()).filter(Boolean);
  const schoolLine = lines.find(line => schoolPattern.test(line)) ?? "";
  const schoolLabel = schoolLine.match(/^(?:school(?:\s*\/\s*university)?|university|college|institute|学校|大学)\s*[:：]\s*(.+)$/iu);
  const school = schoolLabel?.[1].trim() ?? schoolLine;
  const degreeLine = lines.find(line => degreeStartPattern.test(line)) ?? "";
  const degree = degreeLine.match(degreePattern)?.[0] ?? "";
  let major = "";
  for (const line of lines) {
    const explicit = line.match(/(?:\bmajor\s*[:：]\s*|专业\s*[:：]\s*)([^,，;；|｜]+)/iu);
    if (explicit) { major = cleanCapture(explicit[1]); break; }
    if (schoolPattern.test(line)) continue;
    const degreeMajor = line.match(/\b(?:Bachelor(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|Master(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?S\.?|M\.?\s?A\.?|BSc|MSc)\s+in\s+([^,，;；|｜]+)/iu);
    const inMajor = degreeMajor ?? line.match(/\bin\s+([A-Z][\p{L}\p{N}&'’()./-]*(?:\s+[\p{L}\p{N}&'’()./-]+)*)/iu);
    if (inMajor) { major = cleanCapture(inMajor[1]); break; }
  }
  const yearLines = lines.filter(line => /\b(?:19|20)\d{2}\b/u.test(line));
  const graduationLine = yearLines.find(line => /graduat|expected|class of|毕业/iu.test(line));
  const yearLine = graduationLine ?? yearLines.find(line =>
    Boolean(educationSection)
    || /degree|bachelor|master|diploma|foundation|ph\.?\s?d|大学|学院|学士|硕士/iu.test(line),
  ) ?? "";
  const yearValues = yearLine.match(/\b(?:19|20)\d{2}\b/gu) ?? [];
  const graduationYear = yearValues.at(-1) ?? "";
  return {
    school,
    degree,
    major,
    graduationYear,
    graduationYearText: yearLine,
  };
}

function emptyProfile(type: ProfileType): Record<string, unknown> {
  return {
    profile_type: type,
    input_method: "pdf_upload",
    confirmed_by_user: false,
    education: { school: "", degree: "", major: "", key_courses: "" },
    internship_experience: "",
    academic_experience: "",
    professional_certificates: "",
    personal_experience: "",
    interests_and_hobbies: "",
    employment_experience: "",
    other_experience: "",
    skills: "",
    name: "",
    role: "",
    background: "",
  };
}

const knownFieldLabels = new Set([
  "school", "schooluniversity", "university", "degree", "major", "keycourses",
  "internshipexperience", "academicexperience", "professionalcertificates",
  "personalexperience", "interestsandhobbies", "employmentexperience",
  "otherexperience", "name", "role", "background", "currentorrecentrole",
]);

function boundedSkillSection(text: string, section: CvSectionRange): string {
  const body = text.slice(section.contentStart, section.end);
  const accepted: string[] = [];
  for (const { line } of splitLines(body)) {
    const trimmed = line.trim();
    if (!trimmed) break;
    const label = trimmed.match(/^([^:：]{1,50})\s*[:：]/u)?.[1];
    if (label) {
      const key = label.toLowerCase().replace(/[\s_&/]+/gu, "");
      if (knownFieldLabels.has(key) || key !== "skills" && key !== "currentskills") break;
    }
    const nextHeading = headingFromLine(trimmed);
    if (nextHeading && nextHeading.kind !== "skills") break;
    accepted.push(line);
  }
  return accepted.join("\n");
}

function cappedSourceText(value: string): string {
  return value.trim().slice(0, maxFieldLength);
}

function profileSummary(profile: CvProfile, educationFacts: CvEducationFields): MatchedSummary {
  return {
    skills: profile.skills.split(/[,，]/u).filter(skill => skill.trim()).length,
    education: Object.values(profile.education).filter(value => Boolean(value.trim())).length
      + Number(Boolean(educationFacts.graduationYear)),
    basics: Number(Boolean(profile.name)),
  };
}

/**
 * Rules-only mapper. Exact source spans are validated before vocabulary aliases
 * are canonicalized; no model, network request, or skill inference is used.
 */
export function mapCvSmart(text: string, type: ProfileType): SmartCvProfile {
  const sections = extractSections(text);
  const basics = extractBasics(text);
  const educationFacts = extractEducation(text);
  const skillSections = sections.filter(section => section.kind === "skills");
  const excludedSections = sections.filter(section => section.kind !== "skills");
  const skillText = skillSections.length
    ? skillSections.map(section => boundedSkillSection(text, section)).join("\n")
    : excludedSections.length
      ? (() => {
        let cursor = 0;
        const parts: string[] = [];
        for (const section of excludedSections.sort((left, right) => left.start - right.start)) {
          parts.push(text.slice(cursor, section.start));
          cursor = section.end;
        }
        parts.push(text.slice(cursor));
        return parts.join("\n");
      })()
      : text;
  const skillMatches = extractSkillMatches(skillText);
  const legacy = simulateCvMappingLegacy(text, type);
  const profile = emptyProfile(type);
  const education = profile.education as Record<string, string>;
  education.school = educationFacts.school;
  education.degree = educationFacts.degree;
  education.major = educationFacts.major;
  const educationSection = sections.find(section => section.kind === "education");
  profile.academic_experience = cappedSourceText(
    educationSection?.text ?? educationFacts.graduationYearText,
  );
  profile.name = basics.name;

  for (const section of sections) {
    const value = cappedSourceText(section.text);
    if (!value) continue;
    if (section.kind === "employment" && !profile.employment_experience) {
      profile.employment_experience = value;
    } else if (section.kind === "internship" && !profile.internship_experience) {
      profile.internship_experience = value;
    } else if (section.kind === "leadership" && !profile.personal_experience) {
      profile.personal_experience = value;
    } else if ((section.kind === "experience" || section.kind === "projects")
      && !profile.other_experience) {
      profile.other_experience = value;
    }
  }

  const smartHit = Boolean(
    basics.name
    || skillMatches.length
    || educationFacts.school
    || educationFacts.degree
    || educationFacts.major
    || educationFacts.graduationYear
    || profile.academic_experience
    || profile.employment_experience
    || profile.internship_experience
    || profile.personal_experience
    || profile.other_experience,
  );

  if (!smartHit) {
    const fallback = simulateCvMappingLegacy(text, type);
    return {
      ...fallback,
      mapping_method: "demo-fallback",
      matched_summary: profileSummary(fallback, educationFacts),
    };
  }

  const textFields = [
    "internship_experience", "academic_experience", "professional_certificates",
    "personal_experience", "interests_and_hobbies", "employment_experience",
    "other_experience", "name", "role", "background",
  ] as const;
  for (const key of textFields) {
    if (!profile[key]) profile[key] = legacy[key];
  }
  for (const key of ["school", "degree", "major", "key_courses"] as const) {
    if (!education[key]) education[key] = legacy.education[key];
  }

  const legacySkillTokens = legacy.skills.split(/[,，;；]/u).map(skill => skill.trim()).filter(Boolean);
  const evidenceSkills = [...skillMatches.map(match => match.sourceText), ...legacySkillTokens];
  profile.skills = [...new Set(evidenceSkills)].join(", ");
  const validated = validateExtractedProfile(profile, text, type);
  const finalSkills: string[] = [];
  const seenSkills = new Set<string>();
  const addFinalSkill = (skill: string) => {
    const canonical = extractSkillMatches(skill)[0]?.canonical ?? skill.trim();
    const key = normalizedAlias(canonical);
    if (!canonical || seenSkills.has(key) || finalSkills.length >= maxSkills) return;
    seenSkills.add(key);
    finalSkills.push(canonical);
  };
  for (const skill of legacySkillTokens) addFinalSkill(skill);
  for (const match of skillMatches) addFinalSkill(match.canonical);
  const result = {
    ...validated,
    skills: finalSkills.join(", "),
    mapping_provenance: "simulated" as const,
  };
  return {
    ...result,
    mapping_method: "rules-v2",
    matched_summary: profileSummary(result, educationFacts),
  };
}
