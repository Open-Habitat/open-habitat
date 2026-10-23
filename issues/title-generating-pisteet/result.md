# Pisteet in the conversation header

Implemented the selected direction from
`design-system/prototypes/rounds/2026-10-23-otsikon-odotus/` in the shared
`AgentHeader`. The existing title remains readable; three accent-coloured dots
start immediately, with the round's 1000 ms cycle and 120/240 ms stagger.
Reduced motion leaves static dots. The H action no longer spins independently.
The title has `aria-busy` and a separate polite status announcement; naming does
not replace the agent's activity. The production component has a Storybook state.

Live and native-history manual title actions feed their existing pending state
to the same header. Automatic naming uses the daemon controller's existing
`naming` reservation, exposed through the already-defined snapshot
`title.generation_state = pending`. Start and completion (including failure)
invalidate the snapshot. No new contract, command or title store was added;
Pi's native history still supplies the displayed title.

## Decisions for later review

- No delay or minimum duration: even a fast result stops the dots immediately.
  Automatic operations appear when their host invalidation reaches the browser;
  the browser never guesses from the agent's turn activity.
- The first automatic title preserves the existing temporary display title
  (including a native first-message fallback), rather than forcing it to
  “Uusi keskustelu”. This keeps the native title authoritative.
- The hidden dots reserve their 21 px slot, as in the prototype, so starting or
  finishing naming does not shift the title/tools. Long titles ellipsize while
  the dots and actions remain visible at 390 px.
- After automatic failure, pending clears without adding a new persistent
  failure notification. Manual failures retain the existing inline error and
  retry action. This change does not invent retained operation outcomes.

## Verification

Tested implementation: baseline `64098e5b5a1e1b0e69d5448b308ce07071a6a8c4`
plus the worker diff. SHA-256 of the tracked implementation/test diff:
`4e58e57d838eb3b5ffe97e9a9bfb8a6978ec5f0fdfe159a735f33b9419aaa083`;
new lab spec: `8daaefb4f09651be7099132e4e239394c48d7086740a485be1c515eb5817879e`.

Checks use synthetic homes, identities, histories and fake Pi only. Commands
were invoked with `umask 077` and a private `mktemp -d /var/tmp/oh-…` TMPDIR.
Installed Fleetrepo wrappers place heavy browser work in their isolated warm
Linux workspace; evidence was retrieved through that same pinned route.

- `./scripts/test-focused.sh --area web`: formatting, lint, type checking and
  93 files / 555 unit and component tests passed.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`:
  68 passed, including automatic snapshot observations, first-title display,
  and manual success/failure clearing the live header's pending state.
- `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts`:
  3 passed: native-history naming after daemon restart, live failures, header layout and
  accessibility coverage. The old rotating-arrow assertion was replaced with
  the chosen dots' animation/busy assertion; rotation-centre stability is no
  longer relevant because the H arrow no longer animates. The phone layout
  assertion now measures the title group, including the reserved dot slot.
- `./scripts/test-focused.sh --area browser --spec lab-title-generation.spec.ts`:
  4 passed (1440/390 px × light/dark). Held replies prove old-title preservation,
  new-title adoption, failure preserving the last title, action disabling/retry,
  running versus reduced-motion animations, and header action visibility.
  Axe found no violations in the affected view (conversation feed excluded).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
  Extended the native naming fence regression to inspect the real snapshot
  during generation and after failure and require a completion invalidation.
- `./scripts/test-focused.sh --area contracts`: passed; no generated/schema drift.

Paired synthetic-lab captures (static reduced-motion frame of a long title):

| Width | Light | Dark |
| --- | --- | --- |
| 1440 | [image](evidence/pending-1440-light.avif) · [HTML](evidence/pending-1440-light.html) | [image](evidence/pending-1440-dark.avif) · [HTML](evidence/pending-1440-dark.html) |
| 390 | [image](evidence/pending-390-light.avif) · [HTML](evidence/pending-390-light.html) | [image](evidence/pending-390-dark.avif) · [HTML](evidence/pending-390-dark.html) |

The browser title-generation replies/displayed replacement are synthetic route
seams; the daemon test covers native fencing separately. These checks do not
claim real-provider availability, separate-UID isolation or test-server deployment.
No full gate or release was run. `issuectl doctor --json`,
`python3 scripts/validate-project-view.py` and `git diff --check` passed.

## Review and assessment

Because the automatic-generation wiring touched the daemon, used `/llm-review`
and `/assess-findings`, not self-review alone. Finder `claude-fable-5-1`
identified an existing browser test still locating the removed H-spinner class.
Confirmed locally and fixed its assertion to cover dots, preserving native
operation/failure and axe coverage; the affected spec passes all 3 cases.
Verifier `gpt-6-astra` confirmed the stale locator is gone and found no
counterexample to naming/cursor mutex ordering. The reserved idle dot slot was
assessed as intended prototype behavior, not a defect. Assessment: one FIX
(applied), one DROP, no unresolved actionable findings or new issues.
Local scratch reports: `history/review-title-generating-pisteet.md` and
`history/assessment-title-generating-pisteet.{json,md}`. Final focused web checks
passed again after the review fix. No pushes were made.
