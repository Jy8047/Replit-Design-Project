import {
  calculateCareerMatches,
  type CareerRecord,
} from './career-data.ts';

export interface LearningResource {
  status: 'verified' | 'unverified';
  title: string;
  provider: string;
  url?: string;
  checkedOn?: string;
  note: string;
}

export interface LearningStep {
  skill: string;
  order: number;
  duration: string;
  resource: LearningResource;
}

export type ScenarioId = 'moderate' | 'fast';

export interface ScenarioAssumption {
  label: string;
  moderate: string;
  fast: string;
  explanation: string;
}

export interface ScenarioResult {
  occupation: string;
  overlapScore: number;
  scenarioIndex: number;
  adjustment: number;
  risingSkills: string[];
  stableSkills: string[];
  decliningSkills: string[];
}

export interface GoalMapping {
  goalNumber: number;
  goalTitle: string;
  officialUrl: string;
  occupation: string;
  relevantSkills: string[];
  rationale: string;
  relationship: 'potential' | 'conditional';
}

export interface WorkforceScenarioYear {
  year: number;
  lowAI: number;
  moderateAI: number;
  highAI: number;
}

export interface WorkforceScenarioOption {
  id: 'low' | 'moderate' | 'high';
  labelEn: string;
  labelZh: string;
  labelMs: string;
}

export interface WorkforceScenarioData {
  schemaVersion: 1;
  note: string;
  years: WorkforceScenarioYear[];
  scenarios: WorkforceScenarioOption[];
  source: {
    name: string;
    publishedAt: string;
    url: null;
  };
  sdgExplanationKeys: number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseWorkforceScenarioData(value: unknown): WorkforceScenarioData {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.note !== 'string') {
    throw new Error('Invalid workforce scenario data');
  }
  if (!Array.isArray(value.years) || value.years.length !== 5) {
    throw new Error('Invalid workforce scenario data');
  }

  const years: WorkforceScenarioYear[] = [];
  for (const [index, row] of value.years.entries()) {
    if (
      !isRecord(row) ||
      row.year !== 2026 + index ||
      !Number.isFinite(row.lowAI) ||
      !Number.isFinite(row.moderateAI) ||
      !Number.isFinite(row.highAI)
    ) {
      throw new Error('Invalid workforce scenario data');
    }
    years.push({
      year: row.year as number,
      lowAI: row.lowAI as number,
      moderateAI: row.moderateAI as number,
      highAI: row.highAI as number,
    });
  }

  const expectedIds = ['low', 'moderate', 'high'];
  if (!Array.isArray(value.scenarios) || value.scenarios.length !== expectedIds.length) {
    throw new Error('Invalid workforce scenario data');
  }
  const scenarios: WorkforceScenarioOption[] = [];
  for (const [index, option] of value.scenarios.entries()) {
    if (
      !isRecord(option) ||
      option.id !== expectedIds[index] ||
      typeof option.labelEn !== 'string' ||
      typeof option.labelZh !== 'string' ||
      typeof option.labelMs !== 'string'
    ) {
      throw new Error('Invalid workforce scenario data');
    }
    scenarios.push({
      id: option.id as WorkforceScenarioOption['id'],
      labelEn: option.labelEn,
      labelZh: option.labelZh,
      labelMs: option.labelMs,
    });
  }

  if (
    !isRecord(value.source) ||
    typeof value.source.name !== 'string' ||
    typeof value.source.publishedAt !== 'string' ||
    value.source.url !== null ||
    !Array.isArray(value.sdgExplanationKeys) ||
    !value.sdgExplanationKeys.every((key) => Number.isInteger(key))
  ) {
    throw new Error('Invalid workforce scenario data');
  }

  return {
    schemaVersion: 1,
    note: value.note,
    years,
    scenarios,
    source: {
      name: value.source.name,
      publishedAt: value.source.publishedAt,
      url: null,
    },
    sdgExplanationKeys: value.sdgExplanationKeys as number[],
  };
}

const RESOURCE_CHECK_DATE = '2026-10-23';
const NOT_VERIFIED_RESOURCE: LearningResource = {
  status: 'unverified',
  title: 'No verified resource link yet',
  provider: 'Not independently checked',
  note: 'A relevant resource page has not been verified. No course link is being suggested.',
};

