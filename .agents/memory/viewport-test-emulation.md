---
name: Mobile viewport testing
description: Reliable viewport measurements for Chromium mobile-emulation checks
---

For small mobile-emulated viewports, use `document.documentElement.clientWidth` and `visualViewport` to establish the visible viewport. Avoid treating `innerWidth` or document-wide scroll width as the viewport when app content behind a fixed overlay can expand the layout viewport.

**Why:** Chromium mobile emulation showed an inflated `innerWidth` when the hidden page underneath a splash had wider content, even though `visualViewport` and the emulated screen retained the requested dimensions.

**How to apply:** Measure overflow on the component under test and compare its bounds with the visible viewport. Test document-wide overflow separately when the entire page layout is in scope.
