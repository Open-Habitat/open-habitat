# Result — 2026-11-10

## Cause

The Atlassian start never reached Pi. The daemon refused it with `409
attempt_active` because the same person's Microsoft first pass held the single
login slot (it was counting chosen files for 16 minutes before failing on the
quota; see `microsoft-first-sync-over-quota-and-channel-site-skip`). The
refusal left no daemon event, and the sign-in dialog replaced the host's
explanation with the generic "Kirjautuminen ei onnistunut. Mitään ei
yhdistetty.", which read as the pilot.24 failure again. pilot.25's wrapper fix
is not implicated, and no Atlassian *Live check* failed: none was reached.

## Fix

- `web/src/components/Integrations.tsx`: `FailedStep` takes the refusal text
  (`stage.error`) and shows it in place of the generic failure line
  (`data-testid="integration-login-failed"`).
- `internal/daemon/integrations/handler_linux.go`: `refuseStart` logs
  `integration_login outcome=refused phase=start reason=<code>` for every start
  refusal; `attempt_active` adds `busy_provider`, `busy_state` and
  `busy_syncing`. Values are fixed product constants.

## Verification

- `TestRefusedStartAndQuotaShortfallAreLogged` (synthetic Dropbox-style first
  pass blocked in inventory, Atlassian start → 409 with the event; after the
  quota refusal the slot is free and the start succeeds). Fails on the
  unfixed handler.
- `IntegrationsSettings.test.tsx` › "shows why the host refused to start a
  sign-in": 409 `attempt_active` shows the Finnish "ensimmäinen synkronointi on
  kesken" text. Fails on the unfixed component.
- `go test ./internal/daemon/integrations` (also `-race` on the focused
  tests), `./scripts/test-focused.sh --area web`, and the browser specs
  `integrations.spec.ts` + `atlassian-connect.spec.ts` with
  `OH_BROWSER_WORKERS=2`: passed.

Review: one-finder `/llm-review` (claude-fable-5-1). Its one finding held:
the settings poll kept a refused write's text across a daemon state change,
which the new failure line would have shown over a genuine failure. Fixed
(`IntegrationsSettings.tsx` poll) with a test that fails without it. Lock
order, `errQuota` consumers, log privacy and skipped-site alignment checked
clean. No verifier: the finding was settled by the reproducing test.

## For the pilot

The person can start Jira and Confluence again now: the Microsoft attempt ended at
08:44:40Z and no longer holds the slot. If it fails after the next release the
journal will name the reason.

## Decisions for later review

- **Refusals shown as the failure line.** Alternative: a separate notice
  above a generic failure. Chosen because the generic line is false for a
  refusal (nothing was attempted), and the restart button still lets the
  person try again once the other pass ends.
- **Not changed in the first round: one login slot per daemon.** Decided by
  Jari 10.11. and implemented in the second round below.

# Second round — sign-ins beside a first sync (2026-11-10)

## What was really blocking

Two things, not one. The relay's single slot refused the start, and even an
admitted start could not have finished: a chosen first pass held the
catalog write lock `c.write` through its count and copy (hours), and every
sign-in's last step, and every IMAP/CalDAV/Apple connect and removal
(`TryLock` → 503), needs that lock. On the pilot the Microsoft count alone
held it 16 minutes.

## Change

- `relay_linux.go`: the relay holds one attempt per provider
  (`attempts map[Provider]*attempt`). `startLogin` replaces or refuses only
  *conflicting* attempts: the provider's own, and when the new provider
  copies files (`FolderEntry`: Google, Microsoft, Dropbox), every other
  file-copying provider's. A conflicting attempt that is in its first pass,
  or another session's live unexpired attempt, refuses with 409
  `attempt_active` as before; the session's own earlier one is replaced.
