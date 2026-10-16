# ADR 0022: Request records joined by a gateway request ID

**Status:** Proposed — taken by the implementing agent on 2026-10-16 in
[enormously-light-fall](../../issues/enormously-light-fall/item.md) and
awaiting Jari's review. Refines [ADR 0013](adr-0013-service-logging.md).

On 2026-10-16 Jari reported that hiding a workspace on the test server was
slow. The gateway and daemon journals for that hour held no record of any
request, so neither the slow write nor the snapshot that followed it could be
found or timed; the snapshot had to be measured by hand with `strace`. ADR 0013
left end-to-end tracing to be decided after real operational experience. This
is that experience.

The gateway and each daemon write one `http_request` record for a request that
changes state (any method but GET and HEAD), fails with a 5xx status, or takes
at least 250 ms. Fast reads are routine and are not recorded, as ADR 0013
asks. At 1 s or more the record is a warning with `slow: true`, so the slow
threshold can be found with a level filter. A stream is judged by the time to
its response header, because a healthy event stream stays open for hours. A
record has the method, a route template, the status, `duration_ms`,
`header_ms`, the verified user and a request ID. The route template keeps only
the fixed words of host routes and writes every other path segment as `{id}`,
since conversation, agent and workspace IDs can name content. Queries,
headers, cookies and bodies are never recorded. A snapshot adds the time of
each native observation (`phases_ms`: discovery, taskfleet, git, sessions,
github, processes); they run side by side, so the parts overlap rather than
add up.

The gateway makes a random 16-character request ID for every request and sends
it to the mapped daemon in `X-Agent-Host-Request-Id`. The browser cannot
choose it, because the proxy forwards only selected headers. The daemon takes
the ID only from the verified gateway peer and only in that exact shape; it
never makes one of its own, so a daemon record without an ID did not come
through the gateway. The ID is a log key. Nothing derives identity, routing or
authorization from it, and it is not returned to the browser: a support
reference shown to people would be a separate decision.

The implementation is one middleware in `internal/diagnostic` on Go's `slog`,
mounted outside the route muxes of both services, so new routes are covered
without per-handler code.
