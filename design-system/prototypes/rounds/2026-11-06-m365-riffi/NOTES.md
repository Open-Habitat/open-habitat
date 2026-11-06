# Microsoft 365: aseta tunnukset – kierros 2 (riffit A:sta)

Issue `proto-m365-setup-flow`. Jari valitsi kierroksella 1
(`../2026-11-06-m365-asetus/`) suunnan **A Lista**. Tällä kierroksella on
kolme riffiä siitä. Kaikki pitävät A:n luettavat rivit (yksi Entran kenttä
riviään kohden, arvo ja kopio) ja oikeudet yksi kerrallaan omilla
kopioillaan ja rasteillaan. Näkymä on Asetukset › Palvelinintegraatiot ja
Microsoft 365:n *Aseta tunnukset…* rekisteröinnistä tallennukseen, työpöydällä
(1440) ja puhelimessa (390), vaaleana ja tummana. Kaikki on synteettistä:
sivulta ei lähde pyyntöjä.

## Suunnat yhdellä rivillä

- **A1 Valikkopala**: A:n neljä vaihetta, ja jokaisen vieressä pala Entran oikeaa sivua, jossa tehtävän valikkorivi tai välilehti on korostettu.
- **A2 Valikon järjestyksessä**: yksi jatkuva tarkistuslista, joka kulkee sovelluksen vasemman valikon kohdat ylhäältä alas; auki on yksi kohta kerrallaan.
- **A3 Olet nyt**: jokainen vaihe alkaa Entran sivun otsikosta ja siitä, mihin siirrytään; tunnukset liitetään heti rekisteröinnin jälkeen Overview-sivulta.

## Jarin havainnot, jotka ovat mukana kaikissa kolmessa

- **Ainoa linkki on ensimmäisessä vaiheessa**, ja sen nimi kertoo, minne se
  vie: *Avaa App registrations*. Linkki avaa listan *All applications*, joten
  ohje jatkuu sieltä: *New registration* listan yläpuolelta.
- **Rekisteröinnin jälkeen ei ole linkkejä.** Entra avaa sovelluksen itse,
  ja loput tehdään sen näkymässä. Vaiheet nimeävät vasemman valikon kohdan
  (*Overview*, *Authentication (Preview)*, *API permissions*) ja
  Authenticationin välilehden (*Redirect URI configuration*, *Settings*).
- **Paluu sovellukseen**: jos sivu ehti sulkeutua, *App registrations* ›
  *All applications*, nimi hakukenttään ja täsmälleen tämä nimi. Jarin
  listassa oli sekä *Open Habitat* että *Open Habitat (testi)*.
- **Järjestys on Entran oma.** *Authentication (Preview)* aukeaa välilehdelle
  *Redirect URI configuration*, joten redirect tehdään ensin ja *Settings*
  (Allow public client flows) vasta sen jälkeen. Kierroksella 1 järjestys oli
  toisin päin.
- **Sanat ovat kuvakaappauksista**: *Redirect URI (optional)*, *Single
  tenant only - <domain>*, *Grant admin consent for <domain>*, ja
  oikeusvaiheen *Valmis, kun* -rivi *Microsoft Graph (10)*. Entra näyttää
  saman ryhmärivin otsikkona, jossa on oikeuksien määrä.
- **Tunnukset Overview-sivulta**: kopiointinappi tulee näkyviin, kun osoitin
  viedään arvon päälle (kuvassa sitä ei näy). *Object ID* nimetään erikseen,
  koska se on samannäköinen tunnus kahden oikean välissä.

## Entran palat

Palat on piirretty uudelleen Jarin kuvakaappauksista (Register an
application, App registrations, Overview, Authentication (Preview), API
permissions), eikä niitä ole leikattu kuvista. Siksi ne seuraavat teemaa,
eikä niissä ole yhtään oikeaa tunnusta: tenant, client ja object ID ovat
`xxxxxxxx-xxxx-…`, organisaatio on `esimerkki.fi`, eikä App registrations
-listassa näy muiden sovellusten nimiä. Alkuperäisiä kuvia ei ole
commitoitu. `check.mjs` varmistaa joka kuvassa, ettei mikään pala näytä
GUIDia.

## Mitä kukin riffi päättää

- **A1**: Pala on vaiheen alussa ja vastaa kysymykseen, mistä kohdasta
  Entran sivua tämä löytyy. Leveällä näytöllä se on oikealla, puhelimessa
  ohjeen yläpuolella. Vaihe 4 näyttää kaksi palaa: *API permissions* ja
  napin *Grant admin consent*, sekä Overview-sivun Essentials, jossa
  tarvittavat kaksi riviä on korostettu.
- **A2**: Vaiheita ei ole, on vain lista. Kohdan otsikkona on valikon polku
  leipätekstin kokoisena, ja kiinni olevan kohdan perässä on yhden rivin
  tiivistelmä. *Tehty, seuraava kohta* sulkee kohdan ja avaa seuraavan.
  Tallenna toimii koko ajan; jos tunnukset puuttuvat, se avaa Overview-kohdan
  virheineen. Valikon järjestys tuo tunnukset toiseksi kohdaksi.
- **A3**: Laatikko *Olet nyt Entrassa* näyttää sivun otsikon sellaisena kuin
  Entra sen näyttää (*Open Habitat | Authentication (Preview)*), ja sen alla
  on yksi siirto. Tunnukset ovat omana vaiheenaan heti rekisteröinnin jälkeen,
  jolloin Entra on jo Overview-sivulla. Kumpikin kenttä on Essentialsin
  rivinsä vieressä, ja kenttä kertoo heti, näyttääkö liitetty arvo
  tunnukselta. Tunnukset ovat siis tiedossa ennen hyväksyntävaihetta, joten
  hyväksyntälinkki on vaiheessa 5 valmiiksi täytetty.

## Yläpalkki

*Taso* (Täysi pääsy, Luonnokset, Vain luku) vaihtaa sovelluksen nimen ja
oikeudet ja aloittaa alusta. Lisäksi palkissa ovat *Teema* ja *Alusta*.
Alhaalla oleva valitsin vaihtaa riffiä. *Minulla on jo sovellus* avaa
kaikissa riffeissä polun, joka kulkee listan hakukentän kautta tunnuksiin.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-riffi/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-riffi/check.mjs \
  design-system/prototypes/dist/m365-riffi/m365.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi tallennukseen asti 1440 ja 390 px
vaaleana ja tummana (kerroin 2, koko vaihe yhdessä kuvassa). Se tarkistaa,
että valikkopolku on leipätekstin kokoinen ja täyttä mustetta, että linkki on
vain ensimmäisessä vaiheessa, että A1:n pala on vieressä tai yläpuolella
eikä tekstin päällä, että A2:ssa on auki yksi kohta kerrallaan ja tyhjä
tallennus avaa Overview-kohdan, että A3 tunnistaa vajaan tunnuksen ja täyttää
hyväksyntälinkin vaiheen 2 arvoista, että oikeudet kopioituvat yksi
kerrallaan, että *Minulla on jo sovellus* toimii, että Vain luku -tasolla
on 8 riviä ja *Microsoft Graph (9)*, ja ettei mikään pala näytä tunnusta.
Tarkistuspisteitä on 732, ja konsoli pysyy puhtaana.
