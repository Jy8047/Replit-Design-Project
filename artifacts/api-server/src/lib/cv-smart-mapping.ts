import type { CvProfile } from "@workspace/api-zod";
import { validateExtractedProfile, type ProfileType } from "./cv-profile.ts";
import { simulateCvMappingLegacy } from "./cv-demo-mapping-legacy.ts";
import { CV_SKILL_VOCABULARY } from "./cv-skill-vocabulary.ts";
import { CvError } from "./cv-errors.ts";

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
  | "leadership"
  | "summary";

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
  summary: "summary",
  "professional summary": "summary",
  "profile summary": "summary",
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
  "个人简介": "summary",
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

const profileFieldLabels: Readonly<Record<string, string>> = {
  school: "School",
  schooluniversity: "School",
  university: "School",
  degree: "Degree",
  major: "Major",
  keycourses: "Key Courses",
  skills: "Skills",
  currentskills: "Skills",
  internship: "Internship Experience",
  internshipexperience: "Internship Experience",
  academicexperience: "Academic Experience",
  professionalcertificates: "Professional Certificates",
  personalexperience: "Personal Experience",
  interestshobbies: "Interests & Hobbies",
  interestsandhobbies: "Interests & Hobbies",
  employment: "Employment Experience",
  employmentexperience: "Employment Experience",
  otherexperience: "Other Experience",
  name: "Name",
  role: "Role",
  background: "Background",
};

const skillColumnSuffixPatterns = [...new Set(CV_SKILL_VOCABULARY.flatMap(entry => entry.aliases))]
  .sort((left, right) => right.length - left.length)
  .map(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
    return new RegExp(`^(.*?)(?:\\s+)(${escaped})$`, "iu");
  });

function normalizedFieldKey(label: string): string {
  return label.normalize("NFKC").toLowerCase().replace(/[\s_&/]+/gu, "");
}

function splitStructuredCells(line: string): string[] {
  if (!/[\t|｜]|\s{3,}/u.test(line)) return [line.trim()];
  return line.split(/\t+|[|｜]+|\s{3,}/u).map(cell => cell.trim()).filter(Boolean);
}

function splitSkillColumnSuffix(line: string): { left: string; skill: string } | null {
  for (const pattern of skillColumnSuffixPatterns) {
    const match = line.match(pattern);
    if (match?.[1]?.trim() && match[2]) {
      return { left: match[1].trimEnd(), skill: match[2] };
    }
  }
  return null;
}

function splitInlineHeadings(line: string): string[] {
  const headingAlternation = Object.keys(headingKinds)
    .sort((left, right) => right.length - left.length)
    .map(heading => heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("|");
  const pattern = new RegExp(`(^|[|｜]|\\s{2,})(${headingAlternation})(?=$|\\s|[:：]|[|｜])`, "giu");
  const result: string[] = [];
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const matchStart = match.index ?? cursor;
    const separator = match[1] ?? "";
    const heading = match[2] ?? "";
    const headingStart = matchStart + separator.length;
    const before = line.slice(cursor, headingStart).replace(/[|｜\s]+$/u, "").trim();
    if (before) result.push(before);
    if (heading) result.push(heading);
    cursor = headingStart + heading.length;
    while (cursor < line.length && /[\s:：|｜]/u.test(line[cursor])) cursor++;
  }
  const after = line.slice(cursor).replace(/^[|｜\s]+/u, "").trim();
  if (after) result.push(after);
  return result.length ? result : [line.trim()];
}

/**
 * Normalize only layout separators that can be recognized conservatively:
 * line endings, non-breaking spaces, explicit table separators, and clear
 * section headings. Text cells themselves remain source-backed substrings.
 */
