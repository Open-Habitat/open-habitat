# Synkronoinnin pysähdys ja lupa – kierros 3

> **Saatesanat.** Tämä on kierroksen työohje: miten sivu rakennetaan ja
> tarkistetaan, ja mitä palvelimen pitäisi osata, jotta näytetty toimisi
> oikeasti. Suunnat, suositus ja kysymykset sinulle ovat issuen
> `bisync-force-needs-consent` `result.md`:ssä.
> Kohta "Mitä palvelimen pitäisi osata" on ehdotusta. Siitä sinä olet
> päättänyt vain sen, että lupa on Habitatin kortin painike ja sidottu
> laskelmaan, että agentti saa tuoda kortin komennolla mutta ei anna lupaa,
> ja että liikaa poistoja -pysähdys saa saman kortin.

## Mitä sivu näyttää

Sivu on tuotannon keskustelunäkymä tuotannon komponenteista, kuten
kierroksella 2. Kierroksen omia paloja ovat Habitatin kortti, sen laskelma,
nimilista (C), kuittausrivi ja varapaikan ikkuna.

Valitsimen kolme suuntaa ovat saman kortin kolme muotoa (akseli: miten kortti
vie pysähdyksestä lupaan): **A Pyynnöstä**, **B Valmiina** ja **C Nimeltä**.
Yläpalkin valinnat ovat yhteisiä kaikille suunnille:

- *Tilanne*: pysähtyi, lasketaan, laskettu, jatketaan, valmis, peruttu,
  torjuttu, epäonnistui, kysymyksen 4 myöhäinen poisto, toinen keskustelu
  auki ja varapaikka (mikään keskustelu ei aiheuttanut).
- *Pysähdys*: kaikki tiedostot muuttuivat ilman poistoja (`few`), kaikki
  muuttuivat ja 3 poistettiin (`mixed`), liikaa poistoja eli 212/240
  siirrettyä (`moved`).
- *Kortin tuo*: Habitat itse, agentti komennolla, tai agentti sen jälkeen,
  kun ihminen vastasi sille "kyllä".
- *Kysymys 4*: pakotettu ajo ei voi poistaa, kun laskelmassa ei ollut
  poistoja (suositus), tai voi poistaa kuten nyt.
- Kaksi simulaatiota: tiedosto muuttuu laskelman jälkeen, ja OneDrivessa
  poistetaan 150 tiedostoa juuri ennen ajoa.

