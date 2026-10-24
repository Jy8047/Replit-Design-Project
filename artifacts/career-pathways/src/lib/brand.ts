/** Fixed product identity. This is not an editable workspace-name feature. */
export const PRODUCT_NAME = 'PivotPath AI';
export const PRODUCT_TAGLINE = 'Navigate Change. Shape Your Future.';
export const PRODUCT_DESCRIPTION = 'An AI-powered career intelligence and future-readiness platform.';
export const DEMO_IMPLEMENTATION_NOTICE = 'This demo uses local PDF text extraction and deterministic, rule-based matching. Profile mapping is simulated; no AI model is called.';

export const BRAND_PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/profile': 'My Profile',
  '/skills': 'Future Skills Radar',
  '/roles': 'Future Role Matches',
  '/roadmap': 'Reskilling Roadmap',
  '/impact': 'SDG Impact',
  '/scenarios': 'Future Scenarios',
  '/settings': 'Workspace Settings',
};

/** Update only document presentation; never read or write profile storage. */
export function applyBrandMetadata(
  document: Document,
  copy: { pageLabel: string; description: string; locale: 'en' | 'zh' | 'ms' },
): void {
  const title = copy.pageLabel ? `${copy.pageLabel} | ${PRODUCT_NAME}` : PRODUCT_NAME;
  document.title = title;
  document.documentElement.lang = copy.locale === 'zh' ? 'zh-CN' : copy.locale === 'ms' ? 'ms-MY' : 'en';
  const values: [string, string, string][] = [
    ['name', 'description', copy.description],
    ['property', 'og:title', title],
    ['property', 'og:site_name', PRODUCT_NAME],
    ['property', 'og:description', copy.description],
    ['property', 'og:locale', copy.locale === 'zh' ? 'zh_CN' : copy.locale === 'ms' ? 'ms_MY' : 'en_US'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', copy.description],
  ];
  for (const [attribute, key, content] of values) {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  }
}
