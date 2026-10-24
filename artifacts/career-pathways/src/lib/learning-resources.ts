import { generateCatalog } from './learning-catalog';
import { getCourseLevel, type CourseLevel } from './course-levels';

export type Category =
  | 'Python' | 'Networking' | 'Cloud' | 'Web Security' | 'Cybersecurity'
  | 'Front-end' | 'Data Analytics' | 'Back-end' | 'UI/UX';

export interface Resource {
  id: string;
  skill: string;
  resourceName: string;
  provider: string;
  url: string;
  embedUrl: string | null;
  estimatedHours: number;
  cost: 'Free';
  level: CourseLevel;
  kind: 'video' | 'document';
  category: Category;
  embedding: 'allowed' | 'blocked' | 'external';
  embeddingNote: string;
}

// Public URLs and response frame policies checked 2026-10-23.
// Hours include suggested study/practice time, not just video runtime.
const doc = (
  id: string, skill: string, resourceName: string, provider: string,
  url: string, estimatedHours: number, category: Category,
  framePolicy = 'The provider blocks third-party embedding through X-Frame-Options or CSP.',
): Resource => ({
  id, skill, resourceName, provider, url, estimatedHours, category, level: getCourseLevel(skill, id),
  embedUrl: null, cost: 'Free', kind: 'document', embedding: 'blocked',
  embeddingNote: framePolicy,
});

const video = (
  id: string, skill: string, resourceName: string,
  youtubeId: string, estimatedHours: number, category: Category,
): Resource => ({
  id, skill, resourceName, provider: 'freeCodeCamp', level: getCourseLevel(skill, id),
  url: `https://www.youtube.com/watch?v=${youtubeId}`,
  embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
  estimatedHours, category, cost: 'Free', kind: 'video', embedding: 'allowed',
  embeddingNote: 'Public YouTube embed. Availability may vary by region, browser, or publisher settings.',
});

const externalDoc = (...args: Parameters<typeof doc>): Resource => ({
  ...doc(...args),
  embedding: 'external',
  embeddingNote: 'Open this free resource on its original website. In-app embedding is not enabled for this provider.',
});

