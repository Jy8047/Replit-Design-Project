// P2 匹配引擎（纯函数，零依赖、零网络、零 AI）
// 输入：P1 传来的 profile.skills（字符串或数组）+ CSV 解析出来的技能记录
// 输出：带分数、缺口、理由、置信度、SDG 标签的岗位推荐
//
// 特点：
// - 确定性：同样输入永远同样结果（面试官问「为什么推荐」时能逐条解释）
// - 可解释：分数 = 已具备技能的权重之和 / 岗位要求技能的权重总和
// - 兼容：返回对象里保留了 occupation / requiredSkills / matchingSkills /
//         missingSkills / score 这五个旧字段，现有 UI 不改也不会坏
// - 三语：理由文字支持 en / zh / bm，由调用方把 locale 传进来

export type Locale = 'en' | 'zh' | 'bm';
export type FitLevel = 'strong' | 'partial' | 'exploratory';
export type TrendDirection = 'rising' | 'stable' | 'declining';
export type MatchStatus = 'ok' | 'no_skills' | 'no_data';

/**
 * 引擎版本标记。
 * 上传到 Replit 后，在文件里搜 ENGINE_VERSION 就能确认不是旧版本：
 * - 2026-10-23-v1：初版（无马来文别名）
 * - 2026-10-23-v2：补了 45 条马来文别名（Komunikasi / Fasilitasi / Pengecaman corak …）
 */
export const ENGINE_VERSION = '2026-10-23-v2';

export type SkillInsight = { weight: number; hours: number };

export type OccupationInsight = {
  occupation: string;
  labels: { en: string; zh: string; bm: string };
  sdgTags: number[];
  skills: Record<string, SkillInsight>;
};

/** CSV 里一行记录的最小形状（和 career-data.ts 的 CareerRecord 结构兼容） */
export type CareerRecordLike = {
  occupation: string;
  skill: string;
  trend_direction?: string;
};

export type SkillGap = {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  hours: number;
  weight: number;
};

export type CareerMatch = {
  // ---- 旧字段，保持和原 calculateCareerMatches 一致，UI 不用改 ----
  occupation: string;
  requiredSkills: string[];
  matchingSkills: string[];
  missingSkills: string[];
  score: number;
  // ---- 新字段，给 P3 / P4 / P5 用 ----
  label: string;
  fit: FitLevel;
  gaps: SkillGap[];
  gapHours: number;
  reasons: string[];
  confidence: number;
  sdgTags: number[];
  trend: TrendDirection;
};

export type MatchOutcome = {
  status: MatchStatus;
  message: string;
  matches: CareerMatch[];
  recognizedSkills: string[];
  unknownSkills: string[];
};

const DEFAULT_WEIGHT = 3;
const DEFAULT_HOURS_PER_WEIGHT = 6;

