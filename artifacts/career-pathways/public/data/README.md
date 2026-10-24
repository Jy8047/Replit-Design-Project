# Career and skill example data

`skills-occupations.csv` is a replaceable, structured demonstration dataset. Every included row is marked `synthetic`. Its trend directions, skills, and occupation associations are invented examples for testing the app only; they are not labor-market findings.

The CSV columns are:

| Column | Purpose |
| --- | --- |
| `occupation` | Occupation label used to group required skills |
| `skill` | Skill associated with that occupation |
| `trend_direction` | `rising`, `declining`, or `stable`; illustrative unless independently verified |
| `source_name` | Name of the supporting source; blank for synthetic rows |
| `source_url` | Direct source URL; blank for synthetic rows |
| `publication_date` | Source publication date in `YYYY-MM-DD`; blank for synthetic rows |
| `evidence` | Evidence note or explicit synthetic-data disclaimer |
| `record_status` | `synthetic` or `verified` |

## Adding verified public data later

1. Replace or extend this CSV with records from a real, relevant public source.
2. Independently check each claim against the source; do not mark a row `verified` just because its URL loads.
3. For every `verified` row, provide a source name, an `http` or `https` URL, a valid publication date, and a concise evidence note. The app checks these fields for completeness and format; it does not independently verify the source or the claim.
4. Keep unsourced demonstration rows marked `synthetic`, and do not mix their evidence with verified records.

The app loads this file from `public/data/skills-occupations.csv` at runtime. Invalid rows are skipped and reported in the interface rather than silently treated as verified data.

## Reviewed public occupation subset

The app now also loads `official-occupations.csv`: 48 O*NET® 31.0 classifications,
473 source-backed competency associations, published 2026-08-25. The original
four synthetic occupations above have not been relabelled as verified.
`src/data/occupation-catalog.json` carries identifiers, categories, source evidence,
preparation requirements and conditional, app-authored SDG interpretations.

**No demand trend is verified for the sourced subset.** Its CSV `stable` value
is only a compatibility placeholder; its metadata says `unknown`. Runtime
loading must use `combineCareerDatasets`, not just `parseCareerCsv`, so the UI
does not mistake that placeholder for evidence of market stability.

This subset includes information from the O*NET 31.0 Database, U.S. Department
of Labor, Employment and Training Administration (USDOL/ETA), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). PivotPath AI selected and
adapted the subset and added translations and SDG interpretations. USDOL/ETA
has not approved, endorsed, or tested these modifications.
See `docs/occupation-expansion.md` for selection, verification and limitations.
