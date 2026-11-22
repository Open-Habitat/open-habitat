# Result: server browser runtime ships with the product

## What changed

- **TigerVNC** (`tigervnc-standalone-server` >= 1.13.1+dfsg-2build2) and
  **ca-certificates** (>= 20240203, needed for Google's HTTPS source) are core
  Ubuntu requirements (`runtime/core/ubuntu-packages.json`), installed by the
  existing hard-requirement path of apply and upgrade on both architectures.
- **Google Chrome** is installed by a new best-effort step
  (`internal/host/server_browser_linux.go`) that runs after a successful
  apply or upgrade, including one with nothing to change. When
  `/opt/google/chrome/google-chrome` is missing it writes Google's key and
  deb822 source byte for byte as Chrome's own postinst does (an existing
  `google-chrome.list` is used instead), refreshes only that source with
  `--error-on=any`, checks the candidate against the qualified minimum
  157.0.8103.38-1, simulates, and installs with the same no-removal /
  no-downgrade flags as Ubuntu requirements (now shared via `aptInstallArgs`).
  Anything that fails before the installation withdraws the files it wrote.
  The result's `server_browser` reports `present`, `installed` or
  `unavailable` with a reason; the step never fails or lengthens the
  operation and runs outside its journal and downtime.
- **Plain words when the runtime is missing:** the agent's
  `browser status` adds `reason: runtime_not_installed` and a hint;
  `browser start` answers `browser_unavailable` (exit 1) saying the browser is
  not installed and is the administrator's matter, instead of "native
  operation failed or is uncertain". `browser_feature_off` also got a plain
  message.
- **Settings card:** the experimental card reads the browser state once; on a
  server without the runtime it says so (fi/en, catalog `unavailable`) and the
  switch can only be turned off.
- `docs/operations.md` describes the step; `internal/AGENTS.md`'s package rule
  says how the product adds Google's repository.

## Decisions for later review

1. **Which browser: Google Chrome from Google's apt repository, not a locked
   Chromium.** The page reader's locked headless shell cannot draw on a
   display. A locked full browser was examined: amd64 has only Chrome for
   Testing's `chrome-linux64.zip`, which is Google-branded ("All rights
   reserved", Chrome Terms of Service) and carries the Widevine CDM whose
   licence forbids redistribution, so it cannot go into our runtime archive;
   only arm64 has an open Playwright Chromium. A pinned archive would also be
   months stale in a browser people sign in to (the current lock is 145 while
   stable is 158), which `internal/AGENTS.md`'s package rule already rejects.
   Alternatives: Chromium snapshot builds (unofficial CI builds, amd64 only),
   Ubuntu's chromium (a snap). Cost accepted: a vendor apt source and Google's
   signing key on every host.
2. **Chrome is best effort, not a declared hard requirement.** Declaring it in
   `ubuntu-packages.json` would make the read-only plan fail on every host
   that has no Google source yet (apt-cache cannot see the package before the
   source exists, and the plan may not write), and would make every upgrade
   depend on `dl.google.com` for an experimental feature. Its qualified
   minimum is still declared, in code. Alternative: a hard requirement with a
   source-bootstrap phase in plan/apply.
3. **How VNC is provided:** Ubuntu's TigerVNC as a core requirement (universe,
   which the core already needs for python3-docx and others).
4. **Core, not the `browser` profile:** profiles are optional per site; the
   goal was every installation.
5. **AppArmor:** nothing new; Ubuntu's `/etc/apparmor.d/chrome` and Chrome's
   own profile cover `/opt/google/chrome/chrome`.
6. **No opt-out setting yet.** A site that must not reach Google just gets
   `server_browser: unavailable` and the explanation. A site option to skip the
   step can come when someone needs it.
7. **The rail/chip stay hidden** when the switch is on but the runtime is
   missing; the explanation lives on the card in Settings.
8. **Runtime rebuild needed: yes.** `runtime/core/ubuntu-packages.json`
   changed, which changes the core artifact's `packages` and its payload, so
   the release cut must rebuild the **core** runtime natively on both amd64 and
   arm64. No other profile changed; nothing downloaded changed.

## Evidence

- Real apt in a disposable Ubuntu 24.04 arm64 container: all core and profile
  Ubuntu requirements (with TigerVNC and ca-certificates) installed; then the
  product's step installed Google Chrome 158.0.8127.36 and Chrome's postinst
  rewrote the source and key byte-identically; a second run reported present.
  Log: `/var/tmp/agent-keep/remote-browser-runtime-missing/apt-container-arm64.log`.
  Not run: the same on amd64, and a real installed host.
- Go: `./internal/host`, `./internal/daemon`, `./internal/cli` through
  `test-focused.sh`; the withdrawal test fails with the removal disabled.
- Web fast checks; `server-browser.spec.ts` and
  `settings-experimental.spec.ts` (8 passed, `OH_BROWSER_WORKERS=2`), the new
  case also `--repeat-each 3`. Contracts generation clean, UI reference
  regenerated, project view valid, `test-profile-runtime-build.py` and
  `test-ui-reference.py` pass.

## Review

Critical-rigor `/llm-review` (root apt operations and a new trust root): GPT-6
Astra as finder returned no findings; one focused false-negative probe with
Claude Fable 5.2 found a confirmed must-fix (a failed step left Google's
source behind, breaking later apt runs on unreachable or conflicting hosts),
now fixed with a test. `/assess-findings`: FIX 1 (applied).
