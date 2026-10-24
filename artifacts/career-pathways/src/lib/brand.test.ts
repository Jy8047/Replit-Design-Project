import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import {
  PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_DESCRIPTION, DEMO_IMPLEMENTATION_NOTICE,
  BRAND_PAGE_LABELS, applyBrandMetadata,
} from './brand.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const i18n = read('./i18n.tsx');
const start = i18n.indexOf('{', i18n.indexOf('const translations:'));
const end = i18n.indexOf('\n};', start);
const dictionary = runInNewContext(`(${i18n.slice(start, end + 2)})`) as Record<string, [string, string]>;
const t = (key: string, locale: 'en' | 'zh' | 'ms') =>
  locale === 'en' ? key : dictionary[key]?.[locale === 'zh' ? 0 : 1] ?? key;

function fakeDocument() {
  const elements = new Map<string, { attributes: Record<string, string>; setAttribute(key: string, value: string): void }>();
  const document = {
    title: 'Ignored legacy custom name',
    documentElement: { lang: 'en' },
    createElement: () => ({
      attributes: {} as Record<string, string>,
      setAttribute(key: string, value: string) { this.attributes[key] = value; },
    }),
    head: {
      querySelector: (selector: string) => elements.get(selector) ?? null,
      appendChild(element: { attributes: Record<string, string>; setAttribute(key: string, value: string): void }) {
        const attribute = element.attributes.name ? 'name' : 'property';
        elements.set(`meta[${attribute}="${element.attributes[attribute]}"]`, element);
      },
    },
  };
  return { document, elements };
}

describe('fixed PivotPath AI brand', () => {
  it('keeps the exact name, tagline and description in the existing three-language dictionary', () => {
    assert.equal(PRODUCT_NAME, 'PivotPath AI');
    assert.equal(PRODUCT_TAGLINE, 'Navigate Change. Shape Your Future.');
    assert.equal(PRODUCT_DESCRIPTION, 'An AI-powered career intelligence and future-readiness platform.');
    assert.equal(t(PRODUCT_TAGLINE, 'zh'), '洞见变化，规划未来。');
    assert.equal(t(PRODUCT_TAGLINE, 'ms'), 'Kenali Perubahan, Rancang Masa Depan.');
    assert.equal(t(PRODUCT_DESCRIPTION, 'zh'), '一个以人工智能辅助职业匹配、技能差距分析和未来职业发展规划的平台。');
    assert.equal(t(PRODUCT_DESCRIPTION, 'ms'), 'Platform kecerdasan kerjaya dan kesiapsiagaan masa depan yang dibantu oleh kecerdasan buatan.');
    for (const locale of ['en', 'zh', 'ms'] as const) {
      assert.equal(t(PRODUCT_NAME, locale), PRODUCT_NAME);
      assert.notEqual(t(DEMO_IMPLEMENTATION_NOTICE, locale), '');
      if (locale !== 'en') assert.notEqual(t(DEMO_IMPLEMENTATION_NOTICE, locale), DEMO_IMPLEMENTATION_NOTICE);
    }
  });

  it('applies localized metadata and fixed branding for every registered business page', () => {
    for (const locale of ['en', 'zh', 'ms'] as const) {
      for (const page of Object.values(BRAND_PAGE_LABELS)) {
        const { document, elements } = fakeDocument();
        applyBrandMetadata(document as unknown as Document, {
          pageLabel: t(page, locale), description: t(PRODUCT_DESCRIPTION, locale), locale,
        });
        assert.equal(document.title, `${t(page, locale)} | PivotPath AI`);
        assert.equal(elements.get('meta[property="og:site_name"]')?.attributes.content, PRODUCT_NAME);
        for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
          assert.equal(elements.get(selector)?.attributes.content, t(PRODUCT_DESCRIPTION, locale));
        }
        assert.equal(elements.get('meta[name="twitter:title"]')?.attributes.content, document.title);
        assert.equal(elements.get('meta[property="og:title"]')?.attributes.content, document.title);
      }
    }
  });

  it('updates rather than duplicates metadata when switching languages and ignores a legacy title', () => {
    const { document, elements } = fakeDocument();
    for (const locale of ['en', 'zh', 'ms'] as const) {
      applyBrandMetadata(document as unknown as Document, { pageLabel: '', description: t(PRODUCT_DESCRIPTION, locale), locale });
      assert.equal(document.title, PRODUCT_NAME);
      assert.equal(elements.size, 7);
      assert.equal(document.documentElement.lang, locale === 'zh' ? 'zh-CN' : locale === 'ms' ? 'ms-MY' : 'en');
    }
  });

  it('removes only custom-name controls and state while keeping settings, language switch and profile routes', () => {
    const app = read('../App.tsx');
    assert.doesNotMatch(app, /STORAGE_TITLE|defaultTitle|onTitleChange|setTitle|input-workspace-title|button-save-title|status-title-saved|settings-title-form/);
    assert.match(app, /<Route path="\/settings"><SettingsPage onReset=\{reset\}/);
    assert.match(app, /data-testid="language-switch"/);
    assert.match(app, /<ProfilePage profile=\{profile\} onSave=\{saveProfile\} onDelete=\{deleteProfile\}/);
    assert.match(app, /persistConfirmedProfile\(localStorage,next\)/);
    assert.match(app, /profileSkills=\{profile\?\.skills\?\?''\}/);
    assert.match(app, /data-testid="button-reset-workspace"/);
    assert.match(app, /className="eyebrow" style=\{\{color:'#627867',textTransform:'none'\}\}>\{PRODUCT_NAME\}/);
  });

  it('has no old brand in active UI copy, static social metadata or source attribution', () => {
    for (const path of ['../App.tsx', './i18n.tsx', '../components/career-planning-pages.tsx',
      '../../index.html', '../data/occupation-catalog.json', '../../../../README.md']) {
      assert.doesNotMatch(read(path), /FuturePath|Career Pathways|t\('Pathways'\)/, path);
    }
    assert.match(read('../../index.html'), /<title>PivotPath AI<\/title>/);
    assert.match(read('../../index.html'), /name="description" content="An AI-powered career intelligence and future-readiness platform\."/);
  });
});
