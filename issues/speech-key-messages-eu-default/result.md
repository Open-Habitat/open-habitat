# Result

Saving a Soniox key now tries the EU first and the US only after the EU
refuses the key (401/403). Every speech key message now says what happened
and what to do next:

- Saved in the EU: *Avain tallennettu. Soniox hyväksyi sen EU-alueella.*
- Saved in the US: *Avain tallennettu. Soniox hyväksyi sen USA-alueella, ei
  oletuksena olevalla EU-alueella.*
- Refused in both regions: *Avainta ei tallennettu: Soniox ei tunne sitä EU-
  eikä USA-alueella, joten se on väärä tai peruttu. Hae uusi avain
  Soniox-konsolista.* (with a link to console.soniox.com)
- Unreachable / limit: *Avainta ei tallennettu, koska Sonioxiin ei saatu
  yhteyttä / Sonioxin käyttöraja tuli vastaan. Yritä hetken päästä uudelleen.*
- Dictation: *Soniox ei hyväksy avainta. Avain on väärä tai peruttu. Tallenna
  uusi avain asetuksissa.*; *Soniox-avaimen käyttöraja on täynnä. Yritä hetken
  päästä uudelleen tai lisää oma avain asetuksissa.*; *Soniox ei vastaa. Sanelu
  ei alkanut. Yritä hetken päästä uudelleen.*; and mid-dictation *Sanelu
  katkesi: Soniox ei enää hyväksy avainta / Soniox-avaimen käyttöraja täyttyi /
  yhteys Sonioxiin ei palannut*.
- When a dictation fixes a wrongly stored region, it says nothing. The browser
  spec checks that no notice appears and that the settings row then shows the
  corrected region.

The browser host's synthetic Soniox now treats keys a case did not name as EU
keys. Review: focused self-review. The contract and the authority paths are
unchanged; in the daemon only the probe order changed.

## Decisions for later review

- **A healed region says nothing.** Alternatives: a one-time notice after
  the dictation. The dictation works, and Asetukset › Sanelu shows the
  corrected region, so a notice would only interrupt.
- **The dictation's refused-key notice sends the person to Asetukset, not
  straight to the Soniox console.** A person using the administrator's key
  cannot replace that key; adding their own key in Asetukset is what they
  can do. The console link is on the settings pages, where a new key is
  pasted.
- **A mid-dictation 401/403 reads "ei enää hyväksy avainta"** rather than
  "hylkäsi avaimen", since the key worked when the dictation started.
