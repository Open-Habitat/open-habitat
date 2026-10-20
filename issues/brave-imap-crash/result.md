# Investigation — Chromium cannot reproduce the reported Brave crash

Run: `01m5d7fcdtt78sskmz9ygdvta8` (spinoff). Baseline:
`211a7a7f9155ae1c35326c2ddd7c09ba65f78300`. No production workaround,
push, deployment or test-server access. This supersedes the blocked attempt
preserved in commit `97dd2c85`; that attempt ran no browser assertions.

## What was tried

Extended the existing host-backed IMAP connection/removal journey in
`web/tests/integrations.spec.ts`, using a fresh synthetic Chromium context:

- Open Settings → Integrations → Sähköposti (IMAP) → Yhdistä… → Jatka.
- Type `jar`, assert it remains visible, then type `person@example.test`.
  Repeat at 0, 100 and 300 ms between keyboard events.
- Assert the full address, derived username and `imap.iki.fi` server survive.
  Also exercise whole-value fill, blur and refocus.
- Instrument IndexedDB object-store `get` and the native directory picker;
  their counts do not change during typing. No integration-login request or
  JavaScript page error occurs. A renderer crash would also fail the following
  field assertions and the rest of the journey.
- Continue with the existing synthetic address, refused password, successful
  connection, separate synthetic Bob context and account removal.
- Run the entire Integrations spec, including Google redirect, Microsoft device
  login, cancellation/refusal, and desktop/phone accessibility cases.

All five browser cases passed. No typing-triggered crash reproduced. This is
Linux ARM64 Chromium evidence, **not** evidence that macOS Brave or the reporter's
profile is fixed. No real email account was contacted or credentials used.

## Handle and autofill investigation

`App.tsx` creates `LocalFiles` per authenticated identity and calls `restore()`
in an effect dependent on that instance. Thus entering the app can deserialize a
previous grant from IndexedDB, but opening the IMAP form or changing its address
does not trigger another restore. `localFiles.ts` stores the native directory
handle in `open-habitat-local-folder/grants`; it reads it only in `restore()`,
writes only after explicit grant/revoke, and requests the picker only from the
explicit grant gesture. No OPFS operation occurs in the IMAP flow.

The existing `local-files.spec.ts` already documents the separately reproduced
Chromium off-the-record handle-deserialization crash and uses disposable
persistent contexts for its grant/reload tests. This investigation did not seed
native handles into an off-the-record context or claim that separate browser
bug is fixed. A saved grant can explain an app-start crash in such a context;
there is no demonstrated connection to the specific third keystroke here.

`PasswordForm` in `Integrations.tsx` updates local React state on each keystroke:
address, lowercase username and suggested server after `@`. No network discovery,
datalist or application autocomplete exists. `TextField` in `Primitives.tsx`
uses React Aria's ordinary input, without an email type or explicit autocomplete
attribute; the password input uses `autocomplete="new-password"`. Native browser
or extension autofill remains possible, but was not reproduced. Google,
Microsoft and Dropbox integrations do not add address-keystroke work to this
form. No speculative autofill disablement or change to handle persistence was
made.

## Verification

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec integrations.spec.ts --writers-paused`:
  **passed**, 5 cases, 23.8 s test runtime. Runner job
  `a2e16562507369985456266618d2074a2f29f147537d16ff1e41e8f8618ba99b`,
  terminal `success`, worker exit 0. Captured source SHA-256
  `06cff34d933585ef84d3ebef62e23b08212e9a9b178448bd7256465227fd7eaa`.
  Raw evidence: `/var/tmp/oh-browser-e26p1lvw`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: **passed** (format,
  lint, TypeScript, unit and component checks), job
  `891fde59f73268b778ea86be1bb4a48a042e9328b5bba6d29fd4b205db322708`,
  terminal `success`, worker exit 0. Evidence: `/var/tmp/oh-browser-48hujbyc`.
- `python3 scripts/validate-project-view.py`, `git diff --check` and
  `issuectl doctor --json`: passed.
- Focused self-review: test/evidence-only diff; no production authority,
  Unix-user boundary, credentials, contracts or dependency changes. Independent
  model review is disproportionate and not required for this scope.
- Full gate intentionally not run. Lab captures deferred: no visible UI change;
  used the maintained focused remote browser path rather than specialist local
  lab execution on Alder.

## Failure/incomplete-command inventory

No required check failed or remains incomplete. Initial exploratory reads
encountered the absent result file on this branch (recovered from `97dd2c85`)
and nonexistent component/page globs (replaced by scoped source searches).
These were discovery misses, not skipped validation. No independent model
review, Brave/macOS execution, seeded-handle experiment or lab capture was run;
the evidence and limits above are deliberately narrower than those claims.

## Disposition and limits

Close as `cannot-reproduce` on the concrete Chromium evidence above, not `fixed`.
If it recurs in Brave, the useful next evidence is the exact Brave/macOS build,
whether the whole browser or one renderer exits, and a sanitized crash ID/stack.
Reproduction should use a disposable profile on that platform, then isolate
native autofill/extensions and any pre-existing folder grant. Personal profiles
and saved credentials must not enter synthetic tests.
