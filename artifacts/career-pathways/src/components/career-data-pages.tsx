import { ArrowUpRight, Check, Lightbulb } from 'lucide-react';
import { Link } from 'wouter';
import {
  calculateCareerMatches,
  explainCareerMatches,
  getVerifiedCitation,
  type CareerRecord,
  type DatasetResult,
} from '@/lib/career-data';
import { CatalogAttribution, OccupationCatalogDetails } from './occupation-catalog-details';
import { PageHeading } from '@/components/page-heading';
import { localizeContent, useI18n } from '@/lib/i18n';

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

function RecordProvenance({ record }: { record: CareerRecord }) {
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
        <span className="tag">{localizeContent(record.occupation, locale)}</span>
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
  const { t, locale } = useI18n();
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

  return (
    <>
      <PageHeading
        kicker={t('Explore changing work')}
        title={t('Future Skills Radar')}
        description={t('Source-backed associations and synthetic examples are shown separately. No market forecast is provided for the sourced occupations.')}
      />
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
                />
              ))}
            </article>
          ))}
        </div>
      )}
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
  const matches = calculateCareerMatches(profileSkills, dataset.records);
  const explanations = new Map(
    explainCareerMatches(profileSkills, dataset.records, locale)
      .map((match) => [match.occupation, match]),
  );
  const hasProfileSkills = profileSkills
    .split(',')
    .some((skill) => skill.trim().length > 0);

  return (
    <>
      <PageHeading
        kicker={t('Compare possible directions')}
        title={t('Future Role Matches')}
        description={t('Scores use skill-weighted matches. They are not a hiring probability or a prediction.')}
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
                    minWidth: 94,
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
      <style>{`@media(max-width:560px){.role-lists{grid-template-columns:1fr!important;gap:16px!important}}`}</style>
    </>
  );
}

