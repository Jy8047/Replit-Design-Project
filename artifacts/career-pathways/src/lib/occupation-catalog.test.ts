import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { combineCareerDatasets, calculateCareerMatches, explainCareerMatches, parseCareerCsv, getVerifiedCitation } from './career-data.ts';
import { occupationCatalog, validateOccupationCatalog } from './occupation-catalog.ts';
import { normalizeSkill } from './career-matching.ts';
import { calculateScenarioResults, getOccupationGoalMappings } from './career-planning.ts';
import { normalizeCatalogProfileSkills } from './occupation-skill-aliases.ts';

const read = (file: string) => readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8');
const originalCsv = read('skills-occupations.csv');
const officialCsv = read('official-occupations.csv');
const dataset = combineCareerDatasets(originalCsv, officialCsv);
const catalog = occupationCatalog.occupations;
const rowsFor = (occupation: string) => dataset.records.filter(row => row.occupation === occupation);

describe('reviewed occupation expansion', () => {
  it('validates 48 distinct sourced classifications in eight six-role categories', () => {
    assert.deepEqual(validateOccupationCatalog(occupationCatalog), []);
    assert.equal(catalog.length, 48);
    assert.equal(new Set(catalog.map(role => role.id)).size, 48);
    assert.equal(new Set(catalog.map(role => role.onetCode)).size, 48);
    assert.equal(new Set(catalog.map(role => role.occupation.toLowerCase())).size, 48);
    const categories = new Map<string, number>();
    for (const role of catalog) categories.set(role.category.en, (categories.get(role.category.en) ?? 0) + 1);
    assert.equal(categories.size, 8);
    assert.ok([...categories.values()].every(count => count === 6));
  });

  it('loads both real app CSVs: 52 roles, 473 verified associations and 20 unchanged synthetic rows', () => {
    assert.deepEqual(dataset.errors, []);
    assert.equal(dataset.records.length, 493);
    assert.equal(new Set(dataset.records.map(row => row.occupation)).size, 52);
    assert.equal(dataset.records.filter(row => row.catalog).length, 473);
    assert.equal(dataset.records.filter(row => row.recordStatus === 'synthetic').length, 20);
    assert.deepEqual(dataset.records.filter(row => !row.catalog), parseCareerCsv(originalCsv).records);
    for (const row of dataset.records.filter(row => row.catalog)) {
      const citation = getVerifiedCitation(row);
      assert.equal(citation?.publicationDate, '2026-08-25');
      assert.match(citation?.sourceUrl ?? '', /^https:\/\/www\.onetcenter\.org\/dl_files\/database\/db_31_0_csv\/.+\.csv$/);
      assert.match(row.evidence, /No trend evidence/);
    }
  });

  it('has no empty skills, canonical duplicates, repeated records or identical full competency sets', () => {
    const pairs = dataset.records.map(row => `${row.occupation.toLowerCase()}::${normalizeSkill(row.skill)}`);
    assert.equal(new Set(pairs).size, pairs.length);
    const signatures = new Set<string>();
    for (const role of catalog) {
      const skills = role.skills.map(skill => normalizeSkill(skill.name));
      assert.ok(skills.every(Boolean), role.id);
      assert.equal(new Set(skills).size, skills.length, role.id);
      const signature = skills.sort().join('|');
      assert.ok(!signatures.has(signature), role.id);
      signatures.add(signature);
    }
  });

  it('can match every source competency and scores every fully covered occupation at 100', () => {
    for (const role of catalog) {
      const rows = rowsFor(role.occupation);
      assert.equal(rows.length, role.skills.length);
      for (const skill of role.skills) {
        const match = calculateCareerMatches(skill.name, rows)[0];
        assert.ok(match.score > 0 && match.matchingSkills.includes(skill.name), `${role.id}: ${skill.name}`);
      }
      const match = calculateCareerMatches(role.skills.map(skill => skill.name), rows)[0];
      assert.equal(match.score, 100, role.id);
      assert.deepEqual(match.missingSkills, []);
    }
  });

  it('changes recommendations between fictional software and clinical laboratory profiles', () => {
    const software = catalog.find(role => role.onetCode === '15-1252.00')!;
    const clinical = catalog.find(role => role.onetCode === '29-2011.00')!;
    const a = calculateCareerMatches(software.skills.map(skill => skill.name), dataset.records);
    const b = calculateCareerMatches(clinical.skills.map(skill => skill.name), dataset.records);
    assert.notEqual(a[0].occupation, b[0].occupation);
    assert.equal(a.find(role => role.occupation === software.occupation)?.score, 100);
    assert.equal(b.find(role => role.occupation === clinical.occupation)?.score, 100);
    assert.ok(a.find(role => role.occupation === clinical.occupation)!.score < 100);
    assert.ok(b.find(role => role.occupation === software.occupation)!.score < 100);
  });

  it('matches conservative EN/ZH/MS translations identically without altering the profile', () => {
    const inputs = [
      'Programming, Computers and Electronics, Mathematics',
      '编程，计算机与电子学，数学',
      'pengaturcaraan; komputer dan elektronik; matematik',
    ];
    const scores = inputs.map(input => calculateCareerMatches(input, dataset.records)
      .map(match => [match.occupation, match.score]));
    assert.deepEqual(scores[0], scores[1]);
    assert.deepEqual(scores[0], scores[2]);
    assert.equal(inputs[1], '编程，计算机与电子学，数学');
    assert.deepEqual(normalizeCatalogProfileSkills('未声明技能'), ['未声明技能']);
    for (const locale of ['en', 'zh', 'ms'] as const) {
      const match = explainCareerMatches('Programming', dataset.records, locale).find(row => row.catalog)!;
      assert.equal(match.label, match.catalog!.labels[locale]);
      assert.ok(match.reasons.length);
    }
  });

  it('preserves original P2 weighted scores, including 42 and 87', () => {
    const first = calculateCareerMatches('Communication, Facilitation', dataset.records);
    assert.equal(first.find(row => row.occupation === 'Learning Experience Designer')?.score, 42);
    const second = calculateCareerMatches('Listening, Writing, Pattern recognition, Qualitative research methods, Data visualization', dataset.records);
    assert.equal(second.find(row => row.occupation === 'Customer Insights Associate')?.score, 87);
  });

  it('keeps unknown market trends neutral in both scenarios and removes factual demand assertions', () => {
    const input = 'Python, SQL, Programming, Mathematics';
    const moderate = calculateScenarioResults(input, dataset.records, 'moderate');
    const fast = calculateScenarioResults(input, dataset.records, 'fast');
    for (const role of catalog) {
      const a = moderate.find(row => row.occupation === role.occupation)!;
      const b = fast.find(row => row.occupation === role.occupation)!;
      assert.equal(a.scenarioIndex, b.scenarioIndex);
      assert.equal(a.scenarioIndex, a.overlapScore);
      assert.equal(a.adjustment, 0);
      assert.equal(a.unknownTrendSkills.length, role.skills.length);
      assert.deepEqual(a.stableSkills, []);
    }
    for (const match of calculateCareerMatches(input, dataset.records).filter(row => row.catalog)) {
      assert.equal(match.trendEvidenceStatus, 'unknown');
      assert.match(match.reasons.at(-1)!, /Market trend unknown/);
      assert.ok(!match.reasons.some(reason => /Demand.*(?:rising|stable|declining)/i.test(reason)));
    }
  });

  it('passes snake_case trend fields at the boundary instead of the previous accidental rising default', () => {
    const original = parseCareerCsv(originalCsv).records;
    const office = calculateCareerMatches('Scheduling', original)
      .find(row => row.occupation === 'Office Support Coordinator (illustrative)')!;
    // The two declining and two stable synthetic rows use P2's existing tie rule.
    assert.equal(office.trend, 'stable');
    assert.equal(office.trendEvidenceStatus, 'synthetic');
    assert.match(office.reasons.at(-1)!, /synthetic example/);
  });

  it('supplies valid skill-specific conditional SDG explanations for all 48 occupations', () => {
    for (const role of catalog) {
      const mappings = getOccupationGoalMappings(role.occupation);
      assert.ok(mappings.length > 0, role.id);
      for (const mapping of mappings) {
        assert.ok(mapping.goalNumber >= 1 && mapping.goalNumber <= 17);
        assert.equal(mapping.officialUrl, `https://sdgs.un.org/goals/goal${mapping.goalNumber}`);
        assert.equal(mapping.relationship, 'conditional');
        assert.ok(mapping.relevantSkills.every(skill => role.skills.some(item => item.name === skill)));
        for (const locale of ['en', 'zh', 'ms'] as const) assert.ok(mapping.localizedRationale![locale].length > 40);
        assert.match(mapping.rationale, /not a measured outcome/);
      }
    }
    assert.deepEqual(getOccupationGoalMappings('Not an occupation'), []);
  });

  it('rejects missing envelopes, duplicated identities, invalid sources, dates, skills and SDGs', () => {
    assert.ok(validateOccupationCatalog(null).length);
    assert.ok(validateOccupationCatalog({ schemaVersion: 1 }).length);
    for (const mutate of [
      (copy: typeof occupationCatalog) => { copy.occupations[1].id = copy.occupations[0].id; },
      (copy: typeof occupationCatalog) => { copy.occupations[0].description = ''; },
      (copy: typeof occupationCatalog) => { copy.sources[0].url = 'javascript:alert(1)'; },
      (copy: typeof occupationCatalog) => { copy.publishedOn = '2026-02-30'; },
      (copy: typeof occupationCatalog) => { copy.occupations[0].sdgs[0].goal = 18; },
      (copy: typeof occupationCatalog) => { copy.occupations[0].sdgs[0].rationale.zh = ''; },
      (copy: typeof occupationCatalog) => { copy.occupations[0].skills.push(copy.occupations[0].skills[0]); },
    ]) {
      const copy = structuredClone(occupationCatalog);
      mutate(copy);
      assert.ok(validateOccupationCatalog(copy).length);
    }
  });

  it('does not accept forged source URLs or unknown occupations as verified catalog records', () => {
    const altered = officialCsv.replace(
      'https://www.onetcenter.org/dl_files/database/db_31_0_csv/essential_skills.csv',
      'https://example.invalid/pretend-source.csv',
    );
    const result = combineCareerDatasets(originalCsv, altered);
    assert.ok(result.errors.some(error => error.includes('Unsubstantiated official association')));
    assert.equal(result.records.length, dataset.records.length - catalog[0].skills.length);
    const unknown = officialCsv.replace('Software Developers', 'Made Up Occupation');
    assert.ok(combineCareerDatasets(originalCsv, unknown).errors.length);
  });

  it('omits an incomplete official occupation instead of recommending it on a silently reduced skill set', () => {
    const lines = officialCsv.trim().split(/\r?\n/);
    const missingRow = [lines[0], ...lines.slice(2)].join('\n');
    const result = combineCareerDatasets(originalCsv, missingRow);
    assert.ok(result.errors.some(error => error.includes('Incomplete official occupation')));
    assert.ok(!result.records.some(row => row.occupation === catalog[0].occupation));
    assert.equal(result.records.filter(row => row.recordStatus === 'synthetic').length, 20);
  });
});
