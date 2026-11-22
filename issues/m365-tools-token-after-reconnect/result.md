# Result

The current daemon-owned Microsoft MCP process now releases its native cache before reconnect publishes replacement credentials, and before a health probe refreshes that cache. Existing conversation relays stay connected and the next tool call starts a fresh native child. No token is copied into Habitat state, and no tool call is replayed.

## Cause

Reconnect imports into a new directory containing `.cache-key`, `.token-cache.json` and `.selected-account.json`, then publishes the directory as one unit. The pinned native storage memoizes its encryption key in the process. Its MSAL plugin reloads encrypted cache bytes before access, but that does not make the cached encryption key follow an independently replaced directory. A long-lived child can therefore retain old native state while a fresh verification process reads the new key and succeeds.

The shared MCP binding previously included command, arguments and environment, not the credential directory's generation. Reconnecting the same account with the same permissions left that binding unchanged and did not stop its child. This explains why the five relays could remain present without a usable current native acquisition. It is not five independent relay token stores: relays only forward bytes to the daemon's shared process.

The synthetic native regression uses the actual pinned MSAL, AuthManager and encrypted storage. After directory replacement, forcing the old manager through refresh fails; a fresh process consumes the replacement grant and a subsequent fresh process consumes its rotated refresh token. The fixture rejects stale refresh tokens. It also verifies ordinary same-key rotation observed by an already-created manager. No real account or installation cache was inspected.

A second mismatch was possible in health: discovery refreshed `.default`, whereas the actual tool acquires named permissions. Those can receive different answers. Health now verifies both requests, with the tool's own scope resolver and registration options, before checking Graph with the tool token. Alignment deliberately performs discovery only, because its job is to repair obsolete scope registrations.

## Implementation

- Added a scheduler pause that drains in-flight calls, stops/reaps the native child, and holds queued calls until the native operation finishes. Existing bounded drain/unknown-outcome behavior remains; writes are never replayed.
- Reconnect holds the pause through publication and any rollback. Health refresh, alignment and removal use the same exclusion, avoiding overlapping native cache writers.
- A daemon that does not own the serving endpoint refuses a pause immediately; it never assumes another daemon's child is absent.
- Catalog shutdown keeps endpoint ownership until login/background cleanup finishes, then stops the mux and waits for reaping.
- A local pause or caller-budget failure reports unknown, not successful health or a provider refusal.
- The private CLI validates the added verification options; no public contract or browser surface changed.

## Tests run

All commands used synthetic identities, private test homes and the scratch lease; CPU-heavy commands had an outer timeout. Go ran through the focused runner with its short private TMPDIR and `umask 077`.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations` — passed, including reconnect with a persistent relay, native cleanup at shutdown and deadline classification.
- Same integrations command with `GOFLAGS=-race` — passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/msmcp` — passed, including pause drain/reap, queued calls, cancellation and non-serving refusal.
- Same msmcp command with `GOFLAGS=-race` — passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed.
- `node runtime/profiles/integrations/microsoft-native.test.mjs` — passed against the lockfile's installed modules: import, rotation, stale-key reproduction, fresh-child recovery, discovery versus named acquisition, fixed failure states and real private-CLI request validation.
- `./scripts/test-focused.sh --area contracts` — passed generation and host schema checks.
- `./scripts/build-profile-runtime.sh integrations <private-scratch>/output` — built the sealed integrations artifact successfully.
- `python3 scripts/test-integrations-runtime.py <artifact> <installed-core-runtime>` — passed sealed native tools, Microsoft npm closure, notices, modes, wrappers and pinned interpreter checks. The installed core was read-only.
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=15100 ./scripts/test-focused.sh --area browser --spec lab-microsoft-login.spec.ts` — 4 passed, including accessibility cases. No browser spec was edited; no whole browser suite or clean gate was run.
- `git diff --check`, issue metadata validation and project-view validation — passed before commit.

Tested source: working diff from `18c67cfada2cf1f2a2e1f69d62369851766410ae`, recorded by this result's implementation commit. Final test-only additions were rerun in the native suite. Full daemon, integrations/race and mux/race checks include the final catalog lifecycle change.

The opt-in sealed-runtime/rclone integration test remains skipped in the ordinary Go run because its separate fixture environment was not supplied; native MSAL/storage behavior and the newly built sealed artifact were tested separately as listed above. No claim of a live tenant check, distinct-UID qualification or installed-host upgrade is made.

## Review and assessment

Independent critical review: `claude-fable-5-2` finder and `gpt-6-astra` verifier, two model calls. Credentials and concurrent native writers warranted both. Four confirmed clusters were fixed: private CLI request rejection, non-serving pause/shutdown cleanup lifetime, caller deadline classification, and alignment requiring obsolete scopes. Assessment: three FIX and one FIX_WITH_CARE (catalog lifecycle). No deferred findings or new issues. Final shutdown and deadline refinements were locally regression-tested after verification rather than sent through another review round.

The review and assessment are local working material under `history/`, also retained with the build log at `/var/tmp/agent-keep/m365-tools-token-after-reconnect-01m829wh3ktvcf1d7t9rtx9s7r/`. The substantive findings and resolutions are recorded above so this result does not depend on those files surviving.

## Decisions for later review

- Serialize health refresh with tool use instead of relying on the native reload plugin or adding a second credential store. Reload-before-access is not a lock across refresh and save. The trade-off is restarting the shared native child after a health probe; a busy caller may receive unknown rather than a misleading success or outage.
- Retain the current 12-second health budget rather than silently lengthening list operations. Local budget exhaustion is unknown; an actual completed provider refusal still expires the integration.
- Keep repair/discovery separate from tool-health verification. Requiring old named scopes would prevent alignment from narrowing an outdated registration.
- Leave whole-account file search, old local file copies and unrelated historical documentation outside this credential-lifetime fix; none is needed to repair acquisition. No local user files were removed.

## Live check

The conductor performs this after landing; no real-account access was authorized for this worker.

1. Deploy both the new product and rebuilt integrations runtime: the verifier protocol changed. Reusing the previous integrations archive would omit the native-helper fix.
2. In an existing long conversation, use Microsoft mail and file tools. Reconnect the same Microsoft account with the same permissions without starting a new conversation.
3. Use those tools again through the same conversation. They must work without a `--login` instruction or a conversation restart.
4. Open integration status between tool calls, then continue after ordinary access-token expiry/refresh. Confirm tools still work and status agrees.
5. If a real grant refusal is deliberately tested, the integration must not report ok. A locally busy/canceled probe may report unknown instead.
