# Result

An offered `.html`/`.htm` file now opens as its page in the file preview, in
the panel beside the conversation and in its own tab.

- The preview asks `POST /auth/view` for a handoff naming the file offer and
  the HTML file (`{offer_id, path}`, added to `contracts/v1/view.schema.json`).
  The page opens on the offer's own view host (host = hash of the identity and
  the offer ID) under the unchanged view CSP: scripts, no network, no top
  navigation, no nested frames. That host's session reads only the offer's
  frozen files through the daemon's offer-read route (no Range, query,
  thumbnail or zip), so a folder offer's page finds its siblings. The handoff
  goes straight to the chosen file, so two files of one offer opened at once
  each open their own file.
- The app origin still presents an offered file only as media or an
  attachment; download is unchanged.
- A Sivu / Lähdekoodi ja tiedot switch shows the source (up to 1 MB) and type
  and size. On a site without a view origin the preview stays as before, with
  no switch.

No new security decision was needed. This is the view host's existing model:
the same person's agent-written HTML, on an isolated per-item origin, under the
same policy. An independent review (finder plus a verifier asked about the
boundary) found no way to read across offers, views or users. Its two real
findings, a redirect race and a missing Explain card (V45), were fixed.

Evidence: gateway test `TestOfferedHTMLFileOpensOnItsOwnViewHost`; browser
spec `agent-views.spec.ts` "an offered HTML file of several megabytes opens as
its page in the view sandbox" (an 8 MB prototype-style page with a data: font
and inline module; failed before the change); `agent-file-offers.spec.ts`
covers the fallback without a view origin.

Limits, as for views: external module scripts and fonts in a folder offer do
not load under the opaque sandbox (self-contained pages do). A public offer
address still serves HTML as a download.
