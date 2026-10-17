# Result

## Cause

The dialog's clone used the one-shot `POST /api/v1/onboarding/github/clone`. That request has a hard ceiling: the daemon cancels the clone after **90 s** (`cloneHandler`, `internal/daemon/github_clone_linux.go`) and the gateway gives up after **95 s** (`github_clone_linux.go`), both under Cloudflare's own ~100 s origin limit. The dialog disabled **Luo työtila** only while that request was outstanding. A clone that outlasted the request ended in an error, the button became clickable again and the dialog stayed open, while the native clone might still be finishing or might have been cut off. That matches what Jari saw. The test server's journal for 15:50–16:30 UTC holds no request records (they started at 20:41 UTC with ADR 0022), so this is inferred from the code, not observed live.

## Change

- The dialog now clones through the streaming endpoint (`/clone/stream`, 45-minute ceiling, 20 s heartbeat), the same path onboarding uses.
- Once **Luo työtila** is pressed, the form is replaced by its progress: "Kloonataan owner/repo: Vastaanotetaan objekteja 42 %". There is no create button and no footer. Escape and × are disabled, because closing the dialog aborts the stream, which cancels the daemon's clone. A note says the new workspace opens when it is ready.
- On success the dialog closes and the existing auto-start (Jari 16.10.) opens the new workspace's first conversation.
- If the stream is lost, the browser asks `observe` whether the clone landed anyway, as onboarding does. Otherwise the dialog ends in a failure: "Kloonaus owner/repo ei valmistunut" plus the reason, and only **Sulje**. A new attempt is a new dialog.
- Directory creation is fast and takes the same form → progress → close/failure path.

Screenshots (synthetic lab, `capture.mjs`; the clone stream is replaced in the page so a progress frame stays on screen): `lab-{desktop,phone}-{light,dark}-{progress,failed}.{png,html}`.

## Tests

`web/tests/home-workspace-sections.spec.ts` (lab host):

- **Slow clone.** The stream reply is held. While it is held the dialog shows the progress status, has no **Luo työtila** and no footer, and the × is disabled; Escape does not close it. After release the dialog is gone and the person is in the new workspace `last` with the composer open. Exactly one stream POST was made. On the old code the held stream route is never hit (the old request went to `/clone`), so the case fails.
- **Failed clone.** A 409 stream reply ends in the alert with no create button. **Sulje** closes the dialog.

The earlier "home clone uses existing GitHub path" case is folded into the slow-clone case.

## Not in this issue

Deleting the newly cloned workspace (the disabled trash button) is `implement-trash-ui`. The backend landed in `implement-workspace-trash`; the UI waits for Jari's prototype choice.

## Decisions for later review

- **Progress inside the dialog, not a background job.** Closing during a clone would abort it, so the dialog stays modal until the clone ends. A clone that keeps running after the dialog closes would need the stream (or the clone) to live outside the dialog. That is a bigger change and was not asked for.
- **No retry button after a failure.** The failed outcome may be uncertain (a clone could still appear). Reopening the dialog is the explicit new attempt.
