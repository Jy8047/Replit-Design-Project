import { matchCareers, OCCUPATION_INSIGHTS, type CareerMatch as EngineMatch } from './career-matching.ts';
import {
  catalogErrors, getOccupationMetadata, occupationCatalog, type OccupationMetadata,
} from './occupation-catalog.ts';
import { normalizeCatalogProfileSkills } from './occupation-skill-aliases.ts';

export const REQUIRED_CSV_HEADERS = [
  'occupation',
  'skill',
  'trend_direction',
  'source_name',
  'source_url',
  'publication_date',
  'evidence',
  'record_status',
] as const;

export type TrendDirection = 'rising' | 'declining' | 'stable';
export type RecordStatus = 'synthetic' | 'verified';

export interface CareerRecord {
  occupation: string;
  skill: string;
  trendDirection: TrendDirection;
  sourceName: string;
  sourceUrl: string;
  publicationDate: string;
  evidence: string;
  recordStatus: RecordStatus;
  catalog?: OccupationMetadata;
}

export interface DatasetResult {
  records: CareerRecord[];
  errors: string[];
}

export interface CareerMatch extends EngineMatch {
  catalog?: OccupationMetadata;
  trendEvidenceStatus?: 'unknown' | 'synthetic';
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateRecord(
  values: Record<(typeof REQUIRED_CSV_HEADERS)[number], string>,
  lineNumber: number,
): { record?: CareerRecord; error?: string } {
  const occupation = values.occupation.trim();
  const skill = values.skill.trim();
  const direction = values.trend_direction.trim().toLowerCase();
  const status = values.record_status.trim().toLowerCase();
  const sourceName = values.source_name.trim();
  const sourceUrl = values.source_url.trim();
  const publicationDate = values.publication_date.trim();
  const evidence = values.evidence.trim();
  const fail = (message: string) => ({ error: `Row ${lineNumber}: ${message}` });

  if (!occupation || !skill || !evidence) {
    return fail('occupation, skill, and evidence are required.');
  }
  if (!['rising', 'declining', 'stable'].includes(direction)) {
    return fail('trend_direction must be rising, declining, or stable.');
  }
  if (status !== 'synthetic' && status !== 'verified') {
    return fail('record_status must be synthetic or verified.');
  }
  if (status === 'synthetic' && (sourceName || sourceUrl || publicationDate)) {
    return fail('synthetic rows must not include source or publication-date fields.');
  }
  if (status === 'verified') {
    if (!sourceName || !sourceUrl || !publicationDate) {
      return fail('verified rows require source_name, source_url, and publication_date.');
    }
    if (!isHttpUrl(sourceUrl)) {
      return fail('verified source_url must be a valid http or https URL.');
    }
    if (!isValidIsoDate(publicationDate)) {
      return fail('verified publication_date must be a real date in YYYY-MM-DD format.');
    }
  }

  return {
    record: {
      occupation,
      skill,
      trendDirection: direction as TrendDirection,
      sourceName,
      sourceUrl,
      publicationDate,
      evidence,
      recordStatus: status as RecordStatus,
    },
  };
}

export function parseCareerCsv(text: string): DatasetResult {
  let rows: string[][];
  try {
    rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    return {
      records: [],
      errors: [error instanceof Error ? error.message : 'CSV could not be parsed.'],
    };
  }

  if (rows.length === 0) {
    return { records: [], errors: ['CSV is empty.'] };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missingHeaders = REQUIRED_CSV_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      records: [],
      errors: [`CSV is missing required columns: ${missingHeaders.join(', ')}.`],
    };
  }

  const errors: string[] = [];
  const records: CareerRecord[] = [];
  const seenPairs = new Set<string>();

  rows.slice(1).forEach((cells, rowIndex) => {
    const lineNumber = rowIndex + 2;
    if (cells.length !== headers.length) {
      errors.push(`Row ${lineNumber}: expected ${headers.length} columns, found ${cells.length}.`);
      return;
    }

    const values = Object.fromEntries(
      REQUIRED_CSV_HEADERS.map((header) => [
        header,
        cells[headers.indexOf(header)]?.trim() ?? '',
      ]),
    ) as Record<(typeof REQUIRED_CSV_HEADERS)[number], string>;
    const result = validateRecord(values, lineNumber);
    if (result.error) {
      errors.push(result.error);
      return;
    }

    const record = result.record!;
    const pairKey = `${record.occupation.toLocaleLowerCase()}::${record.skill.toLocaleLowerCase()}`;
    if (seenPairs.has(pairKey)) {
      errors.push(`Row ${lineNumber}: duplicate occupation and skill pair.`);
      return;
    }
    seenPairs.add(pairKey);
    records.push(record);
  });

