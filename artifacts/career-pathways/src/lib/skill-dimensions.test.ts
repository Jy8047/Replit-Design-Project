import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIMENSION_IDS,
  DIMENSION_NAMES,
  SKILL_DIMENSION_MAP,
  SKILLS_BY_DIMENSION,
  dimensionOf,
  profileDimensions,
  roleDimensions,
} from './skill-dimensions.ts';

const zeroVector = {
  data: 0,
  tech: 0,
  design: 0,
  communication: 0,
  management: 0,
  domain: 0,
};

describe('skill dimensions', () => {
  it('exports the six localized dimension keys', () => {
    assert.deepEqual(DIMENSION_IDS, ['data', 'tech', 'design', 'communication', 'management', 'domain']);
    assert.deepEqual(Object.values(DIMENSION_NAMES), [
      'Data handling',
      'Technical',
      'Design & content',
      'Communication',
      'Management & organisation',
      'Domain knowledge',
    ]);
  });

  it('returns all zeroes for empty profile and role skills', () => {
    assert.deepEqual(profileDimensions([]), zeroVector);
    assert.deepEqual(roleDimensions([], []), { required: zeroVector, matched: zeroVector });
  });

  it('puts a Python-only profile in the technical dimension', () => {
    assert.deepEqual(profileDimensions(['Python']), {
      data: 0,
      tech: 100,
      design: 0,
      communication: 0,
      management: 0,
      domain: 0,
    });
  });

  it('maps SQL and its Chinese name to the same data dimension', () => {
    assert.equal(dimensionOf('SQL'), 'data');
    assert.equal(dimensionOf('结构化查询语言'), 'data');
    assert.deepEqual(profileDimensions(['SQL']), profileDimensions(['结构化查询语言']));
    assert.equal(dimensionOf('Structured Query Language'), 'data');
  });

  it('uses the full role weight sum as a shared denominator before scaling both vectors', () => {
    const result = roleDimensions(
      ['SQL', 'Statistics', 'Python'],
      ['SQL'],
      { SQL: 2, Statistics: 2, Python: 4 },
    );
    assert.deepEqual(result.required, {
      data: 100,
      tech: 100,
      design: 0,
      communication: 0,
      management: 0,
      domain: 0,
    });
    assert.deepEqual(result.matched, {
      data: 50,
      tech: 0,
      design: 0,
      communication: 0,
      management: 0,
      domain: 0,
    });
  });

  it('matches an aliased skill against the canonical required skill', () => {
    const result = roleDimensions(['SQL', 'Python'], ['结构化查询语言']);
    assert.equal(result.matched.data, result.required.data);
    assert.equal(result.matched.tech, 0);
  });

  it('uses the requested fallback keywords and defaults unknown terms to management', () => {
    assert.equal(dimensionOf('data engineering'), 'data');
    assert.equal(dimensionOf('Linux administration'), 'tech');
    assert.equal(dimensionOf('content strategy'), 'design');
    assert.equal(dimensionOf('team coordination'), 'management');
    assert.equal(dimensionOf('unclassified hobby'), 'management');
  });

  it('classifies the highlighted real occupation labels in their six dimensions', () => {
    assert.equal(dimensionOf('Programming'), 'tech');
    assert.equal(dimensionOf('R'), 'tech');
    assert.equal(dimensionOf('Mathematics'), 'data');
    assert.equal(dimensionOf('Google Analytics'), 'data');
    assert.equal(dimensionOf('Adobe Photoshop'), 'design');
    assert.equal(dimensionOf('Management of Personnel Resources'), 'management');
    assert.equal(dimensionOf('Medicine and Dentistry'), 'domain');
    assert.equal(dimensionOf('Chemistry'), 'domain');
    assert.equal(dimensionOf('Speaking'), 'communication');
    assert.equal(dimensionOf('Telecommunications'), 'tech');
  });

  it('classifies at least one real catalog label in every dimension', () => {
    assert.deepEqual(
      Object.fromEntries([
        ['Mathematics', 'data'],
        ['Programming', 'tech'],
        ['Adobe Photoshop', 'design'],
        ['Speaking', 'communication'],
        ['Management of Personnel Resources', 'management'],
        ['Medicine and Dentistry', 'domain'],
      ].map(([skill, dimension]) => [skill, dimensionOf(skill)])),
      {
        Mathematics: 'data',
        Programming: 'tech',
        'Adobe Photoshop': 'design',
        Speaking: 'communication',
        'Management of Personnel Resources': 'management',
        'Medicine and Dentistry': 'domain',
      },
    );
  });

  it('keeps a shared role denominator across all six dimensions', () => {
    const result = roleDimensions(
      ['Mathematics', 'Programming', 'Medicine and Dentistry'],
      ['Mathematics'],
      { Mathematics: 2, Programming: 4, 'Medicine and Dentistry': 6 },
    );
    assert.deepEqual(result.required, {
      data: 33.33,
      tech: 66.67,
      design: 0,
      communication: 0,
      management: 0,
      domain: 100,
    });
    assert.deepEqual(result.matched, {
      data: 33.33,
      tech: 0,
      design: 0,
      communication: 0,
      management: 0,
      domain: 0,
    });
  });

  it('exports every explicitly listed skill in the dimension lookup table', () => {
    for (const dimension of DIMENSION_IDS) {
      for (const skill of SKILLS_BY_DIMENSION[dimension]) {
        assert.equal(SKILL_DIMENSION_MAP[skill], dimension);
      }
    }
  });
});
