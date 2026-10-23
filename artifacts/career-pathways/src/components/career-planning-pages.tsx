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
import { localizeContent, useI18n } from '@/lib/i18n';

type SelectionProps = {
  occupations: string[];
  selectedOccupation: string;
  onSelectOccupation: (occupation: string) => void;
};

function OccupationSelector(props: SelectionProps) {
  const { t, locale } = useI18n();
  return <div className="panel" style={{ marginBottom: 18 }}>
    <label className="label" htmlFor="selected-occupation">{t('Your selected occupation')}</label>
    <select id="selected-occupation" className="field" value={props.selectedOccupation} onChange={event => props.onSelectOccupation(event.target.value)} data-testid="select-occupation">
      {!props.occupations.length && <option value="">{t('No occupations available')}</option>}
      {props.occupations.map(occupation => <option key={occupation} value={occupation}>{localizeContent(occupation, locale)}</option>)}
    </select>
    <p className="planning-note">{t('Your selection is shared between the pathway and SDG pages. Choose a role from')} <Link href="/roles" data-testid="link-selector-roles">{t('Future Role Matches')}</Link> {t('or use this list.')}</p>
  </div>;
}

export function PersonalisedRoadmapPage(props: SelectionProps & { profileSkills: string; records: CareerRecord[] }) {
  const { t, locale } = useI18n();
  const steps = buildLearningPlan(props.selectedOccupation, props.profileSkills, props.records);
  const hasSkills = props.profileSkills.split(',').some(skill => skill.trim());
  return <>
    <PageHeading kicker={t('Turn gaps into next steps')} title={t('Personalised Reskilling Pathway')} description={t('An ordered starter plan containing only the skills missing from your saved profile for the selected occupation.')} />
    <OccupationSelector {...props} />
    <div className="planning-notice">{t('Order and durations are planning estimates, not validated course requirements. Allow extra time for practice and feedback. Links marked checked were reviewed for page existence and relevance, not learning quality or outcomes.')}</div>
    {!hasSkills && <p className="planning-note" data-testid="status-pathway-no-profile">{t('No saved skills yet: all example skills are shown.')} <Link href="/profile" data-testid="link-pathway-profile">{t('Save your skills in My Profile')}</Link> {t('to personalise this plan.')}</p>}
    {props.selectedOccupation && steps.length === 0 && <div className="panel" role="status" data-testid="status-pathway-complete">{t('No listed skill gaps remain for this occupation. This is not proof of job readiness; consider a practical work sample and feedback from someone in the field.')}</div>}
    <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }} data-testid="list-learning-plan">
      {steps.map(step => <li key={step.skill} className="panel" data-testid={`step-learning-${step.order}`}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'start' }}>
          <span className="step-dot">{String(step.order).padStart(2, '0')}</span>
          <div style={{ flex: 1 }}>
            <h2 className="planning-title">{localizeContent(step.skill, locale)}</h2>
            <span className="tag">{localizeContent(step.duration, locale)}</span>
            <p className="planning-note">{t('Study the skill, try a small example for this occupation, then ask for feedback before moving on.')}</p>
            {step.resource.status === 'verified' && step.resource.url ? <>
              <a href={step.resource.url} target="_blank" rel="noopener noreferrer" className="btn" data-testid={`link-learning-resource-${step.order}`}><BookOpen size={14} />{step.resource.title}<ExternalLink size={13} /></a>
              <p className="planning-note" data-testid={`status-resource-verified-${step.order}`}>{t('Link and relevance checked')} {step.resource.checkedOn} · {step.resource.provider}. {localizeContent(step.resource.note, locale)} {t('Access and content may change.')}</p>
            </> : <p className="planning-notice" data-testid={`status-resource-unverified-${step.order}`}><strong>{t('Resource not verified.')}</strong> {localizeContent(step.resource.note, locale)}</p>}
          </div>
        </div>
      </li>)}
    </ol>
    <Link href="/impact" className="btn btn-primary" data-testid="link-pathway-sdg">{t('Explore this occupation’s SDG alignment')} <ArrowRight size={14} /></Link>
  </>;
}

