// Responsive entry-splash regression check across reduced-motion and narrow viewports.
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

await withProfileBrowser(async ({ cdp, evaluate, wait, errors }) => {
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
      const scene = splash.querySelector('.entry-splash__scene');
      const brand = scene.querySelector('.entry-splash__brand');
      const logoFrame = scene.querySelector('.entry-splash__logo-crop');
      const logo = scene.querySelector('.entry-splash__logo-crop img');
      const sphere = scene.querySelector('.entry-splash__sphere');
      const sphereSpin = sphere.querySelector('.entry-splash__sphere-spin');
      const text = [...brand.children];
      const rect = element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      };
      const splashRect = rect(splash);
      const sceneRect = rect(scene);
      const brandRect = rect(brand);
      const sphereRect = rect(sphere);
      const sphereStyle = getComputedStyle(sphere);
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
          background: getComputedStyle(splash).backgroundColor,
        },
        scene: {
          rect: sceneRect,
          hasFrame: Boolean(scene.querySelector('.entry-splash__core, .entry-splash__particles')),
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
        logo: {
          src: logo?.getAttribute('src') ?? '',
          rect: logo ? rect(logo) : null,
          frame: logoFrame ? rect(logoFrame) : null,
        },
        sphere: {
          rect: sphereRect,
          letterCount: sphere.querySelectorAll('.entry-splash__sphere-letter').length,
          mask: sphereStyle.maskImage || sphereStyle.webkitMaskImage,
          zIndex: Number.parseInt(sphereStyle.zIndex, 10),
          titleZIndex: Number.parseInt(getComputedStyle(brand).zIndex, 10),
          animationName: getComputedStyle(sphereSpin).animationName,
        },
      };
    })()`);

    assert.equal(layout.viewport.width, viewport.width, `${viewport.name}: viewport width applied`);
    assert.equal(layout.viewport.height, viewport.height, `${viewport.name}: viewport height applied`);
    assert.doesNotMatch(layout.viewport.viewportMeta, /maximum-scale|user-scalable\s*=\s*no/i, 'mobile browser zoom remains available');
    assert.ok(layout.viewport.visualWidth >= layout.splash.rect.right, `${viewport.name}: splash fits the visible viewport width`);
    assert.ok(layout.viewport.visualHeight >= Math.min(layout.splash.rect.bottom, viewport.height), `${viewport.name}: splash covers the visible viewport height`);
    assert.ok(layout.splash.scrollWidth <= layout.splash.clientWidth + 1, `${viewport.name}: splash has no horizontal overflow`);
    assert.equal(layout.scene.hasFrame, false, `${viewport.name}: no framed card or particle layer`);
    assert.match(layout.splash.background, /rgb\(247,\s*249,\s*248\)/, `${viewport.name}: light background`);
    assert.ok(layout.brand.scrollWidth <= layout.brand.clientWidth + 1, `${viewport.name}: brand row has no horizontal overflow`);
    assert.deepEqual(layout.brand.text.map(({ content }) => content), ['PivotPath', 'AI'], `${viewport.name}: full brand text is rendered`);
    for (const [index, text] of layout.brand.text.entries()) {
      assert.ok(text.clientWidth > 0, `${viewport.name}: brand segment ${index + 1} is visible`);
      assert.ok(text.scrollWidth <= text.clientWidth + 1, `${viewport.name}: brand segment ${index + 1} is not clipped`);
      assert.ok(text.rect.left >= layout.brand.rect.left - 1, `${viewport.name}: brand segment ${index + 1} stays inside the brand row`);
      assert.ok(text.rect.right <= layout.brand.rect.right + 1, `${viewport.name}: brand segment ${index + 1} stays inside the brand row`);
    }
    assert.match(layout.logo.src, /\/logo\.png$/u, `${viewport.name}: existing logo is shown`);
    assert.ok(layout.logo.frame.bottom > layout.logo.frame.top, `${viewport.name}: enlarged logo crop remains visible`);
    assert.ok(layout.brand.rect.top >= layout.logo.frame.bottom, `${viewport.name}: brand name remains below the logo`);
    assert.equal(layout.sphere.letterCount, 120, `${viewport.name}: one letter-built sphere is rendered`);
    assert.match(layout.sphere.mask, /radial-gradient/u, `${viewport.name}: sphere leaves a clear title area`);
    assert.ok(layout.sphere.titleZIndex > layout.sphere.zIndex, `${viewport.name}: title sits in front of the sphere`);
    assert.equal(layout.sphere.animationName, 'none', `${viewport.name}: sphere is static with reduced motion`);
    console.log(`PASS ${viewport.name} (${viewport.width}×${viewport.height})`);
  }

  await cdp('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:80/' });
  await wait(`!!document.querySelector('[data-testid="entry-splash"] .entry-splash__brand')`);
  await wait(`(() => {
    const brand = document.querySelector('[data-testid="entry-splash"] .entry-splash__brand');
    return brand && [...brand.children].map(node => node.textContent).join(' ') === 'PivotPath AI';
  })()`);
  const configuredDecodeMs = await evaluate(`Number(document.querySelector('[data-testid="entry-splash"]').dataset.decodeDurationMs)`);
  assert.ok(configuredDecodeMs <= 1000, `decode phase is configured to finish within one second (${configuredDecodeMs} ms)`);
  const sphereMotion = await evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('.entry-splash__sphere-spin'));
    return { name: style.animationName, duration: style.animationDuration };
  })()`);
  assert.deepEqual(sphereMotion, { name: 'splash-sphere-rotate', duration: '18s' }, 'sphere rotates slowly when motion is allowed');
  const identityLayout = await evaluate(`(() => {
    const frame = document.querySelector('.entry-splash__logo-crop').getBoundingClientRect();
    const brand = document.querySelector('.entry-splash__brand').getBoundingClientRect();
    return { logoSize: frame.width, brandGap: brand.top - frame.bottom };
  })()`);
  assert.equal(identityLayout.logoSize, 96, 'desktop logo is enlarged');
  assert.ok(identityLayout.brandGap >= 20, 'brand name is visibly spaced below the larger logo');
  await wait(`!document.querySelector('[data-testid="entry-splash"]')`);
  await wait(`!!document.querySelector('[data-testid="card-home-01"]')`);
  await evaluate(`document.querySelector('[data-testid="link-future-role-matches"]').click()`);
  await wait(`document.querySelector('.page-title')?.textContent.includes('Future Role Matches')`);
  assert.deepEqual(errors, [], 'splash and route transition produce no browser errors');
  console.log('PASS splash resolves, dismisses, and leaves dashboard navigation usable');
});
