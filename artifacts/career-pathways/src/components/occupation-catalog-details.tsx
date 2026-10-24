import { useI18n, localizeContent } from '@/lib/i18n';
import { occupationCatalog, type OccupationMetadata } from '@/lib/occupation-catalog';

export function CatalogAttribution() {
  const { t } = useI18n();
  return <p className="planning-note" style={{ fontSize: 11, lineHeight: 1.7 }}>
    {t('Sourced subset: O*NET 31.0 Database, USDOL/ETA. Selection, translations and SDG interpretations are app-authored; no endorsement.')}
    {' '}<a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener noreferrer">O*NET®</a>
    {' · '}<a href={occupationCatalog.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
    {' · '}{t('Release')} <time dateTime={occupationCatalog.publishedOn}>{occupationCatalog.publishedOn}</time>
    {' · '}{t('Source checked')} <time dateTime={occupationCatalog.checkedOn}>{occupationCatalog.checkedOn}</time>
  </p>;
}

export function OccupationCatalogDetails({ metadata: meta }: { metadata: OccupationMetadata }) {
  const { t, locale } = useI18n();
  const preparation = meta.jobZone <= 2 ? 'Little to some preparation'
    : meta.jobZone === 3 ? 'Medium preparation'
      : meta.jobZone === 4 ? 'Considerable preparation' : 'Extensive preparation';
  return <section style={{ fontSize: 12, lineHeight: 1.7, marginTop: 14 }} data-testid={`catalog-details-${meta.onetCode}`}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      <span className="tag">{meta.category[locale]}</span>
      <span className="tag">{t('Preparation level {n}', { n: meta.jobZone })} · {t(preparation)}</span>
      <span className="tag">{t('Market trend unknown')}</span>
    </div>
    <p>{t('US occupation reference; preparation is not an eligibility check. Local qualifications, licensing and experience must be checked separately.')}</p>
    <details>
      <summary style={{ cursor: 'pointer' }}>{t('Occupation description and entry preparation — original English source')}</summary>
      <p lang="en">{meta.description}</p>
      <p lang="en"><strong>{t('Education')}</strong> · {meta.entryEducation}</p>
      <p lang="en"><strong>{t('Experience')}</strong> · {meta.entryExperience}</p>
      <p>{t('Preparation data date')} · {meta.entryDataDate}</p>
    </details>
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: 'pointer' }}>{t('Explained SDG contributions')}</summary>
      {meta.sdgs.map(sdg => <p key={sdg.goal}>
        <a href={`https://sdgs.un.org/goals/goal${sdg.goal}`} target="_blank" rel="noopener noreferrer">SDG {sdg.goal}</a>
        {' · '}{sdg.skills.map(skill => localizeContent(skill, locale)).join(', ')}<br />
        {sdg.rationale[locale]}
      </p>)}
    </details>
    <p style={{ marginBottom: 0 }}>
      <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer">{t('Official occupation reference')} · {meta.onetCode}</a>
      {' · '}{t('Published')} <time dateTime={occupationCatalog.publishedOn}>{occupationCatalog.publishedOn}</time>
    </p>
    <p>{t('Representative competencies include knowledge and software examples, not a complete list of employer requirements. New roles use default equal skill weights; estimated learning hours are not qualification requirements.')}</p>
  </section>;
}