const resourcesBySkill: Record<string, LearningResource> = {
  'learning evaluation': {
    status: 'verified',
    title: 'CDC Program Evaluation Framework',
    provider: 'U.S. Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/evaluation/php/evaluation-framework/index.html',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public framework explaining how to plan and use program evaluation.',
  },
  'impact measurement': {
    status: 'verified',
    title: 'CDC Program Evaluation Framework',
    provider: 'U.S. Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/evaluation/php/evaluation-framework/index.html',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public framework covering evaluation questions, evidence, and use of findings.',
  },
  'climate literacy': {
    status: 'verified',
    title: 'Climate Literacy: The Essential Principles of Climate Sciences',
    provider: 'NASA Global Precipitation Measurement',
    url: 'https://gpm.nasa.gov/education/articles/climate-literacy-essential-principles-climate-sciences',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'NASA educational material introducing climate science and its impacts.',
  },
  research: {
    status: 'verified',
    title: 'Researching user experiences',
    provider: 'GOV.UK Service Manual',
    url: 'https://www.gov.uk/service-manual/user-research/researching-user-experiences',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public guide to researching people’s experiences of a service.',
  },
  'qualitative research methods': {
    status: 'verified',
    title: 'Researching user experiences',
    provider: 'GOV.UK Service Manual',
    url: 'https://www.gov.uk/service-manual/user-research/researching-user-experiences',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public collection of user-research methods and practical guides.',
  },
  'data visualization': {
    status: 'verified',
    title: 'Datawrapper Academy',
    provider: 'Datawrapper',
    url: 'https://www.datawrapper.de/academy',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public tutorials about charts, maps, and tables.',
  },
  writing: {
    status: 'verified',
    title: 'The Writing Process',
    provider: 'Purdue Online Writing Lab',
    url: 'https://owl.purdue.edu/owl/general_writing/the_writing_process/index.html',
    checkedOn: RESOURCE_CHECK_DATE,
    note: 'Public guide to planning, organizing, drafting, and revising writing.',
  },
};

const durationBySkill: Record<string, string> = {
  communication: '2–4 hours · estimate',
  facilitation: '1–2 weeks · estimate',
  'content planning': '1–2 weeks · estimate',
  'learning design': '2–3 weeks · estimate',
  'learning evaluation': '1–2 weeks · estimate',
  'project coordination': '1–2 weeks · estimate',
  research: '1–2 weeks · estimate',
  'stakeholder support': '1–2 weeks · estimate',
  'impact measurement': '1–2 weeks · estimate',
  'climate literacy': '2–4 hours · estimate',
  listening: '2–4 hours · estimate',
  writing: '1 week · estimate',
  'pattern recognition': '1 week · estimate',
  'qualitative research methods': '2–3 weeks · estimate',
  'data visualization': '1–2 weeks · estimate',
  'manual record handling': '2–4 hours · estimate',
  'routine information processing': '2–4 hours · estimate',
  scheduling: '2–4 hours · estimate',
  'document organization': '2–4 hours · estimate',
};

const pathwaySkillOrder: Record<string, string[]> = {
  'learning experience designer': [
    'Communication',
    'Facilitation',
    'Content planning',
    'Learning design',
    'Learning evaluation',
  ],
  'sustainability program coordinator': [
    'Research',
    'Climate literacy',
    'Stakeholder support',
    'Project coordination',
    'Impact measurement',
  ],
  'customer insights associate': [
    'Listening',
    'Research',
    'Qualitative research methods',
    'Pattern recognition',
    'Writing',
    'Data visualization',
  ],
  'office support coordinator (illustrative)': [
    'Document organization',
    'Scheduling',
    'Routine information processing',
    'Manual record handling',
  ],
};

export function buildLearningPlan(
  occupation: string,
  profileSkills: string,
  records: CareerRecord[],
): LearningStep[] {
  const match = calculateCareerMatches(profileSkills, records).find(
    (item) => item.occupation === occupation,
  );
  if (!match) return [];

  const orderedSkills = pathwaySkillOrder[occupation.toLocaleLowerCase()] ?? [
    ...match.requiredSkills,
  ];
  const missing = new Set(
    match.missingSkills.map((skill) => skill.normalize('NFKC').toLocaleLowerCase()),
  );
  const skills = [
    ...orderedSkills.filter((skill) =>
      missing.has(skill.normalize('NFKC').toLocaleLowerCase()),
    ),
    ...match.missingSkills.filter(
      (skill) =>
        !orderedSkills.some(
          (ordered) =>
            ordered.normalize('NFKC').toLocaleLowerCase() ===
            skill.normalize('NFKC').toLocaleLowerCase(),
        ),
    ),
  ];

  return skills.map((skill, index) => ({
    skill,
    order: index + 1,
    duration:
      durationBySkill[skill.toLocaleLowerCase()] ?? '1 week · estimate',
    resource:
      resourcesBySkill[skill.toLocaleLowerCase()] ?? NOT_VERIFIED_RESOURCE,
  }));
}