  if (records.length === 0 && errors.length === 0) {
    errors.push('CSV has a header but no data rows.');
  }
  return { records, errors };
}

function normalizeSkill(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase();
  const localizedAliases: Record<string, string> = {
    '沟通': 'communication',
    'komunikasi': 'communication',
    '引导': 'facilitation',
    'fasilitasi': 'facilitation',
    '内容规划': 'content planning',
    'perancangan kandungan': 'content planning',
    '学习设计': 'learning design',
    'reka bentuk pembelajaran': 'learning design',
    '学习评估': 'learning evaluation',
    'penilaian pembelajaran': 'learning evaluation',
    '项目协调': 'project coordination',
    'penyelarasan projek': 'project coordination',
    '研究': 'research',
    'penyelidikan': 'research',
    '利益相关方支持': 'stakeholder support',
    'sokongan pihak berkepentingan': 'stakeholder support',
    '影响评估': 'impact measurement',
    'pengukuran impak': 'impact measurement',
    '气候素养': 'climate literacy',
    'literasi iklim': 'climate literacy',
    '倾听': 'listening',
    'pendengaran aktif': 'listening',
    '写作': 'writing',
    'penulisan': 'writing',
    '模式识别': 'pattern recognition',
    'pengecaman corak': 'pattern recognition',
    '定性研究方法': 'qualitative research methods',
    'kaedah penyelidikan kualitatif': 'qualitative research methods',
    '数据可视化': 'data visualization',
    'visualisasi data': 'data visualization',
    '手动记录处理': 'manual record handling',
    'pengendalian rekod manual': 'manual record handling',
    '常规信息处理': 'routine information processing',
    'pemprosesan maklumat rutin': 'routine information processing',
    '日程安排': 'scheduling',
    'penjadualan': 'scheduling',
    '文件整理': 'document organization',
    'penyusunan dokumen': 'document organization',
  };
  return localizedAliases[normalized] ?? normalized;
}

export function calculateCareerMatches(
  profileSkills: string | string[],
  records: CareerRecord[],
): CareerMatch[] {
  return explainCareerMatches(profileSkills, records);
}

/** Return matches in score order for display; scoring remains in the existing engine. */
export function rankCareerMatchesForDisplay(
  profileSkills: string | string[],
  records: CareerRecord[],
): CareerMatch[] {
  return calculateCareerMatches(profileSkills, records)
    .sort((left, right) => right.score - left.score);
}

/** Boundary adapter only: P2's function, algorithm and return structure stay untouched. */
export function explainCareerMatches(
  profileSkills: string | string[],
  records: CareerRecord[],
  locale: 'en' | 'zh' | 'ms' = 'en',
): CareerMatch[] {
  const insights = { ...OCCUPATION_INSIGHTS };
  for (const record of records) {
    const meta = record.catalog;
    if (meta && !insights[record.occupation.toLowerCase()]) {
      insights[record.occupation.toLowerCase()] = {
        occupation: record.occupation,
        labels: { en: meta.labels.en, zh: meta.labels.zh, bm: meta.labels.ms },
        sdgTags: meta.sdgs.map(mapping => mapping.goal),
        skills: {}, // Explicitly retain P2's default equal weights, not source ratings.
      };
    }
  }
  const rows = records.map(record => ({
    occupation: record.occupation, skill: record.skill,
    trend_direction: record.trendDirection,
  }));
  const input = records.some(record => record.catalog)
    ? normalizeCatalogProfileSkills(profileSkills) : profileSkills;
  const result = matchCareers(input, rows, insights, locale === 'ms' ? 'bm' : locale);
  return result.matches.map(match => {
    const roleRecords = records.filter(record => record.occupation === match.occupation);
    const meta = roleRecords.find(record => record.catalog)?.catalog;
    const synthetic = roleRecords.every(record => record.recordStatus === 'synthetic');
    const disclaimer = meta ? {
      en: 'Market trend unknown. Source verification covers competencies, not demand. Learning hours are app estimates.',
      zh: '市场趋势未知。来源核验仅覆盖职业能力关联，不代表需求；学习工时为程序估算。',
      ms: 'Trend pasaran tidak diketahui. Pengesahan sumber meliputi kompetensi, bukan permintaan. Jam pembelajaran ialah anggaran aplikasi.',
    } : {
      en: 'Direction is a synthetic example, not a measured market trend. Learning hours are app estimates.',
      zh: '方向为合成示例，不是已测量的市场趋势；学习工时为程序估算。',
      ms: 'Arah ialah contoh sintetik, bukan trend pasaran terukur. Jam pembelajaran ialah anggaran aplikasi.',
    };
    return {
      ...match, catalog: meta,
      trendEvidenceStatus: meta ? 'unknown' : synthetic ? 'synthetic' : undefined,
      reasons: meta || synthetic ? [...match.reasons.slice(0, -1), disclaimer[locale]] : match.reasons,
    };
  });
}

