# Result: Kartta route frame and the Google step

Delivers `onboarding-route-map`: the Kartta direction of
`proto-onboarding-person` r2 is production's onboarding frame.

## What changed

- **The frame.** `OnboardingFrame` (`web/src/components/OnboardingFrame.tsx`)
  now draws the whole route beside the step: a column "Oma reittisi" with
  each step, the current one marked (`aria-current="step"`), passed ones with
  a check or, when left without a result, a dashed ring, and a short note of
  what each left behind ("Kirjautunut", "1 repo haussa", "Ei repoja",
  "Yhdistetty", "Ohitettu"). At narrow widths (container under 680 px, so
  390 px phones) the route becomes two short rows above the step. The frame
  takes its route from the owning journey through `OnboardingRoute`; without
  one (login, profile, an AI sign-in from Settings) it shows GitHub → Repot →
  AI-tili as before. Onboarding pages get room for the column: `main` and
  `.ah-state` widen only when they hold the frame.
- **Steps inside it, unchanged.** The repository chooser (`GitHubRepoChooser`,
  with background clones and continue-without-repos) and the AI-account flow
  (`PiOnboarding`) render exactly as before inside the frame; only the step
  id they pass changed. The Git identity confirmation, previously outside any
  frame, is now inside it as the GitHub step.
- **The Google step.** `GoogleOnboarding` (`web/src/app/GoogleOnboarding.tsx`)
  is `IntegrationsSettings` itself, limited to Google (`only`) and shown
  compactly: the Settings page's lead, folder hint, agent warning and closing
  note are left out, because the step says what Google is for and the
  connect dialog (same `ConnectDialog`) still shows the agent warning before
  anything is connected. Connecting, the pasted redirect, the folder choice,
  progress, re-sign-in and removal are the Settings code paths. The step
  continues either way ("Jatka ilman Googlea" / "Jatka AI-tiliin") and can go
  back to the repositories.
- **When Google is a step.** `GitHubOnboarding` reads the integration catalog
  once when it binds the session and passes it to the step, so the step does
  not read it again. Google is on the route when that catalog says Google is
  available, which is the operator's configuration (`Available` in
  `internal/daemon/integrations`). A passed Google step is remembered for the
  session like the repository step (`nah:google-step`) and is forgotten when
  the person goes back to the repositories.
- No daemon, contract or session change; the step uses the same
  `/api/v1/integrations` reads and CSRF-bound writes as Settings.

## Decisions for later review

1. **Who sees the Google step.** Until `plan-site-onboarding-authority`
   makes it a site setting, Google is a step exactly when the server offers
   it in Asetukset › Integraatiot (provider available). A catalog that cannot
   be read leaves Google out of onboarding rather than holding the person.
2. **Google is always optional in onboarding.** The prototype's "required"
   variant waits for the site setting; nothing blocks the AI step.
3. **Already connected Google** still shows its step (account card,
   "Jatka AI-tiliin") instead of being skipped silently, so the route stays
   the same for everyone on the server.
4. **The map's label is "Google"**, not "Integraatiot": the issue asks for
   the integration as its own step, and a later second integration would be
   its own step too.
5. **Git identity and profile completion** count as the GitHub step's
   current state, since both come from the GitHub sign-in.
6. **An AI sign-in from Settings** (`?pi_sign_in=1`) is not onboarding: it
   keeps the plain three-step route and never shows Google.
7. **The AI step's back action** still returns to the repositories, as the
   unchanged AI flow did; Google's own back action goes there too.
8. **Small seams left as they are**: the route can grow from three to four
   steps if the catalog answers after the first paint; after a reload the
   repository note says "Valmis" because the count is not kept; the Git
   identity form keeps its own card and heading inside the frame card; the
   step cards keep their "Käyttöönotto" eyebrow next to the route.

## Evidence

Synthetic lab captures (real gateway and daemon handlers, stand-in Google
entry, invented homes), screenshot plus inert HTML, desktop 1440 and phone
390 in light and dark. Reproduce with the lab up:
`PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/onboarding-route-map.mjs`.

- Repository step with Google ahead: `repositories-{desktop,phone}-{light,dark}.png`
- Google step: `google-{desktop,phone}-{light,dark}.png`
- AI step after skipping Google, with the queued clone:
  `ai-after-google-skipped-{desktop,phone}-{light,dark}.png`

Each has an `.html` twin of the same name.

## Checks

All with `umask 077` and a disk-backed `TMPDIR`; host-backed synthetic
evidence, not UID isolation.

- `./scripts/test-focused.sh --area web`: typecheck, lint, format and unit
  tests pass (new `OnboardingFrame.test.tsx`, compact case in
  `Integrations.test.tsx`).
- `./scripts/test-focused.sh --area browser --spec onboarding-route-map.spec.ts`:
  4 passed — route progression with every step marked, skipping Google,
  continuing without repositories inside the frame and back from Google to
  the chooser, connecting Google through the Settings dialog, and a server
  without Google getting no Google step.
- `--spec github-first-onboarding.spec.ts`: 5 passed.
- Whole suite `npm run test:browser --prefix web`: 332 passed, 3 skipped.
  The first whole run failed three layout assertions that encoded the old
  single-card geometry (`onboarding-notices`, `workspace-slice` login
  width); they now measure the step card and the centred frame, and frame
  notices sit under the card instead of across the route. Onboarding specs
  that go from the repositories to the AI step pass the Google step through
  the shared `passGoogle` helper, because the synthetic host offers Google.
- No Go or contract change, so those areas were not run.

## Review

The change touches only browser presentation and the order of onboarding
steps; daemon state, sessions and the contract are unchanged, so a focused
self-review replaced `/llm-review`. It checked that the Google step adds no
new authority (same Settings reads and CSRF-bound writes, under the session
GitHubOnboarding already verifies; a session change unmounts the step), that
a resumed sign-in in another provider is not reopened inside the Google
step, that the step cannot strand the person (continue in every state, an
unreadable catalog removes the step) and that the chooser and the AI flow are the
same components with only their step id changed.
