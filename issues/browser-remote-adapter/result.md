# Preparation result — 2026-10-19

Preparation only; no routing implementation, installs, builds, browser tests, guest boots or live-service changes. Source reviewed at Open Habitat `eab22b7973aecadff9bcc745a10f1b86f3e35992`; Fleetrepo brief and ADR 0016 read at `0e529c7c33f731ac590b8d754a39cf2884cfbaf3`. Brief's earlier OH reference was `1a19356437a6efd3e0641839fa63a8f850a9c14e`.

## Brief checked against current source

| Claim / surface | Finding |
| --- | --- |
| Whole workload must run on Linux | Confirmed: `test/browser-host/main.go` is Linux-tagged, imports real Linux gateway/daemon/transport, uses Unix sockets and child processes. Removing the tag is not a macOS solution. |
| Focused script dispatch boundary | Confirmed `scripts/test-focused.sh` browser branch checks local Playwright **before** spec existence, then launches `npx playwright test` from web. Filename regex and rejection of leading-dash tags match brief. Dispatch must precede the dependency check. **Correction:** `--spec` is currently optional; omitted spec runs the entire ordinary suite. The pilot must explicitly reject that form, not accidentally offload an unbounded scope. |
| npm browser entrypoint | Confirmed direct `playwright test`; `test:e2e`, `test:a11y`, `test:visual` and `test:demo` are additional direct routes, not automatically protected by changing `test:browser`. Scope/document these bypasses; arbitrary direct Playwright is not intercepted. |
| Full gate interaction | `scripts/ci-local.sh` calls `OH_WEB_PREBUILT=1 npm run test:browser --prefix web` then lab separately. Refusing no-spec `test:browser` changes full-gate availability: document explicit unsupported pilot scope, never bypass dispatch to keep a Alder gate green. Full-gate offload/receipt work is separate. |
| Build / setup | `web/tests/host-build.ts` builds web unless prebuilt, then Go into `.cache/browser-host`; prepends `.tools/go/bin`. Native ARM Go on PATH works when excluded `.tools` is absent. Vite server also runs in the same Playwright job. |
| Worker/ports | Config default eight workers, lab four; OH_BROWSER_WORKERS is unvalidated `Number(...)`, not a resource cap. Runner must force two and restrict task args. `web/test-ports.mjs` accepts base 1024–65480; ordinary worker ports base+20+index, Vite base+9. Fleetrepo reserves the range, OH supplies the map. |
| Fixture ownership | `web/tests/worker-host.ts` starts a host per case and TERM/KILLs it; teardown handles markers but is not whole-descendant lifecycle proof. Runner cgroup must own npm/Go/Vite/fake Pi/Chromium descendants. |
| Pins | `go.mod` says 1.27.1; `web/package.json` pins Playwright 1.63.0 and Node range >=22.23 <23. Exact Node 22.23.2 comes from TESTING.md, not the package engine range. No pin change needed by source inspection. |
| amd64 tooling | `scripts/bootstrap-tools.sh` downloads linux-amd64 Go with a fixed hash; packaging is linux-amd64 per `scripts/AGENTS.md`. Neither belongs in this ARM focused task. |

## ARM64 feasibility and unresolved blockers

No explicit amd64-only branch was found in the inspected browser host and its fixture files; Linux-specific Go files do not imply x86-specific code. This is source inspection, **not** an ARM build or runtime pass.

`web/package-lock.json` includes Linux ARM64 packages for esbuild 0.28.2, Rolldown 1.2.9, Oxc parser 0.127.0/resolver 11.21.2, Lightning CSS 1.33.0, TypeScript 7.0.2 and Biome 2.5.14 (GNU and/or musl variants as declared). Presence in the lock is useful feasibility evidence, not proof of successful download, ABI loading or execution. Choose a Playwright-supported glibc ARM64 image; verify its exact image, Chromium revision, system libraries, fonts, locale/timezone and sandbox behavior in Fleetrepo, without enabling emulation or globally disabling security to conceal an error.

Two omissions in the brief's minimal setup matter:

