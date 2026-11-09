---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Send with large attachments ends uncertain: field empty though the notice says the text is there, Tarkista does nothing

## Description

Jari 9.11.2026 ~09:45–09:50, test server (pilot.23 plus the morning's
landings), screenshots `evidence/`. He sent a message with several large
images ("Tässä ne isot liitteet. Varoitus toimii.") after the combined-size
warning had made him trim them. A warning appeared that he did not have time
to read; he closed the laptop, reopened it, and found:

- the notice *Ei tiedossa, saiko agentti viestin · Tarkistettu: viesti ei näy
  keskustelussa, mutta ei myöskään varmistunut, ettei agentti saanut sitä.
  Sitä ei lähetetä uudelleen automaattisesti, ja teksti on
  kirjoituskentässä.* — but the field is **empty** (the claim is false, and
  the attachments are gone from the field too);
- pressing Enter / *Tarkista keskustelun tila* appears to do nothing;
- finally the message shows in the conversation as a **dashed bubble
  *Odottaa agenttia*** with its images, with the same notice under it (the
  dashed uncertain bubble was meant to be gone after `send-during-restart-uncertain`);
- a terminal chip with *?* appeared beside the assets chip.

Likely chain: a large multipart send (tens of MB) outlives a gateway or
daemon deadline or the laptop's sleep, the receipt is lost, the browser's
send record cannot be settled by history (images, rewritten text?) and
`resend-proven-undelivered` cannot prove non-delivery. Establish what
actually happened (did Pi receive it; daemon `conversation_message_*`,
attachment and receipt logs if reproducible), and fix every wrong piece:
the false "text is in the field", the dead *Tarkista*, the dashed bubble,
the empty field losing the draft and attachments, and the underlying
timeout/sleep handling for large sends. Reproduce with the synthetic host:
a ~90 MB send, a slow upload, the tab suspended mid-send, a daemon restart.

Further facts (Jari 9.11. ~09:52), conversation
`pi:8566f3ca-6a82-41d6-810e-d2c75b8d8a59` on the test server (workspace
`ws_9aVGVKUBudoprTcn3hHCt04R`), screenshots `evidence/jari-3-*`, `jari-4-*`:

- typing a new message *ping* and sending is refused, with a grey line
  **below** the field that disappears after a moment: *Viestiä ei lähetetty:
  Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.*
  The conversation cannot be continued.
- moments later it changed state again by itself: the dashed bubble now
  reads *? Toimitus epävarma*, the six images are back in the attachment row,
  the field holds the old text **and** *ping* concatenated, and the notice now
  says *Teksti on kirjoituskentässä. Jos varmistuu, ettei agentti saanut
  viestiä, se lähetetään itsestään kerran uudelleen …*

The test server's journals are readable as root on the guest from Alder
(Fleetrepo `infra/open-habitat-test/ADMIN.md` "Diagnostic journals"; the
pinned ssh options are in that directory's scripts, key
`~/.ssh/open-habitat-test-hetzner` on Alder only). Read the gateway and the
person's daemon journal around 06:40–07:00Z for this conversation
(read-only; never copy the key off Alder).

## Acceptance Criteria

- [ ] A large send either arrives and settles normally, or fails with a true message and the draft and attachments back in the field; never a false claim.
- [ ] *Tarkista* visibly checks and reports its result; no dashed uncertain bubble remains after a settled outcome.
- [ ] Tests for the large/slow/suspended/restarted cases; touched specs green.
