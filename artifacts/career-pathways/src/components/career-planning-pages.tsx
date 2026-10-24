import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeading } from '@/components/page-heading';
import {
  buildLearningPlan,
  calculateScenarioResults,
  getOccupationGoalMappings,
  parseWorkforceScenarioData,
  scenarioAssumptions,
  type ScenarioId,
  type WorkforceScenarioData,
} from '@/lib/career-planning';
import { courseProgress, formatTime, type StudySession } from '@/lib/study-schedule';
import {
  readPersistedState,
  STORAGE_KEY as LEARNING_PROGRESS_STORAGE_KEY,
  writePersistedState,
  type PersistedState,
} from '@/lib/learning-progress';
import {
  buildCatalogStudySchedule,
  groupStudySessionsByWeek,
  toggleCatalogSession,
} from '@/lib/roadmap-catalog';
import { courseSupplements } from '@/lib/learning-resource-supplements';
import { getCourseLevel } from '@/lib/course-levels';
import { careerProfiles as learningTracks, resources as learningResources, type Resource } from '@/lib/learning-resources';
import { sdgLabel } from '@/lib/career-matching';
import type { CareerRecord } from '@/lib/career-data';
import { localizeContent, useI18n, type Locale } from '@/lib/i18n';

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

const TRACK_SELECTION_STORAGE_KEY = 'career-pathways-catalog-track:v1';
const weekdayNames: Record<Locale, string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  zh: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  ms: ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'],
};

function createTrackProgressStorage(signature: string): Storage | null {
  if (!signature || typeof window === 'undefined') return null;
  try {
    const backing = window.localStorage;
    const namespacedKey = `${LEARNING_PROGRESS_STORAGE_KEY}:${signature}`;
    return {
      get length() {
        return backing.getItem(namespacedKey) === null ? 0 : 1;
      },
      clear() {
        backing.removeItem(namespacedKey);
      },
      getItem() {
        return backing.getItem(namespacedKey);
      },
      key(index: number) {
        return index === 0 && backing.getItem(namespacedKey) !== null ? namespacedKey : null;
      },
      removeItem() {
        backing.removeItem(namespacedKey);
      },
      setItem(_key: string, value: string) {
        backing.setItem(namespacedKey, value);
      },
    };
  } catch {
    return null;
  }
}