export function normalizeCvText(text: string): string {
  const source = text
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u00a0\u2007\u202f]/gu, " ")
    .replace(/[\u200b\ufeff]/gu, "");
  const output: string[] = [];
  let tableHeaders: string[] | null = null;
  let activeSkillColumn = false;

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      output.push("");
      tableHeaders = null;
      activeSkillColumn = false;
      continue;
    }

    const rawCells = splitStructuredCells(line);
    const headerCells = rawCells.map(cell => profileFieldLabels[normalizedFieldKey(cell)]);
    if (rawCells.length >= 2 && headerCells.every((cell): cell is string => Boolean(cell))) {
      tableHeaders = headerCells;
      continue;
    }
    if (tableHeaders && rawCells.length === tableHeaders.length) {
      rawCells.forEach((value, index) => output.push(`${tableHeaders![index]}: ${value}`));
      tableHeaders = null;
      continue;
    }
    tableHeaders = null;

    if (rawCells.length === 2) {
      const label = profileFieldLabels[normalizedFieldKey(rawCells[0])];
      if (label) {
        output.push(`${label}: ${rawCells[1]}`);
        continue;
      }
    }

    const explicitLabel = line.match(/^([^:：]{1,50})\s*[:：]\s*(.*)$/u);
    const canonicalLabel = explicitLabel
      ? profileFieldLabels[normalizedFieldKey(explicitLabel[1])]
      : undefined;
    if (explicitLabel && canonicalLabel) {
      output.push(`${canonicalLabel}: ${explicitLabel[2]}`);
      continue;
    }

    const segments = splitInlineHeadings(line);
    const pairedHeadings = segments.flatMap(segment => {
      const heading = headingFromLine(segment);
      return heading && segment.trim().toLowerCase() === heading.heading.toLowerCase()
        ? [heading]
        : [];
    });
    if (pairedHeadings.length >= 2) {
      activeSkillColumn = pairedHeadings.some(heading => heading.kind === "skills")
        && pairedHeadings.some(heading => heading.kind !== "skills");
    } else if (pairedHeadings.length === 1 && pairedHeadings[0].kind !== "skills") {
      activeSkillColumn = false;
    }

    for (const segment of segments) {
      const heading = headingFromLine(segment);
      if (heading && segment.trim().toLowerCase() === heading.heading.toLowerCase()) {
        output.push(heading.kind === "skills" ? `${heading.heading}:` : heading.heading);
        continue;
      }
      if (activeSkillColumn) {
        const splitSkill = splitSkillColumnSuffix(segment);
        if (splitSkill) {
          output.push(splitSkill.left);
          output.push(`Skills: ${splitSkill.skill}`);
          continue;
        }
      }
      const cells = splitStructuredCells(segment);
      output.push(...cells.map(cell => cell.replace(/[ \t]{2,}/gu, " ").trim()).filter(Boolean));
    }
  }
  return output.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
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
    let end = headings[index + 1]?.start ?? text.length;
    if (heading.kind !== "education") {
      const fieldBoundary = lines.find(record =>
        record.start >= heading.contentStart
        && record.start < end
        && isKnownFieldLabelLine(record.line),
      );
      if (fieldBoundary) end = fieldBoundary.start;
    }
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
    for (const chunk of line.split(/[,，、;；/|｜\t]+/u)) {
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
    return !headingFromLine(line)
      && !/^(?:resume|cv|curriculum vitae|personal profile|profile|contact details?)$/iu.test(line);
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

function sourceContains(text: string, value: string): boolean {
  const fold = (input: string) => input.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
  const candidate = fold(value);
  return !candidate || fold(text).includes(candidate);
}

/** Extract source-backed education facts without inferring a major from experience. */
export function extractEducation(text: string): CvEducationFields {
  const educationSection = extractSections(text).find(section => section.kind === "education");
  const lines = splitLines(text).map(record => record.line.trim()).filter(Boolean);
  const educationLines = educationSection
    ? splitLines(educationSection.text).map(record => record.line.trim()).filter(Boolean)
    : [];
  const orderedLines = [...educationLines, ...lines.filter(line => !educationLines.includes(line))];
  const schoolLine = orderedLines.find(line => schoolPattern.test(line)) ?? "";
  const schoolLabel = schoolLine.match(/^(?:school(?:\s*\/\s*university)?|university|college|institute|学校|大学)\s*[:：]\s*(.+)$/iu);
  const school = schoolLabel?.[1].trim() ?? schoolLine;
  const degreeLine = orderedLines.find(line => degreeStartPattern.test(line)) ?? "";
  const degree = degreeLine.match(degreePattern)?.[0] ?? "";
  let major = "";
  for (const line of orderedLines) {
    const explicit = line.match(/(?:\bmajor\s*[:：]\s*|专业\s*[:：]\s*)([^,，;；|｜]+)/iu);
    if (explicit) { major = cleanCapture(explicit[1]); break; }
  }
  if (!major && degreeLine) {
    const degreeMajor = degreeLine.match(/\b(?:Bachelor(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|Master(?:\s+of\s+(?:Science|Arts|Engineering|Business(?:\s+Administration)?))?|B\.?\s?S\.?|B\.?\s?A\.?|M\.?\s?S\.?|M\.?\s?A\.?|BSc|MSc)\s+in\s+([^,，;；|｜]+)/iu);
    if (degreeMajor) major = cleanCapture(degreeMajor[1]);
    if (!major) {
      const degreeIndex = orderedLines.indexOf(degreeLine);
      const continuation = orderedLines.slice(degreeIndex + 1, degreeIndex + 3)
        .find(line => /^in\s+/iu.test(line) && !headingFromLine(line));
      if (continuation) major = cleanCapture(continuation.replace(/^in\s+/iu, ""));
    }
  }
  const yearLines = lines.filter(line => /\b(?:19|20)\d{2}\b/u.test(line));
  const graduationLine = yearLines.find(line => /graduat|expected|class of|毕业/iu.test(line));
  const yearLine = graduationLine ?? (educationSection
    ? educationLines.find(line => /\b(?:19|20)\d{2}\b/u.test(line))
    : undefined) ?? yearLines.find(line =>
    /degree|bachelor|master|diploma|foundation|ph\.?\s?d|大学|学院|学士|硕士/iu.test(line),
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

function isKnownFieldLabelLine(line: string): boolean {
  const label = line.trim().match(/^([^:：]{1,50})\s*[:：]/u)?.[1];
  if (!label) return false;
  const key = label.toLowerCase().replace(/[\s_&/]+/gu, "");
  return knownFieldLabels.has(key);
}

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
    const bullet = /^[-*•▪◦]\s+/u.test(trimmed);
    const listLike = /[,，、;；/]/u.test(trimmed) || /\s+(?:and|&|和|与)\s+/iu.test(trimmed);
    const singleToken = /^[\p{L}\p{N}][\p{L}\p{N}+#./&()_-]*$/u.test(trimmed);
    if (!bullet && !listLike && !singleToken && !extractSkillMatches(trimmed).length) break;
    accepted.push(line);
  }
  return accepted.join("\n");
}

function explicitSkillTokens(text: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r\n?|\n/u)) {
    const value = line.trim().replace(/^[-*•▪◦]\s*/u, "").trim();
    if (!value) continue;
    for (const item of value.split(/[,，、;；]+/u).map(part => part.trim()).filter(Boolean)) {
      const slashParts = item.split("/").map(part => part.trim()).filter(Boolean);
      const slashMatches = slashParts.map(resolveSkillPhrase);
      const parts = slashParts.length > 1
        && slashMatches.every((match): match is SkillMatch => match !== null)
        ? slashMatches.map(match => match.sourceText)
        : [item];
      for (const part of parts) {
        const identity = normalizedAlias(part);
        if (seen.has(identity) || values.length >= maxSkills) continue;
        seen.add(identity);
        values.push(part);
      }
    }
  }
  return values;
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

function tryLegacyMapping(text: string, type: ProfileType): CvProfile | null {
  try {
    return simulateCvMappingLegacy(text, type);
  } catch (error) {
    if (error instanceof CvError && error.code === "INVALID_PROFILE") return null;
    throw error;
  }
}

function hasProfileContent(profile: CvProfile): boolean {
  return Object.values(profile.education).some(value => Boolean(value.trim()))
    || [
      profile.internship_experience,
      profile.academic_experience,
      profile.professional_certificates,
      profile.personal_experience,
      profile.interests_and_hobbies,
      profile.employment_experience,
      profile.other_experience,
      profile.skills,
      profile.name,
      profile.role,
      profile.background,
    ].some(value => Boolean(value.trim()));
}

function hasPairedHeading(text: string, kind: CvSectionKind): boolean {
  return text.split(/\r\n?|\n/u).some(line => {
    const headings = splitInlineHeadings(line).flatMap(segment => {
      const heading = headingFromLine(segment);
      return heading && segment.trim().toLowerCase() === heading.heading.toLowerCase()
        ? [heading]
        : [];
    });
    return headings.length >= 2 && headings.some(heading => heading.kind === kind);
  });
}

function sourceSectionBody(text: string, kind: CvSectionKind): string {
  if (hasPairedHeading(text, kind)) return "";
  const originalSection = extractSections(text).find(section => section.kind === kind);
  if (originalSection?.text) return cappedSourceText(originalSection.text);

  let activeKind: CvSectionKind | null = null;
  for (const line of text.split(/\r\n?|\n/u)) {
    for (const segment of splitInlineHeadings(line)) {
      const heading = headingFromLine(segment);
      if (heading && segment.trim().toLowerCase() === heading.heading.toLowerCase()) {
        activeKind = heading.kind;
        continue;
      }
      if (activeKind === kind && segment && sourceContains(text, segment)) {
        return cappedSourceText(segment);
      }
    }
  }
  return "";
}

/**
 * Rules-only mapper. Exact source spans are validated before vocabulary aliases
 * are canonicalized; no model, network request, or skill inference is used.
 */
export function mapCvSmart(text: string, type: ProfileType): SmartCvProfile {
  if (typeof text !== "string") throw new CvError("INVALID_PROFILE");
  const normalizedText = normalizeCvText(text);
  const sections = extractSections(normalizedText);
  const basics = extractBasics(normalizedText);
  const educationFacts = extractEducation(normalizedText);
  const skillSections = sections.filter(section => section.kind === "skills");
  const excludedSections = sections.filter(section => section.kind !== "skills");
  const skillText = skillSections
    .map(section => boundedSkillSection(normalizedText, section))
    .join("\n");
  const skillMatches = extractSkillMatches(skillText);
  const legacy = tryLegacyMapping(normalizedText, type) ?? tryLegacyMapping(text, type);
  const profile = emptyProfile(type);
  const education = profile.education as Record<string, string>;
  education.school = sourceContains(text, educationFacts.school) ? educationFacts.school : "";
  education.degree = sourceContains(text, educationFacts.degree) ? educationFacts.degree : "";
  education.major = sourceContains(text, educationFacts.major) ? educationFacts.major : "";
  const academicText = sourceSectionBody(text, "education") || educationFacts.graduationYearText;
  profile.academic_experience = sourceContains(text, academicText) ? cappedSourceText(academicText) : "";
  profile.name = basics.name;

  profile.employment_experience = sourceSectionBody(text, "employment");
  profile.internship_experience = sourceSectionBody(text, "internship");
  profile.personal_experience = sourceSectionBody(text, "leadership");
  profile.other_experience = sourceSectionBody(text, "experience") || sourceSectionBody(text, "projects");
  profile.background = sourceSectionBody(text, "summary");

  if (legacy) {
    const textFields = [
      "internship_experience", "academic_experience", "professional_certificates",
      "personal_experience", "interests_and_hobbies", "employment_experience",
      "other_experience", "name", "role", "background",
    ] as const;
    for (const key of textFields) {
      if (!profile[key] && legacy[key] && sourceContains(text, legacy[key])) profile[key] = legacy[key];
    }
    for (const key of ["school", "degree", "major", "key_courses"] as const) {
      if (!education[key] && legacy.education[key] && sourceContains(text, legacy.education[key])) {
        education[key] = legacy.education[key];
      }
    }
  }

  const smartHit = Boolean(
    basics.name
    || skillMatches.length
    || education.school
    || education.degree
    || education.major
    || educationFacts.graduationYear
    || profile.academic_experience
    || profile.employment_experience
    || profile.internship_experience
    || profile.personal_experience
    || profile.other_experience
    || profile.background,
  );

  if (!smartHit) {
    if (!legacy || !hasProfileContent(legacy)) throw new CvError("INVALID_PROFILE");
    const fallbackPayload = { ...legacy } as Record<string, unknown>;
    delete fallbackPayload.mapping_provenance;
    const fallback = validateExtractedProfile(fallbackPayload, text, type);
    return {
      ...fallback,
      mapping_provenance: "simulated",
      mapping_method: "demo-fallback",
      matched_summary: profileSummary(fallback, educationFacts),
    };
  }

  const legacySkillTokens = skillSections.length
    ? explicitSkillTokens(skillText)
    : (legacy?.skills ?? "").split(/[,，;；]/u).map(skill => skill.trim()).filter(Boolean);
  const evidenceSkills = [...legacySkillTokens, ...skillMatches.map(match => match.sourceText)]
    .filter(skill => sourceContains(text, skill));
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
