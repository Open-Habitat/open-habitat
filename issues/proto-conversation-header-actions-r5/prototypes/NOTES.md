# Selitystila: vie osoitin minkä tahansa kohdan päälle

Avaa `selitystila.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Valitsimessa on neljä vaihtoehtoa (näppäimet 1–4 tai ←/→). Kaikissa on
kierroksen 3 riffin 3 nauha aloitussivun yllä. Ne eroavat siinä, mitä
*Selitä nämä mulle* avaa. Sivun yläreunassa sama yhdellä rivillä per riffi:

- **Pohja · Painike kerrallaan**: kierroksen 4 riffi 3 sellaisenaan.
  Kierroksessa on 8 askelta yläpalkissa, Edellinen ja Seuraava.
- **1 · Himmennys ja kortti osoittimessa**: koko näyttö himmenee. Kohta
  osoittimen alla valaistuu, ja kortti tulee sen viereen. Napsautus pitää
  kortin paikallaan ja tarjoaa Kokeile-painikkeen. Painikkeet eivät toimi
  tilan aikana.
- **2 · Ääriviivat, painikkeet toimivat**: näyttöä ei himmennetä. Jokaisella
  selitettävällä osalla on katkoviiva, ja selitys on alareunan palkissa.
  Painikkeet toimivat tilan aikana, joten avatun paneelin voi heti
  selittää. Puhelimessa ensimmäinen napautus selittää ja toinen painaa.
- **3 · Vain yläpalkki, lajit väreinä**: vain yläpalkki on mukana, ja muu
  näyttö himmenee. Jokaisella yläpalkin osalla on lajinsa värinen reunus
  (paneeli, kertatoiminto, tietoa, valikko). Palkissa on *Näytä kaikki
  nimet*.

Sivu avautuu niin, että *Selitä nämä mulle* on jo painettu ja osoitin
on Päätteen päällä, joten ero näkyy heti. Valinta **Selitys: Ei vielä
avattu** näyttää nauhan ennen painamista. Tila päättyy Esc-näppäimellä,
palkin *Lopeta*-painikkeella tai painamalla nauhan painiketta uudelleen.
Sen teksti on tilan aikana *Lopeta selitys*. Keskustelussa, jossa on jo
työtä, nauhaa ei ole, ja sama tila alkaa kohdasta ⋯ › *Selitä tämä näkymä*.

Kortti kertoo kierroksen 4 tiedot: lajin (paneeli, kertatoiminto, tietoa,
valikko), pikanäppäimen, miksi painike on harmaa ja millä nimellä
painike on ⋯-valikossa, kun se ei mahdu riville. ⋯:n kortti luettelee,
mitä valikossa juuri nyt on. Sivupalkin, aloitussivun ja viestikentän
osilla on omat lajinsa: siirtyminen, luettelo ja kirjoitus.

## Kokeile näin

1. **2** (riffi 1): liikuta osoitinta sivupalkin, aloitussivun ja
   viestikentän yli. Napsauta mikrofonia: kortti jää paikalleen, ja
   *Kokeile* lopettaa tilan. Napsauta Päätettä ja paina *Kokeile*: pääte
   aukeaa.
2. **3** (riffi 2): paina Päätettä kesken tilan. Pääte aukeaa, ja tila
   jatkuu. Vie osoitin paneelin päälle. Vaihda *Kapea (1024)* ja
   *Ensimmäinen keskustelu, jossa on jo työtä*, avaa ⋯ ja vie osoitin
   valikon rivien päälle.
3. **4** (riffi 3): paina *Näytä kaikki nimet*. Vaihda puhelimeen: selite
   ei mahdu palkkiin, joten laji näkyy vain kortissa.
4. Puhelimessa kaikissa riffeissä: napauta mitä tahansa. Riffeissä 1 ja 3
   kortti jää ja *Irrota* vapauttaa sen. Riffissä 2 selitys on alapalkissa.

Sivun lopussa ovat taulukot: mitä kukin riffi näyttää missäkin tilanteessa,
mitä yläpalkista selitetään, ja mitä riffit 1 ja 2 selittävät muualta
näytöltä. Tekstit ovat selaimen käännöksistä, joista `open-habitat-ui`-viite
tehdään.

Suosittelen riffiä **1 · Himmennys ja kortti osoittimessa**. Perustelut,
host-tiedot ja kolme kysymystä ovat issuen `result.md`:ssä. Kuvat ovat
hakemistossa `kuvat/`, ja ne on otettu laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostoon `page.src.html`. Kuvat ja tarkistus tehdään komennolla
`NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`. Tarkistus
selittää jokaisen näkyvän osan (osoittimella työpöydällä, napautuksella
puhelimessa) ja varmistaa, että selitys pysyy sovelluksen sisällä. Lisäksi
se kokeilee Kokeile-painiketta, riffin 2 toimivia painikkeita, Esc-näppäintä
ja Näytä kaikki nimet -painiketta sekä painaa jokaista yläpalkin painiketta
jokaisessa riffissä, teemassa, laitteessa, leveydessä, tilanteessa ja
aloitussivun tilassa. Selityksiä on 2893, painalluksia 2765, ja konsoli
pysyy puhtaana.
