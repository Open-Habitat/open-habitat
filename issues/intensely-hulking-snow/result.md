# Result

gog 0.39.1 and rclone 1.71.2 now ship third-party notices generated from the
Go module lists their release binaries embed, the same way as tea's. This
covers linux-amd64 and linux-arm64. The integrations builder now refuses any Go
executable that has no such notice, not just one whose notice is stale. A new
Go tool, or a lock bump, therefore cannot ship with only its top-level
licence.

## What changed

- **Notices** (`runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES`,
  `rclone-THIRD-PARTY-NOTICES`), generated with
  `scripts/go-binary-notices.py generate` from both targets' binaries. Each
  pair embeds identical module lists: gog has 56 modules plus Go 1.27.1, rclone
  210 plus Go 1.25.3. Every module was downloaded through the Go toolchain
  against `sum.golang.org` and its go.sum hash compared with the one the
  binary records. The lock now names the notice as each tool's licence file
  and `go_notices`. The separately pinned `gogcli-LICENSE` and
  `rclone-COPYING` inputs are gone, because the notice carries the main
  module's own licence (as with tea).
- **Reader** (`go-binary-notices.py`). The build information is now located
  through the ELF section table (`.go.buildinfo`), as Go's own reader does.
  rclone also carries the buildinfo magic as ordinary data, and the old byte
  search refused it as ambiguous. An ELF without a section table is refused
  rather than classified (review finding, below).
- **`+dirty`.** rclone's release stamps its main module as `v1.71.2+dirty`. The
  bound module block keeps the stamp exactly. Only the source download (and
  the notice's title) uses the tag `v1.71.2`.
- **Licence supplements** (`SUPPLEMENTS` in the script), pinned by URL and
  sha256 and keyed by module@version:
  - `github.com/yosuke-furukawa/json5 v0.1.1` (gog) has no licence file in
    its module. The author added a BSD-2 `LICENSE.md` to the repository in
    2019 (commit `1c306d98`). It is included with that explanation, and the
    code also derives from Go's `encoding/json`, whose licence is already in
    the notice.
  - `github.com/cloudsoda/sddl` (rclone) is LGPL-3.0, and LGPL-3.0 §4(b)
    requires the GPL v3 text alongside it. gnu.org's `gpl-3.0.txt` is
    therefore added.
- **Builder** (`integrations-runtime-build.py`): `go_notices_required: <tool>`
  when a tool's executable is Go and its lock entry has no `go_notices`.
  `build-profile-runtime.sh` copies the new notices into the build inputs.
  `test-integrations-runtime.py` checks every sealed Go tool against its
  notice and that himalaya (Rust) is classified non-Go.
- `scripts/test-profile-runtime-build.py` now runs in the gate
  (`ci-local.sh`). Its synthetic Go binary is now a real minimal ELF. New
  cases cover a decoy magic outside the section, a second `.go.buildinfo`
  section, a missing or truncated or stripped section table, a Go tool without
  a notice, and a non-Go ELF tool.

Licences found: gog is all MIT, BSD, Apache-2.0 (and Go PATENTS). rclone adds
ISC, CC0 (`zeebo/blake3`), UPL-or-Apache (`oracle/oci-go-sdk`), MPL-2.0
(`anacrolix/generics`, `anacrolix/log` and six `hashicorp` modules) and one
LGPL-3.0 (`cloudsoda/sddl`). tea's notice regenerates byte-identical with the
new reader.

## Validation

- `build-profile-runtime.sh integrations` on Alder (amd64; archive
  `23085a13…9bb1`) and natively on birch (arm64, in the disposable
  `/var/tmp/oh-notices-RQGb`, never the installed Open Habitat; archive
  `ac7fe5be…9cac`). `test-integrations-runtime.py` passed on both, re-run on
  both with the final reader. It checks each Go tool's sealed binary against
  its notice and runs `rclone version` and `gog --version` under a minimal env.
- `go-binary-notices.py check` passed for all four gog and rclone binaries.
  The module lists equal `go version -m` output for each of them.
- `test-profile-runtime-build.py`: 11 tests, on Alder and birch. Mutation: the
  stripped-section-table case fails against the pre-fix reader.
- Full gate: see the closing line below.

**Review**, focused but independent, because verification logic changed:
`/llm-review` with gpt-6-astra as finder, then `/assess-findings`. One finding
was confirmed and fixed: an ELF whose section table had been stripped still
ran, but `is_go` called it non-Go, so the new guard could be bypassed. No
verifier was called, because a test reproduced the finding.

Not covered: the source-availability statement relies on the Go module proxy
and go.dev keeping these versions. No written source offer is shipped.

## Decisions for later review

- **rclone ships an LGPL-3.0 module statically linked** (`cloudsoda/sddl`, a Windows
  security-descriptor parser). This was already
  true before this issue; the notice now makes it visible. The notice carries
  the LGPL and GPL texts and names where the unmodified source of every
  module can be obtained, and rclone itself is MIT and rebuildable from that
  source. That is the usual way to meet LGPL-3.0 §4 for a static Go binary,
  but whether the product accepts an LGPL component in a shipped profile at
  all is Jari's licence-boundary call.
- **json5 v0.1.1's licence is taken from the author's later repository
  licence.** The module version itself states none.
- **The gate now runs `test-profile-runtime-build.py`**, which it did not
  before. It is offline and finishes in under a second.