// ---------------------------------------------------------------------------
// 1. 技能名归一化 + 别名（中文、马来文、常见写法都认）
// ---------------------------------------------------------------------------
export const SKILL_ALIASES: Record<string, string[]> = {
  sql: ['structured query language', '结构化查询语言', 'sql语言'],
  excel: ['ms excel', 'microsoft excel', 'spreadsheet', '电子表格', 'excel表格'],
  python: ['python3', 'py'],
  statistics: ['statistical analysis', 'statistical methods', '统计学', '统计分析', 'statistik'],
  'data visualization': ['dataviz', 'data viz', 'visualisation', '数据可视化', '可视化', 'visualisasi data'],
  'data cleaning': ['data wrangling', 'data preprocessing', '数据清洗', '数据预处理'],
  javascript: ['js', 'ecmascript', 'javascript es6'],
  typescript: ['ts'],
  react: ['reactjs', 'react js', 'react 18'],
  'html css': ['html', 'css', 'html5', 'css3'],
  git: ['version control', 'github', '版本控制'],
  'network security': ['网络安全', '信息安全', 'cybersecurity', 'information security', 'keselamatan rangkaian'],
  'security monitoring': ['siem', '安全监控', 'pemantauan keselamatan'],
  'incident response': ['事件响应', '应急响应'],
  'risk assessment': ['风险评估', 'risk analysis'],
  linux: ['unix', 'linux系统'],
  scripting: ['bash', 'shell scripting', '脚本', 'skrip'],
  seo: ['search engine optimization', '搜索引擎优化', 'pengoptimuman enjin carian'],
  copywriting: ['文案', '文案写作', 'ad copy', 'copy writing'],
  'content marketing': ['内容营销', 'pemasaran kandungan'],
  analytics: ['google analytics', 'ga4', 'web analytics', '网站分析'],
  'social media': ['社交媒体', 'social media marketing', '媒体运营'],
  'campaign planning': ['活动策划', 'campaign management'],
  communication: ['沟通', '沟通能力', 'komunikasi'],
  facilitation: ['引导', '工作坊引导'],
  'content planning': ['内容规划', 'content strategy'],
  'learning design': ['教学设计', '学习设计', 'instructional design'],
  'learning evaluation': ['学习评估', '评估学习效果'],
  'project coordination': ['项目协调', '项目管理', 'project management', 'penyelarasan projek'],
  'stakeholder support': ['利益相关方', '干系人沟通', 'stakeholder management'],
  'impact measurement': ['影响力评估', '成效评估', 'impact evaluation'],
  research: ['调研', '研究', '研究能力', 'penyelidikan'],
  'climate literacy': ['气候素养', '气候变化知识'],
  'pattern recognition': ['模式识别', '规律识别'],
  'qualitative research methods': ['定性研究', '质性研究', 'qualitative research'],
  listening: ['倾听', '倾听能力'],
  writing: ['写作', 'writing skills', 'penulisan'],
  'manual record handling': ['手工记录', 'manual data entry'],
  'routine information processing': ['信息处理', 'routine data processing'],
  scheduling: ['日程安排', '排班', 'penjadualan'],
  'document organization': ['文档整理', '文件归档'],
  accessibility: ['可访问性', '无障碍', 'a11y'],
};

/** 只做清洗，不做别名替换 */
function normalizeRaw(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let text = String(raw).toLowerCase();
  text = text.replace(/（/g, '(').replace(/）/g, ')');
  text = text.replace(/\([^)]*\)/g, ' ');
  text = text.replace(/[/\\|&+,;:·]+/g, ' ');
  text = text.replace(/[^0-9a-z\u4e00-\u9fff\s]/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

/** 马来文别名（应用支持 BM 界面，技能输入也必须是马来文可用） */
export const SKILL_ALIASES_BM: Record<string, string[]> = {
  sql: ['sql'],
  excel: ['excel'],
  python: ['python'],
  statistics: ['statistik', 'analisis statistik'],
  'data visualization': ['visualisasi data', 'visualisasi'],
  'data cleaning': ['pembersihan data'],
  javascript: ['javascript'],
  typescript: ['typescript'],
  react: ['react'],
  'html css': ['html', 'css'],
  git: ['git'],
  'network security': ['keselamatan rangkaian', 'keselamatan siber'],
  'security monitoring': ['pemantauan keselamatan'],
  'incident response': ['tindak balas insiden'],
  'risk assessment': ['penilaian risiko'],
  linux: ['linux'],
  scripting: ['penulisan skrip', 'skrip'],
  seo: ['pengoptimuman enjin carian', 'seo'],
  copywriting: ['penulisan iklan', 'penulisan salinan iklan'],
  'content marketing': ['pemasaran kandungan'],
  analytics: ['analitis', 'analitik'],
  'social media': ['media sosial'],
  'campaign planning': ['perancangan kempen'],
  communication: ['komunikasi', 'komunikasi berkesan'],
  facilitation: ['fasilitasi'],
  'content planning': ['perancangan kandungan'],
  'learning design': ['reka bentuk pembelajaran'],
  'learning evaluation': ['penilaian pembelajaran'],
  'project coordination': ['penyelarasan projek'],
  'stakeholder support': ['sokongan pihak berkepentingan', 'sokongan pemegang taruh'],
  'impact measurement': ['pengukuran impak'],
  research: ['penyelidikan'],
  'climate literacy': ['literasi iklim'],
  'pattern recognition': ['pengecaman corak'],
  'qualitative research methods': ['kaedah penyelidikan kualitatif'],
  listening: ['mendengar', 'kemahiran mendengar'],
  writing: ['penulisan'],
  'manual record handling': ['pengendalian rekod manual'],
  'routine information processing': ['pemprosesan maklumat rutin'],
  scheduling: ['penjadualan', 'penjadualan masa'],
  'document organization': ['pengurusan dokumen', 'organisasi dokumen'],
  accessibility: ['kebolehcapaian'],
};

const ALIAS_LOOKUP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const table of [SKILL_ALIASES, SKILL_ALIASES_BM]) {
    for (const [canonical, variants] of Object.entries(table)) {
      map.set(canonical, canonical);
      for (const variant of variants) {
        const normalized = normalizeRaw(variant);
        if (normalized) map.set(normalized, canonical);
      }
    }
  }
  return map;
})();

