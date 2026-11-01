# Yläpalkin painikkeiden selitys: miltä se näyttää

Avaa `selitys.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Valitsimessa on neljä vaihtoehtoa (näppäimet 1–4 tai ←/→). Kaikissa on
kierroksen 3 riffin 3 nauha aloitussivun yllä. Ne eroavat siinä, mitä
*Selitä nämä mulle* avaa. Sivun yläreunassa sama yhdellä rivillä per riffi:

- **Pohja · Nauha kysyy agentilta**: kierroksen 3 riffi 3 sellaisenaan.
  Painike kirjoittaa kysymyksen viestikenttään, ja agentti selittää.
- **1 · Nimilaput ja kortti**: kierroksen 3 riffin 1 selitys. Jokaisen
  painikkeen alle tulee nimilappu, ja niiden alle kortti, jossa on kaikki
  painikkeet ja Editorin ja Päätteen pikanäppäin.
- **2 · Ryhmät ja koko palkki**: nimilaput myös vasemmalle (työtila, tila,
  Git, konteksti, malli), värit lajin mukaan. Kortti ryhmittelee:
  paneelit, kertatoiminnot, tietoa ja Lisää.
- **3 · Painike kerrallaan**: yksi korostettu painike, sen nimilappu ja pieni
  kortti: laji, pikanäppäin, Edellinen ja Seuraava. Kahdeksas askel
  selittää vasemman puolen tilan.

Sivu avautuu niin, että *Selitä nämä mulle* on jo painettu, joten ero näkyy
heti. Valinta **Selitys: Ei vielä avattu** näyttää nauhan ennen painamista.
Kun selitys on auki, nauha supistuu yhdeksi riviksi, jossa on *Piilota
selitys*, koska nimilaput toistavat sen kuvakkeet.

Muut valinnat ovat samat kuin kierroksessa 3: **Tilanne** (ensimmäinen uusi
keskustelu, keskustelu jossa on jo työtä, myöhempi uusi keskustelu),
**Aloitussivu**, teema, laite ja ikkunan leveys. Keskustelussa, jossa on jo
työtä, nauhaa ei ole, ja sama selitys avautuu kohdasta ⋯ › *Mitä painikkeet
tekevät?*.

## Kokeile näin

1. **1**: lue kortti. Vaihda *Kapea (1024)*: kertatoiminnot siirtyvät
   ⋯-valikkoon, eikä kortti enää kerro niistä.
2. **2**: katso lappujen värejä. Turkoosi on paneeli, musta kertatoiminto ja
   reunustettu tietoa. Kokeile puhelimella: kortti on pitkä ja vierii.
3. **3**: paina Seuraava. Kolmas askel on Tilannekatsaus, joka on harmaa,
   koska keskustelu on tyhjä. Puhelimessa sama askel osoittaa ⋯:ää.
4. Missä tahansa riffissä: **Ctrl+Alt+T** avaa päätteen ja **Ctrl+Alt+K**
   editorin, kuten selitys kertoo. Selvä tai Valmis sulkee selityksen ja
   nauhan. Esc ja × sulkevat vain selityksen.

Sivun lopussa on taulukko **Mitä selitys opettaa yläpalkista**: jokainen
yläpalkin osa, sen laji, tehtävä, pikanäppäin ja se, minne se siirtyy
kapeassa ikkunassa ja puhelimessa.

Suosittelen riffiä **3 · Painike kerrallaan** ilman ryhmäkorttia. Perustelut,
host-tiedot, muut paikat, joihin samanlainen selitys sopisi, ja kolme
kysymystä ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/`, ja
ne on otettu laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostoon `page.src.html`. Kuvat ja tarkistus tehdään komennolla
`NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`. Tarkistus painaa
jokaista yläpalkin painiketta, avaa jokaisen riffin selityksen nauhasta tai
⋯-valikosta, käy kierroksen loppuun ja kokeilee Ctrl+Alt+T:tä jokaisessa
riffissä, teemassa, laitteessa, leveydessä, tilanteessa ja aloitussivun
tilassa. Painalluksia on 2774, ja konsoli pysyy puhtaana.