function CatalogLearningPlan() {
  const { t, locale } = useI18n();
  const [selectedTrackId, setSelectedTrackId] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = window.localStorage.getItem(TRACK_SELECTION_STORAGE_KEY) ?? '';
      return learningTracks.some((track) => track.id === saved) ? saved : '';
    } catch {
      return '';
    }
  });
  const [trackSelectionSaveError, setTrackSelectionSaveError] = useState(false);
  const [progressSaveError, setProgressSaveError] = useState(false);
  const selectedTrack = learningTracks.find((track) => track.id === selectedTrackId);
  const signature = selectedTrack ? `catalog-track:v1:${selectedTrack.id}` : '';
  const progressStorage = useMemo(() => createTrackProgressStorage(signature), [signature]);
  const resourceById = useMemo(
    () => new Map<string, Resource>(learningResources.map((resource) => [resource.id, resource] as const)),
    [],
  );
  const trackCourses = useMemo(() => selectedTrack?.skills.flatMap(({ skill, courses }) =>
    courses.map((resource) => ({ skill, resource })),
  ) ?? [], [selectedTrack]);
  const coursesById = useMemo(
    () => new Map(trackCourses.map((course) => [course.resource.id, course] as const)),
    [trackCourses],
  );
  const validResourceIds = useMemo(
    () => new Set(trackCourses.map(({ resource }) => resource.id)),
    [trackCourses],
  );
  const courseHours = useMemo(
    () => new Map<string, number>(trackCourses.map(({ resource }) => [resource.id, resource.estimatedHours] as const)),
    [trackCourses],
  );
  const defaultPlan = useMemo(
    () => selectedTrack
      ? buildCatalogStudySchedule(selectedTrack)
      : { sessions: [] as StudySession[], unscheduledResourceIds: [] as string[] },
    [selectedTrack],
  );
  const [trackProgress, setTrackProgress] = useState<PersistedState>({
    signature: '',
    completedIds: [],
    schedule: [],
  });

  useEffect(() => {
    if (!selectedTrack || !progressStorage) {
      setTrackProgress({ signature, completedIds: [], schedule: defaultPlan.sessions });
      setProgressSaveError(Boolean(selectedTrack));
      return;
    }
    const restored = readPersistedState(signature, progressStorage, validResourceIds, courseHours);
    let nextState = restored.state;
    let saved = restored.available;
    if (!nextState.schedule.length && defaultPlan.sessions.length) {
      nextState = { ...nextState, schedule: defaultPlan.sessions };
      saved = writePersistedState(nextState, progressStorage);
    }
    setTrackProgress(nextState);
    setProgressSaveError(!saved);
  }, [selectedTrack, signature, progressStorage, validResourceIds, courseHours, defaultPlan]);

  const activeProgress = trackProgress.signature === signature ? trackProgress : null;
  const sessions = activeProgress?.schedule ?? defaultPlan.sessions;
  const completedIds = activeProgress?.completedIds ?? [];
  const weeks = groupStudySessionsByWeek(sessions);
  const totalCompleted = sessions.filter((session) => session.completed).length;

  function handleTrackChange(trackId: string) {
    setSelectedTrackId(trackId);
    setTrackSelectionSaveError(false);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TRACK_SELECTION_STORAGE_KEY, trackId);
    } catch {
      setTrackSelectionSaveError(true);
    }
  }

  function handleSessionChange(sessionId: string, isComplete: boolean) {
    if (!selectedTrack || !progressStorage) {
      setProgressSaveError(true);
      return;
    }
    const currentState = activeProgress ?? {
      signature,
      completedIds: [],
      schedule: defaultPlan.sessions,
    };
    const nextState = toggleCatalogSession(currentState, sessionId, isComplete, [...validResourceIds]);
    setTrackProgress(nextState);
    setProgressSaveError(!writePersistedState(nextState, progressStorage));
  }

  return <section className="panel" style={{ marginTop: 18 }} data-testid="catalog-learning-plan">
    <h2 className="planning-title">{t('Catalogue learning track')}</h2>
    <p className="planning-note">{t('This is a separate catalogue track and does not change your selected PivotPath AI occupation.')}</p>
    <div style={{ maxWidth: 520, marginTop: 14 }}>
      <label className="label" htmlFor="catalog-learning-track">{t('Choose a catalogue career track')}</label>
      <select
        id="catalog-learning-track"
        className="field"
        value={selectedTrackId}
        onChange={(event) => handleTrackChange(event.target.value)}
        data-testid="select-catalog-learning-track"
      >
        <option value="">{t('Choose a catalogue career track')}</option>
        {learningTracks.map((track) => <option key={track.id} value={track.id}>{localizeContent(track.targetRole, locale)}</option>)}
      </select>
    </div>
    {trackSelectionSaveError && <p className="planning-notice" role="alert">{t('Track selection could not be saved. Select it again after refreshing.')}</p>}
    {!selectedTrack && <p className="planning-note" role="status" data-testid="status-catalog-track-empty">{t('Select a track to generate its weekly schedule.')}</p>}
    {selectedTrack && <>
      <h3 className="planning-title" style={{ marginTop: 20 }}>{t('Weekly study schedule')}</h3>
      <div className="planning-notice">{t('The schedule uses catalogue study-hour estimates and places one session at 09:00 at a time. It is a starter template, not a required workload.')}</div>
      <p className="planning-note" role={progressSaveError ? 'alert' : 'status'} data-testid="status-catalog-progress">
        {progressSaveError
          ? t('Progress could not be saved. Changes remain visible here but may be lost after refresh.')
          : t('Progress is saved in this browser for this learning track.')}
      </p>
      {weeks.length === 0
        ? <div className="panel" role="status" data-testid="status-catalog-no-schedule">{t('No weekly sessions could be generated for this track.')}</div>
        : <div style={{ display: 'grid', gap: 16 }} data-testid="list-catalog-weeks">
          {weeks.map(({ week, sessions: weekSessions }) => {
            const weekResourceIds = [...new Set(weekSessions.map((session) => session.nodeId))];
            return <section className="panel" key={week} data-testid={`catalog-week-${week + 1}`}>
              <h4 className="planning-title">{t('Week')} {week + 1}</h4>
              {weekResourceIds.length === 0
                ? <p className="planning-note">{t('No resources are planned for this week.')}</p>
                : <div style={{ display: 'grid', gap: 14 }}>
                  {weekResourceIds.map((resourceId) => {
                    const course = coursesById.get(resourceId);
                    const resource = resourceById.get(resourceId) ?? course?.resource;
                    const thisWeekSessions = weekSessions.filter((session) => session.nodeId === resourceId);
                    if (!resource || !course) {
                      return <div className="planning-notice" role="status" key={resourceId}>
                        {t('No catalogue resource is available for this plan item.')}
                      </div>;
                    }
                    const courseStatus = courseProgress(
                      resourceId,
                      resource.estimatedHours,
                      sessions,
                      completedIds.includes(resourceId),
                    );
                    const level = getCourseLevel(course.skill, resource.id);
                    const supplementUrl = courseSupplements[course.skill];
                    const hasSupplement = Boolean(supplementUrl && selectedTrack.skills
                      .find((item) => item.skill === course.skill)?.courses.some((item) => item.url === supplementUrl));
                    return <article className="panel" key={resourceId} data-testid={`catalog-course-${resourceId}-week-${week + 1}`}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <h5 className="planning-title" style={{ margin: 0 }}>{localizeContent(course.skill, locale)}</h5>
                        <span className="tag">{t(level)}</span>
                      </div>
                      <p className="planning-note">{resource.resourceName} · {resource.provider}</p>
                      <p className="planning-note">
                        {t('Estimated course hours')}: {resource.estimatedHours} {t('hours')} · {t('Progress')}: {courseStatus.completedHours} / {courseStatus.totalHours} {t('hours')} ({courseStatus.percentage}%)
                      </p>
                      {thisWeekSessions.length === 0
                        ? <p className="planning-note">{t('No study sessions are planned for this week.')}</p>
                        : <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
                          {thisWeekSessions.map((session) => {
                            const duration = session.durationMinutes / 60;
                            const durationLabel = Number.isInteger(duration) ? String(duration) : duration.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
                            const sessionLabel = `${weekdayNames[locale][session.day]} · ${formatTime(session.startMinutes)}–${formatTime(session.startMinutes + session.durationMinutes)} · ${durationLabel} ${t('hours')}`;
                            return <div
                              key={session.id}
                              className={`flex items-center gap-3 rounded-md border p-3 ${session.completed ? 'opacity-60' : ''}`}
                              data-testid={`catalog-session-${session.id}`}
                            >
                              <Checkbox
                                checked={session.completed}
                                onCheckedChange={(checked) => handleSessionChange(session.id, checked === true)}
                                aria-label={`${t('Mark study session complete')}: ${sessionLabel}`}
                                data-testid={`checkbox-session-${session.id}`}
                              />
                              <span className={session.completed ? 'line-through' : ''}>{sessionLabel}</span>
                            </div>;
                          })}
                        </div>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="btn" data-testid={`link-catalog-resource-${resource.id}`}>
                          <BookOpen size={14} />{t('Open learning resource')}<ExternalLink size={13} />
                        </a>
                        {supplementUrl && !hasSupplement && <a
                          href={supplementUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          data-testid={`link-catalog-supplement-${resource.id}`}
                        >
                          <BookOpen size={14} />{t('Supplementary reference')}<ExternalLink size={13} />
                        </a>}
                      </div>
                    </article>;
                  })}
                </div>}
            </section>;
          })}
        </div>}
      {defaultPlan.unscheduledResourceIds.length > 0 && <p className="planning-notice" role="status" data-testid="status-catalog-unscheduled">
        {t('Some catalogue resources have missing or invalid duration estimates and were not scheduled.')}
      </p>}
      {sessions.length > 0 && <p className="planning-note" data-testid="status-catalog-completion">
        {t('Progress')}: {totalCompleted} / {sessions.length} {t('study sessions completed')}
      </p>}
    </>}
  </section>;
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
    <CatalogLearningPlan />
    <Link href="/impact" className="btn btn-primary" data-testid="link-pathway-sdg">{t('Explore this occupation’s SDG alignment')} <ArrowRight size={14} /></Link>
  </>;
}

export function OccupationImpactPage(props: SelectionProps) {
  const { t, locale } = useI18n();
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const mappings = getOccupationGoalMappings(props.selectedOccupation);
  const contributionNotes = [
    { goalNumber: 4, key: 'sdg4.explanation' },
    { goalNumber: 7, key: 'sdg7.explanation' },
    { goalNumber: 8, key: 'sdg8.explanation' },
    { goalNumber: 9, key: 'sdg9.explanation' },
    { goalNumber: 10, key: 'sdg10.explanation' },
    { goalNumber: 12, key: 'sdg12.explanation' },
    { goalNumber: 13, key: 'sdg13.explanation' },
  ] as const;
  const activeNote = contributionNotes.find(note => note.goalNumber === selectedGoal);
  return <>
    <PageHeading kicker={t('Connect work to wider goals')} title={t('SDG Mapping')} description={t('Explore how an occupation and its skills could support selected UN Sustainable Development Goals in an appropriate context.')} />
    <OccupationSelector {...props} />
    <div className="planning-notice"><strong>{t('Intended contribution is not measured impact.')}</strong> {t('These are app-authored explanations, not UN endorsements or assessments. No SDG indicators, employment outcomes, emissions, or social outcomes are measured here.')}</div>
    <section className="panel" aria-labelledby="sdg-contribution-notes-title" style={{ marginBottom: 18 }}>
      <h2 id="sdg-contribution-notes-title" className="planning-title">{t('Explore the seven SDG contribution notes')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {contributionNotes.map(note => (
          <button
            type="button"
            className="panel"
            key={note.goalNumber}
            onClick={() => setSelectedGoal(note.goalNumber)}
            aria-haspopup="dialog"
            data-testid={`button-sdg-note-${note.goalNumber}`}
            style={{ textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 7, padding: 14 }}
          >
            <span className="tag">SDG {note.goalNumber}</span>
            <strong>{sdgLabel(note.goalNumber, locale === 'ms' ? 'bm' : locale)}</strong>
            <span style={{ fontSize: 11 }}>{t('Open contribution note')} →</span>
          </button>
        ))}
      </div>
    </section>
    <Dialog open={selectedGoal !== null} onOpenChange={open => { if (!open) setSelectedGoal(null); }}>
      <DialogContent closeLabel={t('Close')} closeTestId="button-close-sdg-note" className="sm:max-w-xl">
        {activeNote && (
          <>
            <DialogHeader>
              <DialogTitle>
                SDG {activeNote.goalNumber} · {sdgLabel(activeNote.goalNumber, locale === 'ms' ? 'bm' : locale)}
              </DialogTitle>
              <DialogDescription>{t('Potential contribution')}</DialogDescription>
            </DialogHeader>
            <p className="planning-note" data-testid={`text-sdg-note-${activeNote.goalNumber}`}>
              {t(activeNote.key)}
            </p>
            <p className="planning-note">{t('This is an intended alignment, not a measured impact or proof of SDG progress.')}</p>
            <DialogFooter>
              <DialogClose asChild><button className="btn">{t('Close')}</button></DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    {props.selectedOccupation && mappings.length === 0 && <div className="panel" data-testid="status-sdg-unmapped">{t('No reviewed SDG explanation is available for this occupation yet. A goal label has not been assigned automatically.')}</div>}
    <div style={{ display: 'grid', gap: 14 }}>
      {mappings.map(mapping => <article className="panel" key={mapping.goalNumber} data-testid={`card-occupation-sdg-${mapping.goalNumber}`}>
        <span className="tag">SDG {mapping.goalNumber} · {t(`${mapping.relationship} alignment`)}</span>
        <h2 className="planning-title" style={{ marginTop: 12 }}>{localizeContent(mapping.goalTitle, locale)}</h2>
        <p className="planning-note">{mapping.localizedRationale?.[locale] ?? localizeContent(mapping.rationale, locale)}</p>
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
  const [curveData, setCurveData] = useState<WorkforceScenarioData | null>(null);
  const [curveStatus, setCurveStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    const loadScenarioData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/workforce-scenarios.json`);
        if (!response.ok) throw new Error('Scenario data request failed');
        const parsed = parseWorkforceScenarioData(await response.json());
        if (!cancelled) {
          setCurveData(parsed);
          setCurveStatus('ready');
        }
      } catch {
        if (!cancelled) setCurveStatus('error');
      }
    };
    void loadScenarioData();
    return () => { cancelled = true; };
  }, []);
  const results = calculateScenarioResults(profileSkills, records, scenario);
  const curveLabel = (item: WorkforceScenarioData['scenarios'][number]) =>
    locale === 'zh' ? item.labelZh : locale === 'ms' ? item.labelMs : item.labelEn;
  return <>
    <PageHeading kicker={t('Test assumptions, not predictions')} title={t('Future Scenarios')} description={t('Choose a what-if lens and see how it changes the interpretation and ranking of your skill overlap. Your original overlap score is preserved.')} />
    {records.some(record => record.catalog) && <div className="planning-notice">{t('Source-backed occupations have no verified demand trend. They receive neutral scenario weights; an unchanged scenario result is not evidence of market stability.')}</div>}
    <div className="planning-notice"><strong>{t('Estimates only.')}</strong> {t('These synthetic scenarios do not predict AI adoption, hiring odds, or employment outcomes. The included skill directions are synthetic too.')}</div>
    <section className="panel" aria-labelledby="scenario-curves-title" data-testid="section-scenario-curves" style={{ marginBottom: 18 }}>
      <h2 id="scenario-curves-title" className="planning-title">{t('2026–2030 illustrative scenario curves')}</h2>
      <p className="planning-note">{t('scenario.why')}</p>
      <p className="planning-note">{t('These team-provided values are illustrative, not measured labour-market data or a forecast. The data does not specify a unit.')}</p>
      {curveStatus === 'loading' && <p role="status">{t('Loading local scenario data…')}</p>}
      {curveStatus === 'error' && <p role="alert">{t('Scenario data could not be loaded.')}</p>}
      {curveData && (
        <>
          <div role="img" aria-label={t('2026–2030 illustrative scenario curves')} style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData.years} margin={{ top: 12, right: 14, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e6dc" />
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#c9c9bd' }} />
                <YAxis allowDecimals={false} width={40} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [String(value), t('Scenario values are illustrative; the dataset does not provide a unit.')]} />
                <Legend />
                <Line type="linear" dataKey="lowAI" name={curveLabel(curveData.scenarios[0])} stroke="#557f61" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" dataKey="moderateAI" name={curveLabel(curveData.scenarios[1])} stroke="#b8874b" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="linear" dataKey="highAI" name={curveLabel(curveData.scenarios[2])} stroke="#a5645e" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="planning-note" data-testid="text-scenario-source">
            {t('Illustrative source: {source} · published {date}', { source: curveData.source.name, date: curveData.source.publishedAt })}
          </p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {curveData.scenarios.map(option => (
              <div key={option.id} style={{ borderTop: '1px solid #e8e7dd', paddingTop: 9 }}>
                <strong style={{ fontSize: 12 }}>{curveLabel(option)}</strong>
                <p className="planning-note" style={{ marginBottom: 0 }}>{t(`scenario.assumption.${option.id}`)}</p>
              </div>
            ))}
          </div>
          <p className="planning-note"><strong>{t('Uncertainty sources')}:</strong> {t('uncertainty.sources')}</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
              <caption style={{ textAlign: 'left', padding: '8px 0', color: '#697568' }}>{t('Scenario values are illustrative; the dataset does not provide a unit.')}</caption>
              <thead><tr>
                <th style={{ padding: 8 }}>{t('Year')}</th>
                {curveData.scenarios.map(option => <th key={option.id} style={{ padding: 8 }}>{curveLabel(option)}</th>)}
              </tr></thead>
              <tbody>{curveData.years.map(row => <tr key={row.year} style={{ borderTop: '1px solid #e8e7dd' }}>
                <th scope="row" style={{ padding: 8 }}>{row.year}</th>
                <td style={{ padding: 8 }}>{row.lowAI}</td>
                <td style={{ padding: 8 }}>{row.moderateAI}</td>
                <td style={{ padding: 8 }}>{row.highAI}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
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
        {result.unknownTrendSkills.length > 0 && <p className="planning-note">{t('Unknown-direction skills (neutral scenario weight):')} {result.unknownTrendSkills.map(skill => localizeContent(skill, locale)).join(', ')}</p>}
      </article>)}
    </div>
    <Link href="/roles" className="btn" style={{ marginTop: 18 }} data-testid="link-scenario-roles">{t('Return to original role matches')} <ArrowRight size={14} /></Link>
  </>;
}

export function PlanningStyles() {
  return <style>{`.planning-title{font:700 19px Manrope;color:#30483b;margin:0 0 10px}.planning-note{font-size:12px;color:#697568;line-height:1.7;margin:10px 0}.planning-note a{color:#355c40;text-decoration:underline}.planning-notice{font-size:12px;line-height:1.7;color:#626e62;background:#eceee4;padding:14px 17px;border-radius:11px;margin-bottom:18px}.planning-notice+ol{margin-top:18px}`}</style>;
}
