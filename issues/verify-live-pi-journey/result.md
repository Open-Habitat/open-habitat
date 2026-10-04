# Pilot.18 installed-host checks — 4 October 2026

Release `0.0.0-pilot.18`, source
`597264ff78da07d7123d6052aa5c929e18b6eb8f`, was installed on the test server.
The deployment checks below passed. The Pi browser journey covered by this
issue was not tested on the installed host.

## Verified

The installed version and services matched the release. The gateway could
reach the mapped user's daemon, and the native gh and Pi checks passed.
Permission checks denied an unrelated Unix user access to protected sockets
and the mapped home, and denied the mapped user access to gateway configuration.
The session-revocation socket was restricted to root.

The forwarded TLS connection passed hostname validation, and Access intercepted
an unauthenticated request. Workspace-volume verification passed after its
capacity was increased; the earlier free-space failure was resolved.

The full clean product gate also passed on this exact source. Its synthetic
coverage included typed Pi history, provisional events and terminal-history
updates across two browsers. These tests ran in the lab.

## Not verified on the installed host

No authenticated browser journey was run with either a synthetic or real
provider. This leaves Access/GitHub sign-in, Pi device-code onboarding and the
browser conversation flow unverified: creating a conversation, sending,
streaming text and tool updates, interruption, reconnect and continuation.
Separation between two distinct signed-in users was also not tested.

## Evidence

Fleetrepo's `issues/rebuild-test-vm-first-use/result.md` records the pilot.18
installation and follow-up checks on 4 October 2026, including the volume
expansion in run `01m42hnp2mwe649xkxze0g2ht6`. It contains the detailed
deployment and verification receipts.
