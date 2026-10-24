import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Lightbulb, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  explainCareerMatches,
  getVerifiedCitation,
  rankCareerMatchesForDisplay,
  type CareerRecord,
  type DatasetResult,
} from '@/lib/career-data';
import { OCCUPATION_INSIGHTS, parseSkills } from '@/lib/career-matching';
import { normalizeProfile } from '@/lib/profile';
import { PROFILE_STORAGE_KEY } from '@/lib/profile-storage';
import {
  DIMENSION_IDS,
  DIMENSION_NAMES,
  profileDimensions,
  roleDimensions,
} from '@/lib/skill-dimensions';
import { CatalogAttribution, OccupationCatalogDetails } from './occupation-catalog-details';
import { PageHeading } from '@/components/page-heading';
import { localizeContent, useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type DatasetState = DatasetResult & {
  loading: boolean;
  loadError: string;
};

export function DatasetFeedback({ dataset }: { dataset: DatasetState }) {
  const { t, locale } = useI18n();
  if (dataset.loading) {
    return (
      <div
        className="panel"
        role="status"
        data-testid="status-dataset-loading"
      >
        {t('Loading occupation and demonstration datasets…')}
      </div>
    );
  }

  return (
    <>
      {dataset.loadError && (
        <div className="panel" role="alert" data-testid="error-dataset-load">
          {t('Dataset could not be loaded: {error}', { error: localizeContent(dataset.loadError, locale) })}
        </div>
      )}
      {dataset.errors.length > 0 && (
        <div
          className="panel"
          role="status"
          data-testid="status-dataset-errors"
          style={{ marginBottom: 14 }}
        >
          <strong>
            {t('{n} dataset row or format issue(s) found.', { n: dataset.errors.length })}
          </strong>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>
            {t('Invalid rows were skipped; valid rows remain available.')}
          </p>
          <ul
            style={{
              margin: '8px 0 0',
              paddingLeft: 19,
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            {dataset.errors.slice(0, 4).map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
          {dataset.errors.length > 4 && (
            <p style={{ margin: '6px 0 0', fontSize: 11 }}>
              {t('Showing the first four issues.')}
            </p>
          )}
        </div>
      )}
      {dataset.records.length === 0 && !dataset.loadError && (
        <div
          className="panel"
          role="status"
          data-testid="status-dataset-empty"
        >
          {t('There are no valid records to display. Check the CSV columns and row values.')}
        </div>
      )}
    </>
  );
}

function readConfirmedProfileSkills(): string[] {
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) return [];
    const profile = normalizeProfile(JSON.parse(stored));
    return profile?.confirmed_by_user === true ? parseSkills(profile.skills) : [];
  } catch {
    return [];
  }
}

function RecordProvenance({
  record,
  onSelectOccupation,
}: {
  record: CareerRecord;
  onSelectOccupation: (record: CareerRecord) => void;
}) {
  const { t, locale, tag } = useI18n();
  const directionLabel = record.catalog ? t('Market trend unknown') : t(record.trendDirection.charAt(0).toUpperCase() + record.trendDirection.slice(1));
  const citation = getVerifiedCitation(record);

  return (
    <div
      style={{
        borderTop: '1px solid #ebe9df',
        paddingTop: 12,
        marginTop: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 7,
        }}
      >
        <button
          type="button"
          className="tag"
          onClick={() => onSelectOccupation(record)}
          aria-label={t('Show historical employment for {occupation}', {
            occupation: localizeContent(record.occupation, locale),
          })}
          data-testid={`button-occupation-history-${record.catalog?.onetCode ?? record.occupation}`}
          style={{
            cursor: 'pointer',
            font: 'inherit',
            lineHeight: 'inherit',
          }}
        >
          {localizeContent(record.occupation, locale)}
        </button>
        <span
          className={`tag ${
            record.trendDirection === 'declining' ? 'trend-down' : 'trend-up'
          }`}
        >
          {directionLabel} ·{' '}
          {record.recordStatus === 'synthetic'
            ? t('synthetic example')
            : record.catalog ? t('Verified occupation association') : t('marked verified in dataset')}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: '#6e776b',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {record.catalog
          ? t('Source verification covers the occupation–competency association only. No demand trend has been verified.')
          : localizeContent(record.evidence, locale)}
      </p>
      {citation ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: 8,
            fontSize: 11,
          }}
        >
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-source-${record.occupation}-${record.skill}`}
            style={{ color: '#42684f', fontWeight: 700 }}
          >
            {citation.sourceName}
          </a>
          <time
            dateTime={citation.publicationDate}
            data-testid={`date-source-${record.occupation}-${record.skill}`}
            style={{ color: '#788076' }}
          >
            {t('Published')} {new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${citation.publicationDate}T00:00:00.000Z`))}
          </time>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#888d82', margin: '8px 0 0' }}>
          {t('No verified source or publication date is recorded for this synthetic example.')}
        </p>
      )}
    </div>
  );
}

