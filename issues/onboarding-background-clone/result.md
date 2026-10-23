# Result: background clones during onboarding, continue without repos

Delivers `onboarding-background-clone` and `onboarding-continue-without-repos`
(same component).

## What changed

- **Continue in every phase.** The repository chooser always shows Continue
  (`repository-proceed`): while the catalog loads, when it is unavailable, when
  GitHub auth is missing, and with an empty or loaded catalog. Outside a loaded
  catalog it always continues without names. The unavailable notice keeps its
  read-again action; the duplicate page-level notice for catalog failures is
  gone.
- **Continue does not wait for clones.** With a selection, Continue verifies
  the session, queues the names in the app's clone-job store
  (`web/src/app/cloneJobs.ts`) and moves straight to the AI step. The daemon
  runs one clone at a time (`clone_running`), so the store starts queued names
  one after another through the existing ADR 0024 clone-job API. Neither the
  daemon nor the contract changed.
- **Each start is careful.** A checkout that is already there is recognised
  by the existing checkout observation and not started (`present`). A
  conflicting or interrupted directory is reported, not overwritten. A lost
  start reply is settled by the job list, so a clone that started is never
  requested a second time. A busy refusal waits for the running clone.
- **Progress.** The AI step shows a compact list (`onboarding-clones`): one
  line per repository with state, a thin progress bar while receiving, "in
  queue" for waiting names, and the reason plus a retry for a failure. Once
  onboarding is done, the rail's clone block and the clone page
  (`/workspaces/new`) show running, queued and refused names. The clone page
  can retry or remove a queued name.
- **Nothing is lost.** Retry is offered only where the failed attempt left
  nothing on disk: a failed job with `leftover: removed`, or a start the daemon
  refused. A directory that was left behind (interrupted, or failed
  verification) is reported and left for the clone page's existing explicit
  actions.
- **Store lifetime.** The store is bound to the session's CSRF binding rather
  than the snapshot identity, so it exists during `pi_required` and the queue
  carries on into the workspace view. A new login gives a new binding and a new
  store. The store starts names only with its own binding, and onboarding
  running under a different session reports a session change. A clone
  confirmed during onboarding no longer reloads the app, because a reload with
  no snapshot would unmount the AI sign-in.

## Evidence

Host-backed synthetic evidence (same-UID test host, fake gh/git/Pi). It does
not establish distinct-UID isolation.

- `./scripts/test-focused.sh --area web`: pass (93 files). The queue unit
  tests in `cloneJobs.test.ts` cover one-at-a-time starts, an existing
  checkout, a lost reply, refusal and retry, a late list that settles a lost
  reply, busy back-off timing, and refusing another session's token.
- Browser, all passing on the final tree:
  - `github-stream`: Continue with two repos reaches the AI step while the
    first clone is held mid-receive and the second waits. After Pi sign-in, the
    rail shows the clones live; both are confirmed after release. Also a failed
    clone (`fail-once`) is shown in the AI step and its retry succeeds.
  - `github-first-onboarding`: includes the unavailable-phase continue path
    (no clone POST, AI step reached) and reading the catalog again on return.
  - `github-slow`, `github-observation`, `github-denied`, `onboarding-notices`,
    `clone-page`, `github-session`, `first-use-ux`, `shell-accessibility`,
    every `pi-onboarding-*`, `refresh-identity`, `provider-login-layout`,
    `phone-sign-in`, `pi-native-route-gate`, `pi-attempt-host`, and lab
    `lab-onboarding`.
- Whole suite `npm run test:browser --prefix web`: 325 passed, 3 failed, 3
  skipped. All three failures are in untouched specs and fail on main too:
  `spinoffs.spec.ts:231` fails deterministically on main `bd5f5571`, filed as
  `adequately-huge-desire`. `browser-conversation.spec.ts` status/identity
  cases fail intermittently under load on main as well as this branch (3+3
  repeated runs), filed as `almost-aggressive-wind`.
- Screenshots with static HTML twins, from the synthetic lab
  (`web/lab/onboarding-background-clone.mjs`), desktop and 390 px, light and
  dark: `chooser-unavailable-*` and `ai-step-clones-*` (one repo receiving,
  one refused as a conflicting directory with retry, one in the queue).
- Review: an independent `/llm-review` (finder GPT-6 Astra; I verified each
  finding locally, so no verifier model was called), because the store moved to a
  session-scoped key on the identity boundary. All three findings were
  confirmed and fixed in a follow-up commit: the queue could adopt another
  session's token, the busy back-off was bypassed, and a lost reply with an
  unreadable list was shown as a definite refusal.

## Limits

- The queue lives in the tab. Names not yet started when the tab is closed or
  reloaded are not started, and nothing reports them. A started clone carries
  on in the daemon and shows up after a reload as usual.
- Clones are full clones; onboarding offers no light (blobless) choice.
- The Git identity step still appears only after a catalog has loaded, so
  continuing from an unavailable catalog skips it (unchanged behaviour).

## Decisions for later review

1. **The queue is client-side, not in the daemon.** The daemon's one-at-a-time
   rule and admission stay unchanged. A daemon-side queue would survive a closed
   tab but changes security-sensitive admission code and the contract. If
   leaving with a partly-started queue matters on the pilot, the daemon is the
   place to add it.
2. **Continue is offered during `loading` too**, not only in the failure
   phases, so a slow catalog never holds a new person back.
3. **Retry for a refused conflict is offered.** The person can fix the
   directory on the machine and retry. The daemon refuses again harmlessly if
   nothing changed.
4. **An already-present checkout counts as done** ("oli jo haettu") and is
   never re-cloned.
5. **The store is keyed on the session binding** (`csrf ?? identity`) instead
   of the snapshot identity. It is still one store per login, and identity-scoped
   clearing still disposes it.
