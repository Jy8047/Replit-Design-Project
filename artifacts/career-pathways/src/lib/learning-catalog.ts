import type { Category, CareerProfile, Resource } from './learning-resources';
import { courseSupplements } from './learning-resource-supplements';
import { getCourseLevel } from './course-levels';

type FamilySeed = {
  id: string; category: Category; roles: string[]; foundation: [string, string];
  skills: [string, string][];
};

// Reusable, public reference/tutorial seeds, not fabricated unique paid courses.
// Ten real role titles per family x eight families = 80 generated profiles.
const families: FamilySeed[] = [
  {
    id: 'frontend', category: 'Front-end',
    roles: ['Front-end Developer', 'React Developer', 'Vue Developer', 'Angular Developer', 'Next.js Developer', 'Web Accessibility Engineer', 'Web Performance Engineer', 'Design Systems Engineer', 'JavaScript Developer', 'TypeScript Developer'],
    foundation: ['Frontend foundations — MDN', 'https://developer.mozilla.org/en-US/docs/Learn_web_development'],
    skills: [
      ['HTML', 'https://www.w3schools.com/html/'], ['CSS', 'https://www.w3schools.com/css/'],
      ['JavaScript', 'https://javascript.info/'], ['TypeScript', 'https://www.typescriptlang.org/docs/handbook/intro.html'],
      ['React', 'https://react.dev/learn'], ['Vue', 'https://vuejs.org/guide/introduction.html'],
      ['Angular', 'https://angular.dev/tutorials'], ['Next.js', 'https://nextjs.org/learn'],
      ['Web Accessibility', 'https://www.w3.org/WAI/tutorials/'], ['Web Performance', 'https://web.dev/learn/performance'],
      ['Git', 'https://git-scm.com/book/en/v2'],
    ],
  },
  {
    id: 'backend', category: 'Back-end',
    roles: ['Back-end Developer', 'Node.js Developer', 'Python Backend Developer', 'Java Backend Developer', 'Go Developer', 'API Engineer', 'Database Developer', 'Microservices Engineer', 'Django Developer', 'Full-stack Developer'],
    foundation: ['Server-side development — MDN', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side'],
    skills: [
      ['Node.js', 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs'],
      ['REST APIs', 'https://www.freecodecamp.org/news/rest-api-best-practices-rest-endpoint-design-examples/'],
      ['Databases', 'https://www.postgresql.org/docs/current/tutorial.html'], ['Express.js', 'https://expressjs.com/en/starter/hello-world.html'],
      ['Django', 'https://docs.djangoproject.com/en/stable/intro/tutorial01/'], ['Java', 'https://dev.java/learn/'],
      ['Go', 'https://go.dev/tour/'], ['API Authentication', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication'],
      ['Caching', 'https://redis.io/docs/latest/develop/get-started/'], ['Software Testing', 'https://docs.pytest.org/en/stable/getting-started.html'],
      ['Git', 'https://git-scm.com/book/en/v2'], ['Python', 'https://docs.python.org/3/tutorial/'],
    ],
  },
  {
    id: 'data', category: 'Data Analytics',
    roles: ['Data Analyst', 'Business Intelligence Analyst', 'Analytics Engineer', 'Data Engineer', 'Product Analyst', 'Marketing Data Analyst', 'Financial Data Analyst', 'Data Visualization Developer', 'Database Analyst', 'Statistical Analyst'],
    foundation: ['Data analysis with Python — freeCodeCamp', 'https://www.freecodecamp.org/learn/data-analysis-with-python/'],
    skills: [
      ['SQL', 'https://www.w3schools.com/sql/'], ['Excel', 'https://www.w3schools.com/excel/'],
      ['Statistics', 'https://www.khanacademy.org/math/statistics-probability'], ['Data Analysis', 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/'],
      ['Python', 'https://docs.python.org/3/tutorial/'], ['Pandas', 'https://pandas.pydata.org/docs/user_guide/10min.html'],
      ['Data Visualization', 'https://matplotlib.org/stable/tutorials/index.html'], ['Data Modeling', 'https://www.postgresql.org/docs/current/ddl.html'],
      ['ETL Pipelines', 'https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html'],
      ['Data Quality', 'https://docs.greatexpectations.io/docs/core/introduction/'],
    ],
  },
  {
    id: 'ai', category: 'Data Analytics',
    roles: ['AI Engineer', 'Machine Learning Engineer', 'Deep Learning Engineer', 'NLP Engineer', 'Computer Vision Engineer', 'Generative AI Engineer', 'LLM Engineer', 'MLOps Engineer', 'AI Research Engineer', 'Applied Scientist'],
    foundation: ['Machine learning crash course — Google', 'https://developers.google.com/machine-learning/crash-course'],
    skills: [
      ['Machine Learning', 'https://scikit-learn.org/stable/getting_started.html'],
      ['Deep Learning', 'https://www.deeplearningbook.org/'], ['Neural Networks', 'https://playground.tensorflow.org/'],
      ['PyTorch', 'https://pytorch.org/tutorials/beginner/basics/intro.html'], ['TensorFlow', 'https://www.tensorflow.org/tutorials'],
      ['Natural Language Processing', 'https://huggingface.co/learn/nlp-course/chapter1/1'],
      ['Computer Vision', 'https://www.tensorflow.org/tutorials/images/classification'],
      ['Large Language Models', 'https://huggingface.co/learn/llm-course/chapter1/1'],
      ['Model Evaluation', 'https://scikit-learn.org/stable/modules/model_evaluation.html'],
      ['Linear Algebra', 'https://www.khanacademy.org/math/linear-algebra'],
    ],
  },
  {
    id: 'operations', category: 'Cloud',
    roles: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer', 'Platform Engineer', 'Kubernetes Engineer', 'Infrastructure Engineer', 'Cloud Solutions Architect', 'Systems Administrator', 'Release Engineer', 'Observability Engineer'],
    foundation: ['Cloud computing foundations — Microsoft Learn', 'https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/'],
    skills: [
      ['Linux Basics', 'https://linuxcommand.org/lc3_learning_the_shell.php'], ['Docker', 'https://docs.docker.com/get-started/'],
      ['Kubernetes', 'https://kubernetes.io/docs/tutorials/kubernetes-basics/'],
      ['Terraform', 'https://developer.hashicorp.com/terraform/tutorials'], ['CI/CD', 'https://docs.github.com/en/actions/get-started/quickstart'],
      ['Monitoring', 'https://prometheus.io/docs/tutorials/getting_started/'],
      ['Cloud', 'https://docs.cloud.google.com/docs/overview'], ['AWS', 'https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html'],
      ['Networking', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work'],
      ['Incident Response', 'https://sre.google/sre-book/managing-incidents/'],
    ],
  },
  {
    id: 'design', category: 'UI/UX',
    roles: ['UI/UX Designer', 'Product Designer', 'UX Researcher', 'Interaction Designer', 'Visual Designer', 'Service Designer', 'UX Writer', 'Design Technologist', 'Accessibility Designer', 'Information Architect'],
    foundation: ['UX design foundations — Figma', 'https://www.figma.com/resource-library/what-is-ux-design/'],
    skills: [
      ['UX Design', 'https://www.figma.com/resource-library/what-is-ux-design/'],
      ['Wireframing', 'https://www.figma.com/resource-library/prototype-and-wireframe/'],
      ['Usability', 'https://www.nngroup.com/articles/ten-usability-heuristics/'],
      ['Accessibility', 'https://www.w3.org/WAI/fundamentals/accessibility-intro/'],
      ['User Research', 'https://www.nngroup.com/articles/which-ux-research-methods/'],
      ['Interaction Design', 'https://www.interaction-design.org/literature/topics/interaction-design'],
      ['Typography', 'https://www.w3schools.com/css/css_font.asp'],
      ['Color Theory', 'https://www.w3schools.com/colors/'], ['Information Architecture', 'https://www.nngroup.com/articles/ia-study-guide/'],
      ['Design Systems', 'https://design-system.service.gov.uk/'],
      ['Web Accessibility', 'https://www.w3.org/WAI/tutorials/'],
    ],
  },
  {
    id: 'security', category: 'Cybersecurity',
    roles: ['Cybersecurity', 'Security Analyst', 'SOC Analyst', 'Cloud Security Engineer', 'Application Security Engineer', 'Penetration Tester', 'Security Architect', 'Network Security Engineer', 'Digital Forensics Analyst', 'Cryptography Engineer'],
    foundation: ['Web security fundamentals — MDN', 'https://developer.mozilla.org/en-US/docs/Web/Security'],
    skills: [
      ['Network Security', 'https://www.netacad.com/courses/network-defense'],
      ['Web Security', 'https://developer.mozilla.org/en-US/docs/Web/Security'],
      ['Cryptography', 'https://www.khanacademy.org/computing/computer-science/cryptography'],
      ['OWASP', 'https://owasp.org/projects/top-ten'], ['SQL Injection', 'https://portswigger.net/web-security/sql-injection'],
      ['XSS', 'https://portswigger.net/web-security/cross-site-scripting'],
      ['Threat Modeling', 'https://owasp.org/www-community/Threat_Modeling'],
      ['Digital Forensics', 'https://sleuthkit.org/autopsy/docs/user-docs/4.21.0/'],
      ['Security Logging', 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html'],
      ['Secure Coding', 'https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/'],
      ['Linux Basics', 'https://linuxcommand.org/lc3_learning_the_shell.php'], ['Python', 'https://docs.python.org/3/tutorial/'],
    ],
  },
  {
    id: 'mobile', category: 'Front-end',
    roles: ['Mobile Developer', 'Android Developer', 'iOS Developer', 'Flutter Developer', 'React Native Developer', 'Cross-platform Developer', 'Mobile UI Engineer', 'Mobile QA Engineer', 'Mobile Performance Engineer', 'Mobile Application Architect'],
    foundation: ['Mobile web foundations — web.dev', 'https://web.dev/learn/design'],
    skills: [
      ['Android', 'https://developer.android.com/courses'], ['Kotlin', 'https://kotlinlang.org/docs/getting-started.html'],
      ['Swift', 'https://www.swift.org/documentation/'], ['SwiftUI', 'https://developer.apple.com/tutorials/swiftui'],
      ['Flutter', 'https://docs.flutter.dev/get-started/learn-flutter'], ['Dart', 'https://dart.dev/tutorials'],
      ['React Native', 'https://reactnative.dev/docs/getting-started'],
      ['Responsive Design', 'https://web.dev/learn/design'], ['Mobile Testing', 'https://developer.android.com/training/testing/fundamentals'],
      ['Mobile Performance', 'https://developer.android.com/topic/performance/overview'],
    ],
  },
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function generateCatalog(base: readonly Resource[]) {
  const all = [...base];
  const pairs = new Map<string, Resource[]>();
  for (const family of families) {
    for (const [skill, url] of family.skills) {
      if (pairs.has(skill)) continue;
      const existing = base.filter(resource => resource.skill.toLowerCase() === skill.toLowerCase());
      const make = (suffix: string, title: string, link: string): Resource => ({
        id: `seed-${slug(skill)}-${suffix}`, skill, resourceName: title,
        provider: new URL(link).hostname.replace(/^www\./, ''), url: link, embedUrl: null,
        estimatedHours: 4, cost: 'Free', level: getCourseLevel(skill), kind: 'document', category: family.category,
        embedding: 'external', embeddingNote: 'Free public reference or tutorial. Open on the provider website. Study hours are demo estimates.',
      });
      const first = existing[0] ?? make('reference', `${skill} — Reference study`, url);
      let second = existing.find(resource => resource.url !== first.url);
      if (!second) {
        const link = courseSupplements[skill] ?? (url !== first.url ? url : family.foundation[1]);
        second = make('tutorial', link === url || courseSupplements[skill] ? `${skill} — Tutorial study` : family.foundation[0],
          link !== first.url ? link : 'https://www.freecodecamp.org/learn/');
      }
      pairs.set(skill, [first, second]);
      for (const resource of [first, second]) if (!all.some(item => item.id === resource.id)) all.push(resource);
    }
  }
  const careerProfiles: CareerProfile[] = families.flatMap(family => family.roles.map((targetRole, index) => {
    // Deterministic rotation changes the learning order for each specialization.
    const ordered = [...family.skills.slice(index), ...family.skills.slice(0, index)];
    const skills = ordered.map(([skill]) => ({ skill, courses: pairs.get(skill)! }));
    return { id: slug(targetRole), targetRole, skillGaps: skills.map(item => item.skill), skills };
  }));
  return { resources: all, careerProfiles };
}