const baseResources: readonly Resource[] = [
  video('python-video', 'Python', 'Learn Python — Full Course for Beginners', 'rfscVS0vtbw', 6, 'Python'),
  {
    ...doc('python-official', 'Python', 'The Python Tutorial', 'Python Software Foundation',
      'https://docs.python.org/3/tutorial/', 8, 'Python'),
    embedUrl: 'https://docs.python.org/3/tutorial/',
    embedding: 'allowed',
    embeddingNote: 'No frame-blocking response header was observed. Open in a new window if this browser cannot display it.',
  },
  doc('python-w3', 'Python', 'Python Tutorial', 'W3Schools', 'https://www.w3schools.com/python/', 5, 'Python'),
  doc('python-lists', 'Python Lists', 'Python Lists', 'W3Schools', 'https://www.w3schools.com/python/python_lists.asp', 1, 'Python'),
  doc('python-functions', 'Python Functions', 'Python Functions', 'W3Schools', 'https://www.w3schools.com/python/python_functions.asp', 1.5, 'Python'),
  video('networking-video', 'Networking', 'Computer Networking — Network Engineering', 'qiQR5rTSshw', 10, 'Networking'),
  doc('internet-mdn', 'Internet', 'How does the Internet work?', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work', 1, 'Networking'),
  doc('http-mdn', 'HTTP', 'An overview of HTTP', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview', 2, 'Networking'),
  doc('dns-mdn', 'DNS', 'DNS — Domain Name System', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Glossary/DNS', 0.5, 'Networking'),
  doc('cloud-ms', 'Cloud', 'Describe cloud computing', 'Microsoft Learn',
    'https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/', 2, 'Cloud'),
  doc('aws-overview', 'AWS', 'Overview of Amazon Web Services', 'AWS',
    'https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html', 3, 'Cloud'),
  doc('gcp-overview', 'Google Cloud', 'Google Cloud overview', 'Google Cloud',
    'https://docs.cloud.google.com/docs/overview', 2, 'Cloud'),
  doc('docker-start', 'Docker', 'Get started with Docker', 'Docker',
    'https://docs.docker.com/get-started/', 4, 'Cloud'),
  doc('security-mdn', 'Web Security', 'Web security', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Web/Security', 3, 'Web Security'),
  doc('owasp-top-ten', 'OWASP', 'OWASP Top 10', 'OWASP',
    'https://owasp.org/projects/top-ten', 3, 'Web Security'),
  doc('sql-injection', 'SQL Injection', 'SQL injection', 'PortSwigger Web Security Academy',
    'https://portswigger.net/web-security/sql-injection', 3, 'Web Security'),
  doc('xss-academy', 'XSS', 'Cross-site scripting (XSS)', 'PortSwigger Web Security Academy',
    'https://portswigger.net/web-security/cross-site-scripting', 3, 'Web Security'),
  externalDoc('network-security-cisco', 'Network Security', 'Network Defense', 'Cisco Networking Academy',
    'https://www.netacad.com/courses/network-defense', 27, 'Cybersecurity'),
  externalDoc('linux-basics', 'Linux Basics', 'Learning the Shell', 'LinuxCommand.org',
    'https://linuxcommand.org/lc3_learning_the_shell.php', 5, 'Cybersecurity'),
  externalDoc('cryptography-khan', 'Cryptography', 'Cryptography', 'Khan Academy',
    'https://www.khanacademy.org/computing/computer-science/cryptography', 4, 'Cybersecurity'),
  doc('html-mdn', 'HTML', 'Structuring content with HTML', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content', 4, 'Front-end'),
  doc('css-mdn', 'CSS', 'Styling with CSS', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics', 5, 'Front-end'),
  doc('javascript-mdn', 'JavaScript', 'JavaScript Guide', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', 8, 'Front-end'),
  doc('git-github', 'Git', 'Git Handbook', 'GitHub',
    'https://docs.github.com/en/get-started/using-git/about-git', 2, 'Front-end'),
  doc('accessibility-mdn', 'Web Accessibility', 'Accessibility', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Web/Accessibility', 3, 'Front-end'),
  externalDoc('sql-khan', 'SQL', 'Intro to SQL: Querying and managing data', 'Khan Academy',
    'https://www.khanacademy.org/computing/computer-programming/sql', 5, 'Data Analytics'),
  doc('excel-w3', 'Excel', 'Excel Tutorial', 'W3Schools',
    'https://www.w3schools.com/excel/', 4, 'Data Analytics'),
  externalDoc('statistics-khan', 'Statistics', 'Statistics and probability', 'Khan Academy',
    'https://www.khanacademy.org/math/statistics-probability', 8, 'Data Analytics'),
  doc('data-analysis-python', 'Data Analysis', 'Data Analysis with Python', 'freeCodeCamp',
    'https://www.freecodecamp.org/learn/data-analysis-with-python/', 10, 'Data Analytics'),
  externalDoc('nodejs', 'Node.js', 'Introduction to Node.js', 'Node.js',
    'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs', 4, 'Back-end'),
  doc('rest-api', 'REST APIs', 'What is a REST API?', 'MDN Web Docs',
    'https://developer.mozilla.org/en-US/docs/Glossary/REST', 2, 'Back-end'),
  doc('postgresql', 'Databases', 'PostgreSQL Tutorial', 'PostgreSQL',
    'https://www.postgresql.org/docs/current/tutorial.html', 5, 'Back-end'),
  externalDoc('expressjs', 'Express.js', 'Express.js Guide', 'Express',
    'https://expressjs.com/en/guide/routing.html', 4, 'Back-end'),
  doc('ux-design-figma', 'UX Design', 'What is UX design?', 'Figma',
    'https://www.figma.com/resource-library/what-is-ux-design/', 2, 'UI/UX'),
  doc('wireframing', 'Wireframing', 'Wireframing and Prototyping', 'Figma Resource Library',
    'https://www.figma.com/resource-library/prototype-and-wireframe/', 2, 'UI/UX'),
  doc('usability', 'Usability', '10 Usability Heuristics for User Interface Design', 'Nielsen Norman Group',
    'https://www.nngroup.com/articles/ten-usability-heuristics/', 2, 'UI/UX'),
  externalDoc('design-accessibility', 'Accessibility', 'Accessibility Fundamentals Overview', 'W3C WAI',
    'https://www.w3.org/WAI/fundamentals/accessibility-intro/', 2, 'UI/UX'),
];

export interface CareerProfile {
  id: string;
  targetRole: string;
  skillGaps: string[];
  skills: { skill: string; courses: Resource[] }[];
}

export const { resources, careerProfiles } = generateCatalog(baseResources);
