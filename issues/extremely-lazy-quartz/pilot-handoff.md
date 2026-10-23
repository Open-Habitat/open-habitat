# Pilot handoff — publication pending

## Current state

The real ingress is **https://open-habitat.acme.test**. HTTPS health, served UI
and GitHub authorization redirect with exact callback all pass with certificate
validation. No browser login, GitHub callback or personal model/provider grant
has been performed by this worker.

The pilot currently runs a **development build**, not the final released
product. Version 0.1.0-pilot.6-dev2, source
52b103ea27023836e640bf9c814d88dd75438b32, actual service executable SHA-256
49dfeaa8e66877c99b950713d4ae6a7ca7fa4d6e08a651d234039aeafdfb7ad0.
Installed generation /opt/open-habitat/generations/50d7e0d28dbfbf8a5a2f547fa6a42c0a56c41a6436e5e625c2a5fded47cb3c1d.

Original interrupted apply completed intact at seq17. Two deliberate reboots
were used: the first exposed the dormant-polkit check defect; the second tested
the corrected installed build. Latest verified boot ID:
2fdd84c5-85f7-46af-b013-01d3c6cd271e. All host checks pass on this cold boot,
including with polkit still loaded/inactive/dead/MainPID0. Broker, gateway and
private revoke listener are active; no failed units. Nonroot gateway has exactly
cap_net_bind_service in ambient/bounding sets. Editor-host certificate validation
also passes; an unauthenticated editor request correctly returns401.

All twelve runtime archives remain byte-for-byte pilot.3. Product adoption uses
the supported signed named-successor upgrade with distinct transition metadata,
not manual selector/unit changes. No signing private key is on the pilot.

## Final release blocker

The earlier worker published pilot.6 one minute before this run was spawned. It contains
the low-port fix but not the subsequently discovered cold-boot correction.
This worker has not overwritten that release or its tag. Approval was requested
for pilot.7, preserving published identity. Final publication, download/verify,
exact released-product installation and post-install checks remain pending.
Do not describe the current service as released pilot.6 or pilot.7.

## What Jari does first after final release acceptance

1. Open **https://open-habitat.acme.test** and sign in with GitHub.
2. If not already administrator, use the supported root operator after that
   first binding: preview `host apply --site /etc/open-habitat/site.json
   --dry-run --json`, then apply that fresh approved plan as the guide explains.
   The declared subject1272053 is currently `deferred_until_bound`; no account or
   binding was precreated. The explicit native alternative after binding is
   `admin role update 1272053 --administrator true --json`.
3. Authorize your own Pi/model provider and GitHub tools from your own session.
   No shared provider credentials are installed.

## Operations

Strict-pinned SSH uses the customer's existing known_hosts and dedicated
acme-servers identity; customer endpoint203.0.113.30, open-habitat-pilot-1.
Protected declaration and sources stay under /etc/open-habitat. Gateway config,
TLS and unit state are product-managed. Never reset a journal or hand-switch
/opt/open-habitat/current; future releases use the signed named upgrade guide.

Customer OS/TLS/DNS needed no new changes in this round. The existing customer
security.ubuntu.com repair remains. TLS expires2027-01-21 02:12:16UTC; Jari owns
manual renewal by **2026-12-20**, isolated external certbot DNS-01 for only
*.acme.test, SOPS input update, then the guide's supported source-pair rotation
and approved apply. No automatic renewal timer is installed; no DNS admin token
is on the pilot. Follow docs/operations.md and the shipped operator guide.
