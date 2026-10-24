export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export const LEVEL_ORDER: Record<CourseLevel, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};

// Editorial demo difficulty, not a provider-issued certification or rating.
const advancedSkills = new Set([
  'Deep Learning', 'Neural Networks', 'Large Language Models', 'Computer Vision',
  'Model Evaluation', 'ETL Pipelines', 'Data Quality', 'Incident Response',
  'Threat Modeling', 'Secure Coding', 'Web Performance', 'Mobile Performance',
].map(skill => skill.toLowerCase()));
const intermediateSkills = new Set([
  'TypeScript', 'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'REST APIs',
  'Databases', 'Express.js', 'Django', 'Java', 'Go', 'API Authentication',
  'Caching', 'Software Testing', 'Statistics', 'Data Analysis', 'Pandas',
  'Data Visualization', 'Data Modeling', 'Machine Learning', 'PyTorch',
  'TensorFlow', 'Natural Language Processing', 'Linear Algebra', 'Docker',
  'Kubernetes', 'Terraform', 'CI/CD', 'Monitoring', 'Network Security',
  'Cryptography', 'OWASP', 'SQL Injection', 'XSS', 'Digital Forensics',
  'Security Logging', 'User Research', 'Interaction Design',
  'Information Architecture', 'Design Systems', 'SwiftUI', 'Flutter',
  'React Native', 'Mobile Testing',
].map(skill => skill.toLowerCase()));

export function getCourseLevel(skill: string, resourceId?: string): CourseLevel {
  if (resourceId === 'python-official') return 'Intermediate';
  const normalized = skill.trim().toLowerCase();
  if (advancedSkills.has(normalized)) return 'Advanced';
  if (intermediateSkills.has(normalized)) return 'Intermediate';
  return 'Beginner';
}
