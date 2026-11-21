# Result

Moved the identical token walker into `internal/jsoncheck.NoDuplicates` and replaced both copies with direct imports at their existing call sites. It still accepts exactly one JSON value and rejects duplicate keys at every object depth. Bounds, Unicode checks, endpoint schemas, trust checks and response policy remain with the daemon and gateway.

## Verification

- Focused Go package checks through `./scripts/test-focused.sh --area go --go-package`: daemon, gateway and jsoncheck passed (the combined run also checks provision and transport).
- `go vet` passed for those five packages.
- Shared table tests cover nested objects/arrays, repeated names in different objects, escaped duplicate names, scalar values, whitespace, missing/incorrect closers, missing values, trailing commas, trailing values and junk.
- Compared the extracted algorithm with both original copies: only the package/export/helper names and comments changed.

Evidence: `/var/tmp/agent-keep/five-hygiene/go-final.log`, covering this commit's implementation with the sibling hygiene changes. Ordinary Go checks do not claim distinct-UID or live-installation evidence. No new authority or endpoint acceptance rule was introduced.

## Review

Source-level equivalence review plus shared tests and existing caller package tests. This is a pure grammar predicate, not shared gateway/daemon policy or state, so an independent architecture review was not required.

## Decisions for later review

None.
