# Result

The notice was the process pill. While Pi starts for a held message, the
daemon's process inventory answers `bridge_unavailable`, because Pi's process
extension is not up yet. The strip hid process unavailability only for
`pi_not_running`, so it showed **Prosessit ?** with "Prosessit: ei tiedossa
(Prosessiyhteys ei ole saatavilla)". On pilot.206 the older process tray said
"Prosessiyhteys ei ole saatavilla" as visible text below the conversation;
that is the "can't reach Pi" Jari saw. The host-backed browser test reproduced
the pill before the fix.

`BackgroundStrip` now takes `piNotRunning` from the conversation, the same
`starting`/`stopped`/`start_failed` test that routes a send to the held path.
While no Pi runs, a missing or failed inventory says nothing, exactly as
`pi_not_running` already did. A restart's interrupted processes still show.
A real start failure is unchanged: the bubble says **Ei lähtenyt** and
"Pi ei käynnistynyt" has a retry.

Evidence (synthetic):

- `queued-send.spec.ts` "Stop before Pi runs": after two process polls in
  the six-second `pi-slow-start` start, with the daemon still `starting`, the
  conversation has no Taustatyö strip, no connection or not-running text and no
  alert. It failed on the pill before the fix. "a failed start keeps the
  message" still proves the failure path. The whole spec passed 8/8.
- `BackgroundStrip.test.tsx`: no process pill while Pi is not running, both
  for `bridge_unavailable` and for a failed inventory read; with a running Pi
  a missing bridge is still shown.
- Lab captures `held-waiting-{light,dark}-{1440,390}.{png,html}` show only
  the dashed waiting bubble.

## Decisions for later review

- The fix is in the browser rather than making the daemon say
  `pi_not_running` during start. The browser already knows the conversation
  is not running, and the daemon's answer is accurate for any other caller.
