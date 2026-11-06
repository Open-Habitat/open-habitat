# Alarivin valikko puhelimessa, kierros 4

1. **A Valikko**: rivi on yksi painike, ja sen alle aukeaa ⋯:n näköinen valikko. Valikon otsikkona on tila, ja sen alla ovat työtila, Git, konteksti ja malli täysinä. Kun napautat riviä, pääset sen tiedon omaan paikkaan. Valikko sulkeutuu, kun napautat sen ohi tai riviä uudelleen tai painat Esc.
2. **B Alalaatikko**: rivi on yksi painike, ja alhaalta nousee tuotannon Git-laatikko, jossa on kaikki viisi. Ylhäällä on tila, sen alla työtila, konteksti ja malli riveinä ja lopuksi Git kokonaan. Laatikko sulkeutuu ✕:stä, taustasta, kahvasta alas vetämällä tai Esc:llä.
3. **C Omat napit**: rivin jokainen osa on oma painikkeensa ja avaa saman kuin työpöydän siru. Git avaa Git-laatikon, rengas kontekstisivun, malli mallikortin ja nimi työtilan. Jokainen sulkeutuu kuten tuotannossa.

Avaa `alarivin-valikko.html`. Alareunan valitsimesta vaihdat riffiä
(näppäimet 1–4; 4 on **Nyt** eli tuotanto tänään). Yläreunasta valitset
laitteen (puhelin 390 tai työpöytä 1440), teeman, tilanteen
(**Käynnissä** tai **Uusi keskustelu**) ja sen, alkaako riffi auki vai kiinni.

Valitsit 6.11. kierroksen 3 **Alarivin** (`02`). Tila näkyy siinä pelkkänä
pisteenä, eikä työpöytään kosketa. Rivi on kaikissa kolmessa riffissä sama
kuin kierroksen 3 kuvassa 02. Riffit eroavat siinä, mitä napautus avaa, missä
se aukeaa ja miten se sulkeutuu. Jokainen riffi alkaa auki, joten ero näkyy
heti. Näkymä on tuotannon sivu labrasta tallennettuna, ja avautuvat palat ovat
tuotannon omia: ⋯-valikko, puhelimen Git-laatikko, mallikortti ja
kontekstisivu.

## Kaikissa kolmessa

- Työpöytä 1440 on tämän päivän rivi (kuvat `14`, `15`). Siellä jokainen siru
  avaa oman paikkansa kuten nyt.
- ⋯:ssa on vain toimintoja: Avaa työtila, Editori, Pääte, Nimeä uudelleen,
  Luo uusi otsikko, Tee tilannekatsaus nyt, Tiedot ja Arkistoi.
- Paikat ovat samat kuin tänään: Git avaa puhelimen Git-laatikon, konteksti
  kontekstisivun keskustelun tilalle (takaisin-painike palauttaa), malli
  mallikortin alareunaan ja työtila työtilan sivun. Prototyyppi ei siirry
  työtilaan, vaan näyttää ilmoituksen.
- Labra ei tunne mallia eikä osaa kontekstin erittelyä. Kuvissa malli on
  Opus 5.5 · Medium (200k), ja kontekstisivulla lukee, ettei erittelyä voitu
  lukea. Tuotannossa sivulla on erittely.

## Mitä katsoa

- Kuinka monta napautusta tarvitaan. A: rivi näyttää kaikki arvot yhdellä
  napautuksella, ja yksityiskohdat vaativat toisen. B: kaikki on yhdellä
  napautuksella samassa laatikossa, mutta Git vie suurimman osan tilasta.
  C: jokainen yksityiskohta aukeaa yhdellä napautuksella, mutta painikkeet
  ovat pieniä (26 px korkeita, nimi lyhenee `aurin…`-muotoon).
- A:n valikko on samannäköinen kuin ⋯. Alarivi kertoo tiedot ja ⋯ tarjoaa
  toiminnot.
- Uudessa keskustelussa (kuva `03`) malli näkyy sekä rivillä että kentän
  valitsimessa `Opus 5.5 · Medium`.

## Kuvat (`../evidence/`, AVIF, laitteen skaalaus 2, etuliite `r4-`)

- `r4-00-nyt-*`: tuotanto tänään labrassa. `…-git` näyttää puhelimen
  Git-laatikon, jota riffit käyttävät.
- `r4-01`–`04`: A. Puhelin 390 vaalea käynnissä (valikko auki), Git-rivistä
  aukeava Git-laatikko, uusi keskustelu ja tumma.
- `r4-05`–`08`: B. Laatikko auki, malli-rivistä aukeava mallikortti, uusi
  keskustelu ja tumma.
- `r4-09`–`13`: C. Git-napista aukeava Git-laatikko, mallikortti,
  kontekstisivu, uusi keskustelu ja tumma.
- `r4-14`, `r4-15`: työpöytä 1440 vaalea käynnissä ja tumma uusi, sama
  kaikissa riffeissä.
