# Keskustelun yläpalkin painikkeet: opas

Avaa `ylapalkki.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Ylhäällä on valitsin (näppäimet 1–4 tai ←/→):

- **Nykyinen** on yläpalkki sellaisena kuin main sen piirtää
  (`Navigation.tsx`, `AgentHeader`).
- **1 · Sana painikkeessa**, **2 · Paneelit näkyvissä, muut valikossa** ja
  **3 · Kuvakkeet ja ensiopastus** ovat suunnat.

Sivun yläosan valinnoilla vaihdat teemaa (vaalea tai tumma), laitetta
(työpöytä tai puhelin) ja ikkunan leveyttä (1024, 1320 tai 1680 px,
sivupalkki auki). Lisäksi voit valita, onko otsikko pitkä vai lyhyt.
Suunnassa 3 voit valita myös, avataanko keskustelu ensimmäistä kertaa vai
myöhemmin. *Alkuun* palauttaa tilan. Jokainen painike toimii: Editori
avaa editorin keskustelun viereen, Pääte avaa päätteen alle, Katsaus tekee
tilannekatsauksen, Uusi otsikko vaihtaa otsikon ja Tiedot avaa tiedot.
Sivun alareunan taulukossa kerrotaan, mitä kukin painike tekee ja missä se
on valitussa suunnassa.

Kaikissa suunnissa oletan, että nopea vihje (`icon-tooltips-slow`) on jo
käytössä: hiiren alla nimi tulee näkyviin noin 0,3 sekunnissa. Se auttaa
vain hiiren käyttäjää, joka jo kokeilee painikkeita. Puhelimessa vihjettä
ei ole.

## Akseli: mistä ensikertalainen lukee, mitä painike tekee

Mainissa Kaisa näkee kuusi kuvaketta: Editori, Pääte, Tilannekatsaus,
Uusi otsikko, Arkistoi ja Tiedot. Niiden nimet ovat vain vihjeessä. Suunnat
eroavat siinä, missä nimi on luettavissa ilman hiirtä:

1. **Sana painikkeessa.** Jokaisessa näkyvässä painikkeessa on kuvake ja
   sana: *Editori, Pääte, Katsaus, Uusi otsikko, Arkistoi, Tiedot*.
   Puhelimessa sana on kuvakkeen alla. Hinta on leveys: kaikki kuusi
   mahtuvat vasta noin 1680 px:n ikkunaan. 1320 px:ssä neljä viimeistä
   siirtyvät ⋯-valikkoon jo lyhyellä otsikolla, joten tavallisella
   näytöllä suunta näyttää samalta kuin 2.
2. **Paneelit näkyvissä, muut valikossa.** Rivillä ovat sanoin vain
   *Editori* ja *Pääte*, koska ne avaavat paneelin ja pysyvät painettuina,
   kun paneeli on auki. Kertaluonteiset toiminnot (*Tilannekatsaus, Uusi
   otsikko, Nimeä uudelleen, Arkistoi, Tiedot*) ovat aina ⋯-valikossa.
   Jokaisella on siellä kuvake, nimi ja rivi siitä, mitä se tekee.
   Puhelimessa myös Editori ja Pääte ovat valikossa, ja ylärivillä on vain
   otsikko ja ⋯.
3. **Kuvakkeet ja ensiopastus.** Rivi on kuten nyt. Kun keskustelu
   avataan ensimmäistä kertaa, otsakkeen alle avautuu kortti *Yläpalkin
   painikkeet*, joka nimeää ja selittää jokaisen painikkeen. *Selvä*
   sulkee sen. *⋯ › Mitä painikkeet tekevät?* avaa sen uudelleen.

## Kokeile näin

1. **Nykyinen**, työpöytä: vie hiiri kuvakkeiden yli. Vaihda sitten
   *Puhelin* ja mieti, mistä tietäisit, mitä kaksi kuvaketta tekevät.
2. **1**: vaihda leveydeksi *Hyvin leveä (1680)*, niin näet kaikki kuusi
   sanaa. Palaa sitten *Leveä (1320)* -leveyteen.
3. **2**: avaa ⋯. Paina *Pääte*, niin painike jää painetuksi ja paneeli
   avautuu. Vaihda puhelimeen ja avaa ⋯.
4. **3**: lue kortti ja paina *Selvä*. Avaa se uudelleen ⋯-valikosta.
   Vaihda *Myöhemmin*, niin näet rivin sellaisena kuin se on kortin
   jälkeen.

Suosittelen suuntaa **2 · Paneelit näkyvissä, muut valikossa**. Perustelut
ja kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa
`kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostosta `page.src.html`. Kuvat ja konsolitarkistus tehdään
komennolla `NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`.
