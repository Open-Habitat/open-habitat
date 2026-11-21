# Result

Extracted `web/src/app/readJSON.ts`: a feature-neutral streaming JSON reader with an explicit byte cap and fatal UTF-8 decoding. The six named implementations use it, and every client that borrowed `bounded` from integrations now imports the neutral utility. Endpoint schemas, status/refusal classes, limits and write/retry ownership remain with their callers. No retry was added.

The three former `response.text()` readers now enforce bytes, not UTF-16 units, and stop oversized streams before reading the remainder. Reader failures expose no response text. This is the malformed/oversized-response normalization requested by the issue, not a change to accepted endpoint schemas.

## Verification

- `./scripts/test-web-fast.sh`: 234 files, 1921 tests passed, including the new reader's 11 cases and existing endpoint tests.
- Reader cases cover byte-by-byte multibyte UTF-8, exact/over byte limits, misleading Content-Length, malformed/truncated UTF-8, malformed/trailing JSON, absent bodies, non-JSON, stream failure, cancellation, lock release and status independence.
- Focused browser checks: `agent-file-offers.spec.ts`, `agent-views.spec.ts`, `view-links.spec.ts`, repeated three times with two workers, alongside the history regression specs.
- Production assets built by the focused browser runner; no full suite or clean gate run.

Evidence: `/var/tmp/agent-keep/five-hygiene/web-final.log` and `browser-final.log`. Evidence covers the implementation in this commit on synthetic fixtures, not provider availability or a live installation.

## Review

Source-level self-review plus boundary tests: caller schemas, limits and status handling were compared against the original implementations. The helper moves no identity, session, daemon state or authorization authority, so no independent architecture review was required.

## Decisions for later review

Scope the migration to the named clients and all consumers of the integrations-owned primitive. Other specialized response readers remain outside this patch; replacing every transport path at once would turn this bounded cleanup into a cross-journey migration. The shared primitive is available for those paths without inventing an API-client framework.
