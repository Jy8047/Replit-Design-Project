export type PdfLanguageClassification = "SUPPORTED" | "UNSUPPORTED" | "INSUFFICIENT";

const normalize = (value: string) => value.normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase("en");
const markerSet = (words: string[]) => new Set(words.map(normalize));

// Count only ordinary function words and common resume terms as language evidence.
// Names, technical vocabulary, URLs, email addresses and numbers are intentionally
// excluded from the marker lists and URLs/emails are removed before tokenization.
const ENGLISH_MARKERS = markerSet([
  "a", "an", "and", "are", "as", "at", "by", "for", "from", "has", "have",
  "in", "is", "of", "on", "or", "the", "to", "with", "work", "experience",
  "education", "skills", "skill", "degree", "bachelor", "master", "university",
  "school", "responsible", "developed", "managed", "led", "team", "project",
  "professional", "internship", "career", "role", "years", "graduated",
  "worked", "built", "using", "currently", "data", "analysis", "communication",
  "support", "created", "leading", "across", "within", "this", "my", "our",
]);

const OTHER_LANGUAGE_MARKERS: Record<string, ReadonlySet<string>> = {
  Spanish: markerSet(["de", "la", "el", "en", "y", "con", "para", "por", "los", "las", "del", "una", "un", "experiencia", "profesional", "responsable", "educacion", "habilidades", "trabajo", "gestion", "equipo", "desarrollado"]),
  French: markerSet(["de", "la", "le", "les", "des", "du", "et", "en", "avec", "pour", "dans", "une", "un", "expérience", "professionnelle", "compétences", "travail", "responsable", "gestion", "développé"]),
  German: markerSet(["der", "die", "das", "und", "mit", "für", "von", "im", "in", "als", "eine", "einer", "erfahrung", "kenntnisse", "beruflich", "verantwortlich", "entwickelt", "team"]),
  Malay: markerSet(["dan", "yang", "di", "dengan", "untuk", "dari", "pengalaman", "kemahiran", "pendidikan", "kerja", "bertanggungjawab", "mengurus", "membangunkan", "pasukan", "saya"]),
  Portuguese: markerSet(["de", "da", "do", "e", "em", "com", "para", "por", "uma", "um", "experiência", "profissional", "habilidades", "trabalho", "responsável", "gestão", "desenvolvido", "equipe"]),
  Italian: markerSet(["di", "la", "il", "e", "con", "per", "da", "del", "della", "una", "un", "esperienza", "competenze", "professionale", "lavoro", "responsabile", "gestione", "sviluppato"]),
  Dutch: markerSet(["de", "het", "een", "en", "van", "met", "voor", "in", "op", "ervaring", "vaardigheden", "opleiding", "werk", "verantwoordelijk", "ontwikkeld", "team"]),
};

/**
 * Conservative, dependency-free heuristic over extracted PDF text only.
 *
 * A minimum of 20 letters is required before making any language decision.
 * Four or more Han characters are treated as positive Chinese script evidence.
 * Latin-script English requires at least 3 English markers and markers in at
 * least 8% of its words. Another listed language is rejected only with at least
 * 4 markers, a 20% marker ratio, and at least 1.5x its English marker count.
 * Other non-Latin scripts are rejected only when at least 4 letters from those
 * scripts are present and they make up at least half of all letters.
 *
 * This is not general language identification: short phrases, unusual writing,
 * code-heavy text, layout-damaged extraction, and languages without marker sets
 * can remain indeterminate or be misclassified. It favors avoiding false
 * rejection over identifying every unsupported language.
 */
export function classifyPdfLanguage(text: string): PdfLanguageClassification {
  const normalized = normalize(text);
  const hanCount = [...text.matchAll(/\p{Script=Han}/gu)].length;
  const kanaCount = [...text.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)].length;
  const latinTokens = normalized
    .replace(/(?:https?:\/\/|www\.)\S+/gu, " ")
    .replace(/\b[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}\b/gu, " ")
    .match(/\p{Script=Latin}+/gu) ?? [];
  const otherScriptLetters = [...text].filter(character => /\p{L}/u.test(character)
    && !/\p{Script=Latin}/u.test(character)
    && !/\p{Script=Han}/u.test(character)).length;
  const totalLetters = [...text.matchAll(/\p{L}/gu)].length;

  if (totalLetters < 20) return "INSUFFICIENT";

  // Kana distinguishes ordinary Japanese text from Chinese Han-script text.
  // A few isolated glyphs are not enough to override Chinese or English evidence.
  if (kanaCount >= 4 && kanaCount >= Math.max(4, hanCount * 0.35)) return "UNSUPPORTED";
  if (otherScriptLetters >= 4 && otherScriptLetters / totalLetters >= 0.5) return "UNSUPPORTED";

  const latinWordCount = latinTokens.length;
  const englishCount = latinTokens.filter(token => ENGLISH_MARKERS.has(token)).length;
  const competitors = Object.values(OTHER_LANGUAGE_MARKERS)
    .map(markers => latinTokens.filter(token => markers.has(token)).length);
  const strongestOtherCount = Math.max(0, ...competitors);
  const otherDominates = strongestOtherCount >= 4
    && strongestOtherCount / Math.max(latinWordCount, 1) >= 0.2
    && strongestOtherCount >= Math.max(1, englishCount) * 1.5;

  if (otherDominates) return "UNSUPPORTED";

  // A clear Chinese script signal supports Chinese-only and Chinese/English text.
  if (hanCount >= 4) return "SUPPORTED";

  if (englishCount >= 3 && englishCount / Math.max(latinWordCount, 1) >= 0.08) {
    return "SUPPORTED";
  }
  return "INSUFFICIENT";
}
