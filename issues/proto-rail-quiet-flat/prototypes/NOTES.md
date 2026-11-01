# Hiljaiset kaikkine keskusteluineen: opas

Avaa `hiljaiset.html`. Se on yksi offline-sivu, joka ei käytä verkkoa. Ylhäällä
on valitsin (näppäimet 1–3 tai ←/→):

- **Nykyinen** on main nyt: Sinun vuorosi · Käynnissä · Viimeisimmät (viisi).
- **1 · Hiljaiset, nimi rivissä** on sinun kuvauksesi: Viimeisimmät poistuu,
  ja Hiljaiset listaa kaikki muut keskustelut uusin ensin yhtenä listana
  ilman työtilaotsikoita. Ilman kuvakkeita työtilan nimi on rivin lopussa
  himmeänä ennen aikaa.
- **2 · Hiljaiset, nimikirjaimet** on sama raide. Ero on vain ilman
  kuvakkeita: rivin alussa on työtilan nimikirjaimet (samat kuin kapean
  raiteen pisteissä), ja otsikolle jää koko rivi.

Kuvauksesi jätti avoimeksi lähinnä sen, miten rivi kertoo työtilansa, kun
kuvakkeet ovat pois. Siksi suuntia on vain kaksi, ja ne eroavat vain siinä.
Kuvakkeiden kanssa 1 ja 2 ovat samat.

Oikeasta yläkulmasta vaihdat vaalean ja tumman teeman, työpöydän ja
puhelimen, leveän ja kapean raiteen (editori auki), **määrän** ja työtilojen
kuvakkeet:

- **Muutama**: neljä työtilaa ja 14 keskustelua (kierroksen 2 maailma).
- **Paljon**: kymmenen työtilaa ja 50 keskustelua kuukauden ajalta.
  Hiljaisissa on silloin 45 riviä.

## Miten sivua käytetään

- Vasemmalla on **kohdekeskustelun** tilakone. Korostettu laatikko on sen
  tila, ja paksu viiva on viimeisin siirtymä. Uudessa raiteessa ei ole
  katkoviivaista "ei raiteessa" -laatikkoa: valmis keskustelu on aina
  Hiljaisissa, kunnes arkistoit sen.
- Oikealla valitset kohteen ja tapahtumat. Tapahtumarivin lopussa näkyy,
  millä rivillä kohde on (esim. *Hiljaiset, rivi 42/45*).
- Raiteen rivit, työtilat ja Etusivu avautuvat klikkaamalla (puhelimessa ☰).
  Raide vierii, ja **Työtilat** suodattimineen on Hiljaisten alla.

## Kokeile näin

1. **1** → **Paljon** → **Ei kuvakkeita**. Vieritä raide alas. 45 riviä,
   ja työtilat alkavat noin kahden raiteen korkeuden päästä
   (puhelimessa yli kolmen).
2. **Kolmen viikon takainen** (Tarina). Haluat jatkaa 23 päivää sitten
   käytyä *Labin portit* -keskustelua. Se on Hiljaisten rivillä 42/45:
   vieritä ja klikkaa. Vertaa: **Nykyinen** → sama tarina → *Avaa työtilan
   sivulta*. Mainissa se ei ole raiteessa ennen kuin avaat sen, ja silloin
   se tulee kursiivilla kuudenneksi.
3. **2** → **Ei kuvakkeita** → **Puhelin**. Kirjaimet `DE` ja `DO`
   (deutschpad, dotfiles) näyttävät samalta, eikä puhelimessa ole
   vihjettä, josta koko nimen näkisi.
4. **Worktree-agentin ilta** ja *Työ yhdistetään*. Selaimesta aloitettu
   worktree-agentti on Hiljaisten kärjessä, ja yhdistetyn työn merkki on
   vihreä. Rivi ei lähde.
5. *Avaa asetukset*: Ulkoasussa ei enää ole Viimeisimmät-määrää.
6. **Kapea (editori)**: pistenauha on ennallaan (Sinun vuorosi ja
   Käynnissä).

Suosittelen suuntaa **1**, jos kuvakkeet ovat useimmiten pois. Jos kuvakkeet
ovat sinulla aina päällä, valinnalla ei ole juuri väliä. Perustelut, hostin
tiedot ja kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa
`kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostosta `page.src.html`. Kuvat tehdään komennolla
`node shots.mjs <polku>/hiljaiset.html kuvat` ja muunnetaan AVIFeiksi
komennolla `scripts/screenshots-to-avif.py`.
