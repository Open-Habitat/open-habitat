# Result

Offer cards (single and folder), the offer file panel and uploaded attachment chips now request small thumbnails instead of original files. Full image URLs remain only in explicit previews. Failed thumbnails become an image icon and never fall back to downloading the original. Offscreen images retain lazy loading.

The mapped person's daemon opens the same authorized file as before and passes only its descriptor to a disposable same-UID decoder process. Gateway authority and identity mapping are unchanged. No cache or shared store. JPEG, PNG, GIF and WebP input; JPEG output up to 320 px / 128 KiB. Decode is bounded by 64 MiB input, 16MP pixels, two concurrent children per daemon, 30s total admission/request budget, 4s child wall deadline, 3s CPU and 2GiB virtual address-space ceiling. GOMEMLIMIT=128MiB is an additional soft GC target, not a hard RSS guarantee. Original attachment upload limits are unchanged.

New dependency: golang.org/x/image v0.32.0, for WebP decode and bounded scaling. Test WebP comes from that module's testdata/gopher-doc.1bpp.lossless.webp; its BSD license is adjacent.

## Decisions for later review

- 320-pixel longest side, JPEG quality 75, white transparency background. Alternative: larger/transparent PNG or WebP output. Chosen to minimize transferred bytes and avoid another encoder dependency; the original retains transparency when opened.
- Refuse images above 16MP or 64MiB and show an icon. Alternatives: allow 24/50MP camera images or generate with a more specialized decoder. Conservative current memory/CPU budget wins; 24MP phone originals therefore have no thumbnail but remain openable.
- SVG and unsupported formats get an icon, never original-byte thumbnail fallback. Alternative: add an SVG rasterizer or keep full SVG downloads. The latter violates the bounded-thumbnail requirement; rasterizer is not needed for the four requested formats. GIF shows its first frame on the logical canvas; no animated thumbnails.
- Generate on request without a cache. Frozen-offer caching was allowed, but no measured repeated-generation problem justifies another lifecycle yet. Two processes per daemon serialize bursts; total wait remains bounded.

## Validation

Tested the working implementation based on 0d4c3e30aa264927095e19857b18c534881eed76 (the implementation commit carries these results), on Birch with private disk-backed TMPDIR and umask 077.

- `./scripts/test-focused.sh --area web`: passed, 190 files / 1429 tests, static/type/catalog checks included.
- `./scripts/test-focused.sh --area contracts`: passed, generated drift clean, 97 schemas / 154 fixtures / 43 scenarios.
- Focused Go checks for `./internal/thumbnail` and `./internal/gateway`: passed. Thumbnail tests include PNG/JPEG/GIF/WebP, partial GIF frames, malformed input, oversized dimensions, cancelled request and malicious WebP canvas/frame mismatch. Attachment handler test verifies reduced JPEG and trust, other-home and symlink refusals.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: only known `TestAgentCommandPathIsPerHomeAndInherited` failure after installing Python schema dependencies. Reproduced unchanged on main e6146d8a9; already tracked in `agent-path-test-misses-core-tools`, no duplicate filed. `go test ./internal/daemon -skip '^TestAgentCommandPathIsPerHomeAndInherited$'`: passed (223.6s).
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=23700 ./scripts/test-focused.sh --area browser --spec agent-file-offers.spec.ts`: all six passed, rerun after review fixes. New real gateway/daemon/browser case freezes five 26MiB PNG inputs and requires all five thumbnails to decode at 320px, combined response bodies under 200,000 bytes and zero full-image reads until opening; opening then loads the 480px original. Inputs are valid small PNGs padded to 26MiB, so this proves network behavior, not worst-case large-image decoding speed.
- Independent critical `/llm-review` (claude-fable-5-1 finder, gpt-6-astra verifier) and `/assess-findings`: three confirmed findings fixed: queue consuming decode time, partial GIF canvas mismatch, WebP VP8X canvas hiding a larger VP8/VP8L frame. Frame preflight now checks the actual encoded frame before allocation. Review and assessment scratch are under history/; this result preserves the conclusions.

Same-UID synthetic evidence only; no distinct-UID claim or live-server performance measurement. Full gate and whole browser suite intentionally left to conductor. Attachment chip worker 01m6y0fq95bxq808b675ffa7vy owns extra large-upload browser/fallback tests and will rebase on this host implementation; the shared chip component and Composer expectation are included here by agreement.

## Check failures resolved or bounded

Initial web lint rejected image onError as interaction and import order; corrected with a reasoned load-error suppression and import sorting. Composer expectations changed to thumbnail URLs by agreement with chip worker. Initial daemon schema cases lacked Python referencing; installed requirements-ci.txt in a disposable uv venv and reran. The remaining daemon PATH assertion is the main-branch failure described above, not a thumbnail regression. A first repeated --go-package invocation selected only the last package; each package was subsequently run explicitly. No required review failed.
