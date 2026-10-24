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

const zeroVector = { data: 0, tech: 0, design: 0, collab: 0 };

describe('skill dimensions', () => {
  it('exports four dimensions with English, Simplified Chinese and Bahasa Melayu names', () => {
    assert.deepEqual(DIMENSION_IDS, ['data', 'tech', 'design', 'collab']);
    for (const dimension of DIMENSION_IDS) {
      assert.ok(DIMENSION_NAMES[dimension].en);
      assert.ok(DIMENSION_NAMES[dimension].zh);
      assert.ok(DIMENSION_NAMES[dimension].ms);
    }
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
      collab: 0,
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
    assert.deepEqual(result.required, { data: 100, tech: 100, design: 0, collab: 0 });
    assert.deepEqual(result.matched, { data: 50, tech: 0, design: 0, collab: 0 });
  });

  it('matches an aliased skill against the canonical required skill', () => {
    const result = roleDimensions(['SQL', 'Python'], ['结构化查询语言']);
    assert.equal(result.matched.data, result.required.data);
    assert.equal(result.matched.tech, 0);
  });

  it('uses the requested fallback keywords and defaults unknown terms to collaboration', () => {
    assert.equal(dimensionOf('data engineering'), 'data');
    assert.equal(dimensionOf('Linux administration'), 'tech');
    assert.equal(dimensionOf('content strategy'), 'design');
    assert.equal(dimensionOf('team coordination'), 'collab');
    assert.equal(dimensionOf('unclassified hobby'), 'collab');
  });

  it('exports every explicitly listed skill in the dimension lookup table', () => {
    for (const dimension of DIMENSION_IDS) {
      for (const skill of SKILLS_BY_DIMENSION[dimension]) {
        assert.equal(SKILL_DIMENSION_MAP[skill], dimension);
      }
    }
  });
});