- The chosen first pass (`firstPass`: fresh count, quota check, copy) runs
  without `c.write`, as resumed passes already did. `a.pass` is published
  under `c.write` and closed when the native work ends; `abandonFor` (removal)
  waits on it even when a cancellation already marked the attempt failed,
  and a sibling removal of the same provider is refused while it runs.
  `reconcile` keeps every syncing account's client off; `check` does not
  align a provider's configuration while its attempt is live.
- Resume and Microsoft recovery claim a place only when no file-copying
  attempt is live or cleaning up (`filesFree`).
- Contract: `GET /api/v1/integrations/login?provider=<id>` reads that
  provider's attempt of the session; unscoped reads the session's latest; a
  write answers with the attempt it addressed. Schema description and a CT-037
  scenario line; no shape change. The gateway admits exactly that query on
  GET; the daemon refuses an unknown provider, extra parameters and a query on
  a write.
- Browser: dialog polls and the stop-sync check read their own provider's
  attempt, so another provider's attempt neither overwrites the dialog nor
  stalls its polling (the poll ignored a foreign `attempt_id` and never
  re-armed).

## Verification

- `TestSignInWithoutFilesRunsBesideFirstPass`: Dropbox-style first pass
  blocked in its count; Atlassian starts, completes (needs `c.write`) and is
  removed during it; a second Dropbox start and a Google start are refused
  with `busy_provider=dropbox busy_syncing=true`; after the pass ends Google
  starts. `TestRemovalDuringFirstPassStopsIt`,
  `TestRemovalAfterCancelWaitsForThePass` (fails without the review fix),
  provider-query cases in `TestDeviceCodeRelayBelongsToItsSession`, gateway
  `TestGatewayIntegrationQueryShapes`.
- `go test` (and `-race`) `./internal/daemon/integrations`, `./internal/daemon`,
  `./internal/gateway`; `test-focused.sh --area contracts`, `--area web`
  (new `IntegrationsSettings.test.tsx` case fails with unscoped polls);
  browser `integrations.spec.ts` + `atlassian-connect.spec.ts` with
  `OH_BROWSER_WORKERS=2`: passed. The relay tests use Dropbox, not Microsoft,
  as the first pass: the existing blocking-count fixture is Dropbox's; the
  rule is per file-copying provider, so the case is the same.
- No new browser spec for the concurrent case: the synthetic host's first
  pass finishes at once, so it cannot hold one open; the Go tests drive the
  real handler.

Review: independent `/llm-review`, finder gpt-6-astra, verifier
claude-fable-5-1 (high-risk: concurrency, removal, gateway query). One
must-fix confirmed: a removal right after a cancel overtook the still
running pass (Dropbox, Google; Microsoft is fenced by its native mutex).
Fixed with a regression test. `/assess-findings`: 1 FIX, nothing else.

## Decisions for later review

- **Which sign-ins conflict.** Chosen: one attempt per provider, and one
  live attempt among providers whose entry offers a folder choice, whatever
  level or renewal is asked. Alternative: admit a Google or Microsoft
  sign-in that would not reach a folder choice (a renewal of an account
  whose files already sync), refusing only at the folder step. Not done:
  whether an attempt will copy files is known only after the provider
  answers, and a refusal in the middle of a consent flow is worse than one at
  the start. Mail and calendar connections by password were never in the
  relay; they were blocked by the write lock and now work.
- **The provider query rather than a list of attempts.** Alternative: GET
  returns every attempt of the session. Chosen the query because each
  dialog wants exactly one attempt, the reply shape stays the same for the
  browser, the agent route and existing fixtures, and the provider is
  already the unit of exclusivity.
- **Removal during a first pass now works.** It used to answer 503 because
  the pass held the write lock; now it stops the pass, waits up to 15 s for
  the native process and removes. Kept because removing a stuck import is
  what a person wants; 503 remains when the process does not exit in time.
- **Residual, not changed:** a level change's last two-way pass (Google's
  `endLevel`, the Commit of a Dropbox/Microsoft level change) still holds
  `c.write`, so a sign-in beside it completes only after it. Rare and short
  compared with a first sync.
