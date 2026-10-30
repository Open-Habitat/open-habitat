# Sanelun pikanäppäin ⌘§: tulos

Toteutettu 2026-10-30, vain selaimessa: `web/src/components/composer/dictationShortcut.ts`
(tunnistus) ja `Dictation.tsx` (vihje ja `aria-keyshortcuts`).

- **Mac: ⌘§.** Tunnistetaan merkistä (`event.key === "§"`), ei koodista,
  koska Chrome Macin ISO-näppäimistöllä antaa §-näppäimelle koodin
  `IntlBackslash` ja <-näppäimelle `Backquote`. Koodilla tunnistaminen
  ottaisi Chromessa ⌘<:n, joka on macOS:n ikkunanvaihto. ⌘< ja ⌘` eivät
  koskaan käynnistä sanelua.
- **Muut: Ctrl+§**, eli Ctrl ja 1:n vasemmalla puolella oleva näppäin
  (`Backquote`, jota Chrome ei muualla vaihda). Ilman §:ää olevilla
  asetteluilla sama fyysinen näppäin toimii (US: Ctrl+`).
- Shift, Alt (myös AltGr = Ctrl+Alt Windowsissa) ja IME-kirjoitus estävät
  osuman, joten ½ ja ¶ eivät käynnistä sanelua.
- Vihje: *Sanele (⌘§)* / *Sanele (Ctrl+§)*; `aria-keyshortcuts`
  `Meta+§ Meta+Shift+Space` / `Control+§`.

Testit: `dictationShortcut.test.ts` (Mac-koodin vaihto, ikkunanvaihto,
muuntonäppäimet, vihje), `speech-input.spec.ts` (Linuxilla Ctrl+Backquote
aloittaa, `§`/`IntlBackslash`-tapahtuma lopettaa). Ajettu web-tarkistukset
(993) ja `speech-input.spec.ts` (11). Katselmointi: kohdennettu
itsekatselmointi (vain selaimen näppäintunnistus).

## Decisions for later review

- **Mac ilman §-näppäintä (ANSI) pitää ⌘⇧välilyönnin.** Sen 1:n vasemmalla
  puolella oleva näppäin on `, ja ⌘` on ikkunanvaihto, joten fyysistä
  vastinetta ei ole. ⌘⇧välilyönti toimii Macilla siksi edelleen kaikilla
  asetteluilla, ja se on `aria-keyshortcuts`issa mutta ei vihjeessä, jotta
  vihje pysyy lyhyenä. Vaihtoehto oli poistaa se kokonaan, jolloin ANSI-Macilla
  ei olisi pikanäppäintä.
- **Muualla ilman §:ää fyysinen näppäin (Ctrl+`), ei toista yhdistelmää.**
  Ctrl+` ei ole selainten käytössä Windowsissa eikä Linuxissa, ja näppäin
  on sama paikka kuin §. Vihje sanoo silti *Ctrl+§*, koska asettelua ei
  voi lukea synkronisesti (Chromen `navigator.keyboard.getLayoutMap` on
  asynkroninen eikä Safari tai Firefox tue sitä). Ctrl+Shift+välilyöntiä ei
  pidetty muualla.
- **Saksalaisella PC-asettelulla § on Shift+3**; se ei käy, mutta
  Ctrl+^ (sama fyysinen näppäin) käy.
