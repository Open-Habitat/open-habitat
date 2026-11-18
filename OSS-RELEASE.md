---
schema_version: 2
status: approved
maturity: mvp
ecosystems: [go]
targets:
  - {ecosystem: go, package: open-habitat, registry: gh-releases, adapter: manual}
distributions:
  - adapter: manual
    gh_releases: true
    installers: []
    platforms: [x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu]
versioning: semver
changelog: {mode: curated, source: issuectl-trailers}
conventional_commits: false
release: {model: gated, layout: single}
contribution_provenance: dco
provenance_level: none
dependency_bot: none
health_badges: [license]
license: MIT
docs_site: none
---

## Decisions

Items 1 and 2 were settled by Jari on 9.11.2026. He approved the contract as
a whole on 18.11.2026, after the repository had gone public and released
this way.

1. **Copyright holder: Jari Mustonen personally.** Copyright and decision
   comments carry his own name, as does the `LICENSE` file.
2. **Maturity: `mvp`.** Real multi-person installations run named
   releases, but every release is still a `v0.1.N` pre-release, the
   installation path for a stranger is not finished, and formats change
   without compatibility code. `spike` would undersell it, `production` is
   not true.
3. **Distribution: immutable GitHub Releases, no registry.** Each release
   carries a product package and a runtime release per architecture
   (`linux-amd64`, `linux-arm64`) for Ubuntu 24.04. Nothing goes to
   proxy.golang.org: the Go module is not a library and is not meant to be
   `go install`ed. Releases are unsigned: the operator trusts the SHA-256
   GitHub states for the release's assets, and immutable releases keep those
   assets from being replaced.
4. **Launch timing.** The repository is public and releases from `v0.1.0`
   on are published in it. Announcing the project is a separate step Jari
   decides on its own.
5. **No code of conduct.** The project does not have one and will not add
   one (Jari, 18.11.2026). A readiness audit's `code-of-conduct` gap is
   therefore expected, and no tool or contributor should restore the file.

## Rationale

- **license: MIT** — Jari's decision (2026-10-31), chosen over Apache-2.0.
- **maturity: mvp** — `shipshape facts` infers `mvp`: SemVer pre-release tags
  (`v0.1.N`), no `>=1.0` release, no hosted CI
  (`has_ci: false`; the gate is `scripts/ci-local.sh` on the maintainer's
  host), committers counted as two identities of one person.
- **ecosystems: [go]** — `go.mod` (`github.com/open-habitat/open-habitat`); the
  browser package in `web/` is built into the release, not published to npm.
- **targets / distributions: manual gh-releases** — releases are built by
  `scripts/package-release.sh` and the runtime builders and uploaded by the
  maintainer; no tag-triggered workflow exists. The default Go target
  (proxy.golang.org via goreleaser) would be wrong for a server product.
  `platforms` names the two Linux architectures with `-gnu` triples because
  the installation target is Ubuntu 24.04 with glibc-based runtime profiles;
  there is no macOS build. `installers: []`: installation is the operator's
  `host prepare` / `host apply`, not a shell installer.
- **versioning: semver** — existing tags; pre-release identifiers until 1.0.
- **changelog: curated, issuectl-trailers** — `issues/` exists and commits
  carry `Refs-Issue`/`Fixes-Issue` trailers; one maintainer, so one curated
  file does not conflict. No `CHANGELOG.md` exists yet.
- **conventional_commits: false** — the log uses `area: summary` and free
  subjects, not the convention.
- **release: gated, single** — the maintainer (or an agent on their behalf)
  cuts each release; one product version.
- **contribution_provenance: dco** — lightweight sign-off fits a single
  maintainer accepting outside patches; `cla` would be needed only if the
  licence might later change. Alternative: `none`.
- **provenance_level: none** — no CI publishes; `keyless` becomes free once a
  release workflow exists.
- **dependency_bot: none** — no hosted CI to run its pull requests against.
  Switch to `dependabot` together with GitHub Actions CI.
- **health_badges: [license]** — a CI badge needs a hosted workflow that does
  not exist; no registry badge without a registry.
- **docs_site: none** — documentation lives in the repository.

Context, not proposals: documents for agents, the documentation index
`docs/index.md` and the public product page `docs/product.md` are English.
The public repository started from a fresh history, reviewed for personal
names and installation details before it went public. Public reports arrive through GitHub Issues and
Discussions, and security reports through private vulnerability reporting.

## Release notes

- A published GitHub Release is immutable here on purpose: a tag and its
  assets are never replaced, so a broken release is fixed forward with a new
  version.
- Installations pin a release by the SHA-256 GitHub states for its manifest
  (`site.release.manifest_sha256`); re-uploading an asset would break every
  pin to it.
