# Sivupalkin paikkojen kuvakkeet – tulos

## Saatesanat

Piirsin sivupalkin paikoille kolme kuvakesarjaa ja näytän ne siellä, missä
niitä käytetään: mukautuvan sivupalkin kuvakerivissä, ruuduissa ja riveissä,
tilamerkkien ja vihjeiden kanssa, päivällä ja yöllä sekä pikseleinä 1x- ja
2x-tiheydellä. Kaikki sarjat noudattavat tuotannon tyyliä: 24 yksikön
ruudukko ja 1,8 viiva.

Suosittelen suuntaa **A Esineet**. Tuotokset on lokero, jossa on sivu, Oma
selain on selainikkuna ja Agentin käytössä on pistoke. Esineen tunnistaa
nopeimmin ilman nimeä. Ikkuna on sama merkki kuin keskustelurivin
selainmerkki, jonka hyväksyit Kortti-kierroksella. Pistoke vastaa sitä, mitä
sivu oikeasti on: yhdistetyt palvelut ja kansiot, joita agentti käyttää
sinun tunnuksillasi. Kilpi ja huutomerkki lupasivat turvallisuutta ja
varoitusta, joita sivulla ei ole.

**B Merkitykset** erottuu numeroina parhaiten, mutta sen kuvakkeet täytyy
opetella. Lisäksi sen Etusivu (Habitatin aurinko ja kaari) näyttää 18 px
koossa henkilöltä tai kellolta. **C Kaksisävy** on A sävytettynä. Se antaa
paikoille massaa, mutta talo ja lokero lähenevät toisiaan. C on hyvä varaus,
jos A tuntuu 16 px koossa liian ohuelta.

## Sivu

Rakennettu itsenäinen sivu tällä työhostilla:
`/var/tmp/agent-keep/rail-icons-tuotokset-oma-selain/offline.html`.
Lähteet ovat hakemistossa
`design-system/prototypes/rounds/2026-11-22-rail-icons/`, ja rakennus- ja
tarkistuskomennot ovat sen `NOTES.md`:ssä. Tarkistuksen kuvat ovat
hakemistossa `/var/tmp/agent-keep/rail-icons-tuotokset-oma-selain/check/`.
Valitsimessa ovat A Esineet, B Merkitykset, C Kaksisävy ja Nyt. Kaikki nimet
ja sisällöt ovat keksittyjä.

## Akseli ja suunnat

Akseli on **kuvakkeen idea**. Sisältö, tilat ja paikkojen järjestys ovat
kaikissa suunnissa samat.

| Paikka | A Esineet | B Merkitykset | C Kaksisävy | Nyt |
| --- | --- | --- | --- | --- |
| Etusivu | talo | aurinko ja kaari | talo, runko sävytetty | talo |
| Tuotokset | lokero, jossa sivu | kerrokset | lokero sävytetty | maapallo |
| Oma selain | selainikkuna | osoitin | otsikkopalkki sävytetty | maapallo |
| Agentin käytössä | pistoke | napa | pistokkeen runko sävytetty | kilpi ja ! |
| Selitä | ? ympyrässä | ? puhekuplassa | ? ympyrässä | (vain valikossa) |
| Haku, Uusi keskustelu, Uusi työtila, Asetukset | tuotannon | tuotannon | tuotannon (viivana) | tuotannon |

Erottuvuus mitattiin näin: kuvakerivin viisi kuvaketta rasteroidaan 18 px
kokoon 1x-tiheydellä, ja jokaiselle parille lasketaan, kuinka paljon kuvat
menevät päällekkäin (100 % = sama kuva). Tarkistus epäonnistuu, jos jokin
pari ylittää 50 %.

| Suunta | Lähin pari | Päällekkäin |
| --- | --- | --- |
| A Esineet | Agentin käytössä ja Haku | 35 % |
| B Merkitykset | Tuotokset ja Oma selain | 25 % |
| C Kaksisävy | Etusivu ja Tuotokset | 43 % |
| Nyt | Tuotokset ja Oma selain | 100 % |

Luku mittaa vain kuvien päällekkäisyyttä, ei sitä, kuinka helposti
merkityksen tunnistaa. B:n hyvä luku tulee siitä, että sen muodot ovat
keskenään hyvin erilaisia, ei siitä, että ne olisivat selkeämpiä.

## Tilamerkit

Tilamerkit ovat kaikissa suunnissa samat. Ne jatkavat `rail-space-2`:n
merkintää, eikä mikään niistä ole pelkkä väri:

- **Luku** (Tuotokset, uudet): korostusvärinen pilleri kuvakkeen
  oikeassa yläkulmassa. Ruudussa luku on sanana toisella rivillä (*1 uusi*)
  ja rivillä pillerinä oikeassa reunassa.
- **Agentti työssä** (Oma selain): ok-värinen piste kuvakkeen oikeassa
  alakulmassa. Piste sykkii, paitsi kun käyttäjä on pyytänyt vähemmän
  liikettä. Ruudussa ja rivillä on sana *Agentti työssä*.
- **Odottaa sinua** (Oma selain; Agentin käytössä, kun yhteys odottaa
  kirjautumista): Sinun vuorosi -värinen piste, ja itse kuvake vaihtaa
  samaan väriin. Ruudussa ja rivillä on sana.
- **Selitä päällä**: painike on painettuna korostuspinnalla.
- **Nykyinen paikka**: tuotannon nykyisen rivin pinta ja reunaviiva.

