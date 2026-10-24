import catalogData from '../data/occupation-catalog.json' with { type: 'json' };

export type CatalogLocale = 'en' | 'zh' | 'ms';
export type LocalizedText = Record<CatalogLocale, string>;
export interface CatalogSkill {
  name: string;
  originalName: string;
  kind: 'skill' | 'knowledge' | 'software';
  sourceFile: string;
  elementId: string;
  dataDate: string | null;
}
export interface OccupationMetadata {
  id: string;
  occupation: string;
  onetCode: string;
  labels: LocalizedText;
  category: LocalizedText;
  description: string;
  descriptionLanguage: 'en';
  jobZone: number;
  entryEducation: string;
  entryExperience: string;
  entryDataDate: string;
  sourceUrl: string;
  jurisdiction: string;
  trendEvidenceStatus: 'unknown';
  skills: CatalogSkill[];
  sdgs: { goal: number; skills: string[]; rationale: LocalizedText }[];
}
export interface OccupationCatalog {
  schemaVersion: number;
  version: string;
  publishedOn: string;
  checkedOn: string;
  releaseUrl: string;
  licenseUrl: string;
  attribution: string;
  selectionMethod: string;
  sources: { file: string; url: string; sha256: string }[];
  occupations: OccupationMetadata[];
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const localized = (value: unknown) =>
  isObject(value) && ['en', 'zh', 'ms'].every(locale => text(value[locale]));
const date = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const sourceUrl = (value: unknown): boolean => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && ['www.onetcenter.org', 'www.onetonline.org'].includes(url.hostname);
  } catch { return false; }
};

/** Validate the sidecar independently of the P1/P2 contracts; never infer data. */
export function validateOccupationCatalog(input: unknown): string[] {
  if (!isObject(input) || input.schemaVersion !== 1 ||
      !Array.isArray(input.occupations) || !Array.isArray(input.sources)) {
    return ['Occupation catalog has an invalid envelope.'];
  }
  const errors: string[] = [];
  if (!date(input.publishedOn) || !date(input.checkedOn) || !text(input.version) ||
      !text(input.attribution) || !text(input.selectionMethod) || !sourceUrl(input.releaseUrl) ||
      input.licenseUrl !== 'https://creativecommons.org/licenses/by/4.0/') {
    errors.push('Occupation catalog requires dated, licensed and traceable provenance.');
  }
  const files = new Set<string>();
  for (const source of input.sources) {
    if (!isObject(source) || !text(source.file) || !sourceUrl(source.url) ||
        !/^[a-f0-9]{64}$/.test(String(source.sha256)) || files.has(String(source.file))) {
      errors.push('Invalid or duplicate occupation source file.');
    } else files.add(source.file);
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const signatures = new Set<string>();
  for (const raw of input.occupations) {
    if (!isObject(raw)) { errors.push('Invalid occupation metadata.'); continue; }
    const name = String(raw.occupation ?? '').trim().toLowerCase();
    const prefix = `Occupation ${String(raw.id)}: `;
    if (!text(raw.id) || !text(raw.occupation) || !/^\d{2}-\d{4}\.\d{2}$/.test(String(raw.onetCode)) ||
        raw.id !== `onet-${String(raw.onetCode)}` || ids.has(String(raw.id)) || names.has(name)) {
      errors.push(prefix + 'missing or duplicate identity.');
    }
    ids.add(String(raw.id)); names.add(name);
    if (!localized(raw.labels) || !localized(raw.category) || !text(raw.description) ||
        raw.descriptionLanguage !== 'en' || !text(raw.entryEducation) || !text(raw.entryExperience) ||
        !text(raw.entryDataDate) || !Number.isInteger(raw.jobZone) ||
        Number(raw.jobZone) < 1 || Number(raw.jobZone) > 5 || !sourceUrl(raw.sourceUrl) ||
        raw.jurisdiction !== 'United States' || raw.trendEvidenceStatus !== 'unknown') {
      errors.push(prefix + 'incomplete description, preparation or evidence status.');
    }
    const skills = new Set<string>();
    if (!Array.isArray(raw.skills) || raw.skills.length < 6) {
      errors.push(prefix + 'insufficient sourced competencies.');
    } else for (const skill of raw.skills) {
      if (!isObject(skill) || !text(skill.name) || !text(skill.originalName) ||
          !text(skill.elementId) || !files.has(String(skill.sourceFile)) ||
          !['skill', 'knowledge', 'software'].includes(String(skill.kind)) ||
          skills.has(String(skill.name).trim().toLowerCase())) {
        errors.push(prefix + 'invalid, duplicate or untraceable competency.');
      } else skills.add(skill.name.trim().toLowerCase());
    }
    const signature = [...skills].sort().join('|');
    if (signature && signatures.has(signature)) errors.push(prefix + 'duplicates an entire competency set.');
    signatures.add(signature);
    if (!Array.isArray(raw.sdgs) || raw.sdgs.length === 0) {
      errors.push(prefix + 'missing explained SDG alignment.');
    } else for (const sdg of raw.sdgs) {
      if (!isObject(sdg) || !Number.isInteger(sdg.goal) || Number(sdg.goal) < 1 || Number(sdg.goal) > 17 ||
          !localized(sdg.rationale) || !Array.isArray(sdg.skills) || sdg.skills.length === 0 ||
          sdg.skills.some(skill => !text(skill) || !skills.has(skill.toLowerCase()))) {
        errors.push(prefix + 'invalid SDG goal, rationale or relevant skills.');
      }
    }
  }
  return errors;
}

export const occupationCatalog = catalogData as OccupationCatalog;
export const catalogErrors = validateOccupationCatalog(occupationCatalog);
const byName = new Map(
  catalogErrors.length ? [] : occupationCatalog.occupations.map(item => [item.occupation, item] as const),
);
export function getOccupationMetadata(occupation: string): OccupationMetadata | undefined {
  return byName.get(occupation);
}
export function catalogText(value: LocalizedText, locale: CatalogLocale): string {
  return value[locale];
}
