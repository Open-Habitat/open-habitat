# Result — UI foundation recut

Implementation tree: `fcb8f457f9575593d8e5a3819279bce07b352749` (message-only issue stamp changed HEAD to `04c776d1eedfe208615f0f141f8b341a5ce5f6e5` after validation). The v2 table now drives shared typography, spacing, radii, rail and content widths. The conversation and read-only history use the same header/scrolling stream frame; the live controller still owns focus, history anchoring, drafts and send receipts. Button variants and disabled reasons are component-owned, statuses have explicit kinds, and touched glyphs use SVG. The phone layout uses an expandable drawer instead of a stacked sidebar.

`component-map.md` records the untouched later slices and the behavioral deviations from the design draft. In particular, send-mode semantics, uncertain result honesty, readable full title and restored reading position continue to follow the existing agreements. No host/contract or internal changes were required. The all-visible repository default remains the agreed rule.

## Evidence

- Before/after synthetic-lab captures: `before-{light,dark}-{1440,390}.{avif,html}` and `after-{light,dark}-{1440,390}.{avif,html}` in this directory. The HTML is an inert offline twin beside each image; all identities and content are invented. This is not live-host or separate-UID evidence.
- `./scripts/test-web-fast.sh`: format, lint, types, 11 unit tests, 54 component tests passed.
- `NAH_PORT_BASE=21000` focused host-backed browser tests: conversation reading-position, footer bottom anchoring, narrow history, accessibility and workspace route tests passed. The lab foundation test checks computed rail widths 296/52, rendered column width 780, top-bar 13×24 padding, text sizes, radius, focus outline and offset, stream scrolling, desktop→phone collapse, phone drawer resize, short drawer scrolling, route focus and Escape return in both themes.
- **Final committed clean gate:** `TMPDIR=/var/tmp/nah-recut-build NAH_PORT_BASE=21000 ./scripts/ci-local.sh --clean --json` passed on the `fcb8f45` tree with 86 standard browser tests and 9 lab tests, plus Go/contracts, packaging and documentation checks. Receipt: `/var/tmp/recut-required-gate.json` (local scratch). `issuectl doctor --json` exited 0; its non-AVIF warnings refer to earlier issue evidence, not this issue. `git diff --check` exited 0.

## Review and risk

A broad shared-style refactor and new responsive frame have medium UI regression risk, but no new host authority or persistent data. Proportionate review was two independent focused final-diff reviews (`claude-fable-5-1`, `gpt-6-astra`) plus real synthetic browser journeys. Eight first-pass and six edge-case findings were checked against source/browser evidence and fixed. No review residual met the filing bar after the final checks. Review and assessment scratch are under `history/` (not the only evidence for any issue). The full gate followed the last runnable change. UI correspondence to the designer's drafts still needs Jari's visual judgment; the captures are available for that review.
