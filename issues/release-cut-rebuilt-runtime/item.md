---
created: 2026-11-07
updated: 2026-11-07
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: release pilot.20 run
source_ref: taskfleet:01m6v4fwchjk9y365ebg4cn7t6/release-cut-rebuilt
originating_run: 01m6v4fwchjk9y365ebg4cn7t6
originating_run_kind: spinoff
closed: 2026-11-07
commits:
- hash: fb05b45d8
  summary: release-cut --rebuilt
---

# release-cut.py cannot cut a release whose runtime changed; take natively rebuilt profiles with --rebuilt

## Description

`scripts/release-cut.py` refused every release whose runtime inputs changed since the predecessor (`runtime_changed`) and offered no route for one: the runtime archives must be built natively per architecture, which the script cannot do, and nothing took those archives into a cut. pilot.20 needs a new core archive (Taskfleet, workmux and the `pi` launcher in every installation's runtime, `fe28f9e2`), so the cut would have had to be done by hand outside the script.

The script now takes `--rebuilt ARCH=DIR` (a `build-*-runtime.sh` output) for each rebuilt profile and both architectures. It checks each archive against its `artifact.json`, refuses a profile whose `runtime/<profile>/` inputs changed but was not rebuilt, replaces that profile's descriptor in the successor manifest (named `<profile>-linux-<arch>.tar.gz`, no `archive_release`), uploads the archive with the release and records the rebuilt archives in `release-gate.json` and the notes.
