# Result

The recap card no longer has an activity line above its heading. It starts with **Tilannekatsaus**, its age and its marks, then the recap. The line came from `RecapCard`'s `activityLabel`. `BrowserConversation` filled it with the conversation's activity ("Odottaa sinua", "Työskentelee") or, while the agent waited on a process or spinoff, with "Odotan <name> · jatkan itse, kun odotus päättyy." The prop and the now-unused `waitingSummary` helper are removed.

The conversation header still shows the activity (the "Odottaa sinua" chip, or the "Odottaa prosessia · …" control that opens the process tray), and so does the sidebar's attention mark.

Screenshots (synthetic lab `pi-recap` scenario, an answered conversation with its automatic recap, `capture.mjs`): `lab-{desktop,phone}-{light,dark}-recap.{png,html}`.

## Tests

- `RecapCard.test.tsx`: the card's first element is the Tilannekatsaus heading and the card has no "Odottaa sinua".
- `process-tray.spec.ts` (host-backed): while the agent waits on a process, the card's text starts with "Tilannekatsaus" and has no "Odotan testit". The header's waiting control is still asserted. The earlier assertion that the card *contained* "Odotan testit" is gone. On the old code the new check fails, because the line came first.

## Decisions for later review

- **The waiting-on-process line went too, not only "Odottaa sinua".** It was the same line with a different label. The header's "Odottaa prosessia · testit" control says the same thing and opens the tray. Jari asked for the heading to be just Tilannekatsaus.
