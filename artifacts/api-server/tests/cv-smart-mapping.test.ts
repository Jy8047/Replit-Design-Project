import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseCareerCsv } from "../../career-pathways/src/lib/career-data.ts";
import {
  CSV_SKILL_NAMES,
  CV_SKILL_VOCABULARY,
} from "../src/lib/cv-skill-vocabulary.ts";
import {
  extractBasics,
  extractEducation,
  extractSections,
  extractSkills,
  mapCvSmart,
} from "../src/lib/cv-smart-mapping.ts";

const dataDirectory = new URL("../../career-pathways/public/data/", import.meta.url);
const jordanResume = `Jordan Miller
jordan.miller@example.test | +60 12-345 6789 | Kuala Lumpur
EDUCATION
University of Malaya | 2020–2024
Bachelor of Science in Computer Science
Graduated 2024
PROJECTS
Northstar Analytics | Product Insights Dashboard | 2023
• Prepared monthly reporting summaries
WORK EXPERIENCE
Northstar Analytics | Data Intern | 2023–2024
• Supported report preparation and stakeholder updates
SKILLS
• Python
• SQL
• Google Analytics
• React/Node.js
LEADERSHIP
Campus Data Club | Coordinator | 2022`;

test("static vocabulary contains all 81 unique CSV skills and P2 aliases", () => {
  const actual = new Set<string>();
  for (const file of ["skills-occupations.csv", "official-occupations.csv"]) {
    const csv = readFileSync(new URL(file, dataDirectory), "utf8");
    for (const record of parseCareerCsv(csv).records) actual.add(record.skill);
  }
  assert.equal(CSV_SKILL_NAMES.length, 81);
  assert.equal(new Set(CSV_SKILL_NAMES).size, 81);
  assert.deepEqual([...CSV_SKILL_NAMES].sort(), [...actual].sort());
  assert.ok(CV_SKILL_VOCABULARY.some(skill => skill.canonical === "Network security"));
  assert.ok(CV_SKILL_VOCABULARY.find(skill => skill.canonical === "SQL")?.aliases.includes("结构化查询语言"));
  assert.ok(CV_SKILL_VOCABULARY.find(skill => skill.canonical === "JavaScript")?.aliases.includes("js"));
  assert.ok(CV_SKILL_VOCABULARY.find(skill => skill.canonical === "Network security")?.aliases.includes("keselamatan rangkaian"));
});

test("skill extraction is case-insensitive, longest-first, and removes duplicate canonical skills", () => {
  assert.deepEqual(
    extractSkills("google analytics, GOOGLE ANALYTICS; JavaScript ES6, JS"),
    ["Google Analytics", "JavaScript"],
  );
});

test("skill extraction accepts conjunctions, slashes, bullets, labels and supported delimiters", () => {
  assert.deepEqual(
    extractSkills("Skills: Python and SQL\n• React/Node.js\nExcel，Python; SQL"),
    ["Python", "SQL", "React", "JavaScript", "Excel"],
  );
});

test("skill extraction maps Chinese and Bahasa Melayu aliases to canonical names", () => {
  assert.deepEqual(
    extractSkills("结构化查询语言；Keselamatan Rangkaian, Fasilitasi、沟通能力"),
    ["SQL", "Network security", "Facilitation", "Communication"],
  );
});

test("skill extraction caps results at twenty unique skills", () => {
  const input = CSV_SKILL_NAMES.slice(0, 25).join("\n");
  assert.equal(extractSkills(input).length, 20);
  assert.deepEqual(extractSkills(input), [...CSV_SKILL_NAMES.slice(0, 20)]);
});

test("basics extracts email and phone while choosing the first eligible name line", () => {
  assert.deepEqual(
    extractBasics("jordan.miller@example.test | +60 12-345 6789\nJordan Miller\n2024"),
    {
      name: "Jordan Miller",
      email: "jordan.miller@example.test",
      phone: "+60 12-345 6789",
    },
  );
});

test("education extraction handles school, degree, major, labeled major and graduation year", () => {
  assert.deepEqual(
    extractEducation("EDUCATION\nExample Institute\nB.S. in Computer Science\nGraduated 2024"),
    {
      school: "Example Institute",
      degree: "B.S.",
      major: "Computer Science",
      graduationYear: "2024",
      graduationYearText: "Graduated 2024",
    },
  );
  assert.equal(extractEducation("大学：虚构大学\n硕士\n专业：数据科学").major, "数据科学");
});

test("section extraction returns source offsets and stops each body at the next known heading", () => {
  const text = "EDUCATION\nFictional University\n工作经历\nFictional Employer\n技能\n• Python";
  const sections = extractSections(text);
  assert.deepEqual(sections.map(section => section.kind), ["education", "employment", "skills"]);
  for (const section of sections) {
    assert.equal(text.slice(section.start, section.end).includes(section.text), true);
    assert.equal(section.contentEnd, section.end);
  }
  assert.equal(sections[0].text, "Fictional University");
  assert.equal(sections[2].text, "• Python");
});

test("Jordan Miller résumé-style sections and bullets map without Label: value fields", () => {
  const result = mapCvSmart(jordanResume, "fresh_graduate");
  assert.deepEqual(extractSkills(jordanResume.slice(jordanResume.indexOf("SKILLS"))), [
    "Python", "SQL", "Google Analytics", "React", "JavaScript",
  ]);
  assert.equal(result.name, "Jordan Miller");
  assert.equal(result.education.school, "University of Malaya | 2020–2024");
  assert.equal(result.education.degree, "Bachelor of Science");
  assert.equal(result.education.major, "Computer Science");
  assert.equal(result.academic_experience.includes("Graduated 2024"), true);
  assert.equal(result.employment_experience.includes("Northstar Analytics"), true);
  assert.deepEqual(result.matched_summary, { skills: 5, education: 4, basics: 1 });
  assert.equal(result.mapping_method, "rules-v2");
  assert.equal(result.mapping_provenance, "simulated");
  assert.equal(result.confirmed_by_user, false);
});

test("mapCvSmart does not turn education or work-history mentions into skills", () => {
  const result = mapCvSmart(
    "Jordan Miller\nEDUCATION\nBachelor of Science in Biology\nWORK EXPERIENCE\nUsed Python for a project",
    "career_switcher",
  );
  assert.equal(result.skills, "");
  assert.equal(result.education.degree, "Bachelor of Science");
  assert.equal(result.education.major, "Biology");
});

test("explicit fields still work through the legacy fallback when rules-v2 finds nothing", () => {
  const result = mapCvSmart("Interests & Hobbies: Gardening", "fresh_graduate");
  assert.equal(result.interests_and_hobbies, "Gardening");
  assert.equal(result.mapping_method, "demo-fallback");
  assert.equal(result.mapping_provenance, "simulated");
  assert.equal(result.confirmed_by_user, false);
});

test("smart output keeps the existing profile fields and does not expose extracted contact details", () => {
  const result = mapCvSmart(jordanResume, "career_switcher");
  assert.equal(typeof result.skills, "string");
  assert.equal(result.profile_type, "career_switcher");
  assert.equal(result.input_method, "pdf_upload");
  assert.equal(result.mapping_method, "rules-v2");
  assert.equal("email" in result, false);
  assert.equal("phone" in result, false);
});
