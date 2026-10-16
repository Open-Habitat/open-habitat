# Result: request records in the gateway and daemon journals

## Yhteenveto Jarille

Nyt gatewayn ja käyttäjän daemonin lokiin tulee rivi `http_request` jokaisesta muuttavasta pyynnöstä (kaikki muut kuin GET/HEAD), jokaisesta 5xx-virheestä ja jokaisesta vähintään 250 ms kestäneestä pyynnöstä. Yli sekunnin pyynnöt ovat varoituksia (`level: WARN`, `slow: true`), joten hitaat löytyvät suoraan. Saman klikkauksen gateway- ja daemon-rivillä on sama `request_id`. Hidas snapshot kertoo myös, mihin aika kului (`phases_ms`: discovery, taskfleet, git, sessions, github, processes). Polussa näkyy vain reitin malli, esim. `/api/v1/conversations/{id}/send`. Tunnisteet, kyselyt, otsakkeet, evästeet ja sisältö jäävät pois. Labissa yksi piilotusklikkaus tuotti yhteen liitetyt gateway- ja daemon-rivit. Testikoneella tätä ei ole vielä varmistettu, koska ohjeen mukaan palvelinta ei muutettu. Päätöksen kirjasin ehdotukseksi [ADR 0022](../../docs/decisions/adr-0022-request-records.md), ja se odottaa katselmointiasi.

## What was built

- `internal/diagnostic/request.go`: `Requests` middleware on the existing `slog` JSONL logger. It writes one `http_request` record per request that is mutating, 5xx or ≥ `SlowRead` (250 ms), and records at ≥ `Slow` (1 s) as WARN with `slow: true`. Streams are judged by time to the response header (`header_ms`), so a long-lived event stream doesn't count as slow. Fields: outcome (`completed` / `failed` / `client_canceled`), method (standard methods or `other`), route template, status, `duration_ms`, `header_ms`, `request_id`, `user`, optional `phases_ms`. `Route` keeps a fixed allowlist of route words and writes every other segment as `{id}`. The UI static surface is `ui`.
- Gateway (`internal/gateway/server.go`): mounted inside Cloudflare Access ingress and around the whole mux. It makes a fresh 16-character ID for every request. `authenticated()` names the verified Unix user, and `proxy` forwards the ID in `X-Agent-Host-Request-Id`. The proxy already forwarded only selected headers, so a browser cannot choose the ID; a test checks this.
- Daemon (`internal/daemon/handoff_linux.go`): `RequestLog` is mounted outside the route mux, so new routes are covered automatically. It takes the ID only from the verified gateway peer and only in the generated shape, and never makes one up. The handoff route keeps its own `credential_handoff` records.
- Snapshot (`snapshot_linux.go`): `diagnostic.Phase` around discovery, Taskfleet exclusion, git, the session scan, GitHub status and the process inventory.
- The lab host (`test/browser-host`) mounts the same daemon middleware, so `.cache/lab/host.log` shows joined lines.
- Docs: ADR 0022 (proposed), linked from ADR 0013; `docs/architecture/deployment.md` and the logs line in `docs/operations.md`, with a journalctl join example.

## Evidence

- Lab, `issues/enormously-light-fall/lab-click.mjs` (real clicks: hide, then undo), from `.cache/lab/host.log`:

  ```
  {"level":"INFO","event":"http_request","component":"daemon","user":"jari","outcome":"completed","method":"POST","route":"/api/v1/workspaces","status":200,"duration_ms":1,"header_ms":1,"slow":false,"request_id":"1K18HoaL1wZ2cc1N"}
  {"level":"INFO","event":"http_request","component":"gateway","outcome":"completed","method":"POST","route":"/api/v1/workspaces","status":200,"duration_ms":2,"header_ms":2,"slow":false,"request_id":"1K18HoaL1wZ2cc1N","user":"alice"}
  ```

  The lab runs every daemon as the developer's own UID, which is why the daemon user is `jari`. The snapshots that followed took under 250 ms, so they were not logged, which is the intended behaviour.
- Go: `internal/diagnostic` (thresholds on an injected clock, stream header judgement, client cancel at both levels, method classification, no body/cookie/query/ID markers in records, phases), `internal/gateway` (`TestProxyJoinsGatewayAndDaemonRecords`), and `internal/daemon` (`TestRequestLogTakesIDOnlyFromTrustedGateway`, `TestSlowSnapshotRecordsPhases`) all pass, with `-race` for diagnostic and gateway. Full `go test ./internal/daemon` fails only the six known Pi credential/device/model/startup tests. `internal/transport` and `internal/cli` pass.
- Browser (focused): `lab-workspace-page` 8, `reconnect-recovery` 9, `github-stream` 1, `lab-live-turn` 1 and `browser-conversation` 64 all pass. These cover streams and flushing through the new writer wrapper.
- No UI change, so no screenshots.

Not verified: the test server. The change has not been released there, and the brief said not to change the server. KOKEILTAVAA.md has the live check.

## Review

Independent `/llm-review` at routine rigor, because the change touches the gateway session path and proxy headers. Finder Claude Fable 5.1, one call. It found two defects, both confirmed locally and fixed with tests:

- The HTTP method was logged verbatim, and net/http accepts any token, so a client could write large arbitrary strings into the gateway journal. Methods are now classified.
- On the daemon, the gateway's own 60 s timeout looked like an INFO `client_canceled`. A slow canceled request now stays WARN.

The verifier was skipped because both claims were settled by a test. The finder ruled out five more candidates (ReadTimeout context, races, stream/flush/deadline breakage, header abuse, sendfile). The model-performance entry was not logged because SSH from alder to itself failed (known issue `assess-models-alder-self-ssh`).

## Decisions for later review

- **Request ID across services (ADR 0022, proposed).** ADR 0013 left end-to-end tracing for later. This adds a gateway-made log-only ID header to the daemon. It moves no authority, but it does change the logging decision, so it is recorded as proposed for Jari.
- **What gets logged.** Mutations always; reads only when ≥ 250 ms or 5xx. That keeps ADR 0013's "no routine noise" while making every click visible, since clicks are writes. Fast snapshot polling is not logged. If the live volume is too high or too low, adjust `SlowRead`/`Slow` in `internal/diagnostic`.
- **The ID is not returned to the browser.** A support reference people could quote would be a separate product decision.
- **The user field** is the verified Unix username, as in the existing records. Gateway records of a 401/403 after a valid session also carry it.
