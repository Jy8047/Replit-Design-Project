import {
  BookOpen,
  CheckCircle2,
  Compass,
  ExternalLink,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeading } from '@/components/page-heading';

export type LearningResource = {
  status: 'verified' | 'unverified';
  title: string;
  provider: string;
  url?: string;
  checkedOn?: string;
  note: string;
};

export type LearningStep = {
  skill: string;
  order: number;
  duration: string;
  resource: LearningResource;
};

export type GoalMapping = {
  goalNumber: number;
  goalTitle: string;
  occupation: string;
  relevantSkills: string[];
  rationale: string;
  relationship: 'potential' | 'conditional';
};

export type ScenarioId = 'moderate' | 'fast';

export type ScenarioResult = {
  occupation: string;
  overlapScore: number;
  scenarioIndex: number;
  adjustment: number;
  risingSkills: string[];
  stableSkills: string[];
  decliningSkills: string[];
};

export type ScenarioAssumption = {
  label: string;
  moderate: string;
  fast: string;
  explanation: string;
};

type OccupationSelectProps = {
  occupations: string[];
  selectedOccupation: string;
  onSelectOccupation: (occupation: string) => void;
  id: string;
};

function OccupationSelect({
  occupations,
  selectedOccupation,
  onSelectOccupation,
  id,
}: OccupationSelectProps) {
  return (
    <div className="pathway-select-wrap">
      <label className="pathway-label" htmlFor={id}>
        Explore an occupation
      </label>
      <div className="pathway-select-control">
        <Compass size={16} aria-hidden="true" />
        <select
          id={id}
          className="pathway-select"
          value={selectedOccupation}
          onChange={(event) => onSelectOccupation(event.target.value)}
          data-testid={`select-${id}`}
          aria-label="Select an occupation"
        >
          {occupations.length === 0 && (
            <option value="">No occupations available</option>
          )}
          {occupations.map((occupation) => (
            <option key={occupation} value={occupation}>
              {occupation}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Notice({
  children,
  tone = 'sage',
  testId,
}: {
  children: ReactNode;
  tone?: 'sage' | 'sand';
  testId?: string;
}) {
  return (
    <div className={`pathway-notice ${tone}`} role="note" data-testid={testId}>
      <ShieldCheck size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="pathway-empty" role="status">
      <span className="pathway-empty-mark">
        <BookOpen size={20} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

export function RoadmapPage({
  occupations,
  selectedOccupation,
  onSelectOccupation,
  steps,
  hasProfile,
  profileSkills,
}: {
  occupations: string[];
  selectedOccupation: string;
  onSelectOccupation: (occupation: string) => void;
  steps: LearningStep[];
  hasProfile: boolean;
  profileSkills: string;
}) {
  return (
    <div className="pathway-page">
      <PageHeading
        kicker="A practical next step"
        title="Reskilling Roadmap"
        description="A flexible sequence for exploring skills that may help with a direction you’re considering. Take one small step at a time."
      />

      <section className="pathway-intro roadmap-intro">
        <div className="pathway-intro-copy">
          <span className="pathway-overline">YOUR WORKING PLAN</span>
          <h2>Progress can be practical, not perfect.</h2>
          <p>
            This is a place to organize ideas and learning options—not a fixed
            prescription. Adapt the pace and steps to fit your circumstances.
          </p>
        </div>
        <OccupationSelect
          occupations={occupations}
          selectedOccupation={selectedOccupation}
          onSelectOccupation={onSelectOccupation}
          id="roadmap-occupation"
        />
      </section>

      {hasProfile ? (
        <section className="pathway-profile-context" data-testid="status-roadmap-profile">
          <div className="pathway-context-icon">
            <CheckCircle2 size={17} aria-hidden="true" />
          </div>
          <div>
            <strong>Starting with skills you already use</strong>
            <p>{profileSkills.trim() || 'Your saved profile is ready to inform this plan.'}</p>
          </div>
        </section>
      ) : (
        <section className="pathway-profile-context muted" data-testid="status-roadmap-no-profile">
          <div className="pathway-context-icon">
            <Sparkles size={17} aria-hidden="true" />
          </div>
          <div>
            <strong>You can explore without a profile</strong>
            <p>
              Add skills later if you’d like the plan to reflect experience you
              already have.
            </p>
          </div>
        </section>
      )}

      <div className="pathway-section-heading">
        <div>
          <span className="pathway-overline">LEARNING SEQUENCE</span>
          <h2>{selectedOccupation || 'Your next steps'}</h2>
        </div>
        <span className="pathway-count">{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
      </div>

      {steps.length ? (
        <div className="pathway-timeline" data-testid="results-roadmap">
          {steps.map((step, index) => {
            const linked =
              step.resource.status === 'verified' && Boolean(step.resource.url);
            return (
              <article
                className="pathway-step"
                key={`${step.order}-${step.skill}-${index}`}
                data-testid={`card-roadmap-step-${step.order}`}
              >
                <div className="pathway-step-marker">
                  <span>{String(step.order).padStart(2, '0')}</span>
                  {index < steps.length - 1 && <i aria-hidden="true" />}
                </div>
                <div className="pathway-step-card">
                  <div className="pathway-step-topline">
                    <span className="pathway-overline">STEP {String(step.order).padStart(2, '0')}</span>
                    <span className="pathway-duration">{step.duration} · estimate</span>
                  </div>
                  <h3>{step.skill}</h3>
                  <div className="pathway-resource">
                    <div className="pathway-resource-heading">
                      <BookOpen size={15} aria-hidden="true" />
                      <span>Learning resource</span>
                    </div>
                    {linked ? (
                      <div className="pathway-resource-detail">
                        <div>
                          <strong>{step.resource.title}</strong>
                          <span>{step.resource.provider}</span>
                        </div>
                        <a
                          className="pathway-resource-link"
                          href={step.resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-roadmap-resource-${step.order}`}
                        >
                          Open verified resource <ExternalLink size={13} aria-hidden="true" />
                        </a>
                        {step.resource.checkedOn && (
                          <span className="pathway-checked-date">
                            Checked {step.resource.checkedOn}
                          </span>
                        )}
                        <p>{step.resource.note}</p>
                      </div>
                    ) : (
                      <div
                        className="pathway-resource-unverified"
                        data-testid={`status-roadmap-resource-${step.order}`}
                      >
                        <span className="pathway-status-pill">Not verified</span>
                        <p>{step.resource.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No learning steps to show yet"
          body="Choose an occupation above or check back when a plan is available for this direction."
        />
      )}

      <Notice testId="note-roadmap-guidance">
        <strong>Before you commit</strong>
        <p>
          Check course details, cost, accessibility, and fit with your goals.
          Durations are planning estimates, not promises.
        </p>
      </Notice>
      <PathwayStyles />
    </div>
  );
}

export function ImpactPage({
  occupations,
  selectedOccupation,
  onSelectOccupation,
  mappings,
}: {
  occupations: string[];
  selectedOccupation: string;
  onSelectOccupation: (occupation: string) => void;
  mappings: GoalMapping[];
}) {
  return (
    <div className="pathway-page">
      <PageHeading
        kicker="Work in a wider context"
        title="SDG Impact"
        description="Explore possible connections between an occupation and selected United Nations Sustainable Development Goals."
      />

      <Notice tone="sage" testId="note-impact-intended">
        <strong>Intended connection, not measured impact</strong>
        <p>
          These mappings describe a possible relationship. They do not show
          outcomes, prove contribution, or assess progress toward a global goal.
        </p>
      </Notice>

      <section className="pathway-filter-panel">
        <div>
          <span className="pathway-overline">LOOK AT ONE DIRECTION</span>
          <h2>Which occupation are you exploring?</h2>
        </div>
        <OccupationSelect
          occupations={occupations}
          selectedOccupation={selectedOccupation}
          onSelectOccupation={onSelectOccupation}
          id="impact-occupation"
        />
      </section>

      <div className="pathway-section-heading impact-heading">
        <div>
          <span className="pathway-overline">POTENTIAL ALIGNMENTS</span>
          <h2>{selectedOccupation || 'Occupation links'}</h2>
        </div>
        <span className="pathway-count">{mappings.length} {mappings.length === 1 ? 'connection' : 'connections'}</span>
      </div>

      {mappings.length ? (
        <div className="pathway-goal-list" data-testid="results-impact">
          {mappings.map((mapping, index) => (
            <article
              className="pathway-goal-card"
              key={`${mapping.goalNumber}-${mapping.occupation}-${index}`}
              data-testid={`card-impact-goal-${mapping.goalNumber}-${index}`}
            >
              <div className="pathway-goal-number">
                <span>GOAL</span>
                <strong>{String(mapping.goalNumber).padStart(2, '0')}</strong>
              </div>
              <div className="pathway-goal-content">
                <div className="pathway-goal-title-row">
                  <div>
                    <span className="pathway-overline">{mapping.occupation}</span>
                    <h3>{mapping.goalTitle}</h3>
                  </div>
                  <span className={`pathway-relationship ${mapping.relationship}`}>
                    {mapping.relationship === 'potential' ? 'Potential alignment' : 'Conditional alignment'}
                  </span>
                </div>
                <p className="pathway-rationale">{mapping.rationale}</p>
                {mapping.relevantSkills.length > 0 && (
                  <div className="pathway-skill-row">
                    <span className="pathway-skill-label">Skills connected in this mapping</span>
                    <div className="pathway-skill-chips">
                      {mapping.relevantSkills.map((skill) => (
                        <span className="pathway-skill-chip" key={skill}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No goal connections to show"
          body="There are no occupation-linked mappings available for this selection yet."
        />
      )}

      <div className="pathway-footnote">
        <Network size={16} aria-hidden="true" />
        <p>
          Goal names refer to the UN Sustainable Development Goals. A possible
          link is not evidence of a real-world outcome.
        </p>
      </div>
      <PathwayStyles />
    </div>
  );
}

export function ScenariosPage({
  scenario,
  onScenarioChange,
  results,
  assumptions,
  formula,
}: {
  scenario: ScenarioId;
  onScenarioChange: (scenario: ScenarioId) => void;
  results: ScenarioResult[];
  assumptions: ScenarioAssumption[];
  formula: string;
}) {
  const selectedLabel = scenario === 'moderate' ? 'Moderate change' : 'Faster change';

  return (
    <div className="pathway-page">
      <PageHeading
        kicker="Think in possibilities"
        title="Future Scenarios"
        description="Compare two sets of assumptions about how work could change. Use them to ask better questions, not to forecast what will happen."
      />

      <section className="scenario-switcher" aria-label="Choose a scenario">
        <div className="scenario-switcher-copy">
          <span className="pathway-overline">SCENARIO LENS</span>
          <h2>How quickly might work shift?</h2>
          <p>Switch between the assumptions to review the same occupation results through a different lens.</p>
        </div>
        <div className="scenario-toggle" role="group" aria-label="Scenario pace">
          <button
            type="button"
            className={scenario === 'moderate' ? 'selected' : ''}
            aria-pressed={scenario === 'moderate'}
            onClick={() => onScenarioChange('moderate')}
            data-testid="button-scenario-moderate"
          >
            <Minus size={15} aria-hidden="true" />
            Moderate
          </button>
          <button
            type="button"
            className={scenario === 'fast' ? 'selected fast' : ''}
            aria-pressed={scenario === 'fast'}
            onClick={() => onScenarioChange('fast')}
            data-testid="button-scenario-fast"
          >
            <TrendingUp size={15} aria-hidden="true" />
            Faster
          </button>
        </div>
      </section>

      <Notice tone="sand" testId="note-scenario-estimates">
        <strong>Estimates, not predictions</strong>
        <p>
          Scenario scores are estimates based on the supplied assumptions. They
          are not predictions, measured probabilities, or hiring odds.
        </p>
      </Notice>

      <section className="assumptions-panel">
        <div className="pathway-section-heading compact">
          <div>
            <span className="pathway-overline">{selectedLabel.toUpperCase()} LENS</span>
            <h2>Assumptions to keep in view</h2>
          </div>
          <SlidersHorizontal size={18} aria-hidden="true" />
        </div>
        {assumptions.length ? (
          <div className="assumption-list">
            {assumptions.map((assumption, index) => (
              <article
                className="assumption-row"
                key={`${assumption.label}-${index}`}
                data-testid={`row-scenario-assumption-${index}`}
              >
                <strong>{assumption.label}</strong>
                <span>{scenario === 'moderate' ? assumption.moderate : assumption.fast}</span>
                <p>{assumption.explanation}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="pathway-inline-empty">No assumptions are available for this view yet.</p>
        )}
      </section>

      <div className="pathway-section-heading scenario-results-heading">
        <div>
          <span className="pathway-overline">OCCUPATION COMPARISON</span>
          <h2>Skills through the {scenario === 'moderate' ? 'moderate' : 'faster'}-change lens</h2>
        </div>
        <span className="pathway-count">{results.length} {results.length === 1 ? 'occupation' : 'occupations'}</span>
      </div>

      {results.length ? (
        <div className="scenario-results" data-testid="results-scenarios">
          {results.map((result, index) => (
            <article
              className="scenario-result-card"
              key={`${result.occupation}-${index}`}
              data-testid={`card-scenario-result-${index}`}
            >
              <div className="scenario-result-header">
                <div>
                  <span className="pathway-overline">OCCUPATION {String(index + 1).padStart(2, '0')}</span>
                  <h3>{result.occupation}</h3>
                </div>
                <div className="scenario-score" data-testid={`text-scenario-score-${index}`}>
                  <strong>{result.overlapScore}%</strong>
                  <span>estimated overlap</span>
                </div>
              </div>
              <div className="scenario-metrics">
                <div><span>Scenario index</span><strong>{result.scenarioIndex}</strong></div>
                <div><span>Adjustment</span><strong>{result.adjustment}</strong></div>
              </div>
              <div className="scenario-skill-groups">
                <SkillGroup label="May be rising" kind="rising" skills={result.risingSkills} />
                <SkillGroup label="May be stable" kind="stable" skills={result.stableSkills} />
                <SkillGroup label="May be declining" kind="declining" skills={result.decliningSkills} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scenario results to compare"
          body="Occupation results will appear here when they are available for this scenario."
        />
      )}

      <section className="formula-panel" data-testid="text-scenario-formula">
        <div className="formula-icon"><SlidersHorizontal size={17} aria-hidden="true" /></div>
        <div>
          <span className="pathway-overline">HOW TO READ THE SCORE</span>
          <p>{formula || 'No score formula has been provided for this view.'}</p>
          <small>Values are estimates for comparison within this scenario only.</small>
        </div>
      </section>
      <PathwayStyles />
    </div>
  );
}

function SkillGroup({
  label,
  kind,
  skills,
}: {
  label: string;
  kind: 'rising' | 'stable' | 'declining';
  skills: string[];
}) {
  const Icon = kind === 'rising' ? TrendingUp : kind === 'declining' ? TrendingDown : Minus;
  return (
    <section className={`scenario-skill-group ${kind}`}>
      <h4><Icon size={14} aria-hidden="true" />{label}</h4>
      {skills.length ? (
        <div className="pathway-skill-chips">
          {skills.map((skill) => <span className="pathway-skill-chip" key={skill}>{skill}</span>)}
        </div>
      ) : (
        <span className="scenario-no-skills">No skills listed</span>
      )}
    </section>
  );
}

function PathwayStyles() {
  return (
    <style>{`
      .pathway-page { --pw-ink:#30483b; --pw-muted:#72796f; --pw-line:#e5e4d9; --pw-sage:#edf1e8; --pw-amber:#f7f0e5; color:var(--pw-ink); }
      .pathway-page * { box-sizing:border-box; }
      .pathway-page h2,.pathway-page h3,.pathway-page h4,.pathway-page p { margin-top:0; }
      .pathway-overline { color:#7d8477; font:500 9px 'IBM Plex Mono',monospace; letter-spacing:.14em; text-transform:uppercase; }
      .pathway-label { display:block; color:#4c5b4f; font-size:11px; font-weight:700; margin-bottom:7px; }
      .pathway-select-wrap { width:min(100%,340px); }
      .pathway-select-control { position:relative; display:flex; align-items:center; gap:9px; padding:0 12px; background:#fffdf8; border:1px solid #dcded3; border-radius:10px; color:#627568; }
      .pathway-select { width:100%; min-width:0; appearance:none; border:0; outline:0; background:transparent; color:#334a3e; padding:11px 20px 11px 0; font:600 13px 'DM Sans',sans-serif; cursor:pointer; }
      .pathway-select-control:after { content:''; position:absolute; right:13px; width:7px; height:7px; border-right:1.5px solid #758176; border-bottom:1.5px solid #758176; transform:rotate(45deg) translateY(-2px); pointer-events:none; }
      .pathway-intro { display:flex; justify-content:space-between; align-items:end; gap:25px; padding:clamp(20px,3vw,30px); border:1px solid #dfe2d7; border-radius:17px; background:linear-gradient(115deg,#e9ede3 0%,#f4f2e9 100%); margin-bottom:19px; }
      .pathway-intro-copy { max-width:520px; }
      .pathway-intro h2 { font:700 clamp(20px,2.8vw,27px)/1.16 Manrope,sans-serif; letter-spacing:-.035em; margin:9px 0 8px; color:#30483b; }
      .pathway-intro p,.scenario-switcher-copy p { margin:0; color:#6d776b; font-size:12px; line-height:1.7; max-width:500px; }
      .pathway-profile-context { display:flex; gap:11px; align-items:flex-start; padding:13px 15px; border:1px solid #e0e5d9; border-radius:12px; background:#f5f6ef; margin-bottom:28px; }
      .pathway-profile-context.muted { background:#faf6ee; border-color:#ece3d5; }
      .pathway-context-icon { display:grid; place-items:center; flex:0 0 29px; width:29px; height:29px; border-radius:9px; background:#e6ecdf; color:#54725b; }
      .pathway-profile-context.muted .pathway-context-icon { background:#f2e9dc; color:#927454; }
      .pathway-profile-context strong { display:block; font-size:12px; color:#3f5747; margin:1px 0 3px; }
      .pathway-profile-context p { margin:0; font-size:11px; color:#788073; line-height:1.55; overflow-wrap:anywhere; }
      .pathway-section-heading { display:flex; justify-content:space-between; align-items:end; gap:14px; margin:0 0 14px; }
      .pathway-section-heading h2 { font:700 19px/1.25 Manrope,sans-serif; letter-spacing:-.025em; color:#30483b; margin:5px 0 0; }
      .pathway-count { flex:0 0 auto; border:1px solid #e1e3d9; border-radius:99px; background:#f4f5ed; padding:6px 10px; color:#667365; font-size:10px; font-weight:700; }
      .pathway-timeline { display:grid; gap:0; max-width:880px; }
      .pathway-step { display:grid; grid-template-columns:40px minmax(0,1fr); gap:12px; align-items:stretch; }
      .pathway-step-marker { position:relative; display:flex; justify-content:center; padding-top:20px; }
      .pathway-step-marker span { z-index:1; display:grid; place-items:center; width:34px; height:34px; border:1px solid #cfd7ca; border-radius:50%; background:#f5f6ef; color:#49654f; font:500 11px 'IBM Plex Mono',monospace; }
      .pathway-step-marker i { position:absolute; top:54px; bottom:0; width:1px; background:#dce1d7; }
      .pathway-step-card { min-width:0; margin-bottom:12px; border:1px solid #e4e3d9; border-radius:15px; background:#fffdf8; padding:19px 21px; box-shadow:0 4px 16px rgba(54,58,42,.025); }
      .pathway-step-topline { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
      .pathway-duration { border-radius:99px; background:#f4f0e7; color:#76664e; padding:5px 9px; font-size:10px; font-weight:600; }
      .pathway-step-card h3 { margin:8px 0 16px; color:#30483b; font:700 17px/1.3 Manrope,sans-serif; letter-spacing:-.02em; }
      .pathway-resource { border-top:1px solid #ecebe2; padding-top:12px; }
      .pathway-resource-heading { display:flex; align-items:center; gap:7px; color:#536b58; font-size:11px; font-weight:700; margin-bottom:9px; }
      .pathway-resource-detail { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px 12px; align-items:center; }
      .pathway-resource-detail strong,.pathway-resource-detail span { display:block; }
      .pathway-resource-detail strong { color:#405347; font-size:12px; }
      .pathway-resource-detail span { margin-top:3px; color:#82887d; font-size:10px; }
      .pathway-resource-detail p { grid-column:1/-1; margin:4px 0 0; color:#72796f; font-size:11px; line-height:1.55; }
      .pathway-resource-link { display:inline-flex; align-items:center; gap:5px; color:#47684f; font-size:10px; font-weight:700; text-decoration:none; }
      .pathway-resource-link:hover { text-decoration:underline; }
      .pathway-checked-date { grid-column:1/-1; }
      .pathway-resource-unverified { display:flex; align-items:flex-start; gap:9px; }
      .pathway-resource-unverified p { margin:0; color:#786c59; font-size:11px; line-height:1.6; }
      .pathway-status-pill { flex:0 0 auto; border:1px solid #eadcc8; border-radius:99px; background:#faf4e9; color:#806849; padding:4px 8px; font-size:9px; font-weight:700; white-space:nowrap; }
      .pathway-notice { display:flex; gap:11px; align-items:flex-start; padding:14px 16px; border-radius:12px; margin:18px 0; color:#536d59; }
      .pathway-notice.sage { background:#edf1e8; border:1px solid #e0e6db; }
      .pathway-notice.sand { background:#f8f1e7; border:1px solid #eee2d1; color:#896e4f; }
      .pathway-notice>svg { flex:0 0 auto; margin-top:1px; }
      .pathway-notice strong { display:block; font-size:12px; color:#3e5846; margin-bottom:3px; }
      .pathway-notice.sand strong { color:#755b3e; }
      .pathway-notice p { margin:0; font-size:11px; line-height:1.6; color:#6e796d; }
      .pathway-notice.sand p { color:#7d715f; }
      .pathway-empty { display:grid; justify-items:center; text-align:center; padding:34px 20px; border:1px dashed #d7dbd0; border-radius:15px; background:#f8f8f1; }
      .pathway-empty-mark { display:grid; place-items:center; width:42px; height:42px; border-radius:14px; background:#e9eee3; color:#56725d; }
      .pathway-empty h2 { margin:13px 0 5px; color:#405748; font:700 16px Manrope,sans-serif; }
      .pathway-empty p { max-width:430px; margin:0; color:#788074; font-size:12px; line-height:1.6; }
      .pathway-filter-panel { display:flex; justify-content:space-between; align-items:end; gap:18px; padding:18px 20px; margin:20px 0 26px; border:1px solid #e3e3d9; border-radius:14px; background:#f8f7ef; }
      .pathway-filter-panel h2 { margin:5px 0 0; color:#344a3c; font:700 15px Manrope,sans-serif; }
      .impact-heading { margin-bottom:13px; }
      .pathway-goal-list { display:grid; gap:12px; }
      .pathway-goal-card { display:grid; grid-template-columns:64px minmax(0,1fr); gap:17px; padding:20px; border:1px solid #e4e3d9; border-radius:15px; background:#fffdf8; box-shadow:0 4px 16px rgba(54,58,42,.025); }
      .pathway-goal-number { align-self:start; display:flex; flex-direction:column; justify-content:center; min-height:64px; padding-left:12px; border-radius:12px; background:#e8ede3; color:#4d6b53; }
      .pathway-goal-number span { font:500 8px 'IBM Plex Mono',monospace; letter-spacing:.12em; }
      .pathway-goal-number strong { margin-top:3px; font:700 24px/1 Manrope,sans-serif; letter-spacing:-.04em; }
      .pathway-goal-content { min-width:0; }
      .pathway-goal-title-row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .pathway-goal-title-row h3 { margin:5px 0 0; color:#30483b; font:700 17px Manrope,sans-serif; }
      .pathway-relationship { flex:0 0 auto; padding:6px 9px; border-radius:99px; font-size:9px; font-weight:700; }
      .pathway-relationship.potential { color:#4e6f55; background:#eef3e9; border:1px solid #dfe8d9; }
      .pathway-relationship.conditional { color:#806747; background:#faf3e8; border:1px solid #ede1cf; }
      .pathway-rationale { margin:10px 0 14px; color:#70786d; font-size:12px; line-height:1.7; }
      .pathway-skill-row { padding-top:11px; border-top:1px solid #ecebe2; }
      .pathway-skill-label { display:block; margin-bottom:8px; color:#798075; font-size:10px; font-weight:600; }
      .pathway-skill-chips { display:flex; flex-wrap:wrap; gap:6px; }
      .pathway-skill-chip { display:inline-flex; align-items:center; border:1px solid #e1e4da; border-radius:99px; background:#f4f5ee; color:#526351; padding:5px 9px; font-size:10px; font-weight:600; }
      .pathway-footnote { display:flex; align-items:flex-start; gap:9px; max-width:850px; margin:18px 0 0; color:#81877b; }
      .pathway-footnote svg { flex:0 0 auto; margin-top:2px; color:#6d816f; }
      .pathway-footnote p { margin:0; font-size:10px; line-height:1.6; }
      .scenario-switcher { display:flex; align-items:center; justify-content:space-between; gap:22px; padding:22px 24px; margin-bottom:16px; border:1px solid #dfe2d7; border-radius:16px; background:linear-gradient(115deg,#e9ede3,#f4f2e9); }
      .scenario-switcher-copy { max-width:490px; }
      .scenario-switcher-copy h2 { margin:6px 0 6px; color:#30483b; font:700 21px Manrope,sans-serif; letter-spacing:-.03em; }
      .scenario-toggle { display:flex; gap:5px; padding:5px; border:1px solid #d9ddd2; border-radius:12px; background:#f9f8f1; }
      .scenario-toggle button { display:flex; align-items:center; justify-content:center; gap:7px; min-height:39px; padding:0 13px; border:0; border-radius:8px; background:transparent; color:#687366; cursor:pointer; font:600 11px 'DM Sans',sans-serif; transition:background .18s,color .18s,transform .18s; }
      .scenario-toggle button:hover { transform:translateY(-1px); }
      .scenario-toggle button.selected { background:#3e5d48; color:#f8f5ec; box-shadow:0 2px 5px #30483b1c; }
      .scenario-toggle button.selected.fast { background:#8b6d4e; }
      .assumptions-panel { margin-top:23px; padding:21px; border:1px solid #e3e3d9; border-radius:15px; background:#fffdf8; }
      .pathway-section-heading.compact { align-items:center; margin-bottom:15px; }
      .pathway-section-heading.compact>svg { color:#70806e; }
      .assumption-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
      .assumption-row { min-width:0; padding:13px; border-radius:11px; background:#f4f4ec; }
      .assumption-row strong { display:block; color:#566354; font-size:10px; line-height:1.4; }
      .assumption-row span { display:block; margin-top:7px; color:#354e3f; font-size:12px; font-weight:700; }
      .assumption-row p { margin:6px 0 0; color:#7a8075; font-size:10px; line-height:1.5; }
      .pathway-inline-empty { margin:0; color:#7c8377; font-size:12px; }
      .scenario-results-heading { margin-top:28px; }
      .scenario-results { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .scenario-result-card { min-width:0; padding:20px; border:1px solid #e3e3d9; border-radius:15px; background:#fffdf8; box-shadow:0 4px 16px rgba(54,58,42,.025); }
      .scenario-result-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
      .scenario-result-header h3 { margin:6px 0 0; color:#30483b; font:700 17px Manrope,sans-serif; letter-spacing:-.02em; }
      .scenario-score { min-width:98px; display:flex; flex-direction:column; align-items:center; padding:10px; border-radius:12px; background:#eff2e9; }
      .scenario-score strong { color:#34513f; font:700 23px/1 Manrope,sans-serif; letter-spacing:-.05em; }
      .scenario-score span { margin-top:5px; color:#748071; font-size:9px; font-weight:600; text-align:center; }
      .scenario-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:17px 0 14px; padding:11px 0; border-top:1px solid #edede4; border-bottom:1px solid #edede4; }
      .scenario-metrics div { display:flex; justify-content:space-between; gap:6px; align-items:center; }
      .scenario-metrics span { color:#82877d; font-size:9px; }
      .scenario-metrics strong { color:#586957; font:600 10px 'IBM Plex Mono',monospace; }
      .scenario-skill-groups { display:grid; gap:10px; }
      .scenario-skill-group h4 { display:flex; align-items:center; gap:6px; margin:0 0 7px; font-size:10px; font-weight:700; color:#617363; }
      .scenario-skill-group.rising h4 { color:#4c7658; }
      .scenario-skill-group.declining h4 { color:#936e53; }
      .scenario-no-skills { color:#909489; font-size:10px; }
      .formula-panel { display:flex; align-items:flex-start; gap:12px; margin-top:17px; padding:16px; border:1px solid #e3e4d9; border-radius:13px; background:#f5f5ed; }
      .formula-icon { display:grid; place-items:center; flex:0 0 32px; width:32px; height:32px; border-radius:10px; background:#e7ecdf; color:#58715d; }
      .formula-panel p { margin:5px 0 5px; color:#59695a; font-size:12px; line-height:1.6; }
      .formula-panel small { color:#858a7e; font-size:10px; line-height:1.5; }
      @media(max-width:700px) { .pathway-intro,.scenario-switcher,.pathway-filter-panel { align-items:stretch; flex-direction:column; } .pathway-select-wrap { width:100%; } .scenario-toggle { width:100%; } .scenario-toggle button { flex:1; } .assumption-list { grid-template-columns:1fr; } .scenario-results { grid-template-columns:1fr; } }
      @media(max-width:500px) { .pathway-section-heading { align-items:flex-start; flex-direction:column; } .pathway-goal-card { grid-template-columns:48px minmax(0,1fr); gap:12px; padding:15px; } .pathway-goal-number { min-height:54px; padding-left:9px; } .pathway-goal-number strong { font-size:20px; } .pathway-goal-title-row { flex-direction:column; } .pathway-resource-detail { grid-template-columns:1fr; } .pathway-resource-link { justify-self:start; } .pathway-resource-detail p,.pathway-checked-date { grid-column:auto; } .scenario-result-header { flex-wrap:wrap; } .scenario-score { align-items:flex-start; min-width:0; } }
    `}</style>
  );
}
