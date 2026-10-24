import { normalizeSkill, parseSkills } from './career-matching.ts';

// Conservative translations of the actual source labels, not inferred skills.
// Keep these outside the frozen P2 engine and never append them to P1.skills.
const aliases: Record<string, string[]> = {
  'Critical Thinking': ['批判性思维', 'pemikiran kritis'],
  'Reading Comprehension': ['阅读理解', 'pemahaman bacaan'],
  'Active Learning': ['主动学习', 'pembelajaran aktif'],
  'Active Listening': ['积极倾听', '主动倾听', 'pendengaran aktif'],
  'Speaking': ['口头表达', 'pertuturan'],
  'Programming': ['编程', 'pengaturcaraan'],
  'Complex Problem Solving': ['复杂问题解决', 'penyelesaian masalah kompleks'],
  'Systems Analysis': ['系统分析', 'analisis sistem'],
  'Judgment and Decision Making': ['判断与决策', 'pertimbangan dan pembuatan keputusan'],
  'Computers and Electronics': ['计算机与电子学', 'komputer dan elektronik'],
  'Mathematics': ['数学', 'matematik'],
  'Customer and Personal Service': ['客户与个人服务', 'perkhidmatan pelanggan dan peribadi'],
  'English Language': ['英语', 'bahasa inggeris'],
  'Design': ['设计', 'reka bentuk'],
  'Engineering and Technology': ['工程与技术', 'kejuruteraan dan teknologi'],
  'Economics and Accounting': ['经济学与会计', 'ekonomi dan perakaunan'],
  'Administration and Management': ['行政与管理', 'pentadbiran dan pengurusan'],
  'Administrative': ['行政事务', 'pentadbiran'],
  'Law and Government': ['法律与政府', 'undang-undang dan kerajaan'],
  'Mechanical': ['机械学', 'mekanikal'],
  'Building and Construction': ['建筑与施工', 'bangunan dan pembinaan'],
  'Production and Processing': ['生产与加工', 'pengeluaran dan pemprosesan'],
  'Quality Control Analysis': ['质量控制分析', 'analisis kawalan kualiti'],
  'Operations Monitoring': ['作业监控', 'pemantauan operasi'],
  'Medicine and Dentistry': ['医学与牙科学', 'perubatan dan pergigian'],
  'Psychology': ['心理学', 'psikologi'],
  'Biology': ['生物学', 'biologi'],
  'Chemistry': ['化学', 'kimia'],
  'Therapy and Counseling': ['治疗与咨询', 'terapi dan kaunseling'],
  'Service Orientation': ['服务导向', 'orientasi perkhidmatan'],
  'Social Perceptiveness': ['社会感知', 'kepekaan sosial'],
  'Coordination': ['协调', 'penyelarasan'],
  'Geography': ['地理学', 'geografi'],
  'Science': ['科学', 'sains'],
  'Education and Training': ['教育与培训', 'pendidikan dan latihan'],
  'Instructing': ['指导教学', 'pengajaran'],
  'Learning Strategies': ['学习策略', 'strategi pembelajaran'],
  'Personnel and Human Resources': ['人员与人力资源', 'personel dan sumber manusia'],
  'Management of Personnel Resources': ['人力资源管理', 'pengurusan sumber manusia'],
  'Fine Arts': ['美术', 'seni halus'],
  'Communications and Media': ['传播与媒体', 'komunikasi dan media'],
  'Sales and Marketing': ['销售与营销', 'jualan dan pemasaran'],
  'Transportation': ['运输', 'pengangkutan'],
  'Time Management': ['时间管理', 'pengurusan masa'],
  'Negotiation': ['谈判', 'perundingan'],
  'Telecommunications': ['电信', 'telekomunikasi'],
};
const lookup = new Map<string, string>();
for (const [canonical, variants] of Object.entries(aliases)) {
  for (const variant of variants) lookup.set(normalizeSkill(variant), canonical);
}
export function normalizeCatalogProfileSkills(input: string | string[]): string[] {
  return parseSkills(input).map(skill => lookup.get(skill) ?? skill);
}
export function localizedCatalogSkill(skill: string, locale: 'en' | 'zh' | 'ms'): string {
  const key = Object.keys(aliases).find(name => normalizeSkill(name) === normalizeSkill(skill));
  return key && locale !== 'en' ? aliases[key][locale === 'zh' ? 0 : aliases[key].length - 1] : skill;
}
