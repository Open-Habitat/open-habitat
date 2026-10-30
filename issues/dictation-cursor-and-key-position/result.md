# Sanelu kursorin kohdalle, pikanäppäin fyysisestä paikasta: tulos

Toteutettu 2026-10-30, vain selaimessa: `web/src/components/composer/Dictation.tsx`
(lisäys kursorin kohdalle), `Composer.tsx` (kursori sanelulle ja lopuksi),
`dictationShortcut.ts` (näppäimen tunnistus ja vihje). Gateway ja daemon
eivät muuttuneet.

## Sanelu kursorin kohdalle

- Sanelun alkaessa kenttä jaetaan kursorin kohdalta: teksti ennen ja jälkeen.
  Maalattu teksti korvautuu. Vahvistettu teksti ja himmeä arvaus näkyvät
  kursorin kohdalla, ja punainen kursori on niiden perässä ennen loppuosaa.
- Lopuksi kursori jää lisätyn tekstin perään, ja kenttä saa kohdistuksen.
- Välilyönnit: sanotun eteen tulee välilyönti, jos edellä on sana; sanotun
  ja jäljessä olevan tekstin väliin tulee välilyönti, ellei jäljessä ole jo
  välilyöntiä tai välimerkkiä (`.,;:!?)]}»”`).
- Kun sanelu alkaa painikkeesta, pikanäppäimellä tai ilmoituksen *Jatka
  sanelua* -painikkeesta, kohta on kentän kursori (kohdistettuna) tai
  viimeisin kursori ennen kuin kenttä menetti kohdistuksen. Jos teksti on
  sen jälkeen vaihtunut (esim. lähetys tyhjensi kentän tai luonnos
  vaihtui), sanelu menee loppuun kuten ennen.
- Enter/Valmis, Esc, *Lähetä* kesken sanelun ja puskuroitu aloitus
  toimivat kuten ennen.

## Pikanäppäin: ⌘ (muualla Ctrl) + Escin alla oleva näppäin

Näppäin tunnistetaan paikasta (`event.code`), ei merkistä:

- **Muualla kuin Macilla** `Backquote` Ctrl:n kanssa. Chrome ei vaihda
  koodeja Windowsissa eikä Linuxissa. Ctrl+< (`IntlBackslash`) ei käy.
- **Macilla** ISO-näppäimistön §-näppäin (1:n vasemmalla) on macOS:n
  näppäinnumero 0x0A ja <-näppäin 0x32. Chrome (ja oletettavasti Safari)
  antaa niistä koodit `IntlBackslash` ja `Backquote` eli vaihdettuina;
  Firefox korjaa vaihdon. ⌘ ja 0x32 on macOS:n ikkunanvaihto (suomalaisella
  ⌘<, ANSI:lla ja UK-asettelulla ⌘`).
  - Kun selaimella on `navigator.keyboard.getLayoutMap()` (vain Chromium),
    hyväksytään vain `IntlBackslash`. Jos kartta näyttää, että
    `IntlBackslash` kirjoittaa < tai `, eli Chrome on lopettanut vaihdon,
    hyväksytään `Backquote`.
  - Ilman karttaa (Safari, Firefox) hyväksytään kumpi tahansa näistä
    kahdesta koodista, ja ikkunanvaihtonäppäin erotetaan merkistä: <, >, `
    ja ~ eivät koskaan käynnistä sanelua.
  - Siksi ⌘< ei koskaan käynnistä sanelua, eikä § muualla (esim.
    belgialaisen näppäimistön 6-näppäin) käynnistä.
- Shift (paitsi ⌘⇧välilyönti Macilla), Alt/AltGr ja IME-kirjoitus estävät
  osuman kuten ennen.
- **Vihje** nimeää näppäimen asettelun kartasta, jos se on saatavilla:
  *Sanele (⌘§)* suomalaisella Macilla, *(⌘^)* saksalaisella, *(Ctrl+`)*
  US-PC:llä. Ilman karttaa vihje on *⌘§* / *Ctrl+§* kuten ennen.

## Missä käyttöjärjestelmä vie yhdistelmän