1. **Native fixture dependencies.** `test/browser-host/main.go:382–385` constructs a Pi credential device from `internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent`, running guest Node. The ordinary `web/tests/account-settings.spec.ts` credential journeys use that route. The full gate installs that directory with `--ignore-scripts`; focused setup does not. Include its manifests/lock and install in the job. That lock also includes Linux ARM64 Claude SDK packages; actual native/transitive package compatibility remains unverified. Do not copy host node_modules or provision real Pi/Claude accounts. The brief's anonymous login smoke can pass without proving this dependency.
2. **Fixture temp storage.** `test/browser-host/main.go:109` hardcodes `os.MkdirTemp("/tmp", "oh-browser-")`; `web/tests/host-teardown.ts:20` accepts only that `/tmp` prefix. TMPDIR alone controls build scratch but not the synthetic home/socket/history tree. Fleetrepo must provide bounded disk-backed private guest `/tmp`, or the adapter implementation must coordinate a short TMPDIR-aware root and safe cleanup change. Unix socket length limits constrain the root. Ordinary fixture creation is not itself a CPU-architecture blocker, but memory-backed unbounded `/tmp` defeats the intended resource profile.

The host additionally needs real `/usr/bin/git`, `/bin/sh`, `/bin/sleep` and basic shell utilities used by synthetic scripts, plus `/proc` for Linux process behavior. No real gh/provider/agent credentials are needed. Fresh clean synthetic HOME and sanitized environment prevent personal Git configuration, agent tokens or prebuilt flags affecting evidence. npm/Go downloads require allowed egress or populated guest-native caches; install preparation is part of the same slot and budget.

## Runner interface requested from Fleetrepo

These are capability requirements, **not invented CLI names or a task schema**:

- Versioned installed task registration/invocation with fixed cwd/argv and validated spec/tag; trusted placement `remote-required`, native Linux ARM64 profile and enforced workers/CPU/RAM/pids/disk/deadline. Internal guest execution context must not be forgeable into Alder local admission by a recursion flag.
- Durable submit acknowledgement with job/attempt/idempotency identity, bounded status/wait/logs, cancellation and result/artifact retrieval. Client exit/disconnect is not cancel; reconnect observes the original attempt. Distinct exit, timeout, OOM, cancelled, interrupted and unknown classes must be consumable without parsing log prose.
- Capture call usable by a non-Taskfleet foreground command: explicit untracked selection and source-owner write barrier, immutable manifest with base/index/final dirty bytes/modes/link targets/content hashes, exclusions/rejections and guest verification. How a cooperating editor pauses and how the dispatcher receives capture ownership must be concrete before implementation. No stash/reset/index edits or live-tree rsync.
- Assigned worker limit and ports; exact guest/toolchain/browser/image identities; sanitized env/HOME, cache and scratch roots; dependency install network/cache policy; job cgroup covers preparation and every descendant. Fleetrepo proves global one-slot admission and restart/reboot reconciliation.
- Bounded result directory and manifest with input/task/argv/toolchain/platform/attempt/times/outcome, safe artifact paths, stale-source comparison and truncation reporting. Initial brief limits: 100 MiB logs, 500 MiB artifacts, tail 200 lines. Fetch never writes into source or gate receipt directories.

Supply the six-part infra-ready receipt in the brief, including measured inference headroom and authorized guest provisioning. An installed command name, accepted task schema, execution-context/local-budget mechanism, capture barrier API and stable status/exit mapping are still unknown. OH must bind to those real interfaces after readiness, not ship a fake substitute now.

## Scheduling and handoff

The implementation plan and future acceptance criteria are in [item.md](item.md). The issue stays open, `gate-health`, sequence 4, collision `gate`, `preparation: pending`. No fabricated cross-repo `blocked_by` edge: Fleetrepo @orx-background-runner and its infra-ready receipt are the explicit external blocker. Another session owns TODO.md and the ongoing work round; they remain untouched.

Fleetrepo receives this result through `issues/orx-background-runner/open-habitat-preparation-report.md` and a pointer on its owning issue. No current result is a clean gate, amd64 release, distinct-UID or ARM runtime proof.

Jari relayed that the other session's @gate-load-flakes-1019 worker is changing browser synchronization and running the full gate. This preparation changes no scripts/tests and launches no heavy job. Recheck all entrypoints and fixture assumptions against the eventual implementation ref after that worker lands; its gate result belongs to its own ref and is not ARM evidence for this issue.

## Preparation checks

`python3 scripts/validate-project-view.py` passed (8 pages / 8 navigation entries). `git diff --check` passed in both repositories. `issuectl doctor --json` found no schema, parse or transition errors; existing attachment advisories remain (one large binary, 656 non-AVIF images), unrelated to this change. `issuectl dag --json` confirms this issue in gate-health behind the existing repair, `preparation: pending`, `spawnable: false`. No runnable code changed and no test/build was needed for this documentation-only preparation.