Neljä *Näytä*-painiketta vie suoraan briefin neljään kohtaan, ja jokaisen
alla on rivi siitä, mikä tilanteessa eroaa. Alkutilan valitsevat myös
`?s=<tilanne>`, `?data=few|mixed|moved`, `?origin=habitat|agent|yes`,
`?q4=safe|open` ja `?theme=dark`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-16-sync-consent-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-16-sync-consent-3/check.mjs \
  design-system/prototypes/dist/sync-consent-3/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/sync-consent-3/`:aan
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja,
Glasspadin hiekkalaatikkoa varten). Tarkistus käy kolme suuntaa kaikissa
tilanteissa, pysähdyslajeissa ja kortin tuojissa 1440 ja 390 px:n
leveydellä vaaleana ja tummana, klikkaa jokaisen suunnan polut (laskelma,
jatkaminen, kuittausrivi, peruminen, torjunta ja uusi laskelma, valintaruutu,
C:n nimilista, kysymys 4 molemmin päin, Kysy agentilta, kello, sivupalkki,
varapaikan ikkuna, englanti, puhelimen polku) ja vaatii puhtaan konsolin.
`--quick` ajaa vain 1440 px vaalean.

## Mitä palvelimen pitäisi osata (ehdotus)

Kierrosten 1 ja 2 `NOTES.md`:t kuvaavat laskelman (kuivaharjoitus), luvan
sitomisen laskelmaan ja keskustelun tunnistamisen historiasta. Ne pätevät
yhä, ja tämä kierros lisää tai muuttaa seuraavat. Valtarajat eivät muutu:
kaikki tapahtuu käyttäjän omassa daemonissa, gateway välittää selaimen
komennot kuten muutkin integraatiokomennot, eikä provision ole mukana.

### Kortti on daemonin tilaa, ei keskustelun historiaa

Pysähdystä kohden on yksi kortti. Daemon pitää muistissaan pysähdyksen,
keskustelun, johon kortti kuuluu, ja vuoron, jonka jälkeen kortti näytetään.
Kun Habitat liittää pysähdyksen keskusteluun itse, kortti tulee aiheuttaneen
vuoron jälkeen. Kun agentti tuo kortin, se tulee komennon ajaneen vuoron
jälkeen. Jos kortti oli jo toisessa kohdassa, se siirtyy sinne, eikä
keskustelussa ole koskaan kahta lupakorttia samalle pysähdykselle. Snapshot
kertoo selaimelle kortin paikan, vaiheen ja laskelman, ja kentät
määritellään skeemassa `contracts/v1/`, kun tämä toteutetaan. Mitään ei
tallenneta: uudelleenkäynnistyksen jälkeen seuraava ajo pysähtyy taas ja
kortti palaa.

### Agentin komento `open-habitat agent sync request-consent`

```
open-habitat agent sync status <kansio>
open-habitat agent sync request-consent <kansio> --current
```

`status` kertoo, onko synkronointi pysähdyksissä ja miksi
(`all_files_changed` tai `delete_limit`). `request-consent --current` pyytää
daemonia näyttämään pysähdyksen kortin siinä keskustelussa, jossa komento
ajetaan. Keskustelu tunnistetaan samoin kuin
`open-habitat agent conversation show --current`:ssa: daemonin
käynnistämä Pi saa ympäristöön `OPEN_HABITAT_CONVERSATION_ID`:n,
`OPEN_HABITAT_WORKSPACE_ID`:n ja `OPEN_HABITAT_LAUNCH_GENERATION`:n, ja
ilman niitä komento epäonnistuu (`current_context_unavailable`). Tuloste on
CLI:n JSON-kirjekuori, joka sanoo, että kortti näytettiin ja että lupa on
ihmisen (`"consent": "person_only"`).

Komento ei laske eikä jatka mitään itse, eikä sillä ole lupaa vastaavaa
muotoa: lupa syntyy vain selaimen kortin painikkeesta, jonka gateway
välittää ihmisen istunnolta. Agentin ohjeeseen
(`internal/daemon/integrations/skill_linux.go`) lisätään, että pysähdyksen
selitys kuuluu agentille ja lupa kortille, ja että "kyllä" keskustelussa ei
ole lupa: agentti tuo kortin uudelleen ja kertoo, että painike on siinä.

Tämä on tuotteen tapa kysyä, ei turvaraja, kuten kierroksella 2. Agentti
ajaa samana Unix-käyttäjänä kuin daemon ja voisi ajaa synkronointityökalun
itse. Ero on siinä, että tuote ei tarjoa agentille tietä lupaan, ja ohje
sanoo, miksi.

Sama malli (agentti tuo Habitatin kortin, ihminen päättää painikkeella)
on Jarin mukaan ehdokas myös tilanteeseen, jossa työntekijäagentti kysyy
lupaa vanhemmaltaan. Sitä ei suunnitella tässä.

### Liikaa poistoja -pysähdys

bisync pysähtyy omalla tarkistuksellaan (`--max-delete 50`), kun ajo
poistaisi yli puolet toisen puolen tiedostoista. Habitat ei koskaan jatka
sitä itse (`DeleteLimit`, `passes_linux.go`). Ehdotus: sama kortti ja sama
lupa kuin "kaikki muuttuivat" -pysähdyksellä. Erot:

- Kortti sanoo määrän jo pysähtyessä ("olisi poistanut 212 tiedostoa
  240:stä"), koska bisyncin keskeytys kertoo sen.
- Laskelmassa on vahva varoitus, valintaruutu "Poistot ovat
  tarkoituksellisia" ja vaarallinen painike, joka nimeää määrän
  ("Poista 212 ja jatka").
- Pakotettu ajo ohittaa poistorajan vain tämän luvan verran ja vain, jos
  uusi laskelma on sama (kuten kierroksen 1 sitominen).

Kun poistoja on vähän ("kaikki muuttuivat, 3 poistoa"), poistot nimetään
lauseessa ja painikkeessa ("Poista 3 ja jatka") ilman valintaruutua.

### Laskelma pysähdyshetkellä (suunta B)

B:ssä daemon tekee kuivaharjoituksen heti, kun se havaitsee pysähdyksen,
ja kortti tulee laskelman kanssa. Luvan hetkellä daemon laskee uudelleen ja
vertaa. Jos jokin muuttui, ajoa ei tehdä ja kortti näyttää uuden laskelman
ja uuden painikkeen samalla kertaa. Jos laskelma epäonnistuu (esimerkiksi
verkko on poikki), kortti näyttää pysähdyksen ja *Laske uudelleen*
-painikkeen kuten A. A ja C laskevat vasta pyynnöstä, kuten kierroksella 2.

### Kysymys 4: ajo, joka ei voi poistaa

Nyt pakotettu ajo käyttää `--force`a, joka ohittaa molemmat bisyncin
tarkistukset. Laskelman tarkistuksen ja ajon välissä on muutama sekunti,
jona OneDrivessa tehty joukkopoisto menisi ajon mukana Habitatiin.
Ehdotus: kun hyväksytyssä laskelmassa ei ollut poistoja, pakotettu ajo
ajetaan tilassa, jossa se ei voi poistaa mitään kummaltakaan puolelta.
Myöhempi poisto jää seuraavalle tavalliselle ajolle, joka pysähtyy taas,
jos poistoja on paljon. Sivulla tämä näkyy kahdessa kohdassa: laskelma ja
käynnissä oleva ajo sanovat "tämä ajo ei voi poistaa tiedostoja", ja
myöhäisen poiston tapauksessa kuittaus kertoo, että poistot jäivät
odottamaan, ja kello näyttää uuden pysähdyksen.

Toteutustapa on tarkistamatta. bisyncin `--max-delete` on prosenttiraja,
jonka `--force` ohittaa, joten tarvitaan joko bisyncin oma tila, joka
estää poistot pakotetussakin ajossa, tai pakotetun ajon korvaaminen
kahdella yksisuuntaisella kopiolla, jotka eivät poista, ennen kuin
tavallinen ajo jatkuu. Tämä pitää kokeilla oikealla rclonella ennen kuin
suositus kirjataan päätökseksi. Laskelmalle, jossa oli poistoja, suoja ei
päde, koska ajon on saatava poistaa. Siinä jäännösikkuna jää, ja kortti
näyttää sen rehellisesti, jos ajo poisti enemmän kuin laskelma sanoi.
