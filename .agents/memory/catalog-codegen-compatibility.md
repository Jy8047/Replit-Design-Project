---
name: Catalog and codegen compatibility
description: Explicit generator targets prevent workspace catalogs from causing silent runtime-major mismatches.
---

Keep code generator target library majors explicit when versions are supplied
through workspace catalogs rather than ordinary local dependency declarations.

**Why:** Generator auto-detection can fall back to different React Query or Zod
majors despite the correct runtimes already being installed. This produces
incompatible hooks or validators; changing the runtime merely to satisfy those
defaults would unnecessarily change the team's interface.

**How to apply:** During generator upgrades, check detection warnings and
generated contracts, preserve existing runtime majors, and test transport
headers, query values and schema behavior. Do not treat a successful install or
a comment-only schema-types diff as proof that generated validators are unchanged.
