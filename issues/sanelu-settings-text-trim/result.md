# Result

Asetukset › Sanelu, Palvelimen ylläpito › Saneluavain and the composer's
dictation notices are cut to one short line per control. What is needed only
now and then (Soniox console permissions, the key file, what happens to the
shared key's copies) sits in an *Oikeudet ja säilytys* disclosure at the foot
of each key card, a `<details>` like the integration grant list in Asetukset ›
Tiedot agenteille.

Evidence (synthetic lab, Alice, 1280×800 at device scale factor 2):
`before/` and `after/` hold the same journey: 01 composer without a key,
02 Sanelu without a key, 03–04 Saneluavain empty and set, 05 Sanelu with the
administrator's key, 06 adding an own key, 07 own key; `after/08` and `after/09`
show the disclosure open. Captured by `web/lab/capture-sanelu-settings-text.mjs
before|after` (the lab's `openLab` gained a `deviceScaleFactor` option).

Checks: `test-focused.sh --area web` (865 passed), `--area browser --spec
speech-input.spec.ts` (5 passed; the layout case now also checks the
disclosure starts closed and holds the permissions and key path). Review:
focused self-review, as only browser copy and one CSS rule changed.

## Decisions for later review

Every removed or moved sentence, and where it went.

### Asetukset › Sanelu

| Before | Now |
|---|---|
| Intro: "Sanelu kirjoittaa puheesi viestikenttään." | Removed. The section name and the composer's *Sanele* say it. |
| Intro: "Puhe kulkee selaimesta suoraan Sonioxille, ja käyttö laskutetaan sen avaimen omistajalta, jonka avainta käytetään." | Removed. How it works; that your own Soniox key bills your Soniox account is self-evident. |
| Status: "Ei avainta. Sanelu tarvitsee Soniox-avaimen." | "Ei avainta. Sanelu tarvitsee sen." (the row title already says *Soniox-avain*) |
| Status: "Palvelimen ylläpitäjän antama avain …X (EU). Oma avain korvaa sen." | "Ylläpitäjän avain …X (EU)." The *Lisää oma avain* button carries the replacement. |
| Region: "Sama kuin Soniox-projektin, jossa avain on tehty." | "Sama kuin Soniox-projektissa." |
| Note: "Avain tallentuu kotihakemistoosi (~/.config/soniox/key.json), ja agenttisi voivat käyttää sitä." | Moved to the disclosure: "Avain tallentuu tiedostoon `~/.config/soniox/key.json`, ja agenttisi voivat käyttää sitä." |
| Note: "Sitä ei näytetä uudelleen." | Kept as the form's only note: "Tallennettua avainta ei näytetä uudelleen." |
| Note: "Soniox-konsolissa avaimelle riittävät oikeudet Temporary API keys ja Speech-to-text, real-time." | Moved to the disclosure, unchanged. |

### Palvelimen ylläpito › Saneluavain

| Before | Now |
|---|---|
| Intro: "Yhteinen Soniox-avain antaa sanelun kaikille, joilla ei ole omaa." + "Käyttö laskutetaan sinulta" | Kept as the one intro line: "Kaikki, joilla ei ole omaa avainta, sanelevat tällä. Käyttö laskutetaan sinulta." |
| Intro: "Jokainen saa siitä kopion kotihakemistoonsa, ja hänen agenttinsa voivat käyttää sitä." | Moved to the disclosure. |
| Intro: "Kopiota ei voi perua kuin vaihtamalla avain Soniox-konsolissa." | Moved to the disclosure, same item as the copies. |
| Intro: "…kaikki jakavat avaimen samanaikaisten sanelujen rajan." | Moved to the disclosure. |
| Status: "Ei yhteistä avainta. Sanelu toimii vain niillä, jotka lisäävät oman avaimen." | "Ei yhteistä avainta." The intro already says who it serves. |
| Note: "Tallennus antaa avaimen heti jo liittyneille, joilla ei ole omaa, ja uudet saavat sen ensimmäisellä kirjautumisellaan." | Moved to the disclosure: "Jo liittyneet saavat avaimen heti, uudet ensimmäisellä kirjautumisellaan." |
| Note: "Tallenna sama avain uudelleen, jos joku jäi tavoittamatta." | Shown only when it applies: appended to the result line after a save that left someone unreached or unknown ("Tavoittamattomat saavat avaimen, kun tallennat sen uudelleen."). |
| Note: permissions sentence | Moved to the disclosure. |
| — | New form note: "Tallennettua avainta ei näytetä uudelleen." |

The disclosure is always present under the key row (also when a key is set,
not only while the form is open), so the copies-cannot-be-revoked fact is one
click away when the administrator considers *Poista*. Alternative: keep that
one sentence visible next to *Poista*. Chosen against because Jari named the
sentence among the excessive ones; reconsider if an administrator is surprised
that removing the key does not revoke the copies.

### Composer dictation notices

| Before | Now |
|---|---|
| Missing key: "Lisää oma avain asetuksissa. Jos palvelimen ylläpitäjä lisää yhteisen avaimen, sanelu toimii ilman omaa." | "Lisää avain asetuksissa." |
| Refused key: "Avain on poistettu tai sen oikeudet eivät riitä reaaliaikaiseen saneluun. Vaihda avain asetuksissa." | "Vaihda avain asetuksissa." The needed permissions are in the Sanelu disclosure the *Avaa asetukset* button leads to. |
| Limit: title "Sanelu ei nyt mahdu", text "Soniox-avaimella on jo niin monta sanelua käynnissä kuin se sallii. Yritä hetken päästä tai lisää oma avain." | Title "Soniox-avaimen sanelut ovat täynnä", text "Yritä hetken päästä tai lisää oma avain." The reason moved into the title. |
| Unsupported: "Selain ei anna mikrofonin ääntä sivulle. Kokeile toista selainta." | "Kokeile toista selainta." (title says the browser cannot dictate) |
| Unavailable: "Sanelua ei saatu käyntiin. Yritä hetken päästä uudelleen." | "Yritä hetken päästä uudelleen." (title *Soniox ei vastaa*) |
| Ceiling reached: "Kaikki sanottu on kentässä. Jatka uudella sanelulla, jos sinulla on vielä sanottavaa." | "Kaikki sanottu on kentässä." The *Jatka sanelua* button carries the rest. |
| Ceiling warning: "10 minuutin kohdalla. Kaikki sanottu jää kenttään, ja voit jatkaa uudella sanelulla." | "Kaikki sanottu jää kenttään." The countdown title already says when. |

Unchanged because each is already one actionable line: microphone denied,
the dropped-stream notice (its "Viimeiset sanat voivat olla epätarkkoja" tells
the person to check the end), the pill's tooltip and the status labels.
