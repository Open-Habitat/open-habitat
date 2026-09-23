# Application foundation result

## Revisions and scope

- Accepted implementation-readiness artifact: `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`.
- Foundation product revision: `079694adf0f9cdabddf6cc7289672d1d813a521f`.
- Toolchain: Go 1.27.1, Node 22.23.2, npm 10.9.8, stable TypeScript 7.0.2 and Biome 2.5.14.
- Canonical host contracts remained in `contracts/v1/`. Their accepted CG-01–CG-04 forms and CT-030–CT-034 catalogue are executable through the offline contract validator. Deterministic generation emits all ten opaque Go and TypeScript wire families plus one schema fingerprint; callers must validate wire input before narrowing an opaque family.

This revision establishes one Go module/binary with explicit CLI, gateway, daemon, core and generated-contract packages. The gateway owns same-origin/static routing but not home/native access. The daemon package owns the Linux peer-credential seam but does not yet expose native history or control. The React client owns route selection, a Redux connection boundary and test-only deterministic bootstrap states. Shared production controls live under `web/src/components/` and are imported by Storybook.

The shell intentionally says that native workspaces and Pi history are not implemented. `/api/`, `/events` and `/auth/` never receive the SPA fallback. Browser fixture content is enabled only by Playwright's explicit Vite environment and a release build containing fixture markers is rejected.

## Dependency and license choices

- Go has one exact third-party module, `golang.org/x/sys v0.37.0`, for Linux `SO_PEERCRED`; all other host code uses the standard library.
- React 19.3.0, Vite 8.3.0, React Router 8.4.0, Redux Toolkit 2.12.0, React Redux 9.3.0, React Aria Components 1.21.1 and TanStack React Virtual 3.14.13 are exact pins in `web/package-lock.json`.
- Storybook 10.6.0, Vitest 5.0.1, Playwright 1.63.0, Axe 4.13.0, Testing Library 16.3.3, TypeScript 7.0.2 and Biome 2.5.14 are exact development pins. No forced peer, nightly package, TypeScript 6 fallback or typescript-eslint graph was used.
- `scripts/check-licenses.py` verified license metadata for all 22 direct web dependencies and rejected AGPL/GPL direct dependencies. The repository has not selected a public distribution license; `licenses/DEPENDENCIES.md` says so explicitly.
- The accepted design-system token entrypoint no longer performs a third-party runtime font request. The foundation uses system stacks; reviewed bundled font files remain later design-system work.

## Fixtures and launch evidence

`./scripts/native-fixture.sh create --output <new-temp-path>` created a disposable non-Git workspace, local Git repository, manual linked worktree, malformed event, long output, edit, extension question and 2,500-entry synthetic Pi-shaped history. It read no real user history. Its manifest explicitly does not claim a Taskfleet-owned lifecycle.

`./scripts/vm-test.sh self-test --json` validated the immutable Ubuntu Noble 2026-09-11 amd64 URL/checksum and synthetic `agent-a`, `agent-b` and gateway cloud-init input. It returned `launched:false`: QEMU is not installed on this host, so this foundation does **not** claim a systemd boot, two-UID routing or gateway-home-denial result. Those live scenarios remain with their assigned product slices.

The package/test-target launch method was exercised with:

```sh
go run ./cmd/native-agent-host gateway exec --config /tmp/native-agent-host-gateway-foundation.json --verbose
curl --fail http://127.0.0.1:18181/healthz
curl --fail http://127.0.0.1:18181/workspaces
curl http://127.0.0.1:18181/api/v1/snapshot # observed HTTP 501
```

Observed JSONL startup diagnostics, health 200, UI route 200 and API 501. No machine install, systemd activation, Fleetrepo mutation or live deployment occurred.

## Verification

The complete clean-checkout approximation was run as:

```sh
export PATH="$PWD/.tools/go/bin:$PATH"
./scripts/ci-local.sh --clean --json
```

It provisions disposable HOME/Go/npm/Python/issuectl state, performs locked Go and npm fetches followed by offline use, installs Chromium into the ignored repository cache, and runs:

- Go version, formatting, vet, race tests and CGO-free build;
- Biome format/lint, `tsc --noEmit`, Vitest unit/component, Playwright route/browser, Axe, Vite and Storybook builds;
- deterministic contract generation/drift, contract/plan/project validators and direct dependency license policy;
- synthetic native and immutable VM-recipe self-tests;
- two byte-identical package builds, checksum/manifest/provenance verification, relocated archive verification and tamper rejection;
- `issuectl doctor --json`, `git diff --check` and final tree cleanliness.

`project-canon doctor` was run separately and was mechanically conformant; its two advisory warnings are the intentionally absent public root README and a Rust-specific `crates/` layout heuristic that does not recognize this Go module's tested `internal/core`/`internal/cli` split.

The individual required package command was also run:

```sh
./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/
./scripts/verify-release.sh --archive dist/native-agent-host-0.0.0-test-linux-amd64.tar.gz --json
```

The verifier observed a checksum-valid archive, complete internal manifest, required binary/web/unit/declaration/license files and a full 40-character build commit. The workflow is committed, but no hosted CI URL exists before this branch lands; local clean-checkout parity is the available foundation evidence. The initial npm fetch timed out once; a bounded retry succeeded. The final review's first Claude invocation failed without output; Gemini's noisy candidates were checked locally, and gpt-6-astra found an absolute-path checksum-sidecar defect. The package now uses an exact basename-only sidecar and regression-checks relocated and tampered copies. Model-performance logging was attempted but its SSH write failed with `Permission denied`; that advisory corpus write did not affect source review or deterministic validation.

## Remaining limits and successor handoff

This is a foundation, not the walking journey. There is no real OAuth/OIDC, web session, CSRF implementation, mapped Unix routing, native `gh` setup, workspace/history discovery, Pi process control, SSE ledger, Alder deployment or live-version claim. `admin readiness show` therefore returns `ready:false` and `foundation-only`.

QEMU/systemd execution and a real Taskfleet-owned fixture were not claimed. Storybook reports its own large catalog/vendor chunks; the production application bundle was 319.60 kB minified / 103.10 kB gzip and emitted no Vite size warning. Later design and journey slices must keep using the exact production component modules and foundation green gate, add only their assigned native/VM scenarios, and preserve fail-closed unknown states.
