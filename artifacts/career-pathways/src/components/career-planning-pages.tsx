import { Link } from 'wouter';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import {
  buildLearningPlan,
  calculateScenarioResults,
  getOccupationGoalMappings,
  scenarioAssumptions,
  type ScenarioId,
} from '@/lib/career-planning';
import type { CareerRecord } from '@/lib/career-data';

type SelectionProps = {
  occupations: string[];
  selectedOccupation: string;
  onSelectOccupation: (occupation: string) => void;
};

function OccupationSelector(props: SelectionProps) {
  return <div className="panel" style={{ marginBottom: 18 }}>
    <label className="label" htmlFor="selected-occupation">Your selected occupation</label>
    <select id="selected-occupation" className="field" value={props.selectedOccupation} onChange={event => props.onSelectOccupation(event.target.value)} data-testid="select-occupation">
      {!props.occupations.length && <option value="">No occupations available</option>}
      {props.occupations.map(occupation => <option key={occupation} value={occupation}>{occupation}</option>)}
    </select>
    <p className="planning-note">Your selection is shared between the pathway and SDG pages. Choose a role from <Link href="/roles" data-testid="link-selector-roles">Future Role Matches</Link> or use this list.</p>
  </div>;
}

export function PersonalisedRoadmapPage(props: SelectionProps & { profileSkills: string; records: CareerRecord[] }) {
  const steps = buildLearningPlan(props.selectedOccupation, props.profileSkills, props.records);
  const hasSkills = props.profileSkills.split(',').some(skill => skill.trim());
  return <>
    <PageHeading kicker="Turn gaps into next steps" title="Personalised Reskilling Pathway" description="An ordered starter plan containing only the skills missing from your saved profile for the selected occupation." />
    <OccupationSelector {...props} />
    <div className="planning-notice">Order and durations are planning estimates, not validated course requirements. Allow extra time for practice and feedback. Links marked checked were reviewed for page existence and relevance, not learning quality or outcomes.</div>
    {!hasSkills && <p className="planning-note" data-testid="status-pathway-no-profile">No saved skills yet: all example skills are shown. <Link href="/profile" data-testid="link-pathway-profile">Save your skills in My Profile</Link> to personalise this plan.</p>}
    {props.selectedOccupation && steps.length === 0 && <div className="panel" role="status" data-testid="status-pathway-complete">No listed skill gaps remain for this occupation. This is not proof of job readiness; consider a practical work sample and feedback from someone in the field.</div>}
    <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }} data-testid="list-learning-plan">
      {steps.map(step => <li key={step.skill} className="panel" data-testid={`step-learning-${step.order}`}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'start' }}>
          <span className="step-dot">{String(step.order).padStart(2, '0')}</span>
          <div style={{ flex: 1 }}>
            <h2 className="planning-title">{step.skill}</h2>
            <span className="tag">{step.duration}</span>
            <p className="planning-note">Study the skill, try a small example for this occupation, then ask for feedback before moving on.</p>
            {step.resource.status === 'verified' && step.resource.url ? <>
              <a href={step.resource.url} target="_blank" rel="noopener noreferrer" className="btn" data-testid={`link-learning-resource-${step.order}`}><BookOpen size={14} />{step.resource.title}<ExternalLink size={13} /></a>
              <p className="planning-note" data-testid={`status-resource-verified-${step.order}`}>Link and relevance checked {step.resource.checkedOn} · {step.resource.provider}. {step.resource.note} Access and content may change.</p>
            </> : <p className="planning-notice" data-testid={`status-resource-unverified-${step.order}`}><strong>Resource not verified.</strong> {step.resource.note}</p>}
          </div>
        </div>
      </li>)}
    </ol>
    <Link href="/impact" className="btn btn-primary" data-testid="link-pathway-sdg">Explore this occupation’s SDG alignment <ArrowRight size={14} /></Link>
  </>;
}

