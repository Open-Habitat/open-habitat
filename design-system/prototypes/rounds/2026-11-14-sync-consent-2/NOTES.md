# Synkronoinnin pysähdys keskustelussa – kierros 2

> **Saatesanat.** Tämä on prototyyppikierroksen työohje: miten sivu
> rakennetaan ja tarkistetaan, ja mitä palvelimen pitäisi osata, jotta
> näytetty toimisi oikeasti. Suunnat, suositus (A Kortti) ja kysymykset
> sinulle ovat issuen `bisync-force-needs-consent` `result.md`:ssä, eikä
> täältä tarvitse päättää mitään erikseen.
> Tarkistettavaa on yksi asia: alla oleva "Mitä palvelimen pitäisi osata"
> on kokonaan ehdotusta. Sinä olet päättänyt vain, että synkronointi ei
> jatka itse, että ihminen näkee laskelman ja antaa luvan yhteen ajoon, ja
> että tämä tapahtuu keskustelussa, jossa agentti aiheutti muutoksen.
> Erottelu päätetyn ja ehdotetun välillä on `result.md`:n lopussa.

## Mitä sivu näyttää

Sivu on tuotannon keskustelunäkymä tuotannon komponenteista. Kierroksen omia
paloja ovat Habitatin kortti (A, B), Habitatin rivi agentille (B), rivi
kentän yllä (C) sekä kierroksen 1 (`2026-11-14-sync-consent`) laskelma,
ikkuna ja painikkeet. C käyttää `Composer`in `beforeField`-paikkaa, jossa
tuotanto pitää taustatyön palkkia. Aiheuttaneen keskustelun rivillä on
tuotannon `attentionLabel`-merkki.

Kaksi keksittyä tapausta: `few` on keskustelu, jossa agentti muokkasi 14
muistiinpanon otsikot ja lisäsi 2 pohjaa. `many` on keskustelu, jossa agentin
`mv` siirsi 212 raporttia kansion sisällä, jolloin OneDrive näkee 212 poistoa
ja 212 uutta tiedostoa.

Alkutilan valitsevat
`?s=pysahtyi|lasketaan|laskettu|kaynnissa|valmis|torjuttu|epaonnistui|muualla|eikeskustelua`,
`?data=few|many` ja `?theme=dark`.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-sync-consent-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-14-sync-consent-2/check.mjs \
  design-system/prototypes/dist/sync-consent-2/offline.html <kuvahakemisto>
```

`web/node_modules` asennetaan lukitiedoston mukaan (`npm ci --prefix web`).
Tarkistus käy kolme suuntaa, yhdeksän tilannetta ja molemmat tapaukset 1440
ja 390 px:n leveydellä vaaleana ja tummana. Se klikkaa jokaisessa suunnassa
laskelman, jatkamisen, perumisen, torjunnan ja paljon poistoja -polun sekä
Kysy agentilta -luonnoksen, kellon, sivupalkin merkin, varapaikan ja
englannin, ja vaatii puhtaan konsolin.

## Mitä palvelimen pitäisi osata (ehdotus)

Kierroksen 1 `NOTES.md` kuvaa laskelman ja sen, miten lupa sidotaan
laskelmaan; ne ovat tässä samat. Tämä kierros lisää kolme asiaa.

### Mikä keskustelu aiheutti pysähdyksen

Daemon lukee jo keskustelujen natiivihistoriaa. Kun synkronointi pysähtyy,
se etsii saman käyttäjän keskusteluista kirjoituksia synkronoituun kansioon
edellisen onnistuneen ajon jälkeen:

- `edit`- ja `write`-kutsu, jonka polku on kansion sisällä, on varma.
- `bash`-kutsu, jonka työhakemisto on kansiossa tai jonka komento nimeää
  kansion, on vain todennäköinen: komento voi kirjoittaa minne tahansa.

Pysähdys liitetään keskusteluun, kun sen kirjoitukset selittävät kansion
muutokset kokonaan tai lähes. Jos keskusteluja on kaksi, kortti tulee siihen,
jolla on enemmän osumia, ja sanoo "tämän ja toisen keskustelun". Kun muutos
tuli muualta (toinen laite, OneDriven selainkäyttö, ihmisen oma pääte, agentti,
jonka historiaa daemon ei lue) tai osumat ovat pelkkiä epävarmoja
`bash`-kutsuja, pysähdystä ei liitetä mihinkään ja käytetään varapaikkaa:
kello ja tilin kortti Asetuksissa. Väärään keskusteluun liitetty kortti
kertoisi ihmiselle väärän syyn, joten epävarmassa tapauksessa ei arvata.

Liitos on daemonin muistissa oleva havainto, kuten pysähdyskin, eikä sille
tehdä tallennetta: uudelleenkäynnistyksen jälkeen seuraava ajo pysähtyy taas
ja liitos lasketaan historiasta uudelleen. Selain saa sen snapshotin
integraatiotilassa (keskustelun tunniste, varmuus ja vuoro, jonka jälkeen
kortti näytetään). Kentät määritellään skeemassa `contracts/v1/`, kun tämä
toteutetaan.

### Miten selain näyttää sen

A:ssa selain lisää kortin aikajanalle aiheuttaneen vuoron jälkeen. Kortti on
Habitatin tilaa eikä keskustelun historiaa: se näkyy niin kauan kuin pysähdys
on voimassa ja sen jälkeen yhden rivin kuittauksena, kunnes keskustelu
avataan uudelleen. Sivupalkin merkki ja kellon kohta tulevat samasta
tiedosta.

### Mitä agentti saa tietää ja tehdä

A:ssa ja C:ssä Habitat ei kerro agentille mitään. Kysy agentilta kirjoittaa
kenttään viestin, jonka ihminen lähettää tai jättää lähettämättä.

B:ssä daemon kertoo pysähdyksestä keskustelun agentille samaa tietä kuin
taustaprosessin päättymisestä (`process-extension.mjs`, `wake_linux.go`).
Työssä oleva agentti saa viestin kesken vuoron. Odottava agentti herää omaan
vuoroonsa, enintään kerran pysähdystä kohden. Jos agentti ei ole käynnissä,
B toimii kuten A. Viesti näkyy aikajanalla Habitatin rivinä.

Agentti saa pyytää laskelman ja selittää sen ja oman osuutensa. Luvan
jatkaa antaa tässä kierroksessa vain kortin painike: agentti ei pyydä
pakotettua ajoa, vaikka ihminen vastaisi keskustelussa kyllä, vaan kertoo,
että painike on kortissa. Kierros 1 salli agentille tämän; kumpi jää
voimaan, on `result.md`:n kysymys 2.

Tämä on tuotteen tapa kysyä, ei turvaraja. Agentti ajaa samana
Unix-käyttäjänä kuin daemon ja voisi ajaa synkronointityökalun itse, eikä
daemon erota selaimen painiketta agentin kutsusta. Valtarajat eivät muutu:
kaikki tapahtuu käyttäjän omassa daemonissa, gateway välittää komennot kuten
muutkin integraatiokomennot, eikä provision ole mukana.
