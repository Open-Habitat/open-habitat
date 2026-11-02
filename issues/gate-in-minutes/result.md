# Result: the clean gate in about seven minutes

Birch, 8 cores. Other r54 workers ran specs and builds beside most of these
runs (load averages noted); `go clean -testcache` before every gate run so the
Go tests really ran.

## Before and after, per phase

| Phase | Issue (idle, `3c9c6072`) | After (gate runs 3 and 4, this branch) |
|---|---|---|
| setup | 5 s | 2 s (issuectl archive and pip wheels kept by checksum) |
| dependencies | 50 s | 15 s (warm caches; cold first run was 69 s) |
| web checks | 44 s | 32 s |
| browser + Go/contracts | 19 min 10 s | 5 min 42 s – 6 min 6 s, packaging included |
| — ordinary suite | 14.2 min | 5.7–6.1 min, side by side with lab |
| — lab suite | 4.9 min, after ordinary | 5.6–5.8 min, side by side |
| — Go/contracts | beside browser | 5.2 min (go test −race 300 s) |
| packaging | 95 s, after browser | 105 s, in the background beside the above |
| **total** | **22 min 24 s** | **6 min 31 s and 6 min 55 s** |

My own baseline on `de44e75a` at the gate's 4 workers, sequential, load 17–21:
ordinary 16.6 min, lab 8.5 min. Gate run 1 (cold caches, load up to 38, before
the priority change) was 13.2 min; run 2 was 7.9 min.

Both suites alone at 6 + 3 workers, untraced: 5.4 min wall, 2029 core-seconds,
CPU 21 % idle. Summed case time: ordinary 3748 s → 1703 s, lab 1830 s → 794 s.

## Where the time went, and what changed

1. **Every page load spent 5–8 s compiling contract validators.** About forty
   modules built their own Ajv and compiled their validators at module load;
   a CDP profile showed Ajv code generation dominating the bundle's evaluation
   before the app's first request. This was the product, not only the tests:
   the same cost hits people's phones. `web/src/app/lazyAjv.ts` keeps each
   module's schemas and options and compiles on first use. `/workspaces` page
   load: 5.1–8.3 s → 0.45–0.7 s. A Biome rule keeps direct Ajv imports out.
   This alone halved both suites.
2. **The synthetic host is not the cost.** Measured start: 70–90 ms ordinary,
   220–250 ms lab, about 0.4 s per case with teardown. Sharing a host per file
   would save little and give up isolation, so hosts stay per case. CPU during a
   run: Chromium renderers 51 %, Chromium browser+GPU 26 %, Playwright 13 %,
   hosts and their Pi SDK helpers 6 %. An idle conversation page costs 0.035
   cores, so the cost is navigations, axe audits and screenshots.
3. **Ordinary and lab run side by side** (`scripts/ci-local.sh`): ordinary
   6 workers, lab 3, lab listeners at `OH_PORT_BASE + 100` (ordinary specs
   start lab-mode hosts at base + 40 too). They had shared `test-results/`,
   which each run clears at start, and teardown reclaimed every host marker
   there, so a teardown could have deleted the other suite's live host trees.
   Markers now live in each project's output directory, lab writes
   `test-results-lab`, teardown reclaims only its own project's markers, and
   the host binary is built once (`OH_BROWSER_HOST_PREBUILT=1`).
4. **Traces off in the gate.** `retain-on-failure` records every case;
   520 → 376–399 s system CPU for the same 137 cases (trace without screencast:
   469 s). Failures still write `error-context.md`; a focused rerun with
   `--trace on` gives the trace.
5. **The Go tests were starved, not heavy.** `go test -race ./...` uses 199
   core-seconds over 249 s alone (mostly `internal/daemon`, sequential, waiting
   on subprocesses) but took 596 s beside the browsers. The browser suites run
   at nice 5; Go now finishes in 300 s.
