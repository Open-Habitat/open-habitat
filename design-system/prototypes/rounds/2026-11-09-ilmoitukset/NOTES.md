# Ilmoitukset – kierros 1: yksi järjestelmä varoituksille ja ilmoituksille

- **Nyt**: jokainen tilanne omalla tavallaan: punainen varoitus, paljas punainen rivi, harmaa rivi joka katoaa, laatikko aikajanalla, katkoviivakupla.
- **A Kentän yllä**: kaikki tämän keskustelun ilmoitukset yhdessä pinossa viestikentän yllä, vakavin ensin, kaksi näkyvissä; koko tilin asiat palkkina ylhäällä.
- **B Asian luona**: sama varoitus sen vieressä, mitä se koskee: viestin alla, liiterivillä, workerien rivillä; koko tilin asiat palkkina ylhäällä.
- **C Yksi rivi**: viestikentän yllä yksi rivi, vakavin ensin ja montako muuta; Näytä avaa kaikki. Koko tilin asiat ovat kellossa.

Issue `proto-notices-one-system` (Jari 9.11.). Kaikissa suunnissa on sama
järjestelmä: neljä lajia (`WarningBanner`in sävyt), yksi ilmoitus asiaa
kohden ja ilmoitus, joka elää niin kauan kuin asia on totta. Suunnat
eroavat yhdellä akselilla: missä keskustelun ilmoitukset ovat.

*Tapaus*-valinta käy läpi oikeat tapaukset. Oletus on *Kaikki kerralla*,
eli 9.11. aamu yhtä aikaa: epävarma lähetys, historia, jota ei saada,
liian suuri liite, vanhentunut Claude-kirjautuminen ja worker, joka
odottaa. *Lähetys epävarma* -tapauksessa kentässä on *ping*. Enter
lähettää sen: Nyt-näkymässä tulee tuotannon oma kuuden sekunnin harmaa
rivi, ja suunnissa sama tieto lisätään epävarman viestin ilmoitukseen.

Nyt-näkymä on tuotannon markup: `WarningBanner`, `InlineNotice`,
`WaitingMessage`, `AISignInWarning`, `BackgroundStrip` ja tuotannon
`Composer`, jonka lähetys on estetty samalla syyllä kuin Jarin
tapauksessa. Tekstit luetaan tuotannon katalogeista. Paljas liiterivi ja
`ah-status-check`- ja `ah-conversation-notices`-kääreet on kopioitu
`Composer`ista ja `BrowserConversation`ista, koska ne eivät ole omia
komponenttejaan. Kaikissa suunnissa ilmoitus on tuotannon `WarningBanner`.
Kierroksen omaa on vain pinon *Näytä 1 muu ilmoitus* -linkki ja C:n
määräsiru.

`round.css`:n lopussa on kirjastoehdotus ohituksena. Puhelimessa yksinäinen
×-painike pysyy otsikon rivillä eikä vie omaa täyttä riviään, ja
yksirivinen ilmoitus pitää painikkeensa tekstin vieressä (sama löydös kuin
kierroksessa `2026-11-08-liitteen-torjunta`).

## Rakentaminen ja tarkistus

Aja kertakäyttöisessä checkoutissa, jossa on `web/node_modules`
commitoidusta lukosta.

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 290
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
