# Result

Shipped `open-habitat-ui`, installed for daemon-launched Pi alongside the
start-page skill, with a host-context discovery cue. It covers all browser text
catalogs (Finnish, US English and UK overrides), settings sections/rows,
visibility conditions and route aliases, and discovered keyboard handlers.
No gateway, contract, session state or authority boundary changed.

`python3 scripts/generate-ui-reference.py` produces module-sized searchable
Markdown references. `--check` rejects changed, added, missing or obsolete
references in the gate and release packager (including ungated releases).
The generator regression test exercises catalog addition/change/removal,
settings changes, new keyboard handler discovery and exclusion of test sources.
Go tests check exact embedded bytes/private modes and restoring missing
references. The existing pinned Pi loader test now verifies both shipped skills
alongside personal/project skill trust and precedence.

## Decisions for later review

- Name: `open-habitat-ui`, rather than the prototype's `open-habitat-ohje`.
  It matches the existing English start-page skill prefix and routes naturally
  in either UI language.
- Reference representation: source-shaped text in per-module Markdown files,
  rather than evaluating catalog functions with invented inputs or maintaining
  a second prose manual. This preserves every plural/conditional branch, JSX
  placeholder, US/UK override and shortcut restriction without a TypeScript
  interpreter or new dependency. The agent interprets it; it is not a human
  manual. The skill explicitly separates known wording from inferred effects.
- Shortcut coverage: include discovered key handlers with their surrounding
  components, not just labels, since focus/platform/state conditions change
  what works. Library/browser defaults are not claimed to be fully enumerated.
- Delivery: checked-in generated build inputs, embedded in the binary and
  materialized privately with the existing per-controller skill lifecycle.
  No user-global skill install, runtime source checkout, screenshots or network
  fetch. Release packaging also checks freshness so an ungated test release
  cannot accidentally carry a previous UI's guide.

## Verification

Tested the working diff based on `1c57e16172d0c386b8528b2efec1d5164f38a812`.

- `python3 scripts/test-ui-reference.py`: pass, including negative drift cases.
- `python3 scripts/generate-ui-reference.py --check`: pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: pass
  after installing requirements-ci.txt into a disposable uv venv. First run
  failed only because Python `referencing` was absent; the complete rerun passed.
- `./scripts/test-focused.sh --area web`: pass (Biome, TypeScript, 161 files /
  1,185 unit/component tests).
- `npm run build --prefix web`: pass; existing PostCSS/chunk-size warnings.
- `package-release.sh --version 0.0.0-agent-ui --target linux-arm64 ...` and
  `verify-release.sh --archive ... --json`: pass. Disposable package:
  `/var/tmp/oh-agent-ui-package.IGHjxS/package/open-habitat-0.0.0-agent-ui-linux-arm64.tar.gz`,
  SHA-256 `87c9e7aa0582151f58353520b400c9e5d884b0ca14e0fbf6bf121575fba23687`.
  The first verifier call incorrectly used a positional archive; reran with
  the documented flag successfully.
- `python3 scripts/validate-project-view.py`, `git diff --check`: pass.
- `issuectl doctor --json`: no schema, parse or reference errors; existing
  non-AVIF image inventory in unrelated issues remains unchanged.

Focused self-review traced both initial and reused `piArgs` installation paths,
relative reference delivery, generator selection/drift/removal, and the skill's
browser/agent authority distinction. Changes to the daemon are file shipping
only. No new browser behavior or specs: no Playwright/full gate run. These tests
prove packaging/loading and source fidelity, not arbitrary model obedience,
answer quality in a live conversation, or installed-host acceptance. The Finnish
trial prompt is recorded under KOKEILTAVAA's Työn alla.