export function CareerSkillsPage({
  dataset,
}: {
  dataset: DatasetState;
}) {
  const { t, locale, tag } = useI18n();
  const [selectedOccupation, setSelectedOccupation] = useState<CareerRecord | null>(null);
  const [history, setHistory] = useState<{
    occupationCode: string;
    socCode: string;
    sourceName: string;
    sourceUrl: string;
    refreshedAt: string;
    points: { year: number; employment: number }[];
  } | null>(null);
  const [historyState, setHistoryState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error'>('idle');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const confirmedSkills = readConfirmedProfileSkills();
  const profileValues = confirmedSkills.length ? profileDimensions(confirmedSkills) : null;
  const profileRadarData = profileValues
    ? DIMENSION_IDS.map((dimension) => ({
        dimension: t(DIMENSION_NAMES[dimension]),
        value: profileValues[dimension],
      }))
    : [];
  const hasProfileRadarData = profileRadarData.some((point) => point.value > 0);
  const groups = new Map<string, { skill: string; records: CareerRecord[] }>();
  for (const record of dataset.records) {
    const key = record.skill.toLocaleLowerCase();
    const group = groups.get(key) ?? { skill: record.skill, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  const skillGroups = Array.from(groups.values()).sort((left, right) =>
    left.skill.localeCompare(right.skill),
  );
  const counts = { rising: 0, declining: 0, stable: 0, unknown: 0 };
  for (const record of dataset.records) {
    if (record.catalog) counts.unknown += 1;
    else counts[record.trendDirection] += 1;
  }
  const verifiedCount = dataset.records.filter(
    (record) => record.recordStatus === 'verified',
  ).length;

  useEffect(() => {
    if (!selectedOccupation) {
      setHistory(null);
      setHistoryState('idle');
      return;
    }
    const occupationCode = selectedOccupation.catalog?.onetCode;
    if (!occupationCode) {
      setHistory(null);
      setHistoryState('unavailable');
      return;
    }

    const controller = new AbortController();
    setHistory(null);
    setHistoryState('loading');
    const url = `${import.meta.env.BASE_URL}api/occupations/history?occupationCode=${encodeURIComponent(occupationCode)}&refresh=${historyRefresh}`;
    void fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error('BLS_HISTORY_UNAVAILABLE');
        if (
          typeof body?.occupationCode !== 'string' ||
          typeof body?.socCode !== 'string' ||
          typeof body?.sourceName !== 'string' ||
          typeof body?.sourceUrl !== 'string' ||
          typeof body?.refreshedAt !== 'string' ||
          !Array.isArray(body?.points) ||
          body.points.some((point: unknown) =>
            !point || typeof point !== 'object' ||
            !Number.isInteger((point as { year?: unknown }).year) ||
            typeof (point as { employment?: unknown }).employment !== 'number' ||
            !Number.isFinite((point as { employment?: number }).employment),
          )
        ) {
          throw new Error('BLS_RESPONSE_INVALID');
        }
        return body as NonNullable<typeof history>;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setHistory(body);
        setHistoryState(body.points.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistory(null);
          setHistoryState('error');
        }
      });
    return () => controller.abort();
  }, [historyRefresh, selectedOccupation]);

  return (
    <>
      <PageHeading
        kicker={t('Explore changing work')}
        title={t('Future Skills Radar')}
        description={t('Source-backed associations and synthetic examples are shown separately. No market forecast is provided for the sourced occupations.')}
      />
      <section className="panel" data-testid="profile-skill-radar" style={{ marginBottom: 17 }}>
        {hasProfileRadarData ? (
          <>
            <h2 style={{ margin: '18px 20px 0', fontSize: 18, color: '#30483b' }}>
              {t('My skill profile')}
            </h2>
            <div style={{ width: '100%', height: 300, padding: '0 8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={profileRadarData} outerRadius="68%">
                  <PolarGrid stroke="#dce2d7" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#637064', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tickCount={5}
                    tick={{ fill: '#858d82', fontSize: 9 }}
                    axisLine={false}
                  />
                  <Radar
                    name={t('My skill profile')}
                    dataKey="value"
                    stroke="#30483b"
                    fill="#78977e"
                    fillOpacity={0.42}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ margin: '0 20px 17px', fontSize: 11, lineHeight: 1.5, color: '#737a70' }}>
              {t('Dimensions illustrate coverage after skill categorization; this is not an ability assessment.')}
            </p>
          </>
        ) : (
          <div style={{ padding: '18px 20px' }}>
            <p
              role="status"
              data-testid="status-profile-skill-radar-empty"
              style={{ margin: '0 0 12px', fontSize: 13, color: '#737a70' }}
            >
              {t('Go to My Profile first to enter skills before generating your skill profile.')}
            </p>
            <Link href="/profile" className="btn btn-primary" data-testid="link-profile-skill-radar">
              {t('Go to My Profile')} <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </section>
      <DatasetFeedback dataset={dataset} />
      <section className="panel" style={{ marginBottom: 17 }}>
        <div className="eyebrow">{t('Dataset status')}</div>
        <h2
          style={{
            font: '700 18px Manrope',
            margin: '6px 0',
            color: '#344a3c',
          }}
        >
          {t('Direction labels are not trend measurements')}
        </h2>
        <p
          style={{
            fontSize: 12,
            color: '#778074',
            lineHeight: 1.6,
            margin: '0 0 13px',
          }}
        >
          {t('Counts below describe the rows in this file only. They do not measure demand, growth, or decline in the real world.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag trend-up">{t('Rising examples')} · {counts.rising}</span>
          <span className="tag trend-down">
            {t('Declining examples')} · {counts.declining}
          </span>
          <span className="tag">{t('Stable examples')} · {counts.stable}</span>
          <span className="tag">{t('Unknown trend records')} · {counts.unknown}</span>
          <span className="tag">
            {t('{n} rows marked verified in dataset', { n: verifiedCount })}
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#858b80', margin: '12px 0 0' }}>
          {t('Verification labels and citations come from the CSV. The app checks citation fields and date format, but does not independently validate the source or its claims.')}
        </p>
      </section>
      <CatalogAttribution />
      {dataset.records.length > 0 && (
        <div className="skills-list">
          {skillGroups.map(({ skill, records }, index) => (
            <article
              className="panel"
              key={skill}
              data-testid={`card-skill-${index}`}
            >
              <h3
                style={{
                  font: '700 16px Manrope',
                  margin: 0,
                  color: '#344a3c',
                }}
              >
                {localizeContent(skill, locale)}
              </h3>
              {records.map((record, recordIndex) => (
                <RecordProvenance
                  key={`${record.occupation}-${record.skill}-${recordIndex}`}
                  record={record}
                  onSelectOccupation={setSelectedOccupation}
                />
              ))}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={selectedOccupation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOccupation(null);
            setHistory(null);
            setHistoryState('idle');
          }
        }}
      >
        <DialogContent
          closeLabel={t('Close')}
          closeTestId="button-close-occupation-history"
          className="sm:max-w-3xl"
          data-testid="dialog-occupation-history"
        >
          {selectedOccupation && (
            <>
              <DialogHeader>
                <DialogTitle>{localizeContent(selectedOccupation.occupation, locale)}</DialogTitle>
                <DialogDescription>
                  {t('Historical U.S. employment estimates from BLS OEWS. These annual estimates describe the past, not a forecast.')}
                </DialogDescription>
              </DialogHeader>
              {selectedOccupation.catalog && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                  <a href={selectedOccupation.catalog.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {t('O*NET occupation details')} · {selectedOccupation.catalog.onetCode}
                  </a>
                  <a href="https://www.bls.gov/oes/tables.htm" target="_blank" rel="noopener noreferrer">
                    {t('BLS OEWS source')}
                  </a>
                </div>
              )}
              {selectedOccupation.catalog && !selectedOccupation.catalog.onetCode.endsWith('.00') && (
                <p role="note" style={{ margin: 0, fontSize: 11, color: '#737a70' }}>
                  {t('This O*NET sub-occupation is shown using its broader six-digit BLS SOC group.')}
                </p>
              )}
              {historyState === 'loading' && (
                <div role="status" data-testid="status-occupation-history-loading" className="panel">
                  {t('Loading historical employment data…')}
                </div>
              )}
              {historyState === 'error' && (
                <div role="alert" data-testid="error-occupation-history" className="panel">
                  <p style={{ marginTop: 0 }}>{t('Historical employment data could not be loaded. Check your connection and try again.')}</p>
                  <button className="btn" type="button" onClick={() => setHistoryRefresh(value => value + 1)} data-testid="button-retry-occupation-history">
                    {t('Try again')} <RefreshCw size={14} />
                  </button>
                </div>
              )}
              {historyState === 'unavailable' && (
                <div role="status" className="panel" data-testid="status-occupation-history-unavailable">
                  {t('No O*NET occupation code is available for this record, so BLS history cannot be matched safely.')}
                </div>
              )}
              {historyState === 'empty' && (
                <div role="status" className="panel" data-testid="status-occupation-history-empty">
                  {t('BLS did not return historical employment observations for this occupation.')}
                </div>
              )}
              {historyState === 'ready' && history && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#6e776b' }}>
                      {t('Source')}: {history.sourceName} · {t('BLS occupation group')} {history.socCode} · {t('Last checked')}{' '}
                      {new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(history.refreshedAt))}
                    </p>
                    <button className="btn" type="button" onClick={() => setHistoryRefresh(value => value + 1)} data-testid="button-refresh-occupation-history">
                      <RefreshCw size={14} /> {t('Refresh data')}
                    </button>
                  </div>
                  {history.points.length >= 2 ? (
                    <div data-testid="chart-occupation-history" style={{ width: '100%', height: 320, marginTop: 4 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history.points} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
                          <CartesianGrid stroke="#e6e9e1" strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={{ fill: '#637064', fontSize: 11 }} />
                          <YAxis
                            tick={{ fill: '#637064', fontSize: 11 }}
                            tickFormatter={(value: number) => new Intl.NumberFormat(tag, { notation: 'compact' }).format(value)}
                            width={54}
                          />
                          <Tooltip
                            formatter={(value) => [new Intl.NumberFormat(tag).format(Number(value)), t('Employment estimate')]}
                            labelFormatter={(year) => `${t('Year')} ${year}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="employment"
                            name={t('Employment estimate')}
                            stroke="#2f746d"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#2f746d' }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div role="status" className="panel" data-testid="status-occupation-history-single-point">
                      {t('BLS returned only one annual estimate; there is not enough history to draw a trend line.')}
                      {history.points[0] && (
                        <strong style={{ display: 'block', marginTop: 8 }}>
                          {history.points[0].year}: {new Intl.NumberFormat(tag).format(history.points[0].employment)} {t('estimated jobs')}
                        </strong>
                      )}
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: 11, color: '#777f74' }}>
                    {t('Historical employment estimates are not forecasts. BLS occupation definitions may change across years.')}
                  </p>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <style>{`.skills-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:950px){.skills-list{grid-template-columns:1fr}}.trend-down{background:#f8f0e9;color:#805f46;border-color:#e8d6c8}.trend-up{background:#edf2e9;color:#4c7156;border-color:#dce4d9}`}</style>
    </>
  );
}

export function CareerRolesPage({
  dataset,
  profileSkills,
  onChooseOccupation,
}: {
  dataset: DatasetState;
  profileSkills: string;
  onChooseOccupation: (occupation: string) => void;
}) {
  const { t, locale } = useI18n();
  const rankedMatches = rankCareerMatchesForDisplay(profileSkills, dataset.records);
  const totalMatches = rankedMatches.length;
  const matches = rankedMatches.slice(0, 8);
  const explanations = new Map(
    explainCareerMatches(profileSkills, dataset.records, locale)
      .map((match) => [match.occupation, match]),
  );
  const hasProfileSkills = parseSkills(profileSkills).length > 0;
  const radarMatch = matches[0];
  const radarInsight = radarMatch
    ? OCCUPATION_INSIGHTS[radarMatch.occupation.toLowerCase()]
    : undefined;
  const radarWeights = radarInsight
    ? Object.fromEntries(
        Object.entries(radarInsight.skills).map(([skill, insight]) => [skill, insight.weight]),
      ) as Record<string, number>
    : undefined;
  const dimensionCoverage = hasProfileSkills && radarMatch?.requiredSkills.length
    ? roleDimensions(radarMatch.requiredSkills, radarMatch.matchingSkills, radarWeights)
    : null;
  const radarData = dimensionCoverage
    ? DIMENSION_IDS.map((dimension) => ({
        dimension: t(DIMENSION_NAMES[dimension]),
        required: dimensionCoverage.required[dimension],
        matched: dimensionCoverage.matched[dimension],
      }))
    : [];
  const hasDimensionData = radarData.some((point) => point.required > 0);

  return (
    <>
      <PageHeading
        kicker={t('Compare possible directions')}
        title={t('Future Role Matches')}
        description={t('Scores use occupation-specific skill weights where available; otherwise each required skill is weighted equally. This is not a hiring probability or prediction.')}
      />
      <DatasetFeedback dataset={dataset} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: '#eceee4',
          padding: '13px 15px',
          borderRadius: 11,
          fontSize: 12,
          color: '#637064',
          lineHeight: 1.6,
          marginBottom: 17,
        }}
      >
        <Lightbulb
          size={17}
          color="#56745d"
          style={{ flex: '0 0 auto', marginTop: 1 }}
        />
        <div>
          <strong>{t('Score formula:')}</strong> {t('Weighted score = total weight of skills you already have ÷ total weight of skills required by the occupation.')}
        </div>
      </div>
      {!dataset.loading && (
        <section className="panel" data-testid="role-skill-dimension-radar" style={{ marginBottom: 17 }}>
          {hasDimensionData ? (
            <>
              <div style={{ padding: '18px 20px 0' }}>
                <h2 style={{ margin: 0, fontSize: 18, color: '#30483b' }}>
                  {t('Role requirements vs. your skills')}
                </h2>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#737a70' }}>
                  {t('Based on the top-ranked role')}: {localizeContent(radarMatch!.occupation, locale)}
                </p>
              </div>
              <div style={{ width: '100%', height: 300, padding: '0 8px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="68%">
                    <PolarGrid stroke="#dce2d7" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: '#637064', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tickCount={5}
                      tick={{ fill: '#858d82', fontSize: 9 }}
                      axisLine={false}
                    />
                    <Radar
                      name={t('Role requirements')}
                      dataKey="required"
                      stroke="#30483b"
                      fill="#30483b"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Radar
                      name={t('Skills you have')}
                      dataKey="matched"
                      stroke="#78977e"
                      fill="#a9c1ad"
                      fillOpacity={0.5}
                      strokeWidth={2}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ margin: '0 20px 17px', fontSize: 11, lineHeight: 1.5, color: '#737a70' }}>
                {t('Dimensions illustrate coverage after skill categorization; they are not an ability assessment or an employment probability.')}
              </p>
            </>
          ) : (
            <p
              role="status"
              data-testid="status-role-skill-dimension-empty"
              style={{ margin: 0, padding: '20px', fontSize: 13, color: '#737a70' }}
            >
              {t('Add current skills to see this radar.')}
            </p>
          )}
        </section>
      )}
      <CatalogAttribution />
      {!hasProfileSkills && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: '#f7f1e8',
            padding: '12px 15px',
            borderRadius: 11,
            fontSize: 12,
            color: '#765f47',
            marginBottom: 17,
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/profile"
            className="btn btn-secondary"
            data-testid="link-add-profile-skills"
          >
            {t('Add skills in My Profile')} <ArrowUpRight size={14} />
          </Link>
          <span>
            {t('Results use your last saved skills list. Update My Profile and save to refresh the rankings.')}
          </span>
        </div>
      )}
      {dataset.records.length > 0 && (
        <div style={{ display: 'grid', gap: 14 }}>
          {matches.map((match, index) => {
            const explanation = explanations.get(match.occupation);
            return (
            <article
              className="panel"
              key={match.occupation}
              data-testid={`card-role-${index}`}
              style={{ padding: '23px 25px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 18,
                  alignItems: 'start',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="eyebrow">
                      {t('RANK {n}', { n: String(index + 1).padStart(2, '0') })}
                    </span>
                    <span className="tag">{t(match.catalog ? 'Verified association; unknown market trend' : 'Synthetic role-skill mapping')}</span>
                  </div>
                  <h2
                    style={{
                      font: '700 21px Manrope',
                      letterSpacing: '-.03em',
                      margin: '10px 0 7px',
                      color: '#30483b',
                    }}
                  >
                    {localizeContent(match.occupation, locale)}
                  </h2>
                  {match.catalog && (
                    <span className="tag role-career-field">
                      {t('Career field')}: {match.catalog.category[locale]}
                    </span>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: '#737a70',
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {t('Example occupation · not a live vacancy or labor-market assessment.')}
                  </p>
                </div>
                <div
                  style={{
                    minWidth: 132,
                    textAlign: 'center',
                    background: '#eff1e8',
                    borderRadius: 13,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    className="stat-number"
                    style={{ fontSize: 25 }}
                    data-testid={`text-match-score-${index}`}
                  >
                    {match.score}%
                  </div>
                  <div
                    style={{
                      font: '500 9px IBM Plex Mono',
                      color: '#778074',
                      marginTop: 5,
                    }}
                  >
                    {t('SKILL OVERLAP')}
                  </div>
                  <div
                    style={{ fontSize: 11, color: '#526457', marginTop: 9 }}
                    data-testid={`text-match-confidence-${index}`}
                  >
                    {t('Confidence')}: {Math.round(match.confidence * 100)}%
                  </div>
                  <p
                    style={{ fontSize: 10, color: '#737a70', lineHeight: 1.45, margin: '5px 0 0' }}
                  >
                    {t('The more completely you enter your skills, the higher the confidence.')}
                  </p>
                </div>
              </div>
              {match.catalog && <OccupationCatalogDetails metadata={match.catalog} />}
              <section
                aria-label={t('Why this match')}
                style={{
                  marginTop: 17,
                  padding: '13px 15px',
                  borderRadius: 11,
                  background: '#f7f7f1',
                  border: '1px solid #e7e6dc',
                }}
              >
                <strong style={{ fontSize: 12, color: '#30483b' }}>
                  {t('Why this match')}
                </strong>
                {explanation?.reasons.length ? (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 19, color: '#697568', fontSize: 12, lineHeight: 1.7 }}>
                    {explanation.reasons.map((reason, reasonIndex) => (
                      <li key={`${match.occupation}-reason-${reasonIndex}`}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '7px 0 0', color: '#697568', fontSize: 12 }}>
                    {t('Add saved skills to view match reasons.')}
                  </p>
                )}
              </section>
              <div
                className="role-lists"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                  marginTop: 22,
                  paddingTop: 17,
                  borderTop: '1px solid #e7e6dc',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#4c7156',
                      marginBottom: 9,
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <Check size={13} /> {t('Matched skills')} (
                    {match.matchingSkills.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {match.matchingSkills.length ? (
                      match.matchingSkills.map((skill) => (
                        <span key={skill} className="tag">
                          {localizeContent(skill, locale)}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: '#858b80' }}>
                        {t('No overlap yet')}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#8b684b',
                      marginBottom: 9,
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <ArrowUpRight size={13} /> {t('Missing skills')} (
                    {match.missingSkills.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {match.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="tag"
                        style={{
                          background: '#f8f0e9',
                          color: '#805f46',
                          borderColor: '#e8d6c8',
                        }}
                      >
                        {localizeContent(skill, locale)}
                      </span>
                    ))}
                  </div>
                  {explanation?.gaps.length ? (
                    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                      {explanation.gaps.map((gap) => (
                        <div
                          key={`${match.occupation}-gap-${gap.skill}`}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 10, color: '#737a70' }}
                        >
                          <span>{localizeContent(gap.skill, locale)} · {t(`${gap.priority === 'high' ? 'High' : gap.priority === 'medium' ? 'Medium' : 'Low'} priority`)}</span>
                          <span>{t('Estimated {n} hours', { n: gap.hours })}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <Link href="/roadmap" className="btn btn-primary" style={{marginTop:18}} onClick={() => onChooseOccupation(match.occupation)} data-testid={`link-plan-role-${index}`}>{t('Build a learning plan')} <ArrowUpRight size={14}/></Link>
            </article>
            );
          })}
        </div>
      )}
      {totalMatches > 0 && (
        <p role="status" data-testid="status-role-match-count" style={{ marginTop: 14, fontSize: 12, color: '#737a70' }}>
          {t('Showing up to 8 of {total} matches.', {
            total: totalMatches,
          })}
        </p>
      )}
      <style>{`@media(max-width:560px){.role-lists{grid-template-columns:1fr!important;gap:16px!important}}`}</style>
    </>
  );
}

