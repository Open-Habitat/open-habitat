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
