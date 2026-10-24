export const DIMENSION_IDS = ['data', 'tech', 'design', 'collab'] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];
export type DimensionLocale = 'en' | 'zh' | 'ms';
export type DimensionVector = Record<DimensionId, number>;

export const DIMENSION_NAMES: Readonly<Record<DimensionId, Readonly<Record<DimensionLocale, string>>>> = {
  data: {
    en: 'Data handling',
    zh: '数据处理',
    ms: 'Pengendalian data',
  },
  tech: {
    en: 'Technical',
    zh: '编程技术',
    ms: 'Teknikal',
  },
  design: {
    en: 'Design & content',
    zh: '设计与内容',
    ms: 'Reka bentuk & kandungan',
  },
  collab: {
    en: 'Communication & collaboration',
    zh: '沟通与协作',
    ms: 'Komunikasi & kerjasama',
  },
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
  collab: [
    'Communication',
    'Listening',
    'Writing',
    'Stakeholder support',
    'Project coordination',
    'Scheduling',
    'Document organization',
    'Manual record handling',
    'Routine information processing',
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
  collab: [
    'management',
    'administration',
    'personnel',
    'negotiation',
    'coordination',
    'communication',
    'customer',
    'sales',
    'teaching',
    'training',
    'service',
    'leadership',
    'time management',
  ],
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
    'biology',
    'chemistry',
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
 * default to collab for display grouping only; this does not infer a user skill.
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
  // Collaboration has priority over design's "communicat" family (for example,
  // "Communications and Media" remains collab because it hits communication).
  if (includesKeyword(normalized, fallbackKeywords.collab)) return 'collab';
  if (includesKeyword(normalized, fallbackKeywords.design) || normalized.includes('communicat')) {
    return 'design';
  }

  // 这是展示归类，不是技能推断；未命中标签仅归入 collab 供展示。
  return 'collab';
}

function emptyVector(): DimensionVector {
  return { data: 0, tech: 0, design: 0, collab: 0 };
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

function scaleToMaximum(values: DimensionVector): DimensionVector {
  const maximum = Math.max(...DIMENSION_IDS.map((dimension) => values[dimension]));
  if (maximum <= 0) return emptyVector();
  return {
    data: roundPercent((values.data / maximum) * 100),
    tech: roundPercent((values.tech / maximum) * 100),
    design: roundPercent((values.design / maximum) * 100),
    collab: roundPercent((values.collab / maximum) * 100),
  };
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
    required: {
      data: roundPercent((requiredShares.data / maximumRequiredShare) * 100),
      tech: roundPercent((requiredShares.tech / maximumRequiredShare) * 100),
      design: roundPercent((requiredShares.design / maximumRequiredShare) * 100),
      collab: roundPercent((requiredShares.collab / maximumRequiredShare) * 100),
    },
    matched: {
      data: roundPercent((matchedShares.data / maximumRequiredShare) * 100),
      tech: roundPercent((matchedShares.tech / maximumRequiredShare) * 100),
      design: roundPercent((matchedShares.design / maximumRequiredShare) * 100),
      collab: roundPercent((matchedShares.collab / maximumRequiredShare) * 100),
    },
  };
}