6. **Packaging beside the browser phase.** Its 83–106 s are mostly
   `test-package-socket.sh` repacking and verifying the archive ~30 times per
   architecture. It reads only `web/dist` and the committed sources, so it runs
   in the background. `go fmt`, `go generate` and `check-generated.sh` moved
   ahead of every concurrent reader: contractgen truncates its outputs on every
   run and packaging tars `cmd/` and `internal/`, and the old layout already
   had the web checks reading `web/src/contracts` beside `go generate`.
7. **Slow cases.** `next-waiting-row` question/archive 102 s → 11 s;
   dictation ceiling 50 s → 4 s (`clock.fastForward` instead of replaying ten
   minutes of 250 ms ticks; the tick reads `Date.now()`). Other long cases
   (`reconnect-paths`, `settings-close`) wait on real liveness or sweep every
   settings page at three widths; their time is their check.

## What each changed check protected and where it lives now

- `next-waiting-row.spec.ts` "question, failed send and archive close the
  window": archive is refused while Pi works, so the click waited out the fake
  Pi's 90 s hold. By then the turn had finished and finishing closed the
  window, so the archive step never exercised the window's `archived` clause.
  The browser case now ends the hold first (same journey). The archived clause
  is pinned in `web/src/app/nextWaiting.test.tsx` (an open window during a
  running turn closes when archived; fails if the clause is removed).
- `speech-input.spec.ts` ceiling case: same states checked (no warning at 8:50,
  warning at 9:10, stopped with the text kept past the ceiling).
- `lab-conversation-scroll.spec.ts:201`: the non-vacuity floor is now more
  than 5 work frames instead of 30 (135 idle, 12–24 under the gate's load, and
  it failed on main under load too). The follow checks are unchanged.

## Test races fixed on the way (exposed by faster loads or concurrency)

- `github-connection-warning`: an aborted `/auth/github/start` navigation
  committed `chrome-error://` and could interrupt the next `goto` (1 in 4);
  now answered 204. Re-routing the snapshot on each state change could unroute
  a handler mid-fetch ("Route is already handled"); now one route per page.
- `browser-conversation` cold open: polls for the released status reply.
- `pi-onboarding-race`: Bob's repository step can advance between the check
  and the click.
- `lab-conversation:517`: the header swaps its ⋯ menu for the workspace link
  as fonts and chips arrive; the case waits for a settled choice (2/12 → 24/24).
- Lab evidence screenshots moved under `test-results-lab` (review finding).

Load-only failures that pass in isolation are filed as
`browser-flakes-under-load` (intake).

## Review

Focused self-review, plus `/llm-review` (finder gpt-6-astra, local
verification) of the shared fixture, host, gate and LazyAjv changes: one
finding (lab screenshots in the ordinary suite's cleared directory), fixed.

## Decisions for later review

- **Gate runs untraced.** Alternatives: keep `retain-on-failure` (+25–35 %
  CPU), or traces without screencast (+10 %). Chosen because a failure still
  leaves `error-context.md` and a focused rerun with `--trace on` is cheap.
- **Worker budget 6 + 3, browsers at nice 5.** 4 + 4 left 39 % idle (8.5 min);
  8 + 4 saturated the CPU (7 % idle) and timing-sensitive cases failed. Under
  6 + 3 the gate leaves 17–30 % idle.
- **LazyAjv throws "missing contract" on first use of an unregistered ref**,
  where `getSchema` returned undefined and callers threw their own "invalid …"
  error. Only reachable through a programming error; the `?.` call sites were
  simplified.
- **Lowered frame floor** in `lab-conversation-scroll` (above).

## Proposed next steps (not done here)

- Split the 2.4 MB main bundle: each document load still costs ~0.4 s of main
  thread, the largest remaining per-case cost, and the same on phones.
- `internal/daemon` tests run sequentially (226 s); with the browsers now at
  ~5.5 min the Go phase (5.2 min) is nearly co-critical.
- `test-package-socket.sh` could check its ~30 cases concurrently (release
  script area, so left to its owner).
