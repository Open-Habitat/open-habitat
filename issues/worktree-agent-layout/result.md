# Result

The worktree introduction now retains the shared conversation stream's automatic inline margins. Its local `margin: auto 0` had overridden them, centring the text inside a left-aligned column instead of above the composer. The pending worktree composer reads the existing Pi model context and displays the native default model and thinking level, rather than a hard-coded `Pi`. An unavailable observation says `Malli ei tiedossa`, not an invented model.

## Decisions for later review

- Keep worktree/branch creation at the first message, with the existing explanation of the base branch. No naming step or pre-created worktree is added.
- Before creation, show the observed native default as a read-only chip. Model selection in a created conversation remains unchanged; there is no new preferences store or extra model request.

## Verification

The worktree-agent journey exercises creation, sending, merge, archive and accessibility; added geometry checks compare introduction/composer centres at 1920px, 1000px and 390px in both themes. It also sets a synthetic native default and verifies its model/thinking chip before sending. No live browser verification or deployment is claimed.

- `scripts/test-focused.sh --area browser --spec lab-worktree-agent.spec.ts`: **1 passed**, including axe and the complete worktree create→send→merge→archive journey.
- Fast web checks: format, lint, typecheck, **244 unit + 174 component tests passed**.
- `lab/new-worktree-{wide,narrow,phone}-{light,dark}.avif` and adjacent static HTML: six synthetic lab views at 1920×1080, 1000×900 and 390×844. The synthetic native default is `gpt-6-astra · medium`.
- Source tested/captured: `ff9fe451`; capture helper committed alongside this result. Visually reviewed all six views; introduction and composer share the same centre, with no off-screen column.

## Failed attempts and review limits

The first test assumed the synthetic fixture already had a default model; it actually returned null. Setting a native synthetic default initially lacked the required Origin header and was refused; the final case uses both Origin and CSRF. Lint rejected non-null assertions in geometry checks; they now narrow explicitly. All were corrected and rerun successfully. One attempted multi-edit was rejected for overlapping ranges before changing anything, then reapplied with disjoint ranges. Focused self-review checked native-context reuse, unknown-model wording and preservation of inline auto margins. No independent LLM review, live provider or live browser test is claimed.
