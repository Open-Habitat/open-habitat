# Result: top bar flashes on Birch

## What flashed and why

The bar was the page-wide connection banner ("Yhteys katkesi", `ConnectionBanner`),
shown whenever the tab's event stream (`/api/v1/events`) dropped. The
conversation's inline "Tapahtumayhteys katkesi" notice flashed with it.

The stream was dropped by our own gateway. For proxied streams
(`internal/gateway/proxy_linux.go`) the gateway set a 10 s write deadline and
renewed it only when it forwarded bytes; the daemon sends a heartbeat every
20 s. On HTTP/1.1 an expired deadline only fails the *next* write, which was
always preceded by a renewal, so it was harmless. On HTTP/2, Go's server arms a
timer and resets the stream (`RST_STREAM INTERNAL_ERROR`) when the deadline
passes, write or no write. Birch serves TLS directly from the gateway, so
browsers negotiate h2 and every event stream died about 10 s after its last
byte. The test server sits behind Cloudflare, which talks HTTP/1.1 to the
origin, so the defect never showed there.

Evidence:

- Jari's console on Birch: repeated `net::ERR_HTTP2_PROTOCOL_ERROR` on
  `/api/v1/events` after `200 (OK)`, each reconnect resuming from the same
  cursor (`…:153`), i.e. reset before any new event.
- Birch, read-only `ss`: a single long-lived TCP/TLS connection from Jari's
  browser for the whole minute sampled, so not a network or relay drop but
  an HTTP/2 stream reset inside a healthy connection. Fast reads (including
  stream opens) are not logged by `diagnostic.Requests`, which is why the
  journal showed no event-stream records.
- Standalone Go reproduction: an h2 TLS server with a 1 s write deadline left
  armed resets the idle stream at 1 s with `INTERNAL_ERROR`.
- `TestProxyStreamSurvivesQuietDaemonOverHTTP2` serves the gateway handler
  over TLS/h2 with a quiet daemon. It fails on the previous code with exactly
  the error seen on Birch and passes now.

The banner was visible for about a round trip (Jari: ≤100 ms) because the
journal marked the tab offline on the stream error and online again as soon as
its probe and the new stream answered.

## Changes

- Gateway: the stream write deadline now bounds each write to the browser and
  is cleared while waiting for the daemon. A browser that stops reading is
  still cut off after 10 s of a blocked write.
- Browser journal: a stream that had opened and then dropped is reported
  offline only when the reconnect probe fails (network error, timeout,
  403/5xx/other refusal, or a 409 resnapshot). A reconnect the probe clears
  is silent. A stream that never opened is still a failure at once, so a
  proxy that blocks streams while plain reads pass is not hidden. A real
  outage shows the banner for at least one backoff period (≥3 s) and for as
  long as it lasts.
- Spinoffs: `SpinoffProvider` polled `/api/v1/agents/pi:<id>/spinoffs` every
  3 s for every open conversation. The daemon answers 404 while the
  conversation has no readable native session (a new conversation before its
  first turn), so the console filled with 404s. A 404 now pauses polling until
  the conversation's status or the snapshot reports the session readable, with
  a 60 s fallback re-read.

## Checks

- Go: `./scripts/test-focused.sh --area go --go-package ./internal/gateway`.
- Web: `./scripts/test-focused.sh --area web` (new journal and spinoff
  provider cases; both fail on the previous code).
- Browser: `reconnect-recovery`, `resilience-states`, `browser-conversation`,
  `spinoffs` specs, plus one whole-suite run (see the run report).

## Decisions for later review

- **Probe decides, not a timer.** Instead of delaying the banner by a few
  seconds, the journal treats a dropped stream as an outage only once its
  reconnect probe fails. Alternative: a 3 s display delay plus a minimum
  visible time. Rejected because it is a guess about latency, hides a real
  outage for those seconds, and the reconnect specs freeze the page clock to
  pin backoff, which a display timer would also freeze. A never-opened stream
  is still announced at once.
- **Spinoff 404s handled in the client.** The daemon's history handler only
  knows discovered native sessions, not conversations the browser just
  created. Alternative: have the daemon answer 200 with no runs for a
  conversation it created but has not written yet. Rejected for now because
  it would wire the conversation controller into the history handler for a
  read that carries no information before the first turn.
- **No server-wide HTTP/2 tuning.** The gateway's `http.Server` sets no
  Write/Idle timeouts; Go's h2 defaults (pings off, no idle timeout on an
  active stream) are fine once the per-stream deadline is not left armed.
