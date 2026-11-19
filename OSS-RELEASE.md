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

# Release contract

How Open Habitat is released, for the tools and people that release it.

- **License: MIT.** The copyright holder is Jari Mustonen.
- **Maturity: `mvp`.** Real multi-person installations run named releases,
  but every release is a `v0.1.N` pre-release and formats still change
  without compatibility code.
- **Distribution: immutable GitHub Releases, no registry.** Each release
  carries a product package and a runtime release per architecture
  (`linux-amd64`, `linux-arm64`) for Ubuntu 24.04. There is no macOS build
  and no shell installer: installation is the operator's `host prepare` and
  `host apply`. The Go module is not a library and is not published to
  proxy.golang.org; the browser package in `web/` is built into the release,
  not published to npm.
- **Releases are unsigned.** An operator verifies each asset by the SHA-256
  GitHub states for it, and an installation pins a release by its manifest's
  digest (`site.release.manifest_sha256`). A published tag and its assets
  are therefore never replaced: a broken release is fixed forward with a new
  version.
- **Releases are cut by the maintainer** with `scripts/package-release.sh`
  and the runtime builders, after the local gate (`scripts/ci-local.sh`)
  passes. There is no hosted CI, so no release workflow, build provenance,
  dependency bot or CI badge.
- **Versioning: SemVer**, with one product version.
- **Changelog: curated** in `CHANGELOG.md`, written by the maintainer.
  Commits name their issue with `Refs-Issue` and `Fixes-Issue` trailers.
  Commit subjects are free-form, and the version is not derived from them.
- **Contributions: DCO sign-off**, no CLA.
- **No code of conduct.** The project does not have one and will not add
  one. A readiness audit's `code-of-conduct` gap is expected.
- **Documentation lives in the repository**, in English; the website renders
  it.
- **Reports** arrive through GitHub Issues and Discussions, and security
  reports through private vulnerability reporting.
