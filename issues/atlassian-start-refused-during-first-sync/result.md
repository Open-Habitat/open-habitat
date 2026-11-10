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
- **Not changed: one login slot per daemon held through a first pass.** A
  sign-in that copies no files (Atlassian, mail) waits behind another
  provider's first sync, which can take hours on a large drive. Allowing it
  needs several concurrent attempts in the relay and in the login view
  contract (`GET /api/v1/integrations/login` returns one view), so it is a
  design decision, left as the open acceptance item.
