# Result

Implemented explicit `guide: none` for start-page goals. Selecting one still
prepares the request or sends an eligible immediate request; it neither opens
a guide panel nor offers a guide toggle. Existing guided goals are unchanged.

## Decisions for later review

- **Explicit opt-out:** `guide: none`, rather than inferring intent from absent
  fields. Missing `what`, `when` or `steps` still makes an ordinary goal invalid.
  Other nonempty guide values are rejected.
- **Ignored guide copy:** with `guide: none`, typed `what`, `when` and `steps`
  are optional and ignored, rather than forbidden. This lets an author disable
  a guide without deleting its copy. YAML decoding and the whole-file size cap
  still apply. Ignored copy is omitted from replies; the schema enforces that.
- **Card and preview:** the goal card shows its title and the existing action
  arrow, without an empty description. The editor preview retains the request,
  start behavior and any skill/name metadata, but renders no guide fields.
- **Selection is retained:** keep the selected goal in tab memory for draft and
  placeholder recovery, but always close its guide state and hide the toggle,
  including when a skill invocation uniquely recovers the goal after reload.
  Existing shared-skill ambiguity is unchanged: when several goals name the
  same general skill, reload recovers the first one and may offer its toggle
  (but never opens its panel automatically). Prefer each goal's own skill;
  a new persistent selected-card identity is not warranted for this option.
- **Release before authoring:** older installations reject the new field. Wait
  for a release containing this change before using it in a real start page.
  There is no experiment gate or migration of existing pages.

Example:

```yaml
- title: Continue work
  guide: none
  prompt: Continue the work described in TODO.md.
  start: immediate
```

## Verification

Verified the implementation based on `33bd08ecebbbea6dedeb438633cda26a9ac0648b`
plus this issue's change (the completing commit identifies the final tree).
Commands ran with `umask 077`, timeouts and the scratch lease.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
  Parser tests cover missing guide copy, ignored copy, wire omission, ordinary
  goal rejection and unchanged title/prompt/start requirements. Buffer-check
  tests also exercise the guide-free document through the daemon endpoint.
- `./scripts/test-focused.sh --area contracts`: passed, including
  `python3 scripts/validate-contracts.py` and generated-package drift checks.
  Positive and negative schema cases cover the opt-out and ordinary requirements.
- `./scripts/test-focused.sh --area web`: passed after review (246 files,
  2005 tests), including deterministic recovered-goal header coverage.
- Focused browser specs with `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=16200`:
  `lab-start-page-immediate.spec.ts`, `lab-start-page-goal.spec.ts`, and
  `start-page-preview.spec.ts`: passed after the selector repair below.
- Changed specs additionally run with `npx playwright test --repeat-each 3`
  (lab configuration for the immediate-goal spec), two workers and 0–60 ms
  reply jitter: 48 immediate-goal cases and 12 preview cases passed. The final
  immediate-goal rerun after the review adjustment also passed all 48 cases.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check`: passed.

The initial preview run failed only at its existing JSON-preview assertion:
`.ah-yaml-card header` matched both a container and its child. The touched spec
now selects the header containing the native JSON title. Its guide-free preview
checks, accessibility audit and all final assertions pass on the rerun.

Browser evidence is synthetic, host-backed, same-UID and uses fake Pi; it is not
live deployment, real-provider or Unix-user-isolation evidence. It covers guided
and guide-free launches from workspace, conversation and worktree, immediate
send exactly once, placeholder/existing-draft waiting, recovery after reload,
inert editor previews and preview accessibility in Finnish/English at 1440/390px.
The new no-skill request path is also covered by the goal preparation unit test.

Paired synthetic screenshots and HTML are retained outside git at
`/var/tmp/agent-keep/start-page-goal-without-guide/visual/`. Inspected the no-guide
conversation and the A02 Explain cards in Finnish and English at 1440/390px:
no side panel or toggle for the former, and the revised cards fit the latter.
No full browser suite, clean gate or live deployment was run, as scoped by the
worker brief.

## Review

Independent `/llm-review --no-perf-log`: claude-fable-5-2 finder, gpt-6-astra
verifier, routine rigor, two calls. Required because the daemon validator and
wire schema changed; no authority, credential or native-session boundary changes.

One test-rigor finding was confirmed: a post-reload absence assertion could pass
before the page had hydrated. Removed that premature assertion and added a
synchronous real ViewHost/GuideHeaderControl test with a guided positive control
and a recovered guide-free goal. The browser still proves no resend on reload;
the component test proves the hydrated header guard without timing guesses.

Assessment: FIX 1 (applied), DROP 1 (the pre-existing shared-skill ambiguity
recorded above). No new unresolved product defect or follow-up issue. Local
review/assessment artifacts are under `history/review-start-page-goal-without-guide.md`
and `history/assessment-start-page-goal-without-guide.{json,md}`; the material
outcomes and decisions are recorded here so they survive worktree cleanup.
