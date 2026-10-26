---
created: 2026-10-26
updated: 2026-10-26
type: bug
status: open
priority: normal
provenance: other
provenance_detail: found while implementing github-token-expires-silently
source_ref: taskfleet:01m5vrvh57ezey9qxnfszmg6nx/finding:oauth-ten-token-limit
originating_run: 01m5vrvh57ezey9qxnfszmg6nx
originating_run_kind: spinoff
lane: unlaned
collision: [internal/gateway/]
preparation: ready
---

# Each GitHub sign-in mints a token; after ten, GitHub revokes the one gh uses

## Description

Found while fixing `github-token-expires-silently`.

Every GitHub sign-in to Habitat exchanges a code for a new OAuth App token
with the same scopes (`repo read:org gist`). When the person's `gh` already
holds a working login of their own account, the daemon keeps that login
(`nativegh.Install` → `already-correct`) and the new token is dropped by the
gateway, still live at GitHub. GitHub keeps at most ten tokens per
user/app/scope and revokes the *oldest* when an eleventh is minted
(docs: "Authorizing OAuth apps", token limits). The token in `gh` is by
construction the oldest, so after ten more sign-ins (new devices, the fresh
sign-in that disconnect requires, sign-out/sign-in) GitHub silently revokes
the one `gh` uses, and `git push` stops working.

Since `github-token-expires-silently` the settings row shows this as
"Vanhentunut" with a one-step reconnect, but the connection should not
break in the first place.

Two fixes, both architecture-relevant (internal/AGENTS.md: "a later login
reobserves native state instead of replaying a token"):

1. Gateway revokes its surplus token (`DELETE /applications/{client_id}/token`,
   app credentials) when the daemon answers that it kept an existing login.
   Needs the handoff ack to say installed vs kept. Touches no native
   credential. Recommended.
2. Daemon replaces the person's own-account `gh` token with the newer one.
   Simpler, but overwrites a native login that may carry extra scopes
   (e.g. `workflow` from `gh auth refresh`).

## Decisions

### 2026-10-26T09:56:53Z · @conductor

Conductor 2026-10-26: fix 1 (gateway revokes the surplus token it minted when the daemon kept an existing login). It moves no authority: the gateway only revokes a token it just obtained and never holds; native credentials stay untouched. Listed for Jari's later review.
