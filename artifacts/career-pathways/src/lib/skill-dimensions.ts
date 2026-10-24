export const DIMENSION_IDS = [
  'data',
  'tech',
  'design',
  'communication',
  'management',
  'domain',
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];
export type DimensionVector = Record<DimensionId, number>;

export const DIMENSION_NAMES: Readonly<Record<DimensionId, string>> = {
  data: 'Data handling',
  tech: 'Technical',
  design: 'Design & content',
  communication: 'Communication',
  management: 'Management & organisation',
  domain: 'Domain knowledge',
};

export const SKILLS_BY_DIMENSION = {
  data: [
    'SQL',
    'Statistics',
    'Excel',
    'Data cleaning',
    'Data visualization',
    'Analytics',
    'Research',
    'Pattern recognition',
    'Impact measurement',
    'Qualitative research methods',
    'Mathematics',
    'Quality Control Analysis',
    'Systems Analysis',
    'Economics and Accounting',
    'ESRI ArcGIS software',
    'Google Analytics',
  ],
  tech: [
    'Python',
    'JavaScript',
    'TypeScript',
    'React',
    'HTML/CSS',
    'Git',
    'Linux',
    'Scripting',
    'Network security',
    'Security monitoring',
    'Incident response',
    'Risk assessment',
    'Accessibility',
    'Programming',
    'R',
    'Computers and Electronics',
    'Engineering and Technology',
    'Autodesk AutoCAD',
    'Autodesk Revit',
    'MEDITECH software',
    'Epic Systems',
    'Telecommunications',
    'Moodle',
  ],
  design: [
    'Learning design',
    'Content planning',
    'Copywriting',
    'Content marketing',
    'SEO',
    'Social media',
    'Campaign planning',
    'Facilitation',
    'Learning evaluation',
  ],
  communication: [
    'Communication',
    'Listening',
    'Writing',
    'Speaking',
    'Reading Comprehension',
    'English Language',
    'Active Listening',
    'Social Perceptiveness',
    'Instructing',
    'Communications and Media',
    'Education and Training',
  ],
  management: [
    'Stakeholder support',
    'Project coordination',
    'Scheduling',
    'Document organization',
    'Manual record handling',
    'Routine information processing',
    'Administration and Management',
    'Administrative',
    'Management of Personnel Resources',
    'Personnel and Human Resources',
    'Time Management',
    'Coordination',
    'Negotiation',
    'Complex Problem Solving',
    'Critical Thinking',
    'Judgment and Decision Making',
    'Operations Monitoring',
    'Customer and Personal Service',
    'Sales and Marketing',
    'Service Orientation',
    'Active Learning',
    'Learning Strategies',
    'RETScreen',
    'Microsoft PowerPoint',
  ],
  domain: [
    'Medicine and Dentistry',
    'Therapy and Counseling',
    'Biology',
    'Chemistry',
    'Mechanical',
    'Building and Construction',
    'Law and Government',
    'Geography',
    'Psychology',
    'Climate literacy',
    'Transportation',
    'Production and Processing',
    'Science',
  ],
} as const satisfies Record<DimensionId, readonly string[]>;

function normalizeSkill(skill: string): string {
  return skill.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

const explicitSkillDimensions: Record<string, DimensionId> = {};
for (const dimension of DIMENSION_IDS) {
  for (const skill of SKILLS_BY_DIMENSION[dimension]) {
    explicitSkillDimensions[skill] = dimension;
  }
}
export const SKILL_DIMENSION_MAP: Readonly<Record<string, DimensionId>> =
  Object.freeze(explicitSkillDimensions);

const explicitLookup = new Map(
  Object.entries(SKILL_DIMENSION_MAP).map(([skill, dimension]) => [normalizeSkill(skill), dimension]),
);

const skillAliases: Readonly<Record<string, string>> = {
  'structured query language': 'SQL',
  '结构化查询语言': 'SQL',
};

const fallbackKeywords = {
  data: [
    'statistic',
    'mathematics',
    'math',
    'analy',
    'research',
    'data',
    'arcgis',
    'gis',
    'excel',
    'spreadsheet',
    'econom',
    'account',
    'financ',
    'physics',
  ],
  tech: [
    'program',
    'software',
    'computer',
    'network',
    'linux',
    'python',
    'java',
    'javascript',
    'type',
    'react',
    'engineering',
    'technology',
    'autocad',
    'revit',
    'sql',
    'database',
  ],
  design: [
    'design',
    'adobe',
    'photoshop',
    'illustrator',
    'fine arts',
    'media',
    'content',
    'seo',
    'marketing',
    'brand',
  ],
  communication: [
    'communicat',
    'listening',
    'writing',
    'speaking',
    'language',
    'instruct',
    'perceptiv',
    'reading comprehension',
  ],
  domain: [
    'medicine',
    'dentistry',
    'therapy',
    'counseling',
    'biology',
    'chemistry',
    'mechanical',
    'building and construction',
    'law and government',
    'geograph',
    'psycholog',
    'climate',
    'transportation',
    'production and processing',
    'science',
  ],
  management: [
    'management',
    'administration',
    'personnel',
    'negotiation',
    'coordination',
    'customer',
    'sales',
    'teaching',
    'training',
    'service',
    'leadership',
    'time management',
    'organization',
    'organisation',
    'operations',
    'stakeholder',
    'scheduling',
    'record',
    'processing',
    'problem solving',
    'critical thinking',
    'judgment',
    'decision making',
  ],
} as const;

function canonicalSkill(skill: string): string {
  const normalized = normalizeSkill(skill);
  return skillAliases[normalized] ?? skill.trim();
}

function includesKeyword(skill: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => skill.includes(keyword));
}

