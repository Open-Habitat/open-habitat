# Result

- Palvelimen ylläpito's tab and heading are **Palvelinintegraatiot** (slug
  `server-integrations` unchanged). The person's own tab stays Integraatiot.
  References in the person's paused-account text, comments, stories,
  `docs/operations.md` and `KOKEILTAVAA.md` follow.
- Row status on Palvelinintegraatiot: **Tarjolla** / **Ei tarjolla**
  (`Ei tarjolla · rclone puuttuu`). Käyttöönotto's unready tiles and hidden
  step hint use the same word.
- New tab **AI-avain** (`/settings/ai-key`, after Palvelinintegraatiot): set,
  replace and remove the site key with the same editor, terms and removal
  dialog; a refusal shows its reason, an unknown outcome stops the page until
  it is read again. Käyttöönotto › AI-tili › Sivuston avain shows the stored
  key's suffix and links to the tab; leaving the key way there still asks
  and removes it.

Evidence: `test-focused.sh --area web` (705 tests); browser specs
`site-ai-key` (now stores the key on the new tab; phone width 390 has no
horizontal overflow and no axe violations), `server-integrations`,
`site-onboarding`, `lab-english-url-paths`; `go test ./internal/gateway`.

## Decisions for later review

- **"Tarjolla" / "Ei tarjolla"** for the status: one word, as short as
  "Käytössä", and it says the integration is offered to people, which cannot
  be read as the administrator's own connection. Alternatives: "Henkilöiden
  käytössä" (longer), a column header "Henkilöille" (adds a header row the
  list does not otherwise have).
- **Removing the key on AI-avain gives new people every option** (`offer:
  all`). The dialog already says "Uudet henkilöt valitsevat AI-tilin taas
  itse". A default (e.g. ChatGPT) is picked in Käyttöönotto afterwards.
  Alternative: a replacement-offer picker in the dialog (more controls on a
  page about the key).
- **Tab name "AI-avain"**, placed between Palvelinintegraatiot and
  Käyttöönotto, with a new key icon.
- Setting the key on AI-avain switches the offer to `site_key` as before; the
  page's terms say the new person then sees no AI step.
