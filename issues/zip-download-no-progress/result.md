# ZIP download progress and streaming

## Cause

`serveOfferZip` already wrote a stored ZIP incrementally, but did not send
`Content-Length`. The browser therefore could not know the total or show
percentage progress. `fileRelay` already preserved a valid upstream length,
but the daemon supplied none. The relay copied in bounded chunks without
explicitly flushing short chunks; those could wait in HTTP output buffers.

There is no whole-archive buffering step in either handler. Missing length
explains the progress symptom; source inspection does not prove the cause of
the reported long initial stall. In particular, an external reverse proxy or
CDN is outside this product and was not exercised here. A live ingress path
could still buffer or transform the response.

## Change

- Calculate the exact length from manifest payload sizes and the stored-ZIP
  layout: 22-byte end record, and per file 30-byte local header, 46-byte central
  header, 16-byte descriptor, two 9-byte timestamp extras, and the UTF-8 name
  bytes twice. Export caps (200 files / 512 MiB) keep generated offers below
  ZIP64 thresholds. No file is read twice and no archive is staged on disk.
- Send the same length for GET and HEAD. Flush ZIP headers before reading each
  payload; abort on archive close errors as on file-read errors.
- Flush gateway writes, including a short first chunk, without changing its
  header allowlist, authentication or public download budgets.
- Add a synthetic ten-file, 170 MB PNG folder with non-ASCII names, exercised
  through the real gateway/daemon handlers and the card's download link.

## Verification

Base: `1a4f8ef3a6eedcf4a90731856494bff62f6bbd15`; tested the implementation
and tests in this commit. All fixtures use invented data and same-UID test
sockets, not a live installation or distinct-UID isolation proof.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
  Existing multi-file ZIP test now compares the actual bytes written against
  the advertised size, checks HEAD parity and verifies archive entry reads,
  including a UTF-8 filename.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passed.
  New TLS gateway regression declares 170 MB, pauses its daemon stand-in after
  four ZIP bytes, and requires those bytes at the client before releasing the
  producer. It then drains and checks the complete transfer length.
- `./scripts/test-focused.sh --area contracts`: passed; generation clean,
  98 schemas, 157 fixtures, 44 scenarios.
- `./scripts/test-focused.sh --area web`: passed, including 217 test files /
  1692 tests and static/component checks.
- `OH_PORT_BASE=16700 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec agent-file-offers.spec.ts`:
  all eight cases passed; first large-ZIP bytes in 66 ms.
- Named-spec repetition with `npx playwright test tests/agent-file-offers.spec.ts --repeat-each 3`,
  port base 16700, two workers, 0–60 ms reply jitter, timeout and scratch lease:
  final **24/24 passed**. Large-ZIP first bytes in **41, 51 and 97 ms**;
  Content-Length and downloaded file were both **170,001,382 bytes** each time.
  The test cancels a streaming fetch after its first chunk, then downloads the
  complete archive through the card, proving both paths through the gateway.
- Independent `/llm-review` by `claude-fable-5-2` and `/assess-findings`:
  no actionable findings. Routine read-only framing review; local source and
  test evidence checked. Final test-only race repair received focused self-review.
- `git diff --check`, project-view validation and issue doctor: passed.

The first repetition found a race in the existing removed-offer case: deleting
its last available offer could remove the assets chip before the test clicked
it. The case now keeps a separate live offer so its reread control remains
available. The final repetitions above include that repair. An initial Biome
format check was corrected before the passing web checks. An initial Go command
with two package flags selected only the last package; both packages were then
verified separately. No whole browser suite or clean release gate was run.

No screenshots: this changes download transport, not presentation. Browser
checks establish available length and incremental bytes, not Brave's native
download-manager appearance.

## Decisions for later review

- Keep the native browser download, rather than build a second progress UI.
  Exact HTTP length supplies what the browser needs without client buffering.
- Keep stored streaming ZIPs and calculate layout overhead rather than build a
  temporary archive or make a preliminary payload pass. Existing export caps
  make the layout bounded; byte-comparison tests catch writer/layout drift.
- Explicitly flush the shared file relay, rather than ZIPs alone. All its modes
  stream opaque bytes and benefit from prompt delivery. Existing diagnostics
  classify flushed responses by time to headers rather than total transfer time.

**Live check:** After deployment, download an offer containing about ten 17 MB
images from the card's corner in Brave; check that download bytes start promptly,
a total/progress appears, and the ZIP opens. If it still arrives late or in a
burst, compare the direct gateway with the installation's external ingress;
that proxy/CDN layer has not been verified by this worker.
