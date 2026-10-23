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
}

export interface DatasetResult {
  records: CareerRecord[];
  errors: string[];
}

export interface CareerMatch {
  occupation: string;
  requiredSkills: string[];
  matchingSkills: string[];
  missingSkills: string[];
  score: number;
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
  const profileSkillList = Array.isArray(profileSkills)
    ? profileSkills
    : profileSkills.split(/[,\uFF0C]/);
  const normalizedProfileSkills = new Set(
    profileSkillList.map(normalizeSkill).filter(Boolean),
  );
  const occupations = new Map<string, Set<string>>();

  for (const record of records) {
    const occupation = record.occupation.trim();
    const skill = record.skill.trim();
    if (!occupation || !skill) continue;
    const key = occupation.toLocaleLowerCase();
    const requiredSkills = occupations.get(key) ?? new Set<string>();
    requiredSkills.add(skill);
    occupations.set(key, requiredSkills);
  }

  return Array.from(occupations.entries())
    .map(([key, skillSet]) => {
      const occupation = records.find(
        (record) => record.occupation.toLocaleLowerCase() === key,
      )!.occupation;
      const requiredSkills = Array.from(skillSet);
      const matchingSkills = requiredSkills.filter((skill) =>
        normalizedProfileSkills.has(normalizeSkill(skill)),
      );
      const missingSkills = requiredSkills.filter(
        (skill) => !normalizedProfileSkills.has(normalizeSkill(skill)),
      );
      return {
        occupation,
        requiredSkills,
        matchingSkills,
        missingSkills,
        score: requiredSkills.length
          ? Math.round((matchingSkills.length / requiredSkills.length) * 100)
          : 0,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.occupation.localeCompare(right.occupation),
    );
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
