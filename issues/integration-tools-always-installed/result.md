# Result

Every installation now ships the integration tools. The `integrations` profile
is required beside `core`. Its signed closure carries himalaya 2.2.1, rclone
1.71.2 and gog 0.39.1, each pinned by archive and file SHA-256 with its upstream
licence texts and recorded as a `native` component in the manifest. It also
carries the Microsoft MCP tool and adapter, and a Pi wrapper that runs the same
generation's core Pi. Ubuntu's curl is declared as the profile's apt
requirement for DAV. Apply and upgrade write `integrations.json`'s `tools`
through `/opt/open-habitat/profiles/integrations/bin/`. They rewrite the file
only when its tools or mode are wrong, and keep every app section's bytes. The
daemon reports `unavailable_reason: app_credentials_required` for providers
that are only missing an app registration, and the page says they are waiting
for the administrator's settings.

## Live evidence

`python3 scripts/cloud-qualify.py run` passed on a fresh Hetzner Ubuntu 24.04 VM
([receipt](receipt-cloud-qualify.json), VM address redacted; the VM was destroyed and
`open-habitat-qualification-vm list` was empty afterwards). The predecessor was
0.1.0-tools.3 and the successor 0.1.0-tools.4. Both were product packages from
this branch, with pilot.7's core archive and the new integrations archive,
signed with a disposable development key. Results:

- After install, both synthetic people saw IMAP, CalDAV and CardDAV available,
  and Google, Microsoft and Dropbox as `app_credentials_required`. All seven
  tools were root-owned executables, and the file was root:root 0644 with a
  single link.
- The file was byte-identical after a cold boot, and the following apply was
  `no_change`.
- Before the upgrade the harness added a formatted placeholder Dropbox section,
  as a customer would. After the upgrade, the upgrade's interrupted-boot
  recovery and a final cold boot, the file kept the same SHA-256 and Dropbox
  was available.

Two VM runs were used. The first was stopped during delivery once review
showed the upgrade would rewrite the operator's formatting.

## Checks

Focused Go tests for `internal/host`, `internal/daemon/integrations` and
`cmd/runtime-release` passed, as did the root-container host tests
(`scripts/test-host-initialization-uids.sh`) and `scripts/test-cloud-qualify.py`.
The real integrations profile build passed `scripts/test-integrations-runtime.py`,
which runs each tool for its pinned version. Contracts and web unit/type/lint
checks also passed. `internal/daemon` has native-runtime test failures that also
occur on the untouched base commit. A pre-existing flake in
`TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished` is filed as
intake `supremely-simple-bottle`.

## Review

`/llm-review` used gpt-6-astra as the finder and claude-fable-5-1 for one focused
boundary question. Its `/assess-findings` triage confirmed two real defects,
both fixed before the live run:

- The new pins had made an older signed predecessor unauthenticable. That
  would have blocked the Northwind pilot's upgrade, so the pins now gate only
  installation targets and signing.
- Exact-byte matching rewrote the operator's formatting. Matching now compares
  the tools the daemon reads.

Accepted limitation: a site that selected only `core` cannot be upgraded in
place and is reinstalled. No such installation is known; the Northwind pilot
selects every profile.

## Fleetrepo

No Fleetrepo change is needed. The test server keeps its own checksum-pinned
tools and operator file. The product archive's file set, which the release
watcher inspects, is unchanged. Optionally, Fleetrepo could later drop its
separate himalaya, rclone and gog installs on a host installed through
`open-habitat host`, but the test server is not installed that way.
