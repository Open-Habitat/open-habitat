# Result

## Cause

The daemon relays Pi's built-in MCP OAuth to the browser: it reads Pi's
`Sign in to MCP server … :\n<authorization URL>` notification, checks the URL,
and shows it as the authorization step. The check accepted only a loopback
redirect whose path is exactly `/callback`.

Pi 1.5 (the version the release bundles) identifies itself with a Client ID
Metadata Document when the authorization server supports one, and when that
server sends no RFC 9207 `iss` in its responses it makes the redirect URI
server-specific: `http://127.0.0.1:<port>/callback/<12-char base64url id>`.
Atlassian's authorization server for `https://mcp.atlassian.com/v2/mcp`
(checked 16.11.2026 from its public `.well-known/oauth-protected-resource/v2/mcp`
and authorization-server metadata) advertises
`client_id_metadata_document_supported: true` and no `iss` support, so Pi took
that path. The daemon dropped the URL without any trace, never announced a
step, and the browser stayed on "Starting the sign-in…" until Pi's own
five-minute callback wait ended. That surfaced as
`outcome=failed phase=login reason=tool_failed`, matching the report.

The contract's `redirect_prefix` pattern had the same exact-`/callback`
assumption. v0.1.2 and main were identical in this code. The opt-in real-Pi
test missed it because its fake authorization server offered only dynamic
registration.

## Fix

- Daemon (`pi_oauth_linux.go`) and contract (`integration-login.schema.json`)
  accept `/callback` or `/callback/<[A-Za-z0-9_-]{1,32}>`. The pasted redirect
  must still match the exact host, port, path and single state.
- Fail fast: if Pi asks for the pasted redirect with no relayable
  authorization step, or shows nothing within 90 s, the sign-in ends at once
  with the new failure `authorization_unavailable`. The browser says the
  provider's sign-in page could not be prepared and nothing was connected.
  The host log adds a fixed `detail` class (`redirect_unexpected`,
  `authorization_host_unexpected`, `no_authorization_step`, `helper_error`,
  `helper_exited`). No native text is logged.
- Dialog title: "Connect an account: <name>" / "Yhdistä tili: <name>", which
  works for any provider name. The administrator request texts for Atlassian
  and Trello now name `/callback/…`.

## Verification

- Daemon tests: `TestAtlassianServerSpecificCallback` (full flow on the
  `/callback/<id>` shape) and `TestPiOAuthUnrelayableStepFailsPromptly`
  (unrelayable redirect, foreign host, silent helper, helper error). Against
  the v0.1.2 `pi_oauth_linux.go` they hang until the test deadline. With the
  fix they pass in milliseconds. The whole integrations package is green.
- `TestPiOAuthBuiltRuntime` now also runs a CIMD authorization server. It
  passes with the real Pi 1.5.2 (the release's version), in both the
  registration and the metadata-document variants.
- Live, uncommitted: the daemon's `StartLevelLogin` with real Pi 1.5.2
  against Atlassian's real endpoints produced a valid prompt
  (`/callback/<id>`) in about 1 s.
- Contract check, web unit/component suite, and browser specs
  `atlassian-connect` and `trello-connect` are green.
- Review: llm-review (finder gpt-6-astra, plus one focused verifier question
  to claude-fable-5-2 on the redirect-validation boundary). No findings.

## Limits

Without a real Atlassian account nothing past the authorization URL was
exercised: Atlassian's consent page accepting Pi's metadata-document client,
the pasted redirect, the token exchange, and the granted scopes. Whether
Atlassian lists the pi.dev metadata document's redirect pattern for an
organisation with a restricted domain allowlist is also unverified. The
administrator text already gives `http://127.0.0.1:*/**`.

## Decisions for later review

- New failure code `authorization_unavailable` rather than reusing
  `tool_failed`. The alternative was to keep the wire unchanged with a
  generic message. Chosen because the brief asks for a specific error, and
  the person can then tell "try later or ask the administrator" apart from a
  generic failure.
- 90 s start window. Alternatives: 30 s, or none. Pi bounds each request to
  the authorization server at 15 s, and discovery plus registration take a
  few requests, so 90 s avoids false failures on a slow network and still
  replaces the five-minute stall.
- The callback id is accepted by shape (`[A-Za-z0-9_-]{1,32}`), not
  recomputed from the server URL. Recomputing it would tie the daemon to
  Pi's internal derivation and stall again silently if that changed. The
  pasted redirect is still pinned to the exact path Pi showed.
- Title as "Connect an account: <name>", following the sibling titles
  "Change level: <name>" and "Sign in again: <name>". Finnish
  "<name>-tili" was also wrong for names like "Microsoft 365".
