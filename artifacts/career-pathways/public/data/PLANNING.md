# Career planning features

The CSV remains the replaceable source of occupation/skill relationships. The
included records are synthetic, not market evidence.

## Learning plan

Choose an occupation from a role card or the shared occupation selector. The plan
filters out skills in the saved profile and orders the remaining skills using an
app-authored beginner-to-applied sequence. Durations are planning estimates, not
provider completion times or validated requirements.

Public resource pages were checked for existence and topic relevance. A checked
link is not an endorsement, a quality assessment, a guarantee of free
certification, or a promise of continued availability. No course enrolment or
paid service is integrated. Unverified resources are shown without a link.

Checked resources include public materials from CDC (evaluation), NASA (climate
literacy), GOV.UK (user research), Purdue OWL (writing), and Datawrapper Academy
(visualization). Some candidate course pages were blocked or unavailable and
were deliberately not added. The skill-to-resource assignments are in
`src/lib/career-planning.ts`.

## SDG explanations

Mappings are app-authored, conditional explanations for the four included
occupations, linked to official UN goal descriptions. They are intended
alignments only: this app measures no SDG outcome or indicator and is not
endorsed by the UN. A replacement occupation with no reviewed mapping shows an
explicit unmapped state rather than receiving a decorative goal automatically.

## Scenarios

The original overlap score is preserved. The scenario page reranks occupations
by a separate, rounded weighted overlap:

`sum of matched skill weights / sum of all occupation skill weights * 100`

Moderate: rising 1.1, stable 1.0, declining 0.9.
Fast: rising 1.4, stable 1.0, declining 0.6.

These weights are chosen synthetic what-if assumptions, not estimated empirical
effects of AI. A scenario can leave a ranking unchanged, particularly when every
skill or no skill is matched. No future job outcomes are predicted.

## Validation

Run `pnpm --filter @workspace/career-pathways run test`.
The fictional journeys cover profile changes, selected-occupation changes,
ordered missing-skill plans, verified/unverified resource states, SDG coverage,
scenario-weight changes, and empty/unknown/fully-matched states.

Profile, selected occupation and scenario are stored in browser local storage;
they are not cloud-synced. The product name is fixed as PivotPath AI and is not
editable. Any legacy custom-title storage is ignored, not automatically deleted.
