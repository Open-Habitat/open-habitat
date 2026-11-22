# Koko käyttöliittymän rakenne

## Saatesanat

Kysymys on, mikä on navigaatiota ja mikä työtä. Nykyisessä sivupalkissa kaikki
on samassa pinossa: palvelin, neljä paikkaa, haku, kolme tilaosiota ja
työtilat. Siksi kiinteä yläosa syö puolet tilasta. Yläpalkissa taas on kymmenkunta
pientä nimetöntä kuvaketta, jotka kuuluvat kolmelle eri tasolle: sovellukselle
(Selitä), työtilalle (editori, pääte, haara) ja keskustelulle (otsikko,
katsaus, arkistointi, tiedot).

Suosittelen **suuntaa 1, Kaksi tasoa**. Paikat ja työtilat menevät kapeaan
kaistaan vasemmalle, ja viereinen palsta jää kokonaan keskusteluille. Sinun
vuorosi, Käynnissä ja Hiljaiset ovat siinä yhtenä vierityksenä koko
korkeudelta, eivät kolmena pienenä laatikkona. Kannettavan 1280×720-näkymään
mahtuu 17 keskustelua ja kaikki 10 työtilaa, ja 1920×1080:ssa kaikki 22
keskustelua. Klikkaa työtilaruutua: palsta rajautuu siihen työtilaan, ja
otsikosta pääset työtilan sivulle. Yläpalkissa on enää otsikko, työtila, haara ja
tila sekä nimetyt **Editori** ja **Pääte**. Loput ovat `⋯`-valikossa.

Tuotokset, Oma selain ja Agentin käytössä saavat kaikissa suunnissa omat
kuvakkeensa ja saman muodon, eikä mikään niistä ole kortti
(`rail-icons-tuotokset-oma-selain`). Tämän keskustelun selainikkunat
avautuvat kentän yllä olevasta sirusta, kuten selainkierroksen suosituksessa.

Suunta 1 muuttaa kahta sovittua asiaa, ja ne kannattaa päättää tietoisesti.
Työtilat näkyvät nimirivien sijaan kirjainruutuina, ja nimi tulee vihjeestä ja
palstan otsikosta. Editori ja Pääte ovat nimettyjä painikkeita, vaikka
design.md:n mukaan kuvake voittaa. Juuri nimettömät kuvakkeet olivat kuitenkin
valituksesi aihe.

## Suunnat

Akseli: mihin kerrokseen kukin osa kuuluu. Sisältö on sama kaikissa: sama
keskustelu auki, 10 työtilaa ja 22 keskustelua. Rivimäärät on mitattu
selaimessa paljaasta sovelluksesta 1280×720:ssa, ja tarkistus kaatuu, jos
sivun ylärivin luku on eri.

| Suunta | Päätös | 1280×720 | Hinta |
| --- | --- | --- | --- |
| 1 Kaksi tasoa | Kaista paikoille ja työtiloille, palsta pelkille keskusteluille | 17 keskustelua + 10 työtilaa | Työtilat tunnistetaan kirjaimista ja väreistä; yli ~12 työtilaa vierii kaistassa |
| 2 Yläpalkki | Haku/komentopaletti, paikat ja tili koko leveyden yläpalkkiin; editori, pääte ja tiedot keskustelun välilehtinä | 11 keskustelua + 10 työtilaa | Yläpalkki vie 48 px pystytilaa; tili siirtyy pois sovitusta paikasta; välilehti piilottaa keskustelun editorin ajaksi |
| 3 Työtila kotina | Sivupalkissa vain työtilat; keskustelut työtilan välilehtinä; tilaosiot Huomio-ponnahduksessa | 3 keskustelua (välilehdet) + 10 työtilaa | Työtilojen yli kulkeva "mitä minulta odotetaan" on yhden klikkauksen takana; kumoaa product.md:n sivupalkin tilaosiot |

Täysi kartta (jokainen nykyinen osa → missä se kussakin suunnassa asuu) on
kierroksen `NOTES.md`:ssä ja sivulla Kartta-painikkeen takana.

## Mitä kannattaa yhdistää

- **Suunnasta 3:** editori, pääte ja tiedostot ovat *työtilan* työkaluja
  (product.md: "each workspace has a browser terminal … and a VS Code editor"),
  eivät keskustelun. Suunnan 1 yläpalkissa ne kannattaa ryhmitellä työtilan
  nimen ja haaran kanssa, erilleen keskustelun `⋯`:stä.
- **Suunnasta 2:** yksi haku, joka on myös komentopaletti (⌘K): keskustelut,
  työtilat ja komennot kuten Avaa pääte ja Tee tilannekatsaus. Silloin
  `⋯`-valikkoon jäävät komennot löytyvät myös näppäimistöltä.
- **Suunnasta 3:** työtilarivin tilamerkit (● odottaa, ◌ käynnissä
  lukuineen) toimisivat myös suunnan 1 ruuduissa pelkän numeron sijaan.

## Suhde rinnakkaisiin kierroksiin

