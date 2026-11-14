# Result: GitHub workflow permission on the GitHub card

Direction A Rivi of round `2026-11-13-github-workflow-scope` is in
production. Settings › Code hosts' GitHub card shows the token's scopes as
chips on the GitHub row and has its own row, "GitHub Actions -työnkulut",
with the plain-words risk, a state (Ei sallittu, Kirjautuminen kesken,
Sallittu, Lupa puuttuu, Ei tiedossa) and its buttons.

- **Gateway** (`internal/gateway/auth.go`, `github.go`):
  `/auth/github/start?return_to=…&reconnect=1&scope=workflow` adds
  `workflow` to `repo read:org gist`. The extra scope comes from a fixed
  list (`allowedExtraScopes`: only `workflow`). It is honoured only under
  the reconnect's own guard: the person's session, `Sec-Fetch-Site:
  same-origin`. A refused reconnect is an ordinary sign-in with the usual
  scopes. Any other scope value, a repeated `scope`, or `scope` without
  `reconnect=1` is `400 invalid_request`. State, PKCE, flow cookie and the
  callback are unchanged. The start event's reason is `reconnect_scope`.
- **Daemon** (`internal/nativegh`): the existing identity probe is now
  `gh api --hostname github.com user --include --jq …`. The scopes come from
  the same answer's `X-OAuth-Scopes` header, so no new request is made.
  They are sorted and checked against a scope-name pattern. With no header
  (fine-grained or App token), a repeated header, or an unrecognised value,
  they are `null`. The snapshot's `native_github.scopes` is present only
  with `connected`.
- **Opt-in**: `github_workflow` in the person's own
  `~/.config/open-habitat/preferences.json` (`account-preferences` contract).
  After an explicit reconnect has installed a token that has `workflow`
  (`replace` and phase installed or replaced), the daemon sets it to true.
  A reconnect never clears it. Remove permission and Don't allow write
  `false` through the ordinary preferences PUT; Remove does this before it
  starts the reconnect without the scope.
- **Browser**: Allow / Allow again start the reconnect with
  `scope=workflow`. Remove permission starts it without. The card's own
  Reconnect, and every other reconnect in the app, asks for `workflow` when
  the person allowed it or the token has it now, so a routine reconnect
  never drops the permission silently.

## Decisions for later review

1. **Who writes the opt-in.** A reconnect whose token got `workflow` sets
   it, so cancelling on GitHub changes nothing (the prototype's
   "Kirjautuminen peruttiin. Mikään ei muuttunut."). Only the person's own
   write clears it. The review found that letting the reconnect's token
   also clear it would lose the wish: a generic reconnect started before
   the page had read the preferences (or after the read failed) leaves out
   the scope, and the daemon would then have written `false`. Now such a
   reconnect leads to "Lupa puuttuu", and Allow again brings the
   permission back. The hook from nativegh's consumer into the daemon is
   `Adapter.OnReconnected`. No new field crosses the gateway→daemon wire,
   and no authority moves: the daemon writes only its own person's
   preferences, as itself.
2. **Removal writes `false` first, then signs in again without the
   scope.** If that write is not confirmed, the reconnect does not start.
   If GitHub hands back a token that still has `workflow` after a subset
   request (NOTES warns this is unverified), the token sets the opt-in
   back to true and the card keeps showing Sallittu. It does not claim the
   permission was removed. The old token is not revoked (Jari 14.11.).
3. **The browser may write `github_workflow: true`.** The schema allows a
   boolean, though the UI writes only `false`. Writing `true` only changes
   what the card says; it grants nothing.
4. **Callback does not read the token response's `scope` field.** The daemon
   reads the installed token's scopes itself after the install. That is the
   token gh actually uses, so the gateway passes nothing new.
5. **No outcome sentences after the round trip** ("Työnkulut sallittu…"). The
   page reloads from GitHub, and the new state is the outcome. Only Don't
   allow, which happens in place, has its sentence. The pending state has a
   Cancel button and clears itself when the page is restored from the
   browser's history.
6. **The row appears only with a working login**, because only then does the
   host read scopes. With expired or disconnected the card's existing repair
   comes first.
7. `bounded` output limit raised from 8 to 16 KiB, because `--include` adds
   about 2 KiB of GitHub headers to the probe's output.

## Validation

- Go: `scripts/test-focused.sh --area go --go-package` for `./internal/nativegh`,
  `./internal/gateway`, `./internal/daemon`: all ok.
- `scripts/test-focused.sh --area contracts`: ok. `--area web`: 1635 passed.
- Browser: `github-workflow-scope.spec.ts` (3 tests, 2 workers): passed;
  axe clean on both rows in light and dark at 1440 and 390.
- Screenshots (1440/390, light/dark, scale 2) of off, on, missing and unknown
  are in the run's worker-results directory.

Live check: not run on a live host; GitHub's behaviour for a subset re-request
(decision 2) still needs one real reconnect with the production OAuth app.

## Review

An independent `/llm-review` was run, with gpt-6-astra as finder and
claude-fable-5-2 as verifier, followed by `/assess-findings`. The review
produced one confirmed finding, a generic reconnect clearing the remembered
opt-in, which is fixed (decision 1). The verifier's focused pass on the
gateway and token boundary found no path by which a cross-site or
unauthenticated request could get `workflow`, no path by which any other
scope could be requested, no weakening of the state, PKCE or flow-cookie
checks, and no token or raw gh output reaching a log, the snapshot or a
reply.