**ANSI-Mac (US-näppäimistö ilman §:ää):** 1:n vasemmalla oleva näppäin on
`, ja ⌘` on macOS:n *Siirrä kohdistus seuraavaan ikkunaan*. Selain ei saa
sitä, joten siellä toimii **⌘⇧välilyönti**, joka toimii Macilla kaikilla
asetteluilla. Chromessa vihje näyttää *Sanele (⌘§ tai ⌘⇧välilyönti)*, kun
asettelun `Backquote` on ` (US- ja UK-tyyppiset asettelut). Asettelukartta
ei erota ANSI-näppäimistöä US-asettelun ISO-näppäimistöstä, joten
molemmille näytetään vaihtoehto. Safarissa ja Firefoxissa karttaa ei ole,
ja vihje on *⌘§*; ⌘⇧välilyönti on `aria-keyshortcuts`issa.

Windowsissa ja Linuxissa Ctrl+` / Ctrl+§ ei ole tiettävästi käyttöjärjestelmän
tai selainten käytössä.

## Testit

- `dictationShortcut.test.ts`: Mac-ISO-vaihto kartan kanssa ja ilman,
  ⌘< ja ⌘` eivät käy, saksalainen ^ ja Firefoxin koodit käyvät, belgialainen
  § (Digit6) ei käy, Chromen korjattu vaihto, Ctrl-puoli paikan mukaan,
  vihje ja `aria-keyshortcuts` asettelun mukaan, ANSI-vaihtoehto.
- `Composer.test.tsx`: sanelu kursorin kohdalle, maalauksen tilalle,
  välilyönnin eteen ja kentän alkuun; arvaus näkyy kursorin kohdalla ja
  kursori jää lisätyn tekstin perään.
- `speech-input.spec.ts`: Linuxin spec käyttää US-asettelun karttaa (vihje
  *Ctrl+`*), Ctrl+< ei lopeta sanelua ja Ctrl+§ (`Backquote`) lopettaa.
  Uusi Mac-ISO-spec (alusta MacIntel, Chromen suomalainen kartta): ⌘<
  (`Backquote`) ei aloita, ⌘§ (`IntlBackslash`) aloittaa ja lopettaa,
  sanelu menee tekstin keskelle, arvaus näkyy siinä, kursori jää perään,
  ja maalaus korvautuu.
- Ajettu: `./scripts/test-focused.sh --area web` (999 testiä) ja
  `--area browser --spec speech-input.spec.ts` (12/12).
  Katselmointi: kohdennettu itsekatselmointi (vain selain).

## Decisions for later review

- **Kursori jää sanotun perään, ennen lisättyä välilyöntiä.** Esimerkiksi
  "Alku |loppu" + "sanelu" → "Alku sanelu| loppu". Kirjoittaminen jatkaa
  sanaa kuten macOS:n omassa sanelussa. Vaihtoehto oli viedä kursori
  välilyönnin jälkeen.
- **Vanhentunut kursori → loppuun.** Jos kentän teksti on muuttunut sen
  jälkeen, kun kenttä viimeksi menetti kohdistuksen, sanelu menee loppuun
  eikä vanhaan kohtaan, jotta toisen luonnoksen tai lähetyksen jälkeinen
  sanelu ei osu satunnaiseen kohtaan.
- **Macilla ilman asettelukarttaa kaksi koodia ja merkkisuodatin.** Safari
  ja Firefox eivät kerro, vaihtavatko ne koodit. Molempien koodien
  hyväksyminen ja ikkunanvaihtomerkkien (<, >, `, ~) hylkääminen toimii
  kummassakin tapauksessa kaikilla yleisillä asetteluilla. Jos jokin
  harvinainen asettelu kirjoittaa 0x32-näppäimellä muun merkin, ⌘ ja se
  voisi käynnistää sanelun Safarissa tai Firefoxissa. macOS ottaa ⌘+0x32:n
  yleensä itse ennen selainta.
- **ANSI-vaihtoehto näytetään US/UK-tyyppisille asetteluille Chromessa**,
  koska ANSI:a ei voi erottaa. UK-ISO-käyttäjä näkee siis *⌘§ tai
  ⌘⇧välilyönti*, vaikka ⌘§ toimii. Lyhyempi vihje olisi jättänyt ANSI-käyttäjän
  ilman toimivaa ohjetta.
- **Muualla kuin Macilla § ei enää käy merkkinä**, vain paikka
  (`Backquote`). Merkkinä § osuisi esimerkiksi belgialaisen näppäimistön
  Ctrl+6:een.
- **Ei mitattu oikealla Macilla.** Birchlla ei ole istuinta. Chromen
  koodivaihto ja asettelukartan arvot ovat tämän ja edellisen issuen
  tulosten mukaisia, ja ne on tarkistettava KOKEILTAVAA.md:n mukaan Macin
  Chromessa ja Safarissa.