const goalMappings: GoalMapping[] = [
  {
    goalNumber: 4,
    goalTitle: 'Quality Education',
    officialUrl: 'https://sdgs.un.org/goals/goal4',
    occupation: 'Learning Experience Designer',
    relevantSkills: ['Learning design', 'Learning evaluation', 'Facilitation'],
    rationale:
      'When the work creates accessible learning opportunities and checks whether they help, it may align with Goal 4’s lifelong-learning aim. The occupation label alone does not demonstrate a contribution.',
    relationship: 'conditional',
  },
  {
    goalNumber: 12,
    goalTitle: 'Responsible Consumption and Production',
    officialUrl: 'https://sdgs.un.org/goals/goal12',
    occupation: 'Sustainability Program Coordinator',
    relevantSkills: ['Impact measurement', 'Research', 'Stakeholder support'],
    rationale:
      'If the role supports more responsible resource use, coordinating evidence and stakeholders can be relevant to Goal 12. This is an intended alignment, not evidence of changed consumption or production.',
    relationship: 'conditional',
  },
  {
    goalNumber: 13,
    goalTitle: 'Climate Action',
    officialUrl: 'https://sdgs.un.org/goals/goal13',
    occupation: 'Sustainability Program Coordinator',
    relevantSkills: ['Climate literacy', 'Impact measurement', 'Project coordination'],
    rationale:
      'In work that supports climate initiatives, climate literacy and measurement may help teams plan and review activities. No climate outcome is measured by this app.',
    relationship: 'conditional',
  },
  {
    goalNumber: 9,
    goalTitle: 'Industry, Innovation and Infrastructure',
    officialUrl: 'https://sdgs.un.org/goals/goal9',
    occupation: 'Customer Insights Associate',
    relevantSkills: ['Qualitative research methods', 'Research', 'Data visualization'],
    rationale:
      'If findings are used to improve services or products responsibly, research and clear data presentation can inform innovation. The mapping does not show that any innovation or public benefit occurred.',
    relationship: 'potential',
  },
  {
    goalNumber: 16,
    goalTitle: 'Peace, Justice and Strong Institutions',
    officialUrl: 'https://sdgs.un.org/goals/goal16',
    occupation: 'Office Support Coordinator (illustrative)',
    relevantSkills: ['Document organization', 'Scheduling'],
    rationale:
      'In a public or community institution, well-organized records and scheduling may support accessible, accountable processes. This is context-dependent and is not a measured institutional outcome.',
    relationship: 'conditional',
  },
];

export function getOccupationGoalMappings(occupation: string): GoalMapping[] {
  return goalMappings.filter((mapping) => mapping.occupation === occupation);
}

export const scenarioAssumptions: ScenarioAssumption[] = [
  {
    label: 'How the scenario treats dataset directions',
    moderate: 'Rising 1.1× · stable 1× · declining 0.9×',
    fast: 'Rising 1.4× · stable 1× · declining 0.6×',
    explanation:
      'These are chosen what-if weights, not observed AI effects. They use the CSV direction labels, which are synthetic in the included file.',
  },
  {
    label: 'Adoption assumption',
    moderate: 'Uneven and gradual',
    fast: 'Quicker and broader',
    explanation:
      'The scenarios describe contrasting discussion assumptions; they are not forecasts, probabilities, or guaranteed outcomes.',
  },
];

export function calculateScenarioResults(
  profileSkills: string,
  records: CareerRecord[],
  scenario: ScenarioId,
): ScenarioResult[] {
  const matches = calculateCareerMatches(profileSkills, records);
  const weights =
    scenario === 'moderate'
      ? { rising: 1.1, stable: 1, declining: 0.9 }
      : { rising: 1.4, stable: 1, declining: 0.6 };

  return matches
    .map((match) => {
      const occupationRecords = records.filter(
        (record) => record.occupation === match.occupation,
      );
      const risingSkills = occupationRecords
        .filter((record) => record.trendDirection === 'rising')
        .map((record) => record.skill);
      const stableSkills = occupationRecords
        .filter((record) => record.trendDirection === 'stable')
        .map((record) => record.skill);
      const decliningSkills = occupationRecords
        .filter((record) => record.trendDirection === 'declining')
        .map((record) => record.skill);
      const matched = new Set(
        match.matchingSkills.map((skill) =>
          skill.normalize('NFKC').toLocaleLowerCase(),
        ),
      );
      const weightedTotal =
        risingSkills.length * weights.rising +
        stableSkills.length * weights.stable +
        decliningSkills.length * weights.declining;
      const weightedMatched =
        risingSkills.filter((skill) =>
          matched.has(skill.normalize('NFKC').toLocaleLowerCase()),
        ).length *
          weights.rising +
        stableSkills.filter((skill) =>
          matched.has(skill.normalize('NFKC').toLocaleLowerCase()),
        ).length *
          weights.stable +
        decliningSkills.filter((skill) =>
          matched.has(skill.normalize('NFKC').toLocaleLowerCase()),
        ).length *
          weights.declining;
      const scenarioIndex = weightedTotal
        ? Math.round((weightedMatched / weightedTotal) * 100)
        : 0;

      return {
        occupation: match.occupation,
        overlapScore: match.score,
        scenarioIndex,
        adjustment: scenarioIndex - match.score,
        risingSkills,
        stableSkills,
        decliningSkills,
      };
    })
    .sort(
      (left, right) =>
        right.scenarioIndex - left.scenarioIndex ||
        left.occupation.localeCompare(right.occupation),
    );
}