export function OccupationImpactPage(props: SelectionProps) {
  const { t, locale } = useI18n();
  const mappings = getOccupationGoalMappings(props.selectedOccupation);
  return <>
    <PageHeading kicker={t('Connect work to wider goals')} title={t('SDG Mapping')} description={t('Explore how an occupation and its skills could support selected UN Sustainable Development Goals in an appropriate context.')} />
    <OccupationSelector {...props} />
    <div className="planning-notice"><strong>{t('Intended contribution is not measured impact.')}</strong> {t('These are app-authored explanations, not UN endorsements or assessments. No SDG indicators, employment outcomes, emissions, or social outcomes are measured here.')}</div>
    {props.selectedOccupation && mappings.length === 0 && <div className="panel" data-testid="status-sdg-unmapped">{t('No reviewed SDG explanation is available for this occupation yet. A goal label has not been assigned automatically.')}</div>}
    <div style={{ display: 'grid', gap: 14 }}>
      {mappings.map(mapping => <article className="panel" key={mapping.goalNumber} data-testid={`card-occupation-sdg-${mapping.goalNumber}`}>
        <span className="tag">SDG {mapping.goalNumber} · {t(`${mapping.relationship} alignment`)}</span>
        <h2 className="planning-title" style={{ marginTop: 12 }}>{localizeContent(mapping.goalTitle, locale)}</h2>
        <p className="planning-note">{localizeContent(mapping.rationale, locale)}</p>
        <strong style={{ fontSize: 12 }}>{t('Relevant skills')}</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '9px 0 14px' }}>{mapping.relevantSkills.map(skill => <span className="tag" key={skill}>{localizeContent(skill, locale)}</span>)}</div>
        <a href={mapping.officialUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-un-goal-${mapping.goalNumber}`}>{t('Read the official UN goal')} <ExternalLink size={12} /></a>
      </article>)}
    </div>
    <Link href="/scenarios" className="btn btn-primary" style={{ marginTop: 18 }} data-testid="link-sdg-scenarios">{t('Compare future scenarios')} <ArrowRight size={14} /></Link>
  </>;
}

export function FutureScenarioPage({ scenario, onScenarioChange, records, profileSkills }: { scenario: ScenarioId; onScenarioChange: (scenario: ScenarioId) => void; records: CareerRecord[]; profileSkills: string }) {
  const { t, locale } = useI18n();
  const results = calculateScenarioResults(profileSkills, records, scenario);
  return <>
    <PageHeading kicker={t('Test assumptions, not predictions')} title={t('Future Scenarios')} description={t('Choose a what-if lens and see how it changes the interpretation and ranking of your skill overlap. Your original overlap score is preserved.')} />
    <div className="planning-notice"><strong>{t('Estimates only.')}</strong> {t('These synthetic scenarios do not predict AI adoption, hiring odds, or employment outcomes. The included skill directions are synthetic too.')}</div>
    <fieldset className="panel" style={{ margin: '0 0 18px' }}><legend className="label">{t('Choose your AI disruption scenario')}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {(['moderate', 'fast'] as const).map(option => <label className="btn" key={option} style={{ background: scenario === option ? '#e8eadf' : undefined }}><input type="radio" name="scenario" checked={scenario === option} onChange={() => onScenarioChange(option)} data-testid={`input-scenario-${option}`} />{t(option === 'moderate' ? 'Moderate AI disruption' : 'Fast AI disruption')}</label>)}
      </div>
    </fieldset>
    <div className="panel" style={{ marginBottom: 18 }}>
      <h2 className="planning-title">{t('Assumptions you can inspect')}</h2>
      {scenarioAssumptions.map(assumption => <div key={assumption.label} style={{ borderTop: '1px solid #e8e7dd', paddingTop: 12, marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>{localizeContent(assumption.label, locale)}</strong>
        <p className="planning-note">{t('Moderate:')} {localizeContent(assumption.moderate, locale)}<br />{t('Fast:')} {localizeContent(assumption.fast, locale)}<br />{localizeContent(assumption.explanation, locale)}</p>
      </div>)}
      <p className="planning-note" data-testid="text-scenario-formula"><strong>{t('Formula:')}</strong> {t('weighted overlap = matched skill weights ÷ all occupation skill weights × 100, rounded. A rising skill receives more emphasis in the fast lens; a declining skill receives less. These are chosen weights, not market measurements. Ties are alphabetical.')}</p>
    </div>
    {!profileSkills.trim() && <p className="planning-note">{t('All scores are zero because you have no saved skills.')} <Link href="/profile" data-testid="link-scenario-profile">{t('Add skills to compare the lenses.')}</Link></p>}
    <div style={{ display: 'grid', gap: 13 }} aria-live="polite">
      {results.map((result, index) => <article className="panel" key={result.occupation} data-testid={`card-scenario-result-${index}`}>
        <span className="eyebrow">{t('ESTIMATED RANK {n} · {scenario} LENS', { n: index + 1, scenario: t(scenario === 'moderate' ? 'Moderate AI disruption' : 'Fast AI disruption') })}</span>
        <h2 className="planning-title" style={{ marginTop: 9 }}>{localizeContent(result.occupation, locale)}</h2>
        <p data-testid={`text-scenario-index-${index}`}><strong>{result.scenarioIndex}%</strong> {t('scenario-weighted overlap estimate')} · {t('Original overlap')} {result.overlapScore}% · {t('Change')} {result.adjustment > 0 ? '+' : ''}{result.adjustment} {t('points')}</p>
        <p className="planning-note">{t('More-emphasised skills:')} {result.risingSkills.map(skill => localizeContent(skill, locale)).join(', ') || t('None listed')}<br />{t('Baseline skills:')} {result.stableSkills.map(skill => localizeContent(skill, locale)).join(', ') || t('None listed')}<br />{t('Less-emphasised skills:')} {result.decliningSkills.map(skill => localizeContent(skill, locale)).join(', ') || t('None listed')}</p>
      </article>)}
    </div>
    <Link href="/roles" className="btn" style={{ marginTop: 18 }} data-testid="link-scenario-roles">{t('Return to original role matches')} <ArrowRight size={14} /></Link>
  </>;
}

export function PlanningStyles() {
  return <style>{`.planning-title{font:700 19px Manrope;color:#30483b;margin:0 0 10px}.planning-note{font-size:12px;color:#697568;line-height:1.7;margin:10px 0}.planning-note a{color:#355c40;text-decoration:underline}.planning-notice{font-size:12px;line-height:1.7;color:#626e62;background:#eceee4;padding:14px 17px;border-radius:11px;margin-bottom:18px}.planning-notice+ol{margin-top:18px}`}</style>;
}
