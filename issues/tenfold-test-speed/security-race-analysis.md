# Cross-user browser identity race investigation

## Observation and cause

The preserved host-backed synthetic trace from worker `01m50g1qpmxqqg5n333892m73m` (`/var/tmp/oh-race-focus-20.log`, repeat 19 error-context) displays Bob's native conversation alongside an account button labelled Alice. This is not merely a test selector failure: the browser can paint two identities in one view. The gateway resolves each request from its HttpOnly session cookie and forwards to the mapped daemon (`internal/gateway/session.go`, `proxy_linux.go`); the daemon derives `snapshot.identity.web_identity_id` from its configured provider and subject (`internal/daemon/snapshot_linux.go`). Thus the Bob conversation came from Bob's snapshot, not from an Alice request selecting Bob's daemon. The test host's two users share a test UID, so this is evidence for browser composition, not production UID isolation.

The browser's `App` previously read `/auth/session` and its profile only during first Pi check. An Alice tab in Pi onboarding could lose its cookie to a logout/login in another tab, receive Bob's snapshot on a later refresh, and retain the Alice profile in React state. Redux correctly replaced the snapshot and keyed the conversation store by its `web_identity_id`, but neither operation bound the separate account profile to that identity. `useLayoutEffect` cleared the old person's state on an identity change and scheduled a refresh, but a later refresh skipped the session read because `piChecked` remained true; that left the label stale. A delayed Pi-attempt response is one possible trigger of the refresh, not an authority to choose the daemon.

## Contained browser remedy

`App` now reads the authenticated session on each snapshot refresh, fences snapshot/status responses against a second session read, and clears user-specific state and retries when the session CSRF changes. It commits the profile, CSRF, and snapshot only after the session fence. The Pi-missing path checks the binding too. `GitHubOnboarding` also reports a change in its session binding to `App`: this is necessary because a tab can remain in the Pi-required state with no snapshot refresh; without it, Bob's Git-identity step still showed Alice's account label. The existing identity-change cleanup disposes the old conversation store, drafts and event stream. The two-tab test rejects Alice's account label when Bob's native conversation appears or his onboarding account menu is shown; it also requires Alice's repo to be absent. No Unix routing or daemon authority changed.

This uses the session's CSRF as an opaque cookie-session generation value, not as proof of a particular Unix identity. A request already admitted before logout can finish with old content, but a response used in the new UI must pass the current session fence. There remains an unavoidable interval in a background tab between cookie replacement and its next refresh/focus/event, when already-rendered old content is visible locally; the product's documented semantics permit that until the next observation. The fence is not atomic with a future cookie change after the final read, so only a protocol-level identity assertion in the session response combined with snapshot identity could prove stronger synchronous consistency. That would need a separately reviewed contract change. Writes remain gated on the gateway's CSRF and per-request cookie mapping.

## Verification

Verified: the focused two-tab/late-response browser case passed 10/10 repeats (`OH_PORT_BASE=63000`, `/var/tmp/oh-identity-race-last`); the full Pi race spec passed 2/2 (`OH_PORT_BASE=63500`), nearby cross-identity browser tests passed 10/10 (`OH_PORT_BASE=63400`), web unit passed 126/126, and typecheck, lint, format, production build's fixture check and `git diff --check` passed. These host-backed tests prove browser composition and mapped routing against synthetic users, **not** separate-UID production isolation or an atomic session/snapshot transaction. Confidence is high for the observed profile/snapshot race and its contained UI remedy, moderate for every possible cookie-flip ordering. The earlier focused attempts exposed a second Pi-required boundary, which the final remedy covers; later test failures assumed Bob must enter Git confirmation even if he had already reached Pi onboarding, and were corrected by conditioning on the actual step. An overlapping browser run collided on Playwright's default output directory, and a separate retry hit an orphaned Vite port; final checks used unique outputs/ports and the orphan was stopped. The prior 20/20 failures were on the test-only worker's unchanged product bundle, not verification of this fix.

## Authenticated account controls during a snapshot outage

The session-fence change in `f79a482b` moved the account profile commit behind
`readSnapshot`. On a fresh load with a valid `/auth/session` and an unavailable
`/api/v1/snapshot`, the snapshot read fails first, leaving the outage screen
without Alice's account menu, settings or logout. This is a presentation
regression: the authenticated session endpoint still supplied a validated
profile and CSRF, independent of daemon availability.

`App` now presents the profile and CSRF immediately after validating the
session and checking its binding. If the CSRF differs from the previously
observed session, it first clears the old person's snapshot, profile and
identity-scoped browser state, then retries under the new binding; it does not
paint a new profile over an old snapshot. Successful snapshots still pass the
second session fence before Redux accepts them. A missing/invalid session never
creates account controls, and a 401 still clears them. The browser does not
choose the Unix user.

Verification: all five `lab-outage-account` cases pass with `OH_PORT_BASE=60000`
(`TMPDIR=/var/tmp`), including a fresh-page snapshot outage with Alice's named
menu on desktop and phone, settings/logout, and fail-closed administration.
The existing cross-user Pi race now explicitly rejects Alice's account after
the binding switch regardless of whether Bob's native view or onboarding
appears; both cases passed 10 repeats each (`OH_PORT_BASE=60100`,
`TMPDIR=/var/tmp`). Web unit (21 files, 126 tests), typecheck, lint, format
and production build/fixture scan pass. The initial check failed because this
worktree had no npm dependencies; `npm ci --prefix web` restored the pinned
lockfile dependencies and the full retry passed.
The lab host is synthetic, so this proves account presentation and browser
composition, not separate-UID isolation.
A background tab may still show its previously rendered view until it observes
an auth change, and a cookie flip after the last session read cannot be made
atomic without a server protocol change; neither is changed here.
