# Selitystila: kortti seuraa osoitinta

Jari 22.11.: selityskortti on selatessa tiellä. Kokeillaan, että kortti
seuraa osoitinta koko ajan eikä jää paikalleen, vaikka osoitin menisi sen
päälle. Vain F kiinnittää kortin, ja F avaa samalla ilmoituskentän.
Napsautus ei avaa ilmoitusta.

Akseli: **miten seuraava kortti pysyy poissa tieltä.**

- **A Vierellä**: kortti kulkee osoittimen vieressä alaoikealla ja
  kääntyy reunoilla toiselle puolelle. Se kääntyy takaisin vasta, kun
  tilaa on reilusti, ettei se välky reunaa pitkin.
- **B Väistää** (suositus): kortti on osoitetun kohdan vieressä,
  ensisijaisesti sen alla siinä kohdassa, josta osoitin tuli kohtaan.
  Kun osoitin lähtee kohdasta korttia kohti, kortti liukuu kohdan toiselle
  puolelle. Saman kohdan sisällä teksti pysyy paikallaan. Iso kohta, kuten
  vastaus, saa kortin sisäänsä tulokohdan viereen.
- **C Kulma**: kortti on paneeli näkymän alakulmassa, ja vain sen sisältö
  vaihtuu. Osoitetun kohdan kulmassa on pieni ?-merkki, ja sama merkki on
  paneelin yläreunassa. Kun osoitin tulee paneelin lähelle, paneeli vaihtaa
  kulmaa.

Sama kaikissa suunnissa:

- Kortti ei koskaan ota osoitinta, ellei se ole kiinni: osoitin kortin
  päällä osoittaa sitä, mikä on kortin alla. Siksi kortissa ei ole
  ilmoituspainiketta, vaan muistutus *Ilmoita virheestä · Paina F*.
- **F** kiinnittää kortin ja avaa kentän kohdistettuna. Kiinni oleva kortti
  pysyy paikallaan muiden kohtien päällä ja ottaa osoittimen. Tyhjä
  lähetys pyytää ensin tekstiä. Napsautus muualle irrottaa tyhjän
  ilmoituksen, mutta ei hukkaa kirjoitettua tekstiä (kortti nytkähtää ja
  pyytää lähettämään tai perumaan).
- **Esc** irrottaa kortin ja hylkää kirjoittamattoman ilmoituksen. Toinen
  Esc lopettaa tilan. Lähetetty kortti päästää irti, kun osoitin lähtee
  siltä alueelta, jolla ilmoitus oli.
- Napsautus kohtaan toimii kuten aina (prototyypissä ilmoitus kertoo, mitä
  napsautus tekisi), eikä se koskaan avaa ilmoitusta.
- **Vähemmän liikettä** (järjestelmän asetus tai katselmointipalkin
  Liike-valinta): ei liukumia eikä perässä kulkemista. A siirtää korttia
  vain, kun osoitettu kohta vaihtuu tai kun osoitin muuten menisi kortin
  alle. B ja C hyppäävät suoraan uuteen paikkaan.
- **Näppäimistö**: Tabilla kohdistettu kohta selittää itsensä, ja kortti
  asettuu kohdan mukaan (A kohdan alle, B kuten osoittimella, C kulmaan).
  F kiinnittää ja vie kohdistuksen kenttään. Tekstikentässä F kirjoittaa
  F:n; sieltä pääsee Tabilla pois. Pelkät tietokohdat, jotka eivät ole
  kohdistettavissa (esimerkiksi tilamerkki), eivät tavoita näppäimistöä
  tässäkään mallissa.

## Puhelin ja kosketus

Kosketusnäytöllä ei ole osoitinta, jota seurata, eikä F-näppäintä.
Prototyyppi tekee saman kuin tuotanto nyt: ensimmäinen napautus selittää
kohdan, toinen tekee sen. Kortti on suunnasta riippumatta arkki näytön
alareunassa, siinä on sulkemisrasti ja **Ilmoita virheestä** on
painike, joka kiinnittää kortin ja avaa kentän. Arkki ei peitä napautettua
kohtaa, joka jää korostettuna näkyviin sen yläpuolelle. Seuraaminen
koskee siis vain osoitinlaitetta; valittu suunta ei muuta puhelinta.

## Näkymä ja lähteet

Näkymä on synteettinen Habitat: sivupalkki (palvelin, haku, Sinun vuorosi,
Käynnissä, Hiljaiset, työtilat, tilivalikko), keskustelun yläpalkki,
keskustelu työvaiheineen ja koodilohkoineen sekä alakerta taustatyön
merkkeineen. Noin neljäkymmentä kohtaa kantaa tuotannon korttitunnuksensa,
joten korttien tekstit tulevat tuotannon `text/explainMode.ts`:stä ja lajit
ja odottavat painallukset `explainParts.ts`:stä. Kortin, kerroksen ja
palkin ulkoasu on tuotannon `ExplainMode.css`. Osumantunnistus on
kierroksen `2026-11-21-explain-feedback-3` kopio tuotannon
`ExplainLayer`ista (pienin näkyvä kohta osoittimen alla, viipyminen tyhjän
kohdan päällä).

Katselmointipalkki: teema (Päivä/Yö), kieli, Liike (järjestelmän mukaan /
vähemmän liikettä) ja Alusta. `?v=1|2|3`, `?theme=dark`, `?lang=en` ja
`?motion=less` valitsevat alkutilan. Kun tila on lopetettu, yläpalkin `?`
avaa sen uudelleen.

Issue `explain-card-follows-pointer`; suositus ja kysymykset ovat sen
`result.md`:ssä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-explain-follow/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-explain-follow/check.mjs \
  design-system/prototypes/dist/explain-follow/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-follow/`:een
`offline.html`:n, jossa fontit ovat upotettuina, ja `index.html`:n ilman
fontteja. `check.mjs`:n alussa kerrotaan, mitä se tarkistaa.
