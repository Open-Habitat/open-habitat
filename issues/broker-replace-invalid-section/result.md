# Result

## Live cause (test server, 0.0.0-pilot.387, metadata only)

The issue's hypothesis was wrong. The broker never validates a section's
contents before splicing: `integrationapps.Replace` checks only that the file is
one JSON object with distinct keys, and the test server's file passes that
(root:root 0644, one link, 806 bytes, members `dropbox`, `google`,
`microsoft`, `tools`; Microsoft `tenant_id` is `common`).

The refusal came from the host operation lock. `/var/lib/open-habitat/host`
did not exist: product `host apply` creates it, but Fleetrepo installs the test
server and never runs `host apply`. The broker opened the directory without
creating it, and it reported that failure as `integrations_file_invalid`. The
broker journal shows `set_integration_app` rejected with that reason at
14:05:38Z.

## Change

- The broker creates the private 0700 lock directory inside its trusted parent
  when it is missing, as `host apply` does (`internal/provision/integrations_linux.go`
  `hostLock`). An existing directory that is not root's and private, or a link
  in its place, still refuses.
- `host plan` reported a missing directory and an empty one with different
  reasons, and the plan ID hashes that reason. Both are now `no_active_operation`,
  so the broker's first write does not make an approved plan stale (found by
  the review).
- Tests: an invalid-under-current-rules Microsoft section (tenant `common`) is
  replaced and cleared with every other byte unchanged, a malformed file is
  still refused, and the missing lock directory is created.

## Review

`/llm-review`, routine rigor on a high-risk surface: the finder (gpt-6-astra)
found nothing; one focused verifier question (claude-fable-5-1) found the
plan-ID effect, which was confirmed locally and fixed.

## Decisions for later review

- The broker now creates `/var/lib/open-habitat/host`. The original
  integrations work tested that it never would, but recorded no reason for
  that. `host apply` creates the same directory under the same trust check, and
  the bootguard upgrade fence does not depend on whether it exists.

## Checks

Focused Go: internal/provision, internal/cli, internal/host green. The full
gate (`ci-local.sh --clean`) passed web, browser and packaging; Go failed once
in an untouched daemon test because of an HTTP client timeout at load average
36. Run alone, that test passed 3 of 3 times. Filed as
`reasonably-uppity-pizzas`.

## Live verification after release

This worker does not push, so the release follows the conductor's push to
main (watcher). Afterwards Jari's save should succeed. The broker creates
`/var/lib/open-habitat/host` on its first write; the KOKEILTAVAA item for
`microsoft-tenant-migration` is the live check. No Fleetrepo release script
reads that directory.
