# Selitystila: missä F muistuttaa ilmoituksesta

Jari 22.11.: kierros `2026-11-22-explain-follow` valitsi A Vierellä
-kortin, joka kulkee osoittimen vieressä eikä koskaan ota osoitinta. Siksi
ilmoitus avataan F:llä, ja jokaisen kortin alarivillä oli muistutus
*Ilmoita virheestä · Paina F*. Se voi olla liikaa. Tällä kierroksella
kokeillaan, missä ja milloin F-vihje näkyy.

Akseli: **missä ja milloin F-vihje näkyy.**

- **A Palkissa**: kortissa ei ole muistutusta. Vihje on vain
  selitystilan palkissa näppäinmerkkinä: `[F] Ilmoita virheestä`.
- **B Alussa** (suositus): selitystilan kolme ensimmäistä eri korttia
  näyttävät muistutusrivin. Neljännessä kortissa riviä ei enää ole, ja
  palkin merkki nyökkää kahdesti, jotta silmä löytää, mihin vihje siirtyi.
  Kortti, jossa rivi jo oli, näyttää sen yhä saman istunnon ajan. Kun F:ää on
  kerran käytetty, riviä ei näytetä enää koskaan (muisti on selaimessa).
  Katselmointipalkin *Kokeilija*-valinta vaihtaa ensikertalaisen ja F:ää jo
  käyttäneen välillä.
- **C Viipyessä**: rivi ilmestyy korttiin vasta, kun osoitin tai
  näppäimistön kohdistus on levännyt samassa kohdassa 0,9 sekuntia
  (alle 6 px:n liike lasketaan levoksi). Rivi häivyttää itsensä esiin ja
  häviää, kun kohta vaihtuu.

Sama kaikissa suunnissa:

- Kortti on edellisen kierroksen A: alaoikealla osoittimen vieressä,
  kääntyy reunoilla, ei koskaan ota osoitinta ennen kuin F kiinnittää sen.
  F avaa ilmoituskentän, napsautus ei avaa ilmoitusta, Esc irrottaa ja
  toinen Esc lopettaa tilan.
- Palkissa on aina `[F] Ilmoita virheestä`. Se on ainoa näkyvä paikka,
  joka on aina olemassa, kun kortin rivi puuttuu. Kun kortti on kiinni,
  palkki kertoo Esc:stä eikä F:stä.
- **Ruudunlukija**: kortti on elävä alue (`aria-live="polite"`), ja sen
  lopussa on näkymätön rivi "F: ilmoita virheestä tässä selityksessä."
  kaikissa suunnissa. Näkyvä rivi on piilotettu ruudunlukijalta, jottei
  sama asia kuulu kahdesti. Rivi on viimeisenä, joten sen voi keskeyttää.
- **Näppäimistö**: Tabilla kohdistettu kohta selittää itsensä. B laskee
  kohdistetut kortit samoin kuin osoitetut, ja C:ssä rivi tulee, kun
  kohdistus lepää.
- **Kosketus**: F-näppäintä ei ole. Arkki on kuten ennen, ja siinä on
  oikea **Ilmoita virheestä** -painike kaikissa suunnissa. Palkissa ei ole
  F-merkkiä, eikä riviä näytetä.
- **Vähemmän liikettä**: C:n rivi ilmestyy ilman häivytystä, eikä B:n
  palkkimerkki nyökkää.

## Näkymä ja lähteet

Näkymä, osumantunnistus ja kortin sijoittelu ovat kierroksen
`2026-11-22-explain-follow` omia, ja B:n ja C:n sijoittelu on poistettu.
Korttien tekstit tulevat tuotannon `text/explainMode.ts`:stä ja ulkoasu
tuotannon `ExplainMode.css`:stä. Palkin perusvihje on tuotannon
`bar.hint`.

Katselmointipalkki: teema, kieli, Liike, B:ssä Kokeilija, ja Alusta.
`?v=1|2|3`, `?theme=dark`, `?lang=en`, `?motion=less` ja `?learned=1`
valitsevat alkutilan.

Issue `explain-f-reminder`; suositus ja kysymykset ovat sen `result.md`:ssä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-explain-f-reminder/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-explain-f-reminder/check.mjs \
  design-system/prototypes/dist/explain-f-reminder/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-f-reminder/`:een
`offline.html`:n, jossa fontit ovat upotettuina, ja `index.html`:n ilman
fontteja. `check.mjs`:n alussa kerrotaan, mitä se tarkistaa.
