import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  calculateCareerMatches,
  formatPublicationDate,
  getVerifiedCitation,
  parseCareerCsv,
  REQUIRED_CSV_HEADERS,
} from './career-data.ts';

const exampleEvidence =
  'Test fixture only; this reserved example-domain URL is not a real source.';

function csvRow(values: string[]) {
  return values.join(',');
}

function createCsv(rows: string[][]) {
  return [
    REQUIRED_CSV_HEADERS.join(','),
    ...rows.map(csvRow),
  ].join('\n');
}

const synthetic = (occupation: string, skill: string) => [
  occupation,
  skill,
  'rising',
  '',
  '',
  '',
  'Synthetic test row only; not a labor-market claim.',
  'synthetic',
];

describe('parseCareerCsv', () => {
  it('loads the checked-in demonstration CSV without source claims', () => {
    const csv = readFileSync(
      new URL('../../public/data/skills-occupations.csv', import.meta.url),
      'utf8',
    );
    const result = parseCareerCsv(csv);
    assert.equal(result.records.length, 20);
    assert.deepEqual(result.errors, []);
    assert.ok(result.records.every((record) => record.recordStatus === 'synthetic'));
    assert.ok(
      result.records.every(
        (record) =>
          record.sourceName === '' &&
          record.sourceUrl === '' &&
          record.publicationDate === '',
      ),
    );
  });

  it('loads structured synthetic rows while keeping their provenance empty', () => {
    const result = parseCareerCsv(createCsv([synthetic('Role A', 'Research')]));
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].recordStatus, 'synthetic');
    assert.equal(result.records[0].sourceName, '');
    assert.equal(result.records[0].sourceUrl, '');
    assert.equal(result.records[0].publicationDate, '');
    assert.equal(getVerifiedCitation(result.records[0]), null);
    assert.deepEqual(result.errors, []);
  });

  it('rejects missing columns and reports invalid rows instead of treating them as verified', () => {
    const missingHeader = parseCareerCsv('occupation,skill\nRole A,Research');
    assert.equal(missingHeader.records.length, 0);
    assert.match(missingHeader.errors[0], /missing required columns/);

    const invalidDirection = synthetic('Role A', 'Research');
    invalidDirection[2] = 'surging';
    const invalid = parseCareerCsv(createCsv([invalidDirection]));
    assert.equal(invalid.records.length, 0);
    assert.match(invalid.errors[0], /trend_direction/);

    const missingEvidence = synthetic('Role A', 'Research');
    missingEvidence[6] = '';
    const incomplete = parseCareerCsv(createCsv([missingEvidence]));
    assert.equal(incomplete.records.length, 0);
    assert.match(incomplete.errors[0], /evidence are required/);
  });

  it('rejects synthetic rows carrying unverified source metadata', () => {
    const row = synthetic('Role A', 'Research');
    row[3] = 'Unverified source';
    const result = parseCareerCsv(createCsv([row]));
    assert.equal(result.records.length, 0);
    assert.match(result.errors[0], /synthetic rows must not include source/);
  });

  it('requires a valid source URL and real publication date for verified rows', () => {
    const verified = [
      'Role A',
      'Research',
      'stable',
      'Test fixture source',
      'https://example.org/test-record',
      '2024-02-29',
      exampleEvidence,
      'verified',
    ];
    const accepted = parseCareerCsv(createCsv([verified]));
    assert.equal(accepted.records.length, 1);
    assert.equal(accepted.records[0].sourceUrl, 'https://example.org/test-record');
    assert.equal(accepted.records[0].publicationDate, '2024-02-29');
    assert.deepEqual(getVerifiedCitation(accepted.records[0]), {
      sourceName: 'Test fixture source',
      sourceUrl: 'https://example.org/test-record',
      publicationDate: '2024-02-29',
      formattedPublicationDate: 'Feb 29, 2024',
    });

    const invalidUrl = [...verified];
    invalidUrl[4] = 'javascript:alert(1)';
    assert.match(
      parseCareerCsv(createCsv([invalidUrl])).errors[0],
      /valid http or https URL/,
    );

    const invalidDate = [...verified];
    invalidDate[5] = '2024-02-30';
    assert.match(
      parseCareerCsv(createCsv([invalidDate])).errors[0],
      /real date/,
    );
  });

  it('handles quoted commas and escaped quotes in evidence text', () => {
    const row = synthetic('Role A', 'Research');
    row[6] = '"Evidence, with ""quoted"" text"';
    const result = parseCareerCsv(createCsv([row]));
    assert.equal(result.records[0].evidence, 'Evidence, with "quoted" text');
  });
});

describe('calculateCareerMatches', () => {
  const result = parseCareerCsv(
    readFileSync(
      new URL('../../public/data/skills-occupations.csv', import.meta.url),
      'utf8',
    ),
  );

  it('ranks occupations by skill overlap and updates when the profile skills change', () => {
    const facilitationMatches = calculateCareerMatches(
      'communication, Facilitation, facilitation',
      result.records,
    );
    assert.equal(facilitationMatches[0].occupation, 'Learning Experience Designer');
    // 加权匹配：命中技能权重 8 / 岗位总权重 19 ≈ 42%（旧算法为 2/5 = 40%）
    assert.equal(facilitationMatches[0].score, 42);
    assert.deepEqual(facilitationMatches[0].matchingSkills, [
      'Communication',
      'Facilitation',
    ]);
    assert.deepEqual(facilitationMatches[0].missingSkills, [
      'Content planning',
      'Learning design',
      'Learning evaluation',
    ]);

    const customerResearchMatches = calculateCareerMatches(
      'Listening, Writing, Pattern recognition, Qualitative research methods, Data visualization',
      result.records,
    );
    assert.equal(customerResearchMatches[0].occupation, 'Customer Insights Associate');
    assert.equal(customerResearchMatches[0].score, 83);
    assert.notEqual(
      facilitationMatches[0].occupation,
      customerResearchMatches[0].occupation,
    );
  });

  it('returns zero scores and lists all skills as missing for empty or unmatched profiles', () => {
    const emptyProfile = calculateCareerMatches('', result.records);
    assert.ok(emptyProfile.every((match) => match.score === 0));
    assert.ok(emptyProfile.every((match) => match.missingSkills.length > 0));

    const unmatched = calculateCareerMatches('something not in this dataset', result.records);
    assert.ok(unmatched.every((match) => match.score === 0));
  });

  it('matches Chinese and Bahasa Melayu skill names to the same canonical occupations', () => {
    const chinese = calculateCareerMatches('沟通，引导', result.records);
    const malay = calculateCareerMatches('Komunikasi, Fasilitasi', result.records);
    assert.equal(chinese[0].occupation, 'Learning Experience Designer');
    assert.equal(chinese[0].score, 42);
    assert.equal(malay[0].occupation, 'Learning Experience Designer');
    assert.equal(malay[0].score, 40);
  });
});

describe('formatPublicationDate', () => {
  it('displays verified publication dates consistently', () => {
    assert.equal(formatPublicationDate('2024-02-29'), 'Feb 29, 2024');
  });

  it('preserves invalid dates rather than silently changing them', () => {
    assert.equal(formatPublicationDate('not-a-date'), 'not-a-date');
  });
});