/**
 * Classifies labels absent from the explicit table by keyword. Unknown labels
 * default to management for display grouping only; this does not infer a user skill.
 */
export function dimensionOf(skill: string): DimensionId {
  const normalized = normalizeSkill(skill);
  const canonical = normalizeSkill(canonicalSkill(skill));
  const explicit = explicitLookup.get(canonical);
  if (explicit) return explicit;

  if (includesKeyword(normalized, fallbackKeywords.data)) return 'data';
  if (
    includesKeyword(normalized, fallbackKeywords.tech)
    || /(?:^|[^a-z0-9])r(?:$|[^a-z0-9])/.test(normalized)
  ) return 'tech';
  if (includesKeyword(normalized, fallbackKeywords.design) || normalized.includes('communicat')) {
    if (!includesKeyword(normalized, fallbackKeywords.communication)) return 'design';
  }
  if (includesKeyword(normalized, fallbackKeywords.communication)) return 'communication';
  if (includesKeyword(normalized, fallbackKeywords.domain)) return 'domain';
  if (includesKeyword(normalized, fallbackKeywords.management)) return 'management';

  // 这是展示归类，不是技能推断；未命中标签仅归入 management 供展示。
  return 'management';
}

function emptyVector(): DimensionVector {
  return Object.fromEntries(DIMENSION_IDS.map((dimension) => [dimension, 0])) as DimensionVector;
}

function uniqueSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    if (!skill.trim()) return false;
    const canonical = normalizeSkill(canonicalSkill(skill));
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

function skillWeight(skill: string, weights?: Record<string, number>): number {
  if (!weights) return 1;
  const canonical = canonicalSkill(skill);
  const normalizedSkill = normalizeSkill(skill);
  const normalizedCanonical = normalizeSkill(canonical);
  const matchingKey = Object.keys(weights).find((key) => {
    const normalizedKey = normalizeSkill(key);
    return normalizedKey === normalizedSkill || normalizedKey === normalizedCanonical;
  });
  const value = matchingKey === undefined ? undefined : weights[matchingKey];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 1;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function scaleToMaximum(values: DimensionVector, maximum = Math.max(...DIMENSION_IDS.map((dimension) => values[dimension]))): DimensionVector {
  if (maximum <= 0) return emptyVector();
  const scaled = emptyVector();
  for (const dimension of DIMENSION_IDS) {
    scaled[dimension] = roundPercent((values[dimension] / maximum) * 100);
  }
  return scaled;
}

export function profileDimensions(
  skills: string[],
  weights?: Record<string, number>,
): DimensionVector {
  const totals = emptyVector();
  for (const skill of uniqueSkills(skills)) {
    totals[dimensionOf(skill)] += skillWeight(skill, weights);
  }
  return scaleToMaximum(totals);
}

export function roleDimensions(
  requiredSkills: string[],
  matchedSkills: string[],
  weights?: Record<string, number>,
): { required: DimensionVector; matched: DimensionVector } {
  const required = emptyVector();
  const matched = emptyVector();
  const matchedKeys = new Set(
    uniqueSkills(matchedSkills).map((skill) => normalizeSkill(canonicalSkill(skill))),
  );
  const uniqueRequired = uniqueSkills(requiredSkills);
  let denominator = 0;

  for (const skill of uniqueRequired) {
    const weight = skillWeight(skill, weights);
    const dimension = dimensionOf(skill);
    denominator += weight;
    required[dimension] += weight;
    if (matchedKeys.has(normalizeSkill(canonicalSkill(skill)))) {
      matched[dimension] += weight;
    }
  }

  if (denominator <= 0) return { required: emptyVector(), matched: emptyVector() };

  // Both vectors use the same denominator: the full weighted skill set for this role.
  const requiredShares = emptyVector();
  const matchedShares = emptyVector();
  for (const dimension of DIMENSION_IDS) {
    requiredShares[dimension] = required[dimension] / denominator;
    matchedShares[dimension] = matched[dimension] / denominator;
  }

  const maximumRequiredShare = Math.max(...DIMENSION_IDS.map((dimension) => requiredShares[dimension]));
  if (maximumRequiredShare <= 0) return { required: emptyVector(), matched: emptyVector() };

  return {
    required: scaleToMaximum(requiredShares, maximumRequiredShare),
    matched: scaleToMaximum(matchedShares, maximumRequiredShare),
  };
}
