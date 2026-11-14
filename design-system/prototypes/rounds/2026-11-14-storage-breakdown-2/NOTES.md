# Tallennustila – kierros 2 (B:n muunnelmat)

Issue `storage-warning-no-breakdown`. Kierros 1 on
`../2026-11-14-storage-breakdown/`; sen `NOTES.md` kertoo, mitä host
tarvitsisi (mittaus, välimuistitaulukko, käännöshakemistojen tila,
rajapinta) ja missä Go:n käännösvälimuistin pitäisi olla. Ne pätevät
sellaisinaan. Suunnat, suositus ja katselmoitavat päätökset ovat issuen
`result.md`:ssä.

Jari valitsi B:n (Vapautettavissa) ja pyysi: tavallinen ihminen näkee
oletuksena arkikieliset ryhmät ja koot, kansiot ja polut vasta ryhmän
Näytä tarkemmin -kohdan takana; palkki näyttää, mitä valinta tekee
kokonaisuudelle rajaan ja 85 %:n varoitusrajaan nähden. Akseli: miten
palkki ja valintalista yhdistyvät.

- **B1 Esikatselu:** yksi iso palkki listan yllä. Valittu osa on palkin
  lopussa raidallisena, pystyviiva näyttää, mihin käyttö päätyy, ja yllä
  lukee Nyt → Valinnan jälkeen.
- **B2 Palkkivalinta:** palkin osat ovat valintapainikkeita
  (`aria-pressed`, osittain valittu `mixed`). Pienet osat suurennetaan
  napautettaviksi (työpöydällä vähintään 12 %, puhelimessa 19 %), ja
  varoitusviiva sijoitetaan suurennetulle asteikolle. Puhelimessa osissa on
  vain pyöristetty koko; nimet ovat palkin alla.
- **B3 Ennen ja jälkeen:** kaksi ohutta palkkia, Nyt ja Siivouksen
  jälkeen, yhteenvetona, joka pysyy asetusten vierityksen yläreunassa.
  Tuotannon `.s-card` leikkaa ylivuodon, joten kierros sallii sen B3:n
  kortissa.

Sama kaikissa: ryhmät Ohjelmointityökalujen välimuistit, Valmiiden töiden
jäljet, Omien projektien käännöstiedostot (ei valittu oletuksena) ja
Agentin käynnissä olevat työt (ei valittavissa), Roskakori omana
rivinään linkkinä alempaan tyhjennykseen. Ryhmän valinta valitsee kaikki
sen kansiot; Näytä tarkemmin avaa kansiot polkuineen ja yksittäisine
valintoineen. Varoituksen ja kortin painike avaa sijaiskeskustelun
valinnasta kootulla pyynnöllä kuten kierroksessa 1.

Sivu on tuotannon kehys ja `AccountSettings` (Worktreet, Roskakori)
synteettisillä vastauksilla, ja kortti on koottu tuotannon palasista
(`WarningBannerView`, `ControlButton`, `Checkbox`, `Select`, `TextArea`,
`StatusMark`, `Icon`, `ah-trash-*`-luokat) tokenien päälle.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-storage-breakdown-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-14-storage-breakdown-2/check.mjs \
  design-system/prototypes/dist/storage-breakdown-2/offline.html <kuvahakemisto>
```

Tarkistus käy kolme muunnelmaa ja neljä tilannetta 1440 ja 390 px:n
leveydellä vaaleana ja tummana: ei ylivuotoa, oletusnäkymässä ei polkuja,
varoitusviiva palkissa, jälkeen-luku ja tuomio (yli 85 %:n tilanteessa
oletusvalinta vie alle rajan, jaetulla levyllä ei). Sitten se klikkaa
jokaisessa muunnelmassa ryhmän pois ja takaisin, Näytä tarkemmin, yhden
kansion pois (ryhmä osittain valittu) ja pyynnön, B1:ssä varoituksen
painikkeen, uudelleenmittauksen, omien käännösten valinnan, tyhjän
valinnan ja ensimmäisen mittauksen pyynnön, B3:ssa vierityksen ja lopuksi
englannin. Konsoli on puhdas.
