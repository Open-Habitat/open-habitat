# Settings: Osiot

The production settings view uses the accepted direction 2 sources in
`design-system/prototypes/rounds/2026-10-15-asetukset/round.js` and `round.css`:
section navigation and one section, with separate list/detail screens on phones.
Account, agent defaults, connections, appearance and personal storage share the
same list with administrator-only server, users and disk sections. The account
menu's administration entry opens the server section. Existing gateway role and
broker quota enforcement remain authoritative; no access to another daemon or
home was added.

Theme controls reuse the account menu's system/sun/moon icons. Navigation icons
come from the accepted prototype. Git identity remains read-only until editing.
Own usage and users' quota rows have usage bars. Logout keeps the shared existing
confirmation. GitHub detach now uses a dialog while retaining the existing fresh
login and daemon observation-token checks. The working API-key row is delivered
with @provider-api-keys, not a placeholder.

## Decisions for later review

- The section is ephemeral presentation state, not another native preference.
  `/settings` opens the list on a phone; `/administration` opens server detail.
  The browser does not persist the last-open section. Back returns focus to the
  section list; leaving settings restores the previous workspace route.
- The shared model picker replaces the prototype's compact synthetic select,
  as required by @implement-model-choice. Its real model rows and thinking
  controls make Agentti taller. It remains the same production picker in all
  placements, with explicit provider/model choices rather than ambiguous ids.
- Native radio rows and theme buttons, semantic table rows and the existing
  accessible modal implementation replace the prototype's scripted controls.
  The users table folds into stacked rows on a phone.
- No server version is invented: the existing `/api/v1/server` contract exposes
  name and administrator role, not a build version, despite the prototype's
  assumed fact. The implemented server section edits the actual server name.
- The existing Pi status is aggregate readiness (subscription **or** API key),
  so its row is labelled OpenAI (Pi), not falsely labelled a confirmed ChatGPT
  subscription. The credential endpoint separately reports subscription presence.
- No last-seen dates, invented display names or account-entitlement probes are
  introduced. The UI shows only bound GitHub logins from the broker projection.
- The prototype's grouped row/card spacing, 190px section list, section headings,
  one-detail phone layout and theme treatment are carried into production tokens.
  The existing shell, avatar, buttons and focus states remain shared production
  components rather than copies of the prototype library.

## Evidence

Paired static HTML and image captures under `visual/` use invented lab identities
and native homes only. They cover account, connections, agent defaults, appearance,
users and disk on 1440×1000 desktop and 390×844 phone, light/dark, plus phone lists.
Images are human comparison evidence, not automated visual-diff assertions.

Focused validation and final gate/review evidence are appended after the final
runnable tree is verified. Live checks belong to `KOKEILTAVAA.md`; synthetic tests
do not establish real provider entitlement or live Linux-user isolation.

Visual inspection caught two defects before landing: the phone-list capture
had been taken during loading, and unset Git identity showed inputs before an
edit action. The capture now waits for the settings heading, and unset as well
as existing native identity uses the same read-only row until explicitly edited.
The credential security review/assessment is recorded in @provider-api-keys.

The first full normal browser run passed 166 cases, skipped the two existing
opt-in capture cases, and failed two old journeys: one still expected Pi status
on the account section instead of navigating to Connections; the new user-switch
case navigated away before logout's server reply. The former now visits the
section while retaining its one-status-read invariant; the latter waits for the
logout response before a new document navigation. Both and the native key
journey passed the focused rerun. These were test-integration failures, not
unrelated timeouts waived as passes. Final clean-gate evidence follows below.

Final visual set: **30 paired AVIF/static HTML captures**, pinned to runnable
source `43f6c1d1`, plus the key issue's eight pairs. The phone list waits for
loaded settings, and long Agentti pickers include bottom/action captures. A
visual comparison also exposed the shell's ordinary 720px message measure
squeezing both columns; the settings wrapper now uses its own full-width
measure, with sticky desktop section navigation. This is a layout fix, not a
new token or a duplicate shell. Static snapshot scanning found no complete
credential-like string.

Focused evidence before the clean gate: all 244 then-existing web tests passed;
the added unset-Git-identity and colliding-provider intent regressions also
passed their focused runs. Real native Pi credential/readiness, API-key RPC
turn and gateway/admin boundary tests passed after the review fixes. The final
three-case host-backed rerun (key add/suffix/switch/confirmed removal,
administration enforcement and one-status-read navigation) passed in 8.3s.


## Final clean gate

`OH_PORT_BASE=29700 OH_BROWSER_WORKERS=2 OH_GATE_SERIAL_HEAVY=1
./scripts/ci-local.sh --clean --json` **passed**, without reused phases, on
commit `8387d29187c4b60610d473bbfddf8f496ac4a703`, tree
`12880fb81e02763569a857350e71c31721d901db`. The receipt is in the shared
git directory at `open-habitat-gate-receipts/12880fb81e02763569a857350e71c31721d901db.json`.
All 128 app tests, 118 component tests, 168 normal browser cases and 24 lab cases
passed; the two normal browser skips are the existing opt-in capture-only cases.
The gate also passed all Go packages/race checks, native SDK tests, 33 schemas,
generated drift, docs, Storybook and packaging/socket/reproducibility checks.
Total 320s: setup 7s, dependencies 11s, web checks 15s, browser 227s,
Go/contracts 51s and packaging 9s. Available memory was 8 GB before the run;
build scratch stayed on disk-backed `/var/tmp`.

The first clean attempt stopped on formatter output in the new identity test;
that fixture was normalized. The next full parallel attempt passed browser/lab
and the feature tests but failed the existing live-`/proc`
`TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession` with an
uncertain observation under process churn (not a claimed timeout). It passed
ten isolated race-enabled repetitions. The final run used the documented serial
heavy-phase option and passed every unchanged check. No test was skipped or
weakened, and no partial run is called a pass.

The following closing/evidence commit changes documentation only. It does not
claim a clean-gate receipt for a different tree. The watcher release is
explicitly ungated under the disposable-test policy.

## Closing sequence

The bounded one-shot continuation
`/var/tmp/settings-finish-01m51fmtb8any0a0dqre9tf3wh.py` uses the exact full
Taskfleet run id for `/worktree-merge`, then fetches/rebases/pushes main without
force. It waits for unrelated main edits without stashing or touching them.
After the watcher and operator receipts agree on an exact descendant source,
tree, version, gate and artifact digests, it checks public/origin HTTP routes,
closes both issues and pushes their own result/metadata only. It also verifies
the resulting evidence-only deployment. Its log is
`/var/tmp/settings-finish-01m51fmtb8any0a0dqre9tf3wh.log`, with sanitized summaries
at `/var/tmp/settings-deployed.json` and `/var/tmp/settings-final-deployed.json`.
A post-stage or ambiguous release failure stops instead of being blindly retried.
The receipt validator and read-only public/origin probes were exercised against
the already verified pilot.131 before starting it. Signed-in and real-provider
checks remain for Jari; no household service is restarted.
