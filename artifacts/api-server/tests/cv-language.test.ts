import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPdfLanguage } from "../src/lib/pdf-language.ts";

test("accepts clear fictional English with names, technical vocabulary, URLs and numbers", () => {
  const text = `Jordan Miller
  EDUCATION: Fictional University, Bachelor of Science, 2020-2024
  WORK EXPERIENCE: I developed Python, TypeScript, PostgreSQL and Kubernetes projects.
  I managed a team with responsibility for data quality and reporting.
  Portfolio: https://portfolio.example.test/jordan | jordan@example.test`;
  assert.equal(classifyPdfLanguage(text), "SUPPORTED");
});

test("accepts Chinese-only and mixed Chinese-English extracted text", () => {
  const chinese = "教育背景：虚构大学，计算机科学学士学位。工作经历：负责数据分析、项目管理和团队协作。掌握软件开发与数据库技术。";
  const mixed = `${chinese}\nSkills: Python, SQL. Experience with data analysis and project work.`;
  assert.equal(classifyPdfLanguage(chinese), "SUPPORTED");
  assert.equal(classifyPdfLanguage(mixed), "SUPPORTED");
});

test("rejects clearly Spanish-primary content and non-supported script text", () => {
  const spanish = `Experiencia profesional en gestión de proyectos y análisis de datos.
  Responsable de coordinar equipos, desarrollar soluciones y trabajar con clientes.
  Educación y habilidades para una carrera profesional.`;
  const cyrillic = "Профессиональный опыт управления проектами и анализа данных. Ответственный за разработку решений и работу с командой.";
  assert.equal(classifyPdfLanguage(spanish), "UNSUPPORTED");
  assert.equal(classifyPdfLanguage(cyrillic), "UNSUPPORTED");
});

test("treats short, ambiguous, and technical-only text as indeterminate", () => {
  assert.equal(classifyPdfLanguage("Jordan Miller Python SQL 2026"), "INSUFFICIENT");
  assert.equal(classifyPdfLanguage("TypeScript Kubernetes PostgreSQL https://example.test 2020-2024"), "INSUFFICIENT");
  assert.equal(classifyPdfLanguage(""), "INSUFFICIENT");
});
