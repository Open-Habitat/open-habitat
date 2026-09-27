---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: fixed
priority: high
lane: auth-incident
closed: 2026-09-27
closed_by: pi
---

# Investigate first live GitHub login failure

## Description

Jari first attempted live GitHub login on 2026-09-27 around 14:55 local time on Brave, then Chrome. GitHub sent OAuth authorization email for omega-habitat-test (gist, read:org, repo), but both browsers landed at /workspaces?auth_error=invalid_request without a session. Investigate before fixing: correlate callback validation, ingress/proxy and live host logs; establish exactly how far account provisioning progressed and whether partial Unix user, credential, socket or native gh state exists; assess current observability and recommend safe structured logging and diagnostics. Produce a redacted incident report distinguishing observed evidence from hypotheses. No secrets or host-specific identifiers in public repo; no mutating real user state, no fresh OAuth login or browser automation without Jari taking credentials himself. Fleetrepo owns private deployment evidence.

## Comments

### 2026-09-27T14:07:03Z · @pi

2026-09-27 pilot.3 live Chrome retest: browser reached /workspaces with auth_error; bounded gateway oauth_callback log recorded rejected shape_extra_key. Read-only targeted Chrome History query on rowan (no raw callback URL/code/state output) found two callback entries with exactly code, state, iss; iss URL scheme https, host github.com, path /login/oauth, one value. This identifies the cause: strict exact() currently rejects GitHub issuer identifier before exchange, so account provisioning is not reached. No user/binding change claimed. Fix should accept only the pinned exact issuer value while preserving strict rejection of other extras; retest via a later reviewed deployment.

### 2026-09-27T14:25:25Z · @pi

2026-09-27 pilot.4 deployed after guarded pilot.3 switch-back to pilot.2, then stage/switch. Live Chrome retest from existing authenticated browser: auth_error=identity_mapping_denied; bounded gateway event rejected broker_denied. This proves GitHub code exchange and identity parsing proceeded past prior issuer mismatch, but broker ensure or later authorize failed (source has two broker_denied branches). Guest read-only aggregate: allowlist one entry, bindings zero, generation/epoch 1, no pending or ACL markers, no JIT UID user; Alder gh api user ID equals guest allowlist entry. Therefore no JIT binding/account created as of snapshot. Investigate exact broker refusal under authenticated root boundary before retry; do not infer allowlist mismatch or delete state.

### 2026-09-27T14:55:11Z · @pi

2026-09-27 pilot.5 live evidence: gateway ensure rejected broker drift; bounded root event parent_policy. Read-only stat shows installed config dir root:gateway 0750 but product executor expects root:root 0755. Probable pre-provision guard mismatch; no binding/user claimed. Fix expected mode rather than relaxing host permissions.

### 2026-09-27T15:04:02Z · @pi

2026-09-27 security review of config parent fix flagged next boundary: intended /etc/native-agent-host root:gateway 0750 blocks a new daemon UID from traversing to its private binding file unless it gets an exact per-user grant. Live read-only getfacl -cpn /etc/native-agent-host shows only owner/group/other, no per-user ACL. Do not deploy and trigger first provisioning until config delivery/traversal architecture is approved; recommend bounded per-daemon execute-only ACL with Fleetrepo policy and product verifier, no gateway-group membership.

### 2026-09-27T16:37:55Z · @pi

2026-09-27 pilot.6 installed official gh 2.46.0 through hashed Fleetrepo guest installer; native handoff still failed. Root read-only fixed-format probes (no credentials or identities emitted) show helper string produced by actual gh auth setup-git matches exact !/usr/bin/gh auth git-credential, whereas product nativegh.Adapter.observe only accepts exact !gh auth git-credential. Account, broker binding, private file, and active daemon service/socket exist, no pending marker; browser session/native gh still unproved. Product issue @accept-absolute-gh-helper owns narrow validated fix.

### 2026-09-27T16:57:44Z · @pi

2026-09-27 real first login VERIFIED on test guest pilot.7 (product b0ff2f7): Jari-authorized Chrome on rowan returned /workspaces with no auth_error; same-origin browser GET /auth/session returned HTTP 200 and GET /api/v1/snapshot returned HTTP 200 with schema_version 1 and snapshot_id. Bounded gateway logs recorded accepted OAuth callback; root read-only broker state: exactly one binding, one JIT Unix account, one root-controlled private binding file, no pending marker; daemon socket/service active. As mapped UID, native gh auth status succeeded and gh api user numeric ID equaled the root binding subject (boolean equality only, no output). Origin TLS and anonymous Access interception verified after switch. This is a real Chrome/live guest proof for Jari only; no second-user or cross-UID live proof yet.

## Resolution

### 2026-09-27T16:57:44Z · @pi

Live Chrome session, browser snapshot and native mapped gh proved on pilot.7.
