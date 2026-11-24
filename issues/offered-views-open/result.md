# Result: offered views open as a blank page

## Cause

The per-user daemon serves its socket with a five-second per-response write
deadline (`internal/transport`). The gateway reads a view file from the
daemon's export-read route at the browser's pace, so a view file of several
megabytes on an ordinary connection took longer than five seconds and the
daemon's write was cut. HTML goes from the gateway without a length (the
bootstrap script changes it), so the gateway ended its chunked reply
normally and the browser saw a complete 200 document that stopped partway.
A prototype build's offline.html carries all of its code in one inline script
at the end of the body; cut short, that script never closes and never runs,
while the `<style>` with its data: fonts in the head has already arrived. The
recovery bootstrap at the top still answers the panel's probe, so no
recovery notice appeared either. The reported DevTools numbers fit this: a
file of about 7.9 MB arrived as about 5.1 MB after 5.7 s.

It was not the files, the CSP, the bootstrap insertion (byte-faithful on the
real files), the own-tab route or the handoff. The lab didn't show it because
loopback socket buffers absorb several megabytes, so the daemon finished
writing before its deadline.

## Fix

- The daemon's view export read sets a five-minute write deadline for one
  file, the same bound the gateway puts on the whole relay. The view zip and
  offered files already set their own longer deadlines; the single view file
  was the route that didn't.
- The gateway counts the bytes it reads from the daemon and aborts the
  response when fewer than the announced size arrived, so a cut stream can
  never again reach the browser as a complete document.

The view sandbox and CSP are unchanged.

## Evidence

- `TestViewExportOutlastsTheSocketDeadline` (daemon): a server deadline of
  200 ms and a reader that stalls; failed with 2.6 of 8 MiB before the fix.
- `TestViewHostAbortsACutDaemonStream` (gateway): a daemon stream shorter
  than its announced length after the headers have gone out; the HTML reply
  completed cleanly before the fix.
- `agent-views.spec.ts` "a several-megabyte single-file view renders over a
  connection that stalls": a synthetic prototype-style offline.html (data:
  font, one inline module script, about 8 MB) offered through the real
  export, opened in the panel and in its own tab through a TCP relay that
  stalls for seven seconds once in each burst. Before the fix the frame stayed
  blank; with it the spec passes 3 of 3 under repeat. The real prototype files
  behaved the same way in a probe through the same relay.
- The other view, view-link, file-offer and view-language specs (22),
  `--area web`, and the gateway and daemon packages pass.
- Independent review (one finder model, evidence-checked): no findings. Its
  coverage note led to the gateway test checking a cut that comes after the
  headers have gone out.

## Not changed

A private (non-public) view relay has no write deadline toward the browser,
and the relay's five-minute context does not interrupt a write that is already
blocked. That was already the case before this change; public link reads do
set a write deadline.