Kuvakerivissä vihje ja saavutettava nimi kertovat saman, esimerkiksi
*Oma selain · odottaa sinua: vahvista kirjautuminen*.

## Mitä näkymä olettaa hostilta

Ei mitään uutta. Uusien tuotosten määrä, selaimen tila (valmiina / agentti
työssä / odottaa sinua) ja keskustelurivit ovat jo tuotannon tietoja.
Agentin käytössä -tila *yhteys odottaa kirjautumista* on uusi esitys. Sen
tieto on jo olemassa (GitHub-yhteyden ilmoitus, `statusItems`), mutta
sivupalkki ei näytä sitä nyt.

## Decisions for later review

- **Agentin käytössä on pistoke eikä avain tai kilpi.** Vaihtoehdot olivat
  avain (*sinun tunnuksesi*), kilpi ilman huutomerkkiä ja napa (B). Valitsin
  pistokkeen, koska sivu luettelee yhteyksiä ja sen painike on *Yhdistä
  palvelu*. Avain on tuotannossa jo täyden oikeuden merkki samalla sivulla,
  joten se olisi saanut kaksi merkitystä.
- **Tuotokset on lokero, jossa on sivu, eikä lähtevä laatikko.** Tuotokset
  sisältää myös vain sinulle annettuja näkymiä. Ylös osoittava nuoli
  (`rail-space-2`) ja maapallo (*julkinen*) kertoisivat vain jaetuista.
- **Selitä sai oman kuvakkeen sivupalkin hyllyyn** henkilövalikon viereen,
  ja se on yhä myös valikossa. Vaihtoehto oli pitää se vain valikossa, kuten
  nyt. Brief pyysi Selitälle kuvaketta, ja ui-structure-2:n paikkarivissä
  sillä oli jo oma painike.
- **Agentin käytössä näyttää odottaa sinua -tilan**, kun jokin yhteys tarvitsee
  kirjautumisen. Vaihtoehto oli jättää se tilarivin kellon varaan. Valitsin
  näin, koska se on sama "sinun vuorosi" -tieto kuin selaimen pyynnössä.
- **Haku, Uusi keskustelu, Uusi työtila ja Asetukset pidettiin tuotannon
  kuvakkeina** kaikissa suunnissa. Ne ovat työkaluja, eivät paikkoja, eikä
  niistä ole ollut sekaannusta.

## Questions for Jari

1. Kelpaako A Esineet, vai haluatko C:n sävytyksen paikoille, jotta ne
   erottuvat työkaluista?
2. Pistoke Agentin käytössä -paikalle: kertooko se sinulle *mitä agentti saa
   käyttää*, vai sopisiko avain (sinun tunnuksesi) paremmin, vaikka se on
   jo täyden oikeuden merkki samalla sivulla?
3. Saako Selitä oman kuvakkeen sivupalkkiin, vai pysyykö se vain
   henkilövalikossa?

## Production implementation — 2026-11-23

The decision in item.md supersedes the prototype questions above. Home keeps A's house; Outputs uses B's layers, Your browser B's pointer, Agent access B's hub, and Explain B's question bubble. All are unfilled 24-unit, 1.8-stroke icons. The shared browser glyph also updates conversation marks and browser cards. Both adaptive and legacy rail paths use the new place icons; the phone drawer shares them. Explain's top-bar and account-menu entries use the same glyph. No switch or new entry point was added; public-link globes and permission shields retain their distinct meanings.

### Checks and review

- Focused web checks passed: lint, TypeScript and 2,185 tests in 258 files.
- Focused browser run: `account-sound-reasons.spec.ts`, `attention-sound.spec.ts`, `dictation-bar.spec.ts`, `rail-place-toggle.spec.ts` — 22 passed; `lab-dictation-hour.spec.ts` — 4 passed. Two workers and reply jitter throughout.
- Changed browser specs also passed `--repeat-each 3`: 12 account-menu cases and 12 dictation cases.
- `generate-ui-reference.py --check`, `git diff --check` and issue metadata validation passed. Regeneration also refreshed pre-existing ServerAccess/serverStorage reference drift in a separate commit; no corresponding runtime change was made here.
- Focused self-review traced every changed icon's callers, menu focus and navigation, persistent sound fixes, and the dictation timer/provider boundaries. No independent model review: this is presentation plus a browser timer, with no session ownership, daemon state implementation, wire contract or authority change.
- One initial combined browser run had a transient `dictation-bar.spec.ts` layout helper `no box`; its focused rerun and the final combined run passed. No test was weakened.

Synthetic paired PNG/HTML evidence and logs are outside git at `/var/tmp/agent-keep/rail-icons-dictation-sounds/`. The `rail-*` captures show all place icons at 1440 and 390 pixels in Finnish and English; the menu and dictation captures also show Explain cards. These are synthetic browser checks, not a deployment or live-provider test.

### Decisions for later review (implementation)

Keep general-purpose globe and shield glyphs unchanged: those still mean a public link or permission, not these navigation places. Use dedicated outputs/access/explain names instead. Home already matched the approved A path, so it needed no change.

## Live check

Compare Home, Outputs, Your browser and Agent access in the desktop rail and phone drawer. Enable the existing browser experiment to see its pointer, then check its conversation-row mark. Open Explain from the top bar and account menu: both use the question bubble. No duotone or new experiment is involved.
