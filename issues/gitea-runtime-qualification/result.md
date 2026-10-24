# Result

The integrations profile now ships upstream tea v0.16.0 for linux-amd64 and
linux-arm64, so an installation made from the product's profiles offers the
Gitea connector. The Git helper the daemon registers now names the
installation's stable entry point instead of a release generation, so a
person's clones keep authenticating after an upgrade and after the old release
is deleted. No unit, socket, contract, store or daemon state was added.

## What changed

- **Lock** (`runtime/profiles/integrations/artifact-lock.json`): the raw
  upstream executables `tea-0.16.0-linux-amd64` (sha256 `9c142c8a…0636`) and
  `tea-0.16.0-linux-arm64` (`0e14a036…3f0b`) from
  `gitea.com/gitea/tea/releases/download/v0.16.0/`. They match upstream's
  `checksums.txt`, and their build info names commit `9c12138d`, the source
  pin in `native-auth-evidence.md`. They are static Go 1.26.6 builds with
  `CGO_ENABLED=0` and `-trimpath`. The builder accepts a raw executable
  (`member: null`) and checks its digest as it does for archives.
- **Licences** (`runtime/profiles/integrations/tea-THIRD-PARTY-NOTICES`,
  `scripts/go-binary-notices.py`). tea is MIT, and its binaries embed 66 Go
  modules plus the Go standard library. `generate` downloads each module
  through the Go toolchain against `sum.golang.org` and checks the go.sum hash
  the binary records. It then collects each module's root licence files and
  writes them under the exact module list. Both targets embed identical lists.
  The builder refuses a tea whose embedded modules differ from that list
  (`notice_module_mismatch`), so a version bump cannot ship stale notices. The
  licences found were MIT, BSD-3, Apache-2.0 (a yaml.v3 NOTICE) and one
  MPL-2.0 (`hashicorp/go-version`, unmodified); the notice says where each
  module's source can be obtained. No GPL-family licence appears.
- **Host** (`internal/host/integrations_linux.go`): `tea` →
  `/opt/open-habitat/profiles/integrations/bin/tea` joins the tools that apply
  publishes, and an installation target's closure must carry tea 0.16.0. Like
  the other tools, the profile link keeps that path stable across upgrades.
- **Stable helper** (`internal/daemon/agent_path_linux.go`,
  `handoff_linux.go`). The daemon registers the helper at the path it was
  launched through: argv[0] when it is absolute, clean and the same file as
  `os.Executable()`. Under systemd that is
  `/opt/open-habitat/current/open-habitat`. The agent PATH already used this
  rule. Every generation therefore registers the same string, so the
  restarted daemon finds its registration its own, and Git keeps reaching the
  current product after an upgrade. Before this change, an upgrade made every
  registration `HelperForeign` (clone refused, repair `helper_conflict`).
  Removing the old generation then broke every existing clone's fetch, as the
  mutation run below shows.
- `scripts/cloud-qualify.py` expects tea and a usable Gitea, and still
  qualifies an upgrade from a predecessor that predates tea (review finding).

## Validation

Go ran under `umask 077` with TMPDIR under `/var/tmp`, on synthetic homes and
tokens and the loopback TLS Gitea running real `git http-backend`.

- **Real tea, both architectures.** Built with
  `build-profile-runtime.sh integrations` on Alder (amd64; archive
  `0eba33d4…2dd5`) and on birch (arm64, natively, in a disposable
  `/var/tmp/oh-tea-qual-*`; archive `5b01149c…488a`). Both carry 12617 entries.
  `test-integrations-runtime.py` passed on both. It checks digests, modes,
  closure, `tea --version` = 0.16.0 under HOME and `PATH=/usr/bin:/bin`, and
  the notice against the sealed binary. The sealed `runtime/bin/tea` digests
  equal the lock.
- **Interop** (`scripts/test-tea-interop.sh` with the tea extracted from each
  sealed archive; arm64 used a cross-built `nativegitea` test binary on
  birch). `TestShippedTeaSharesHabitatsLogins` runs in the default and XDG
  layouts. tea lists the login Habitat wrote and lists repositories with its
  token. `tea login add`, with the token only in `GITEA_SERVER_TOKEN`, waits
  while Habitat holds tea's lock (the file is unchanged after 1 s) and then
  succeeds. Habitat reads that entry as an external PAT login, its owned entry
  survives tea's rewrite, and its helper answers for both accounts. Each side's
  delete leaves the other's entry usable. Nothing but tea's file and lock
  appears in HOME, and the file stays 0600. `TestShippedTeaLegacyLocation`:
  with `~/.tea/tea.yml` present, both use it and no XDG file appears.
