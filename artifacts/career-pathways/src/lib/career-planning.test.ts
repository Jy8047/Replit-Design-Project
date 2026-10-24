import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { calculateCareerMatches, parseCareerCsv } from './career-data.ts';
import { matchCareers } from './career-matching.ts';
import { buildLearningPlan, calculateScenarioResults, getOccupationGoalMappings, parseWorkforceScenarioData } from './career-planning.ts';

const records = parseCareerCsv(readFileSync(new URL('../../public/data/skills-occupations.csv', import.meta.url), 'utf8')).records;

describe('fictional career exploration journeys', () => {
  it('loads only the illustrative 2026–2030 scenario data with its source limitations intact', () => {
    const source = readFileSync(new URL('../../public/data/workforce-scenarios.json', import.meta.url), 'utf8');
    const parsed = parseWorkforceScenarioData(JSON.parse(source));
    assert.deepEqual(parsed.years.map(row => row.year), [2026, 2027, 2028, 2029, 2030]);
    assert.deepEqual(parsed.scenarios.map(scenario => scenario.id), ['low', 'moderate', 'high']);
    assert.equal(parsed.source.url, null);
    assert.throws(() => parseWorkforceScenarioData({ ...parsed, years: [] }), /Invalid workforce scenario data/);
  });

  it('provides localized role reasons and prioritized skill gaps for role cards', () => {
    const english = matchCareers('Communication', records, {}, 'en').matches.find(match => match.occupation === 'Learning Experience Designer');
    const chinese = matchCareers('Communication', records, {}, 'zh').matches.find(match => match.occupation === 'Learning Experience Designer');
    const malay = matchCareers('Communication', records, {}, 'bm').matches.find(match => match.occupation === 'Learning Experience Designer');
    assert.ok(english && chinese && malay);
    assert.ok(english.reasons.length > 0);
    assert.ok(english.gaps.length > 0);
    assert.deepEqual(
      [...english.gaps.map(gap => gap.skill)].sort(),
      [...english.missingSkills].sort(),
    );
    assert.ok(english.gaps.every(gap => ['high', 'medium', 'low'].includes(gap.priority)));
    assert.notDeepEqual(english.reasons, chinese.reasons);
    assert.notDeepEqual(english.reasons, malay.reasons);
  });

  it('connects a fictional facilitator profile to gaps, ordered learning, SDGs and scenarios', () => {
    const skills = 'Communication, Facilitation';
    const role = calculateCareerMatches(skills, records)[0];
    assert.equal(role.occupation, 'Learning Experience Designer');
    const plan = buildLearningPlan(role.occupation, skills, records);
    assert.deepEqual(plan.map(step => step.skill), role.missingSkills);
    assert.deepEqual(plan.map(step => step.order), [1, 2, 3]);
    assert.ok(plan.every(step => step.duration.includes('estimate')));
    assert.equal(plan[0].resource.status, 'unverified');
    assert.equal(plan[0].resource.url, undefined);
    assert.equal(plan[2].resource.status, 'verified');
    assert.match(plan[2].resource.url!, /^https:\/\/www\.cdc\.gov/);
    assert.equal(getOccupationGoalMappings(role.occupation)[0].goalNumber, 4);
    const moderate = calculateScenarioResults(skills, records, 'moderate');
    const fast = calculateScenarioResults(skills, records, 'fast');
    assert.notEqual(moderate[0].scenarioIndex, fast[0].scenarioIndex);
    assert.equal(moderate[0].overlapScore, role.score);
  });

  it('keeps the learning plan personalised when profile skills are entered in Chinese', () => {
    const plan = buildLearningPlan('Learning Experience Designer', '沟通，引导', records);
    assert.deepEqual(plan.map(step => step.skill), [
      'Content planning',
      'Learning design',
      'Learning evaluation',
    ]);
    assert.deepEqual(plan.map(step => step.order), [1, 2, 3]);
  });

  it('updates results when the fictional profile or selected occupation changes', () => {
    const skills = 'Listening, Research, Qualitative research methods, Writing, Data visualization';
    const role = calculateCareerMatches(skills, records)[0];
    assert.equal(role.occupation, 'Customer Insights Associate');
    const plan = buildLearningPlan(role.occupation, skills, records);
    assert.deepEqual(plan.map(step => step.skill), ['Pattern recognition']);
    assert.equal(getOccupationGoalMappings(role.occupation)[0].goalNumber, 9);
    assert.equal(calculateScenarioResults(skills, records, 'fast')[0].occupation, role.occupation);
    assert.notDeepEqual(
      plan,
      buildLearningPlan('Sustainability Program Coordinator', skills, records),
    );
  });

  it('has explained, valid SDG mappings linked to the skills of every included occupation', () => {
    for (const occupation of new Set(records.map(record => record.occupation))) {
      const mappings = getOccupationGoalMappings(occupation);
      assert.ok(mappings.length > 0, occupation);
      for (const mapping of mappings) {
        assert.ok(mapping.goalNumber >= 1 && mapping.goalNumber <= 17);
        assert.ok(mapping.rationale.length > 80);
        assert.ok(mapping.relevantSkills.every(skill => records.some(record => record.occupation === occupation && record.skill === skill)));
        assert.match(mapping.officialUrl, /^https:\/\/sdgs\.un\.org\/goals\/goal\d+$/);
      }
    }
  });

  it('handles empty, unknown and fully matched inputs without invented gaps or mappings', () => {
    assert.deepEqual(buildLearningPlan('Unknown occupation', '', records), []);
    assert.deepEqual(getOccupationGoalMappings('Unknown occupation'), []);
    assert.deepEqual(calculateScenarioResults('', [], 'moderate'), []);
    assert.ok(calculateScenarioResults('', records, 'fast').every(result => result.scenarioIndex === 0));
    const allSkills = records.filter(record => record.occupation === 'Learning Experience Designer').map(record => record.skill).join(',');
    assert.deepEqual(buildLearningPlan('Learning Experience Designer', allSkills, records), []);
  });
});