export function OccupationImpactPage(props: SelectionProps) {
  const mappings = getOccupationGoalMappings(props.selectedOccupation);
  return <>
    <PageHeading kicker="Connect work to wider goals" title="SDG Mapping" description="Explore how an occupation and its skills could support selected UN Sustainable Development Goals in an appropriate context." />
    <OccupationSelector {...props} />
    <div className="planning-notice"><strong>Intended contribution is not measured impact.</strong> These are app-authored explanations, not UN endorsements or assessments. No SDG indicators, employment outcomes, emissions, or social outcomes are measured here.</div>
    {props.selectedOccupation && mappings.length === 0 && <div className="panel" data-testid="status-sdg-unmapped">No reviewed SDG explanation is available for this occupation yet. A goal label has not been assigned automatically.</div>}
    <div style={{ display: 'grid', gap: 14 }}>
      {mappings.map(mapping => <article className="panel" key={mapping.goalNumber} data-testid={`card-occupation-sdg-${mapping.goalNumber}`}>
        <span className="tag">SDG {mapping.goalNumber} · {mapping.relationship} alignment</span>
        <h2 className="planning-title" style={{ marginTop: 12 }}>{mapping.goalTitle}</h2>
        <p className="planning-note">{mapping.rationale}</p>
        <strong style={{ fontSize: 12 }}>Relevant skills</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '9px 0 14px' }}>{mapping.relevantSkills.map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>
        <a href={mapping.officialUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-un-goal-${mapping.goalNumber}`}>Read the official UN goal <ExternalLink size={12} /></a>
      </article>)}
    </div>
    <Link href="/scenarios" className="btn btn-primary" style={{ marginTop: 18 }} data-testid="link-sdg-scenarios">Compare future scenarios <ArrowRight size={14} /></Link>
  </>;
}

export function FutureScenarioPage({ scenario, onScenarioChange, records, profileSkills }: { scenario: ScenarioId; onScenarioChange: (scenario: ScenarioId) => void; records: CareerRecord[]; profileSkills: string }) {
  const results = calculateScenarioResults(profileSkills, records, scenario);
  return <>
    <PageHeading kicker="Test assumptions, not predictions" title="Future Scenarios" description="Choose a what-if lens and see how it changes the interpretation and ranking of your skill overlap. Your original overlap score is preserved." />
    <div className="planning-notice"><strong>Estimates only.</strong> These synthetic scenarios do not predict AI adoption, hiring odds, or employment outcomes. The included skill directions are synthetic too.</div>
    <fieldset className="panel" style={{ margin: '0 0 18px' }}><legend className="label">Choose your AI disruption scenario</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {(['moderate', 'fast'] as const).map(option => <label className="btn" key={option} style={{ background: scenario === option ? '#e8eadf' : undefined }}><input type="radio" name="scenario" checked={scenario === option} onChange={() => onScenarioChange(option)} data-testid={`input-scenario-${option}`} />{option === 'moderate' ? 'Moderate AI disruption' : 'Fast AI disruption'}</label>)}
      </div>
    </fieldset>
    <div className="panel" style={{ marginBottom: 18 }}>
      <h2 className="planning-title">Assumptions you can inspect</h2>
      {scenarioAssumptions.map(assumption => <div key={assumption.label} style={{ borderTop: '1px solid #e8e7dd', paddingTop: 12, marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>{assumption.label}</strong>
        <p className="planning-note">Moderate: {assumption.moderate}<br />Fast: {assumption.fast}<br />{assumption.explanation}</p>
      </div>)}
      <p className="planning-note" data-testid="text-scenario-formula"><strong>Formula:</strong> weighted overlap = matched skill weights ÷ all occupation skill weights × 100, rounded. A rising skill receives more emphasis in the fast lens; a declining skill receives less. These are chosen weights, not market measurements. Ties are alphabetical.</p>
    </div>
    {!profileSkills.trim() && <p className="planning-note">All scores are zero because you have no saved skills. <Link href="/profile" data-testid="link-scenario-profile">Add skills to compare the lenses.</Link></p>}
    <div style={{ display: 'grid', gap: 13 }} aria-live="polite">
      {results.map((result, index) => <article className="panel" key={result.occupation} data-testid={`card-scenario-result-${index}`}>
        <span className="eyebrow">ESTIMATED RANK {index + 1} · {scenario.toUpperCase()} LENS</span>
        <h2 className="planning-title" style={{ marginTop: 9 }}>{result.occupation}</h2>
        <p data-testid={`text-scenario-index-${index}`}><strong>{result.scenarioIndex}%</strong> scenario-weighted overlap estimate · Original overlap {result.overlapScore}% · Change {result.adjustment > 0 ? '+' : ''}{result.adjustment} points</p>
        <p className="planning-note">More-emphasised skills: {result.risingSkills.join(', ') || 'None listed'}<br />Baseline skills: {result.stableSkills.join(', ') || 'None listed'}<br />Less-emphasised skills: {result.decliningSkills.join(', ') || 'None listed'}</p>
      </article>)}
    </div>
    <Link href="/roles" className="btn" style={{ marginTop: 18 }} data-testid="link-scenario-roles">Return to original role matches <ArrowRight size={14} /></Link>
  </>;
}

export function PlanningStyles() {
  return <style>{`.planning-title{font:700 19px Manrope;color:#30483b;margin:0 0 10px}.planning-note{font-size:12px;color:#697568;line-height:1.7;margin:10px 0}.planning-note a{color:#355c40;text-decoration:underline}.planning-notice{font-size:12px;line-height:1.7;color:#626e62;background:#eceee4;padding:14px 17px;border-radius:11px;margin-bottom:18px}.planning-notice+ol{margin-top:18px}`}</style>;
}