/** Reject official rows whose metadata cannot substantiate their exact association. */
export function combineCareerDatasets(syntheticCsv: string, officialCsv: string): DatasetResult {
  const original = parseCareerCsv(syntheticCsv);
  const official = parseCareerCsv(officialCsv);
  const errors = [...original.errors, ...official.errors, ...catalogErrors];
  const accepted: CareerRecord[] = [];
  for (const record of official.records) {
    const meta = getOccupationMetadata(record.occupation);
    const skill = meta?.skills.find(skill => skill.name === record.skill);
    const source = occupationCatalog.sources.find(source => source.file === skill?.sourceFile);
    if (!meta || !skill || record.recordStatus !== 'verified' ||
        record.publicationDate !== occupationCatalog.publishedOn ||
        source?.url !== record.sourceUrl || record.trendDirection !== 'stable' ||
        !record.evidence.includes(meta.onetCode)) {
      errors.push(`Unsubstantiated official association: ${record.occupation} / ${record.skill}.`);
      continue;
    }
    accepted.push({ ...record, catalog: meta });
  }
  const originalNames = new Set(original.records.map(record => record.occupation.toLowerCase()));
  const incomplete = new Set<string>();
  for (const meta of occupationCatalog.occupations) {
    const roleSkills = new Set(accepted.filter(row => row.occupation === meta.occupation).map(row => row.skill));
    if (meta.skills.some(skill => !roleSkills.has(skill.name))) {
      errors.push(`Incomplete official occupation omitted: ${meta.occupation}.`);
      incomplete.add(meta.occupation);
    }
  }
  return {
    records: [...original.records, ...accepted.filter(record => {
      if (incomplete.has(record.occupation)) return false;
      if (!originalNames.has(record.occupation.toLowerCase())) return true;
      errors.push(`Official occupation duplicates an existing role: ${record.occupation}.`);
      return false;
    })],
    errors,
  };
}

/** Load the two runtime CSV sources without allowing a cached file to override an update. */
export async function loadCareerDataset(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DatasetResult> {
  const files = ['skills-occupations.csv', 'official-occupations.csv'] as const;
  const responses = await Promise.all(
    files.map(file => fetcher(`${baseUrl}data/${file}`, { cache: 'no-store' })),
  );
  for (const response of responses) {
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  }
  const [syntheticCsv, officialCsv] = await Promise.all(
    responses.map(response => response.text()),
  );
  return combineCareerDatasets(syntheticCsv, officialCsv);
}

export function formatPublicationDate(value: string): string {
  if (!isValidIsoDate(value)) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function getVerifiedCitation(record: CareerRecord) {
  if (
    record.recordStatus !== 'verified' ||
    !record.sourceName ||
    !isHttpUrl(record.sourceUrl) ||
    !isValidIsoDate(record.publicationDate)
  ) {
    return null;
  }
  return {
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    publicationDate: record.publicationDate,
    formattedPublicationDate: formatPublicationDate(record.publicationDate),
  };
}