- `rail-space-small-screens` tiivistää nykyisen sivupalkin. Se on pienempi
  askel samaan suuntaan. Jos valitset suunnan 1, sen ratkaisu paikkojen
  sijoittamiseen korvautuu kaistalla, mutta tiiviit rivit ja yhden vierityksen
  idea siirtyvät sellaisinaan palstaan. Jos haluat ensin pienen muutoksen,
  rail-space voi laskeutua ensin ja suunta 1 myöhemmin. Ne eivät ole
  ristiriidassa.
- `server-browser-entry-points` suositteli suuntaa Molemmat: sivupalkista koko
  oma selain ja sirusta tämän keskustelun ikkunat. Kaikki kolme suuntaa
  noudattavat sitä. Sivupalkin rivin paikka vain vaihtuu: suunnassa 1 kaista,
  suunnassa 2 yläpalkki ja suunnassa 3 paikkojen ruudukko.

## Questions for Jari

1. Valitaanko suunta 1 (Kaksi tasoa)? Vai painaako suunnan 3 työtilakeskeisyys
   enemmän kuin se, että kaikki odottava näkyy yhdellä silmäyksellä?
2. Kelpaavatko työtilat kirjainruutuina (vihjeenä nimi, palstan otsikossa
   nimi valittuna)? Vaihtoehto on leveämpi kaista lyhyillä nimillä, jolloin
   palsta kapenee noin 60 px.
3. Saavatko yläpalkin työkalut nimet (Editori, Pääte), vaikka design.md:n mukaan
   kuvake voittaa? Ehdotan sääntöä: pysyvät työkalut nimetään, harvinaiset
   toiminnot menevät `⋯`:n taakse, ja nimetön kuvake jää vain yleisiin merkkeihin
   (`+`, `×`, `⋯`).
4. Saako Selitä-tila (nyt yläpalkin `?`) siirtyä sovelluksen tasolle kaistan
   alaosaan, koska se selittää koko näkymän eikä vain keskustelua?

## Decisions for later review

- **Malli vain kentän rivillä.** Malli oli sekä yläpalkissa että kentässä.
  Kentän siru jäi, koska malli valitaan ennen ensimmäistä viestiä. Vaihtoehto
  oli pitää se otsikossa tilan vieressä.
- **Hiljaisten työtilarajaus (pillerit) korvautuu kaistan työtilaruudulla
  (suunta 1).** Ruutu rajaa koko palstan eikä vain Hiljaisia. Vaihtoehto on
  pitää pillerit Hiljaisten otsikossa. Yksi rajausmekanismi on selkeämpi.
- **Apulaiset pysyvät omina riveinään Käynnissä-osiossa** product.md:n
  mukaisesti, ja suunnassa 3 ne ovat omia välilehtiään. Taustatyön sirut
  kentän yllä (sovittu Merkit-palkki) eivät muuttuneet, joten niitä ei piirretty
  tähän keskusteluun, jossa ei ole apulaisia.
- **Tuotosten kuvake on julkaistu sivu ja nuoli ulos, Oma selain
  selainikkuna ja Agentin käytössä kilpi ja avaimenreikä.** Vaihtoehtoja oli
  pino arkkeja ja avain. Valitut kuvakkeet erottuvat toisistaan myös 16 px:n
  koossa.
- **Suunnan 3 välilehdet ovat käynnissä olevat ja kaksi viimeksi luettua.**
  Selaimen tapaan itse avatut ja suljetut välilehdet olisivat uusi
  laitekohtainen tila. Sitä ei keksitty tähän.
- **Tili jää suunnissa 1 ja 3 alareunaan sovitun mukaisesti.** Suunta 2
  siirtää sen oikeaan yläkulmaan, ja se on kerrottu suunnan ylärivillä.

## Toimitus ja näyttö

- Kierros: `design-system/prototypes/rounds/2026-11-22-ui-structure/`
  (`build.mjs`, `round.js`, `round.css`, `check.mjs`, `NOTES.md`). Kirjastoon
  ei koskettu.
- Rakennettu sivu: `/var/tmp/agent-keep/ui-structure-free-round/offline.html`
  (kopio worktreen `design-system/prototypes/dist/ui-structure/offline.html`:stä).
  Osoitevalinnat `?v=1|2|3&lang=fi|en&theme=light|dark|contrast&bare=1`.
- Tarkistuksen kuvat: `/var/tmp/agent-keep/ui-structure-free-round/check/`
  (suunta-leveys-teema-kieli, `*-palette` ja puhelimen `*-drawer`).
- `check.mjs`: mitatut rivit 1280×720 → 17+10, 11+10, 3+10. 54 yhdistelmää
  (3 suuntaa × fi/en × päivä/yö/kontrasti × 1280×720, 1920×1080, 390×844)
  läpäisty. Axe on puhdas 1280 px:ssä joka teemassa, konsoli puhdas, verkko
  estetty.
- Nykytilan lähteinä olivat tuotannon `WorkspaceRailView.tsx`, yläpalkin
  toimintojen nimet (`web/src/text/explainMode.ts`) ja Jarin kannettavan kuvat.
  Kuvia ei talletettu, ja kaikki prototyypin nimet ovat keksittyjä.
