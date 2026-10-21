import { ArrowUpRight, Check, Lightbulb } from 'lucide-react';
import { Link } from 'wouter';
import {
  calculateCareerMatches,
  getVerifiedCitation,
  type CareerRecord,
  type DatasetResult,
} from '@/lib/career-data';
import { PageHeading } from '@/components/page-heading';

export type DatasetState = DatasetResult & {
  loading: boolean;
  loadError: string;
};

export function DatasetFeedback({ dataset }: { dataset: DatasetState }) {
  if (dataset.loading) {
    return (
      <div
        className="panel"
        role="status"
        data-testid="status-dataset-loading"
      >
        Loading the local demonstration dataset…
      </div>
    );
  }

  return (
    <>
      {dataset.loadError && (
        <div className="panel" role="alert" data-testid="error-dataset-load">
          Dataset could not be loaded: {dataset.loadError}
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
            {dataset.errors.length} dataset row or format issue
            {dataset.errors.length === 1 ? '' : 's'} found.
          </strong>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>
            Invalid rows were skipped; valid rows remain available.
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
              Showing the first four issues.
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
          There are no valid records to display. Check the CSV columns and row
          values.
        </div>
      )}
    </>
  );
}

function RecordProvenance({ record }: { record: CareerRecord }) {
  const directionLabel =
    record.trendDirection.charAt(0).toUpperCase() +
    record.trendDirection.slice(1);
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
        <span className="tag">{record.occupation}</span>
        <span
          className={`tag ${
            record.trendDirection === 'declining' ? 'trend-down' : 'trend-up'
          }`}
        >
          {directionLabel} ·{' '}
          {record.recordStatus === 'synthetic'
            ? 'synthetic example'
            : 'marked verified in dataset'}
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
        {record.evidence}
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
            Published {citation.formattedPublicationDate}
          </time>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#888d82', margin: '8px 0 0' }}>
          No verified source or publication date is recorded for this synthetic
          example.
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
  const counts = { rising: 0, declining: 0, stable: 0 };
  for (const record of dataset.records) counts[record.trendDirection] += 1;
  const verifiedCount = dataset.records.filter(
    (record) => record.recordStatus === 'verified',
  ).length;

  return (
    <>
      <PageHeading
        kicker="Explore changing work"
        title="Future Skills Radar"
        description="Review the direction and evidence attached to each dataset record. The included records are synthetic examples, not a forecast or live labor-market data."
      />
      <DatasetFeedback dataset={dataset} />
      <section className="panel" style={{ marginBottom: 17 }}>
        <div className="eyebrow">Dataset status</div>
        <h2
          style={{
            font: '700 18px Manrope',
            margin: '6px 0',
            color: '#344a3c',
          }}
        >
          Direction labels are not trend measurements
        </h2>
        <p
          style={{
            fontSize: 12,
            color: '#778074',
            lineHeight: 1.6,
            margin: '0 0 13px',
          }}
        >
          Counts below describe the rows in this file only. They do not measure
          demand, growth, or decline in the real world.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag trend-up">Rising examples · {counts.rising}</span>
          <span className="tag trend-down">
            Declining examples · {counts.declining}
          </span>
          <span className="tag">Stable examples · {counts.stable}</span>
          <span className="tag">
            {verifiedCount} rows marked verified in dataset
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#858b80', margin: '12px 0 0' }}>
          Verification labels and citations come from the CSV. The app checks
          citation fields and date format, but does not independently validate
          the source or its claims.
        </p>
      </section>
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
                {skill}
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
}: {
  dataset: DatasetState;
  profileSkills: string;
}) {
  const matches = calculateCareerMatches(profileSkills, dataset.records);
  const hasProfileSkills = profileSkills
    .split(',')
    .some((skill) => skill.trim().length > 0);

  return (
    <>
      <PageHeading
        kicker="Compare possible directions"
        title="Future Role Matches"
        description="Ranked examples use a direct count of skills you entered against each sample occupation's distinct skills. The score is not a hiring probability or a prediction."
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
          <strong>Score formula:</strong> matched skills ÷ distinct skills
          listed for the occupation × 100, rounded to the nearest whole
          percent. Capitalization and duplicate profile entries are ignored.
          Scores describe overlap only; 0% does not mean zero chance of being
          hired.
        </div>
      </div>
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
            Add skills in My Profile <ArrowUpRight size={14} />
          </Link>
          <span>
            Results use your last saved skills list. Update My Profile and save
            to refresh the rankings.
          </span>
        </div>
      )}
      {dataset.records.length > 0 && (
        <div style={{ display: 'grid', gap: 14 }}>
          {matches.map((match, index) => (
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
                      RANK {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="tag">Synthetic role-skill mapping</span>
                  </div>
                  <h2
                    style={{
                      font: '700 21px Manrope',
                      letterSpacing: '-.03em',
                      margin: '10px 0 7px',
                      color: '#30483b',
                    }}
                  >
                    {match.occupation}
                  </h2>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#737a70',
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    Example occupation · not a live vacancy or labor-market
                    assessment.
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
                    SKILL
                    <br />
                    OVERLAP
                  </div>
                </div>
              </div>
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
                    <Check size={13} /> Matched skills (
                    {match.matchingSkills.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {match.matchingSkills.length ? (
                      match.matchingSkills.map((skill) => (
                        <span key={skill} className="tag">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: '#858b80' }}>
                        No overlap yet
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
                    <ArrowUpRight size={13} /> Missing skills (
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
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <style>{`@media(max-width:560px){.role-lists{grid-template-columns:1fr!important;gap:16px!important}}`}</style>
    </>
  );
}

