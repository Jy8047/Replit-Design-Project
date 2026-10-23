import { after, mock, test } from "node:test";
import assert from "node:assert/strict";
import { simulateCvMapping } from "../src/lib/cv-demo-mapping.ts";

mock.method(globalThis, "fetch", () => { throw new Error("Rule skills tests must remain offline"); });
after(() => mock.restoreAll());

for (const type of ["fresh_graduate", "career_switcher"] as const) {
  const map = (text: string) => {
    const result = simulateCvMapping(text, type);
    assert.equal(result.profile_type, type);
    assert.equal(result.input_method, "pdf_upload");
    assert.equal(result.mapping_provenance, "simulated");
    assert.equal(result.confirmed_by_user, false);
    assert.equal(typeof result.skills, "string");
    return result;
  };

  test(`${type}: empty first Skills does not block later nonempty labels`, () => {
    assert.equal(map("Skills:\nSkills: Python, SQL").skills, "Python, SQL");
  });
  test(`${type}: merges repeated Skills and Current Skills labels in source order`, () => {
    assert.equal(map("Skills: Python\nSchool: Fictional School\nCurrent Skills: SQL\nSkills: C++").skills, "Python, SQL, C++");
  });
  test(`${type}: accepts explicit list continuations and single-token skill names`, () => {
    assert.equal(map("Skills:\nPython\n  SQL\n- Machine Learning\n• C#\nResearch，Communication\r\nSkills: CI/CD").skills,
      "Python, SQL, Machine Learning, C#, Research, Communication, CI/CD");
  });
  test(`${type}: every known non-skill field label ends skill collection`, () => {
    for (const label of [
      "School", "Degree", "Major", "Key Courses", "Internship Experience",
      "Academic Experience", "Professional Certificates", "Personal Experience",
      "Interests & Hobbies", "Employment Experience", "Other Experience",
      "Name", "Role", "Background", "University", "Current or Recent Role",
    ]) {
      assert.equal(map(`Skills: Python\n${label}: Fictional value\nSQL`).skills, "Python", label);
    }
  });
  test(`${type}: education and experience headings never become skills`, () => {
    for (const heading of [
      "Education", "Experience", "Work Experience", "Professional Experience",
      "Employment Experience", "Projects", "Summary", "# Education", "- Experience",
      "Education:", "Experience: Fictional work", "Unknown Section: Fictional value",
    ]) {
      assert.equal(map(`Skills: Python\n${heading}\nResearch, SQL`).skills, "Python", heading);
    }
  });
  test(`${type}: normalizes only supported comma and semicolon separators`, () => {
    assert.equal(map("Skills: Python; SQL，C++；C#, CI/CD").skills, "Python, SQL, C++, C#, CI/CD");
  });
  test(`${type}: empty skill labels and empty list items remain empty`, () => {
    assert.equal(map("Skills: ,，;；\nSkills:\n\nSchool: Fictional School").skills, "");
  });
  test(`${type}: removes duplicate skills without rewriting first literal spelling`, () => {
    assert.equal(map("Skills: Python, python, PYTHON\nSkills: SQL; SQL；C++，Ｃ＋＋").skills, "Python, SQL, C++");
  });
  test(`${type}: skill-internal punctuation and spaces are not split`, () => {
    assert.equal(map("Skills: C++, C#, .NET, CI/CD, problem-solving, Machine Learning, Research & Development").skills,
      "C++, C#, .NET, CI/CD, problem-solving, Machine Learning, Research & Development");
  });
  test(`${type}: blank lines, unknown labels and ambiguous prose stop continuation`, () => {
    for (const boundary of ["", "Contact: Fictional contact", "Worked at a fictional company"]) {
      assert.equal(map(`Skills: Python\n${boundary}\nResearch, SQL`).skills, "Python");
    }
    assert.equal(map("School: Fictional School\nExperience: Python, SQL\nResearch").skills, "");
  });
  test(`${type}: other fields retain first-value behavior and are never inferred as skills`, () => {
    const result = map("School: First Fictional School\nSchool: Second School\nEmployment Experience: Python training\nAcademic Experience: SQL project");
    assert.equal(result.education.school, "First Fictional School");
    assert.equal(result.employment_experience, "Python training");
    assert.equal(result.academic_experience, "SQL project");
    assert.equal(result.skills, "");
  });
}