/** 把任意写法的技能名变成规范名；认不出来就返回清洗后的原文 */
export function normalizeSkill(raw: unknown): string {
  const normalized = normalizeRaw(raw);
  if (!normalized) return '';
  return ALIAS_LOOKUP.get(normalized) ?? normalized;
}

/** 把 "Python；SQL、Excel" 这种脏字符串拆成规范名数组，自动去重、去空 */
export function parseSkills(raw: string | string[] | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
  const chunks = Array.isArray(raw) ? raw : [raw];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (chunk === null || chunk === undefined) continue;
    for (const piece of String(chunk).split(/[,，、;；|/\n\r]+/)) {
      const canonical = normalizeSkill(piece);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. SDG 标签（三语，P5 可以直接用）
// ---------------------------------------------------------------------------
export const SDG_LABELS: Record<number, { en: string; zh: string; bm: string }> = {
  1: { en: 'No Poverty', zh: '无贫穷', bm: 'Tiada Kemiskinan' },
  2: { en: 'Zero Hunger', zh: '零饥饿', bm: 'Kelaparan Sifar' },
  3: { en: 'Good Health and Well-being', zh: '良好健康与福祉', bm: 'Kesihatan dan Kesejahteraan Yang Baik' },
  4: { en: 'Quality Education', zh: '优质教育', bm: 'Pendidikan Berkualiti' },
  5: { en: 'Gender Equality', zh: '性别平等', bm: 'Kesaksamaan Gender' },
  6: { en: 'Clean Water and Sanitation', zh: '清洁饮水和卫生设施', bm: 'Air Bersih dan Sanitasi' },
  7: { en: 'Affordable and Clean Energy', zh: '经济适用的清洁能源', bm: 'Tenaga Mampu Milik dan Bersih' },
  8: { en: 'Decent Work and Economic Growth', zh: '体面工作和经济增长', bm: 'Pekerjaan Layak dan Pertumbuhan Ekonomi' },
  9: { en: 'Industry, Innovation and Infrastructure', zh: '产业、创新和基础设施', bm: 'Industri, Inovasi dan Infrastruktur' },
  10: { en: 'Reduced Inequalities', zh: '减少不平等', bm: 'Ketidaksamaan Berkurangan' },
  11: { en: 'Sustainable Cities and Communities', zh: '可持续城市和社区', bm: 'Bandar dan Komuniti Lestari' },
  12: { en: 'Responsible Consumption and Production', zh: '负责任消费和生产', bm: 'Penggunaan dan Pengeluaran Bertanggungjawab' },
  13: { en: 'Climate Action', zh: '气候行动', bm: 'Tindakan Iklim' },
  14: { en: 'Life Below Water', zh: '水下生物', bm: 'Kehidupan Bawah Air' },
  15: { en: 'Life on Land', zh: '陆地生物', bm: 'Kehidupan di Darat' },
  16: { en: 'Peace, Justice and Strong Institutions', zh: '和平、正义与强大机构', bm: 'Keamanan, Keadilan dan Institusi Yang Kukuh' },
  17: { en: 'Partnerships for the Goals', zh: '促进目标实现的伙伴关系', bm: 'Perkongsian untuk Matlamat' },
};

export function sdgLabel(id: number, locale: string = 'en'): string {
  const resolved = resolveLocale(locale);
  const entry = SDG_LABELS[id];
  return entry ? entry[resolved] : `SDG ${id}`;
}

// ---------------------------------------------------------------------------
// 3. 三语文案
// ---------------------------------------------------------------------------
function resolveLocale(locale: string | undefined): Locale {
  const value = (locale ?? '').toLowerCase();
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('bm') || value.startsWith('ms')) return 'bm';
  return 'en';
}

function joinList(items: string[], locale: Locale): string {
  if (items.length <= 1) return items[0] ?? '';
  if (locale === 'zh') return items.join('、');
  if (locale === 'bm') return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const REASONS = {
  matched: {
    en: (skills: string) => `You already have ${skills}, which this role weights most heavily.`,
    zh: (skills: string) => `你已经具备 ${skills}，正好是这个岗位最看重的技能。`,
    bm: (skills: string) => `Anda sudah mempunyai ${skills}, kemahiran yang paling dititikberatkan oleh peranan ini.`,
  },
  gap: {
    en: (skills: string, hours: number) => `Main gaps: ${skills}, roughly ${hours} hours of focused learning.`,
    zh: (skills: string, hours: number) => `主要缺口是 ${skills}，大约需要 ${hours} 小时集中学习。`,
    bm: (skills: string, hours: number) => `Jurang utama: ${skills}, kira-kira ${hours} jam pembelajaran berfokus.`,
  },
  trendRising: {
    en: () => 'Demand for this role is rising in the reference data.',
    zh: () => '参考数据里，这个岗位的需求在上升。',
    bm: () => 'Permintaan untuk peranan ini meningkat dalam data rujukan.',
  },
  trendStable: {
    en: () => 'Demand for this role looks stable in the reference data.',
    zh: () => '参考数据里，这个岗位的需求比较平稳。',
    bm: () => 'Permintaan untuk peranan ini stabil dalam data rujukan.',
  },
  trendDeclining: {
    en: () => 'Demand is declining for some tasks — treat this as a transferable stepping stone, not a destination.',
    zh: () => '部分任务的需求在下降——可以把它当作跳板，而不是终点。',
    bm: () => 'Permintaan bagi sesetengah tugasan menurun — anggap ini sebagai batu loncatan, bukan destinasi.',
  },
  noSkills: {
    en: () => 'Add at least one skill (or upload a CV) so we can compare it with the role data.',
    zh: () => '至少添加一个技能（或上传简历），我们才能和岗位数据做对比。',
    bm: () => 'Tambah sekurang-kurangnya satu kemahiran (atau muat naik CV) untuk dibandingkan dengan data peranan.',
  },
  noData: {
    en: () => 'The role dataset is empty, so no match can be computed yet.',
    zh: () => '岗位数据还是空的，暂时算不出匹配结果。',
    bm: () => 'Set data peranan kosong, jadi padanan belum boleh dikira.',
  },
};

// ---------------------------------------------------------------------------
// 4. 主函数
// ---------------------------------------------------------------------------
function insightFor(occupation: string, insights: Record<string, OccupationInsight>): OccupationInsight | undefined {
  const direct = insights[occupation.trim().toLowerCase()];
  if (direct) return direct;
  const wanted = occupation.trim().toLowerCase();
  for (const entry of Object.values(insights)) {
    if (entry?.occupation?.trim().toLowerCase() === wanted) return entry;
  }
  return undefined;
}

function majorityTrend(rows: CareerRecordLike[]): TrendDirection {
  const counts = new Map<TrendDirection, number>();
  for (const row of rows) {
    const value = (row.trend_direction ?? '').trim().toLowerCase();
    if (value === 'rising' || value === 'stable' || value === 'declining') {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  let best: TrendDirection = 'stable';
  let bestCount = -1;
  for (const trend of ['rising', 'stable', 'declining'] as TrendDirection[]) {
    const count = counts.get(trend) ?? 0;
    if (count > bestCount) {
      best = trend;
      bestCount = count;
    }
  }
  return best;
}

function confidenceOf(parsedCount: number, recognizedCount: number, matchedCount: number, requiredCount: number): number {
  if (!parsedCount || !requiredCount) return 0;
  const recognizedRatio = Math.min(1, recognizedCount / 5);
  const matchedRatio = matchedCount / requiredCount;
  const value = 0.3 + 0.4 * recognizedRatio + 0.3 * matchedRatio;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function fitOf(score: number): FitLevel {
  if (score >= 75) return 'strong';
  if (score >= 45) return 'partial';
  return 'exploratory';
}

export function matchCareers(
  profileSkills: string | string[] | null | undefined,
  records: CareerRecordLike[] | null | undefined,
  insights: Record<string, OccupationInsight> | null | undefined = {},
  localeInput: string = 'en',
): MatchOutcome {
  const locale = resolveLocale(localeInput);
  const insightMap = insights ?? {};
  const parsed = parseSkills(profileSkills);
  const rows = Array.isArray(records)
    ? records.filter(
        (row) =>
          row &&
          typeof row.occupation === 'string' &&
          typeof row.skill === 'string' &&
          row.occupation.trim().length > 0 &&
          row.skill.trim().length > 0,
      )
    : [];

  if (!parsed.length) {
    return {
      status: 'no_skills',
      message: REASONS.noSkills[locale](),
      matches: [],
      recognizedSkills: [],
      unknownSkills: [],
    };
  }
  if (!rows.length) {
    return {
      status: 'no_data',
      message: REASONS.noData[locale](),
      matches: [],
      recognizedSkills: parsed,
      unknownSkills: [],
    };
  }

  // 按岗位聚合技能（同一个技能出现多次只算一次）
  type Group = { occupation: string; skills: { skill: string; canonical: string; trend: TrendDirection }[] };
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const occupation = row.occupation.trim();
    const skill = row.skill.trim();
    const key = occupation.toLowerCase();
    const group = groups.get(key) ?? { occupation, skills: [] };
    const canonical = normalizeSkill(skill);
    if (canonical && !group.skills.some((entry) => entry.canonical === canonical)) {
      group.skills.push({ skill, canonical, trend: majorityTrend([row]) });
    }
    groups.set(key, group);
  }

  const knownSkills = new Set<string>();
  for (const group of groups.values()) {
    for (const entry of group.skills) knownSkills.add(entry.canonical);
  }
  for (const insight of Object.values(insightMap)) {
    for (const skill of Object.keys(insight?.skills ?? {})) {
      const canonical = normalizeSkill(skill);
      if (canonical) knownSkills.add(canonical);
    }
  }

  const profileSet = new Set(parsed);
  const recognizedSkills = parsed.filter((skill) => knownSkills.has(skill));
  const unknownSkills = parsed.filter((skill) => !knownSkills.has(skill));

  const matches: CareerMatch[] = [];
  for (const group of groups.values()) {
    const insight = insightFor(group.occupation, insightMap);
    const required = group.skills;
    const matchedEntries = required.filter((entry) => profileSet.has(entry.canonical));
    const missingEntries = required.filter((entry) => !profileSet.has(entry.canonical));

    const weightOf = (skill: string): number => {
      const entry = insight?.skills?.[skill];
      const weight = typeof entry?.weight === 'number' ? entry.weight : DEFAULT_WEIGHT;
      return Math.max(1, weight);
    };
    const hoursOf = (skill: string): number => {
      const entry = insight?.skills?.[skill];
      if (typeof entry?.hours === 'number' && entry.hours > 0) return Math.round(entry.hours);
      return weightOf(skill) * DEFAULT_HOURS_PER_WEIGHT;
    };

    const totalWeight = required.reduce((sum, entry) => sum + weightOf(entry.skill), 0);
    const matchedWeight = matchedEntries.reduce((sum, entry) => sum + weightOf(entry.skill), 0);
    const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    const gaps: SkillGap[] = missingEntries
      .map((entry) => {
        const weight = weightOf(entry.skill);
        return {
          skill: entry.skill,
          weight,
          hours: hoursOf(entry.skill),
          priority: weight >= 4 ? 'high' : weight >= 3 ? 'medium' : 'low',
        } as SkillGap;
      })
      .sort((left, right) => right.weight - left.weight || left.hours - right.hours || left.skill.localeCompare(right.skill));

    const trend = majorityTrend(group.skills.map((entry) => ({ occupation: group.occupation, skill: entry.skill, trend_direction: entry.trend })) as CareerRecordLike[]);
    const label = insight?.labels?.[locale] ?? insight?.occupation ?? group.occupation;

    const reasons: string[] = [];
    const topMatched = matchedEntries
      .slice()
      .sort((left, right) => weightOf(right.skill) - weightOf(left.skill) || left.skill.localeCompare(right.skill))
      .slice(0, 2)
      .map((entry) => entry.skill);
    if (topMatched.length) {
      reasons.push(REASONS.matched[locale](joinList(topMatched, locale)));
    }
    const topGaps = gaps.slice(0, 2).map((gap) => gap.skill);
    if (topGaps.length) {
      reasons.push(REASONS.gap[locale](joinList(topGaps, locale), gaps.reduce((sum, gap) => sum + gap.hours, 0)));
    }
    reasons.push(
      trend === 'rising'
        ? REASONS.trendRising[locale]()
        : trend === 'declining'
          ? REASONS.trendDeclining[locale]()
          : REASONS.trendStable[locale](),
    );

    matches.push({
      occupation: group.occupation,
      requiredSkills: required.map((entry) => entry.skill),
      matchingSkills: matchedEntries.map((entry) => entry.skill),
      missingSkills: missingEntries.map((entry) => entry.skill),
      score,
      label,
      fit: fitOf(score),
      gaps,
      gapHours: gaps.reduce((sum, gap) => sum + gap.hours, 0),
      reasons,
      confidence: confidenceOf(parsed.length, recognizedSkills.length, matchedEntries.length, required.length),
      sdgTags: insight?.sdgTags ? [...insight.sdgTags] : [],
      trend,
    });
  }

  matches.sort((left, right) => right.score - left.score || right.confidence - left.confidence || left.label.localeCompare(right.label));

  return {
    status: 'ok',
    message: '',
    matches,
    recognizedSkills,
    unknownSkills,
  };
}

/** 给 P4 用：只想要某个岗位的 SDG 标签文案 */
export function sdgLabelsFor(match: CareerMatch, locale: string = 'en'): string[] {
  return match.sdgTags.map((id) => sdgLabel(id, locale));
}

// ---------------------------------------------------------------------------
// 岗位数据（由 build.mjs 从 data 源生成，不要手改；改数据请改 build.mjs 后重新生成）
// ---------------------------------------------------------------------------
/**
 * 每个岗位的补充信息：三语名称、SDG 标签、技能权重（1-5）与学习工时估计。
 * key 一律用小写岗位名，和 skills-occupations.csv 的 occupation 列一一对应。
 */
export const OCCUPATION_INSIGHTS: Record<string, OccupationInsight> = {
  "learning experience designer": {
    occupation: "Learning Experience Designer",
    labels: { en: "Learning Experience Designer", zh: "学习体验设计师", bm: "Pereka Pengalaman Pembelajaran" },
    sdgTags: [4, 8],
    skills: {
    "Learning design": { weight: 5, hours: 40 },
    "Communication": { weight: 4, hours: 24 },
    "Facilitation": { weight: 4, hours: 20 },
    "Content planning": { weight: 3, hours: 16 },
    "Learning evaluation": { weight: 3, hours: 20 },
    },
  },
  "sustainability program coordinator": {
    occupation: "Sustainability Program Coordinator",
    labels: { en: "Sustainability Program Coordinator", zh: "可持续发展项目协调员", bm: "Penyelaras Program Kelestarian" },
    sdgTags: [13, 11],
    skills: {
    "Project coordination": { weight: 5, hours: 30 },
    "Stakeholder support": { weight: 4, hours: 20 },
    "Impact measurement": { weight: 4, hours: 28 },
    "Research": { weight: 3, hours: 16 },
    "Climate literacy": { weight: 3, hours: 20 },
    },
  },
  "customer insights associate": {
    occupation: "Customer Insights Associate",
    labels: { en: "Customer Insights Associate", zh: "客户洞察专员", bm: "Eksekutif Wawasan Pelanggan" },
    sdgTags: [8, 9],
    skills: {
    "Pattern recognition": { weight: 5, hours: 30 },
    "Qualitative research methods": { weight: 4, hours: 30 },
    "Data visualization": { weight: 4, hours: 24 },
    "Listening": { weight: 4, hours: 16 },
    "Writing": { weight: 3, hours: 16 },
    "Research": { weight: 3, hours: 20 },
    },
  },
  "office support coordinator (illustrative)": {
    occupation: "Office Support Coordinator (illustrative)",
    labels: { en: "Office Support Coordinator (illustrative)", zh: "办公支持协调员（示例）", bm: "Penyelaras Sokongan Pejabat (ilustrasi)" },
    sdgTags: [8, 10],
    skills: {
    "Manual record handling": { weight: 4, hours: 8 },
    "Routine information processing": { weight: 4, hours: 10 },
    "Scheduling": { weight: 3, hours: 8 },
    "Document organization": { weight: 3, hours: 8 },
    },
  },
  "data analyst": {
    occupation: "Data Analyst",
    labels: { en: "Data Analyst", zh: "数据分析师", bm: "Penganalisis Data" },
    sdgTags: [8, 9],
    skills: {
    "SQL": { weight: 5, hours: 24 },
    "Statistics": { weight: 5, hours: 30 },
    "Python": { weight: 4, hours: 40 },
    "Data cleaning": { weight: 4, hours: 16 },
    "Data visualization": { weight: 4, hours: 20 },
    "Excel": { weight: 3, hours: 12 },
    },
  },
  "cybersecurity analyst": {
    occupation: "Cybersecurity Analyst",
    labels: { en: "Cybersecurity Analyst", zh: "网络安全分析师", bm: "Penganalisis Keselamatan Siber" },
    sdgTags: [9, 16],
    skills: {
    "Network security": { weight: 5, hours: 40 },
    "Security monitoring": { weight: 5, hours: 28 },
    "Incident response": { weight: 4, hours: 32 },
    "Risk assessment": { weight: 4, hours: 24 },
    "Linux": { weight: 4, hours: 30 },
    "Scripting": { weight: 3, hours: 40 },
    },
  },
  "frontend developer": {
    occupation: "Frontend Developer",
    labels: { en: "Frontend Developer", zh: "前端开发工程师", bm: "Pembangun Frontend" },
    sdgTags: [8, 9],
    skills: {
    "JavaScript": { weight: 5, hours: 40 },
    "HTML/CSS": { weight: 5, hours: 24 },
    "React": { weight: 4, hours: 40 },
    "TypeScript": { weight: 4, hours: 32 },
    "Git": { weight: 3, hours: 12 },
    "Accessibility": { weight: 3, hours: 16 },
    },
  },
  "digital marketing associate": {
    occupation: "Digital Marketing Associate",
    labels: { en: "Digital Marketing Associate", zh: "数字营销专员", bm: "Eksekutif Pemasaran Digital" },
    sdgTags: [8, 12],
    skills: {
    "Copywriting": { weight: 5, hours: 24 },
    "SEO": { weight: 4, hours: 24 },
    "Content marketing": { weight: 4, hours: 20 },
    "Analytics": { weight: 4, hours: 20 },
    "Social media": { weight: 3, hours: 16 },
    "Campaign planning": { weight: 3, hours: 20 },
    },
  },
};

// ---------------------------------------------------------------------------
// 便捷封装：直接替换原来的 calculateCareerMatches，签名保持一致
// ---------------------------------------------------------------------------
export function matchCareersForProfile(
  profileSkills: string | string[] | null | undefined,
  records: CareerRecordLike[] | null | undefined,
  locale: string = 'en',
): CareerMatch[] {
  return matchCareers(profileSkills, records, OCCUPATION_INSIGHTS, locale).matches;
}
