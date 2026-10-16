# Agent processes in the browser

Implementation of the accepted *Kentän yllä* tray and *Merkintänä* notification design.

## Native owner and bridge

The release embeds `process-extension.mjs` alongside the existing recap extension. Each daemon-owned Pi child receives a fresh socket in a 0700 temporary directory; the socket is 0600. The daemon accepts only its own effective UID **and exact child PID** using `SO_PEERCRED`. Systemd's existing `PrivateTmp=yes` keeps the directory within the daemon service. Terminal-owned Pi is never scanned or attached.

The companion dispatches native list/get/combined-output/kill/clear events. pi-processes owns every record, log and process group. The daemon keeps no registry, PID table, log copy or wake-state store. Output reads and stops carry both the child generation and the native record's start-time token, checked against the live record before dispatch. Clear only removes native finished records/logs. Before closing Pi the companion blocks further native process starts and kills remaining groups; RPC shutdown then allows four seconds rather than 100 ms.

Pi's `agent_start` now establishes an active run even without a browser command. It remains active until `agent_settled`; the composer can steer and abort a native wake-up exactly like a browser-started run. Process custom messages project structured `details`, never the XML content that repeats raw commands. Historical delivery remains null; live initial native messages are wake, subsequent messages steer, idle messages context.

The companion joins live process IDs **and start times** to this child's native process start results for exit wake conditions. Pending/spent log watches do not count. Unknown metadata remains unknown rather than inventing a waiting state. An extension question takes precedence over background waiting.

## Decisions for later review

- Live log delivery uses bounded **invalidation hints** on the existing user SSE, followed by a fresh bounded native tail while an output view follows. This deliberately avoids assembling a second stream/log store or promising gap-free replay over upstream's lossy output broadcasts. No log data is read for a closed output view; paused output remains readable in the browser and resume reads a fresh tail. Unknown omitted counts and retention state stay null. A retention restart is claimed only on the exact native marker.
- Command previews redact assignments, URL user-info, header arguments, credential-like long options and known token prefixes. This is best effort, not a guarantee about arbitrary shell syntax. PIDs, log paths, cwd and raw native records are not process API fields. Output is the user's own bounded text, not redacted.
- The optional upstream runtime is discovered beside the selected Pi. Its absence does not break ordinary Pi or rewrite user settings. Only its core extension is loaded, not logs/dock. Fleetrepo owns the pinned package graph and selector; the product owns the companion bytes.
- Fleetrepo child `01m51vja3n7asnpj1skj8yjb5m` landed/pushed `2f1167c7`: Pi 1.3.0 + pi-processes 0.10.9 + existing Claude bridge, with a licensed `@aliou/sh` 0.3.4 override. The product test graph uses the same override. The upstream default parser 0.2.2 declares UNLICENSED and is not the shipped runtime. Fleetrepo verified 254 tests, registry signatures, a real disposable install and byte-identical offline rebuild. Guest selection must happen **after** the matching product release; no guest runtime was switched by that worker. Runbook: Fleetrepo `infra/open-habitat-test/GUEST-PROCESSES-RUNTIME.md`.
- One approved upstream request was filed: https://github.com/aliou/pi-processes/issues/132 — record `ctx.isIdle()` in notification details and report remaining wake conditions, including pending one-shot log watches, in the list reply. No host internals were disclosed.

## Verification

- `go test -race ./internal/daemon ./internal/gateway -run 'TestProcess|TestConversation|TestNativeBlocks|TestCustomMessage' -count=1`: passed, including real pinned Pi/core/companion with synthetic HOME and synthetic provider. Verified idle completion wake, working state, list during a model request without another prompt, stop and clear.
- `node --test internal/daemon/pi-device-test/process-extension.test.mjs`: passed. Checks missing extension vs empty, reused-ID rejection before kill, current-token force stop, native clear/shutdown and bounded hostile output.
- New `TestProcessDistinctUIDs`: passed in the disposable rootless Ubuntu fixture, own UID allowed and foreign/gateway UIDs denied. Existing dialog isolation passed there too. The broader script's older device-login test failed its native-secret assertion (HTTP status matched); that is not evidence against the new process boundary.
- A full affected-package run with `TMPDIR=/var/tmp/oh-process-build` passed daemon tests but hit existing gateway Unix-socket path-length limits. Subsequent tests use the shorter disk-backed `/var/tmp`.

Browser, final gate, review and live release evidence are recorded below when completed.
