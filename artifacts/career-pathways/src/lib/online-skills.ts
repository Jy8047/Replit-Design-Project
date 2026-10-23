/**
 * Online-only input boundary. Each nonempty line in the dedicated skills field
 * is an explicit list item (optionally prefixed by -, * or •), not CV prose.
 * Match the PDF simulator's delimiter and NFKC/case-insensitive duplicate rules.
 * Keep the first spelling and all other skill punctuation; never infer skills.
 * Callers retain the raw draft and only save this string after confirmation.
 */
export function normalizeOnlineSkills(raw: string): string {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const line of raw.split(/\r\n?|\n/u)) {
    for (const item of line.replace(/^\s*[-*•]\s+/u, '').split(/[,，;；]/u)) {
      const skill = item.trim();
      const identity = skill.normalize('NFKC').toLowerCase();
      if (!skill || seen.has(identity)) continue;
      seen.add(identity);
      skills.push(skill);
    }
  }
  return skills.join(', ');
}
