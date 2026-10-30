# Työtilan kuvake: kokeiluohje

Avaa `tyotilan-kuvake.html`. Se toimii offline-tilassa, ja fontit ja tokenit
on upotettu. Suunta valitaan alareunan valitsimesta (*Hymiö*, *Monogrammi*,
*Lähdeketju*), näppäimillä 1–3 tai nuolinäppäimillä. Yläpalkissa vaihdetaan
näkymä (*Työpöytä*, *Kaistale + editori*, *Puhelin*) ja teema. *Alkutila*
peruu tekemäsi vaihdot.

Data on keksittyä, mutta repot ovat sinun: kuvakkeina ovat oikeat
`.workmux.yaml`-hymiöt, ja logot ovat niiden kolmen repon oikeat
`favicon.svg`-tiedostot, joilla sellainen on. Ilman hymiötä ovat
`tailspin-monorepo`, `4dcube-monorepo`, `ergona-monorepo`,
`kunnollavauhtiin-monorepo` ja `muistiinpanot`. Samankaltaisia nimiä
ovat `issuectl`, `intakectl` ja `tailspin-monorepo`, ja viisi
`*-monorepo`-nimeä.

## Mitä kannattaa katsoa

1. **Käynnissä ilman otsikkoriviä.** Kuvakaappauksesi *open-habitat 1* on
   poissa. Katso, erottuvatko ryhmät pelkästä kuvakkeesta, kun intakectl,
   issuectl ja tailspin ovat peräkkäin.
2. **Sinun vuorosi.** Nyt riviltä ei näe, mihin työtilaan se kuuluu.
   Kuvakkeen kanssa näkee.
3. **Mistä koko nimi löytyy.**
   - Hymiö: vie osoitin emojin päälle. Puhelimessa nimi on rivin toisena
     rivinä.
   - Monogrammi: vie osoitin tunnuksen päälle, jolloin tunnus avautuu
     nimeksi. Puhelimessa napauta tunnusta.
   - Lähdeketju: klikkaa kuvaketta. Kortissa ovat nimi, kuvakkeen lähde,
     *Avaa työtilasivu* ja *Vaihda kuvake…*. Puhelimessa sama avautuu
     alapaneelina.
   - Kaikissa: työtilasivu ja keskustelun yläpalkki näyttävät nimen.
     Kaistaleessa nimi näkyy työkaluvihjeenä.
4. **Kuvakkeen vaihto.** Klikkaa Työtilat-listasta työtilaa (esimerkiksi
   `tailspin-monorepo`) ja sitten työtilasivun isoa kuvaketta tai kynää.
   - Hymiö kirjoittaa repoon `.workmux.yaml`-tiedostoon. Tallennuksen
     jälkeen sivu näyttää tiedoston muuttuneena Gitissä. Kokeile valita
     emoji, joka on jo toisella työtilalla. Vihje kertoo, kenen se on, ja
     johdettu kuvake siirtyy toiselle.
   - Monogrammi: kirjaimet, väri ja `open-habitat`-repossa logo tai
     kirjaimet. Tallennus menee `.agent-host/workspace.json`-tiedostoon tälle
     palvelimelle.
   - Lähdeketju: valitse automaattinen tai jokin ehdokas (hymiö, logo,
     kirjaimet tai oma hymiö). Tallennus menee
     `.agent-host/workspace.json`-tiedostoon.
5. **Kaistale editorin vieressä.** Vertaa nykyiseen, jossa lukee 3M, 4M, IM,
   EM, KM ja FM.

## Suositukseni lyhyesti

Hymiö. Se luetaan `.workmux.yaml`-tiedostosta ja muuten johdetaan nimestä.
Vaihto kirjoitetaan `.workmux.yaml`-tiedostoon vain, jos hymiö on jo siellä,
ja muuten Open Habitatin omaan `.agent-host/workspace.json`-tiedostoon.
Perustelut ja avoimet kysymykset ovat issuen `result.md`:ssä.
