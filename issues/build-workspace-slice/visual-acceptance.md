# Browser visual acceptance — corrected revision, Jari review requested

**Product revision:** `f34463b3c150f7ba3e5ea486852d1eff89e27c4a` (tested worktree commit; rebased landing on main: `f0efc294b8f76c701965fd1dd7ae0023bd7352e6`). This revision replaces Jari's visually rejected `7779c064` captures; it is **not** acceptance or closure. The source-ground diagnosis was saved [before the CSS/component edits](./visual-divergences.md). Browser: Playwright Chromium 153.0.8010.12 (headless), Linux x86_64, 1280×720 viewport, light theme; captures are full-page AVIF at color quality 75 and may exceed 720px vertically. No original designer file was modified.

## What changed visually

- Bundled SIL-OFL Instrument Sans and JetBrains Mono (Latin/Latin-ext) locally and loaded them from the production release. The browser test verifies same-origin `.woff2` requests, computed typefaces and loaded face; the Vite catalog serves the same shared assets. No third-party runtime font fetch.
- Login now uses a viewport-centered, approximately 440px card, 20px title, 13.5px body and compact server identifier/action; no oversized `clamp()` heading, narrow left-anchored panel or competing idle auth banner. A11y retains the named heading, button and recoverable auth-error notice.
- Authenticated content uses a measured 296px rail, contained centered reading plane, 20px workspace/state headings, a bounded fact panel, calmer status surfaces, textual disabled-control reasons and selected-workspace highlight. Native GitHub uncertainty is placed with the main workspace facts instead of spanning the entire app above navigation. Empty, absent/unknown, unavailable and partial compositions reuse that hierarchy without inventing agent capabilities or turning unknown into empty. A CSS chevron replaces the unavailable navigation glyph.
- The layout regression test asserts login horizontal/vertical centering, card width, typography/font loading, 296px rail, compact authenticated heading and selected route semantics rather than relying on pixel snapshots alone. Vite's test-only catalog port is 4183 to avoid a concurrent repo worker's 4173 listener; production TLS fixture remains 4174.

## Fresh inline evidence (production build, host-backed)

![Login before provider selection](./assets/login.avif)
![Authenticated workspace details and navigation](./assets/ready.avif)
![Confirmed empty source](./assets/empty.avif)
![Missing source and uncertain deep link](./assets/missing.avif)
![Unavailable daemon](./assets/error.avif)
![Partial and unknown facts](./assets/partial.avif)

Playwright builds `web/dist` without `VITE_ENABLE_TEST_FIXTURES` and starts a standalone loopback HTTPS host at `127.0.0.1:4174`. The fixture drives real Go gateway OAuth/session/snapshot handlers and daemon snapshots over separate Unix sockets with synthetic accounts Alice/Bob and disposable source fixtures; its provider/switch endpoints and simulated same-UID peer mapping are **test-only**. The independently booted [two-UID VM proof](./phase-2-native.md) remains the real UID/systemd boundary evidence. The browser fixture does not prove real provider consent, native account credentials, Pi control, histories, production homes or Alder deployment.

**Scenarios and assertions:** a fresh 401 shows GitHub login with no provider request until pressed; callback/state/PKCE and safe deep link, mapped snapshot, first visible workspace selection, filter/refresh, skip-link focus and single CSRF/Origin-bound logout work. Confirmed empty, missing source, daemon failure, partial facts and absent/unknown deep links are distinct; partial sources preserve observed entries and an incomplete-count warning. Wrong identity, malformed/oversized payload, forged routing headers, A/B contexts, expiry and delayed loading are still exercised. All six states are Axe-checked with zero serious/critical violations. The same run checks 200% page-width overflow, light/dark Axe in the built host, reduced-motion transition and keyboard focus; the component catalog also checks light/dark, reduced-motion, focus and zoom. This remains a desktop review; no mobile or screen-reader pilot is claimed.

**Exact focused commands/results**, from repository root with `export TMPDIR="$PWD/.cache/ci-tmp" PATH="$PWD/.tools/go/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"`: `go test ./internal/gateway/... ./internal/daemon/...` passed; `npm run format:check --prefix web`, `npm run lint --prefix web`, `npm run typecheck --prefix web`, `npm run test:unit --prefix web` (1 passed), `npm run test:component --prefix web` (15 passed), `npm run test:e2e --prefix web` (12 passed), `npm run test:a11y --prefix web` (2 passed) passed. Essential screenshots were encoded with `avifenc -q 75 --speed 6` from that last E2E run. See [result.md](./result.md) for the full clean gate and validators.

## Interactive review boundary

The loopback TLS fixture is for **automated Playwright tests only**, where trust is scoped to the test browser. Do not ask Jari to bypass a self-signed-certificate warning or present it as a manual review URL. Plain HTTP is appropriate for local visual previews but cannot be substituted for the authenticated gateway: its HTTPS Origin/session checks intentionally reject that arrangement. If a manual interactive authenticated review is needed, prepare a separately reviewed HTTPS test endpoint through the Fleetrepo-owned Cloudflare/`example.test` pattern, without changing gateway security or persistent machine state in this slice. Until then the six captures and deterministic host-backed assertions above are the available evidence, not a live app for Jari to use.

## Review boundary

Jari should compare the six images against the accepted workspace and conversation compositions and review the interactive local host if desired. This is a new **request**, not an approval. The conductor records an explicit dated accept/change decision in `item.md`; only then may the issue close or the next `ui-v1` slice proceed. Repository Markdown and relative AVIF paths are canonical; Glasspad's relative-asset limitation remains.
