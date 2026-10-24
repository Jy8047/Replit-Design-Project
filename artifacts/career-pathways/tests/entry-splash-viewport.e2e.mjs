// Responsive entry-brand regression check across narrow, rotated, and zoom-like viewports.
// Run with: node artifacts/career-pathways/tests/entry-splash-viewport.e2e.mjs
import assert from 'node:assert/strict';
import { withProfileBrowser } from './profile-handoff-browser.mjs';

const viewports = [
  { name: 'narrow portrait', width: 240, height: 360 },
  { name: 'small phone', width: 320, height: 568 },
  { name: 'landscape', width: 568, height: 320 },
  { name: '200% zoom equivalent', width: 160, height: 320 },
  { name: '160% zoom equivalent', width: 200, height: 400 },
  { name: 'zoomed short landscape', width: 320, height: 180 },
  { name: 'extreme zoom equivalent', width: 120, height: 240 },
];

await withProfileBrowser(async ({ cdp, evaluate, wait }) => {
  await cdp('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  for (const viewport of viewports) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp('Page.navigate', { url: 'http://127.0.0.1:80/' });
    await wait(`!!document.querySelector('[data-testid="entry-splash"] .entry-splash__brand')`);

    const layout = await evaluate(`(() => {
      const splash = document.querySelector('[data-testid="entry-splash"]');
      const core = splash.querySelector('.entry-splash__core');
      const brand = core.querySelector('.entry-splash__brand');
      const text = [...brand.children];
      const rect = element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      };
      const splashRect = rect(splash);
      const coreRect = rect(core);
      const brandRect = rect(brand);
      return {
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
          visualWidth: visualViewport.width,
          visualHeight: visualViewport.height,
          viewportMeta: document.querySelector('meta[name="viewport"]')?.content ?? '',
        },
        splash: {
          clientWidth: splash.clientWidth,
          scrollWidth: splash.scrollWidth,
          rect: splashRect,
          clientHeight: splash.clientHeight,
          scrollHeight: splash.scrollHeight,
          paddingLeft: parseFloat(getComputedStyle(splash).paddingLeft),
          paddingRight: parseFloat(getComputedStyle(splash).paddingRight),
          paddingTop: parseFloat(getComputedStyle(splash).paddingTop),
          paddingBottom: parseFloat(getComputedStyle(splash).paddingBottom),
        },
        core: {
          rect: coreRect,
          paddingLeft: parseFloat(getComputedStyle(core).paddingLeft),
          paddingRight: parseFloat(getComputedStyle(core).paddingRight),
        },
        brand: {
          clientWidth: brand.clientWidth,
          scrollWidth: brand.scrollWidth,
          rect: brandRect,
          text: text.map(element => ({
            content: element.textContent,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            rect: rect(element),
          })),
        },
      };
    })()`);

    assert.equal(layout.viewport.width, viewport.width, `${viewport.name}: viewport width applied`);
    assert.equal(layout.viewport.height, viewport.height, `${viewport.name}: viewport height applied`);
    assert.doesNotMatch(layout.viewport.viewportMeta, /maximum-scale|user-scalable\s*=\s*no/i, 'mobile browser zoom remains available');
    assert.ok(layout.viewport.visualWidth >= layout.splash.rect.right, `${viewport.name}: splash fits the visible viewport width`);
    assert.ok(layout.viewport.visualHeight >= Math.min(layout.splash.rect.bottom, viewport.height), `${viewport.name}: splash covers the visible viewport height`);
    assert.ok(layout.splash.scrollWidth <= layout.splash.clientWidth + 1, `${viewport.name}: splash has no horizontal overflow`);
    assert.ok(layout.core.rect.left >= layout.splash.rect.left + layout.splash.paddingLeft - 1, `${viewport.name}: card clears the left safe-area inset`);
    assert.ok(layout.core.rect.right <= layout.splash.rect.right - layout.splash.paddingRight + 1, `${viewport.name}: card clears the right safe-area inset`);
    assert.ok(layout.brand.scrollWidth <= layout.brand.clientWidth + 1, `${viewport.name}: brand row has no horizontal overflow`);
    assert.ok(layout.brand.rect.left >= layout.core.rect.left + layout.core.paddingLeft - 1, `${viewport.name}: brand clears the left card inset`);
    assert.ok(layout.brand.rect.right <= layout.core.rect.right - layout.core.paddingRight + 1, `${viewport.name}: brand clears the right card inset`);
    assert.deepEqual(layout.brand.text.map(({ content }) => content), ['PivotPath', 'AI'], `${viewport.name}: full brand text is rendered`);
    for (const [index, text] of layout.brand.text.entries()) {
      assert.ok(text.clientWidth > 0, `${viewport.name}: brand segment ${index + 1} is visible`);
      assert.ok(text.scrollWidth <= text.clientWidth + 1, `${viewport.name}: brand segment ${index + 1} is not clipped`);
      assert.ok(text.rect.left >= layout.brand.rect.left - 1, `${viewport.name}: brand segment ${index + 1} stays inside the brand row`);
      assert.ok(text.rect.right <= layout.brand.rect.right + 1, `${viewport.name}: brand segment ${index + 1} stays inside the brand row`);
    }
    console.log(`PASS ${viewport.name} (${viewport.width}×${viewport.height})`);
  }
});
