# Pi browser OAuth feasibility

## Findings

The source investigation on 2026-09-29 inspected Pi **0.85.1**. Its built-in
OpenAI Codex browser login uses the fixed return address
`http://localhost:1455/auth/callback` in both authorization and token exchange.
In the user's browser, `localhost` means their own computer, not the remote
host running Pi. `PI_OAUTH_CALLBACK_HOST` changes where Pi listens; it does
not change that return address. The manual code-entry fallback does not make
the return address configurable either.

Pi's device-code flow works differently: the browser displays instructions,
while Pi exchanges and stores credentials under the mapped Unix user. The
host's existing adapter selects that method and has no browser callback
interface. Pi provider extensions can define OAuth flows, but that alone does
not establish permission to use a different return address or client for
OpenAI Codex.

An earlier unauthenticated provider probe received an anti-bot 403. That result
establishes neither acceptance nor rejection of an HTTPS host callback.

## Open question

Provider acceptance of a remote HTTPS callback and a corresponding Pi integration
path remain unestablished. Pi provider extensions alone do not settle the first
question, and the 0.85.1 source observation does not describe later versions.
The [issue](item.md) defines the research goal and the constraints on a real
experiment.

## Evidence and limits

The [source investigation](https://github.com/maintainer/native-agent-host/blob/b624d1a06ff5cf7b7d17236f475d8577b48b9358/issues/investigate-pi-browser-oauth/analysis.md)
records the inspected Pi package paths and host files. The relevant Pi sources
were `@earendil-works/pi-ai/dist/auth/oauth/openai-codex.js`, `pkce.js`, and Pi's
provider documentation. The inspected host adapter and attempt handlers kept
exchange and storage in the mapped user's Pi process.

The investigation ran
`TMPDIR=/var/tmp node --test internal/daemon/pi-device-test/helper.test.mjs`.
After supplying the missing test-local dependency from the installed pinned
0.85.1 package, all three tests passed with disposable homes and mocked device
endpoints. They cover existing device-login behavior, redaction and interruption.
They do not establish browser callback support, provider acceptance or separate
Unix-user isolation. The temporary dependency link was removed afterward.

No provider request or real sign-in was made during that source investigation.
Provider compatibility remains unknown.
