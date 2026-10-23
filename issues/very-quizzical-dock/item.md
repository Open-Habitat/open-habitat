---
created: 2026-10-23
updated: 2026-10-23
type: task
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5kdebb4vz5vzswgvs1zrmq6/native-msal-adapter
originating_run: 01m5kdebb4vz5vzswgvs1zrmq6
originating_run_kind: spinoff
lane: integrations
lane_seq: 5
collision: [internal/daemon/integrations]
preparation: ready
closed: 2026-10-23
---

# Microsoft: package and qualify a single-grant native MSAL adapter

## Description

Microsoft 365 still needs two grants, and the Outlook CLI hides its individual `authorization_pending` / `slow_down` responses. The browser now distinguishes the two stages, but the daemon cannot produce Outlook polling counters from this CLI's public output. This is an observed limitation of @softeria/ms-365-mcp-server 0.170.1, not a claim that Microsoft requires two codes.

## Goal

Package a deliberate same-user native MSAL adapter. Obtain one union-scope device grant, preserve the library's own serialized account/refresh state through the tool's native encrypted storage, and give rclone its native token config. No new credential store. Emit allowlisted per-poll telemetry before native output is redacted.

## Evidence and deferral reason

The pinned package exports DefaultTokenCacheStorage and wrapCache/unwrapCache from dist/token-cache-storage.js. An isolated probe round-tripped MSAL serialize/deserialize through its encrypted file storage with mode 0600. Thus native cache interoperability is plausible and is not rejected as an architectural boundary.

The probe was an EMPTY cache: it establishes neither account/tenant identity nor refresh acceptance. The package's dependency is @azure/msal-node ^5.2.2; an isolated installation of the exact MCP pin resolved MSAL 5.6.0. The product's integrations config declares executable paths only, not a Node interpreter/module closure. A source-only adapter that guesses a global package path or hand-builds MSAL account/refresh JSON is not qualified by that probe. A deployable adapter needs an explicitly resolved/locked native module closure and a grant→persist→reload→refresh test against it, including personal and work accounts, identity mismatch, cancellation and failed replacement. That implementation/qualification was deferred from the dialog repair; one-code support is NOT proven impossible.

MSAL's native AuthManager device-code method currently constructs scopes and deviceCodeCallback only, so the standalone CLI does not expose a network-response observer to the Go daemon. Fixed lifecycle diagnostics can be recorded, but unknown Outlook pending/slow-down counts must not be reported as zero.

## Acceptance Criteria

- [x] One synthetic device-code request with union scopes, then both native stores reload and refresh using the actual pinned libraries.
- [x] Expected-account refusal, cancellation and failed replacement preserve existing native credentials.
- [x] Both device-flow responses are observable without raw native logs, user codes, access/refresh tokens or account content in host diagnostics.
- [x] Adapter executable/interpreter/module closure is packaged and qualified; no developer/global npm install is required in production.

## Quick Test

Use synthetic homes and a fake OAuth/Graph transport with the pinned MCP/MSAL libraries. Verify pending, slow_down, success, expiry, durable native reload and silent refresh; no live credentials.

## Decisions

### 2026-10-23T04:19:45Z · @jari

Jari 2026-10-23 07:18 live retry: with the explicit stage 2/2 the flow works (files token 26 s, Outlook token 55 s) but step 2 looks so similar to step 1 that it reads as an error. One code for the whole Microsoft 365 connection is required; accepted for implementation now.