- **Release switch** (`TestGiteaHelperSurvivesReleaseSwitchAndOldReleaseRemoval`,
  `./internal/daemon`; on Alder with Git 2.53 and on birch with Ubuntu's Git
  2.43). The test copies the test binary into generation `a` and starts
  through a `current` selector. It connects, clones and checks that
  `.gitconfig` names `current/open-habitat`, not a generation. It then stages
  generation `b`, switches `current` atomically and deletes `a`. After that,
  the person's own `git fetch` (traced) runs `current/open-habitat gitea
  git-credential get`, has no token in its trace and fetches the new commit.
  A daemon restarted from `b` sees `HelperRegistered`, and its managed fetch
  and a new clone succeed. No file in HOME except tea's carries the token, and
  there is no `.git-credentials`. Mutation: registering the generation path
  (the old behaviour) fails the person's fetch with
  `generations/a/open-habitat: not found`.
- Offline: `test-profile-runtime-build.py` (11, including the module binding
  and a raw tool whose notice is stale) and `test-cloud-qualify.py` (19,
  including a predecessor without tea and a successor that drops it).
  `go test ./internal/nativegitea/... ./internal/daemon/... ./internal/host
  ./internal/cli ./test/browser-host` passed. `validate-project-view.py`
  passed.
- **Review**, critical rigor: independent `/llm-review` with gpt-6-astra as
  finder and claude-fable-5-1 as verifier on one focused false-negative
  question, then `/assess-findings`. One finding was confirmed and fixed: the
  qualification harness rejected the catalog, which lists Gitea, and an upgrade
  from a predecessor without tea. The verifier found no defect on the helper
  boundary: argv[0] comes from the root-owned unit and `daemon exec` requires
  systemd's listeners, upgrades stop daemons before switching the selector,
  the clone and fetch helper pins use the same command, and the tea bytes are
  digest-checked twice before use.
- Full gate: see the closing line below.

Not run or not proven: an installed host upgrade on a VM with this release.
The switch above is a synthetic selector, not the `host` operator. Distinct
kernel UIDs, a real Gitea server, scopes and revocation, and the upstream
`checksums.txt.sig` signature (its key was not established; the digests are the
pin) were also not covered.

## Test server

The test server does not install integration tools through the product's
`host apply`. Fleetrepo's guest operators
(`infra/open-habitat-test/guest_himalaya_runtime.py`,
`guest_microsoft_runtime.py`) pin each tool and merge `tools.<name>` into
`/opt/open-habitat/integrations.json`. This release changes no unit there and
installs as before. Gitea stays hidden on the test server (`provider_unavailable`)
until Fleetrepo adds a tea backend: install the tea digest above
root-owned 0755 in a root-owned, non-writable directory (for example
`/opt/open-habitat/tools/tea`) and merge `"tea": "<that path>"` into the tools
member, keeping the other tools and app sections. The daemon's `Env.Tool`
requires exactly that ownership. The stable helper already works in that
layout: `current` → `releases/<sha>`, whose `open-habitat` bridge reaches the
same file as `os.Executable()`. There is no KOKEILTAVAA line until Fleetrepo
installs tea there.

## Decisions for later review

- **The helper entry point is the daemon's launch path**, not a new constant
  or wrapper. The systemd templates already pin
  `/opt/open-habitat/current/open-habitat`, and the agent PATH uses the same
  rule. A hard-coded `/opt` path in the daemon was the alternative; it would
  break development and synthetic hosts and duplicate the unit's knowledge. A
  daemon started any other way falls back to its resolved executable, as before.
- **Upstream raw executables**, not a source build. tea publishes static
  per-target binaries with checksums. A reproducible source build would need
  the Go toolchain in the builder and adds nothing the digest pin does not
  give.
- **The transitive notice is generated and checked in**, bound to the binary
  by the build-time module check. The other native tools (gog, rclone,
  himalaya) still ship only their top-level licence; extending the generator
  to gog and rclone (both Go) is a follow-up that this issue did not ask for.
- **tea is not put on the agent's PATH.** Like the other integration tools it
  is published by absolute path. The product never runs tea; its presence
  offers Gitea, and a person may use it from the published path. Putting it on
  PATH, or into an agent instruction, is a separate product choice.
- **tea's `version_check: true` and its other fields in Habitat's entries**
  stay as the native owner chose (tea's own defaults). The interop run shows
  tea uses those entries unchanged.
- **The interop test is opt-in** (`OH_TEA_BINARY`, run through
  `scripts/test-tea-interop.sh`), because the gate runs without network and
  without a built profile.
