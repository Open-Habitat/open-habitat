# Tavoite mukana keskustelussa – opas kokeiluun

Kierros näyttää, mitä tapahtuu, kun painat oppaassa **Aloita**. Kaikissa
kolmessa suunnassa on sama Aurinkopolku-aloitussivu kuin edellisellä
kierroksella. Sivu, opas, viestikenttä, historian kuplat, taitosiru ja
oikean reunan paneeli ovat tuotannon React-komponentteja. Kierroksen omia
osia ovat tavoitesiru, sen kortti ja paneelin sisältö. Mitään ei lähetetä:
vastaus on synteettinen.

Prototyypin avaaminen ja rakentaminen on kuvattu [result.md](result.md):n
lopussa.

## Mitä kokeilet

1. Valitse **Korjaa havaittu ongelma** ja paina **Aloita**.
2. Katso viestikenttää. A:ssa ja B:ssä kentän yllä on tavoitesiru, ja kenttään
   jää vain valittu `[kuvaile havainto]`. C:ssä kentässä on koko pyyntö
   raakatekstinä, kuten tuotannossa nyt.
3. Paina sirua. A:ssa siitä aukeaa pyyntö, ja B:ssä myös oppaan vaiheet.
   **Muokkaa tekstinä** purkaa sirun takaisin tavalliseksi tekstiksi.
4. Kirjoita havainto ja lähetä. Katso historian kuplaa ja otsikkoa. Paina
   kuplan sirua.
5. Paina yläpalkista **Lataa sivu uudelleen**. Selain unohtaa välilehden
   muistin, ja jäljelle jää vain lähetetty historia. Katso, palaako opas.
6. Kokeile samaa puhelimessa (**Puhelin 390 px**) ja tummana. Kokeile myös
   pitkää **Valmistele seuraava julkaisu** -pyyntöä sirun kortissa.

Valitsin on ruudun alareunassa: 1/2/3 tai nuolet vaihtavat suuntaa, ja R
aloittaa alusta.

## Nyt tuotannossa (lab)

Näin nykyinen tuotanto toimii synteettisessä labissa. Pitkä pyyntö menee
kenttään raakatekstinä. Lähetyksen jälkeen siitä tulee keskustelun otsikko
(`/skill:pytest-debug S…`), ja opas katoaa näkyvistä.

![Nyt: Aloitan jälkeen](kuvat/nyt-aloitettu-1440-light.webp)
![Nyt: lähetetty](kuvat/nyt-lahetetty-1440-light.webp)

Labin Pi-korvike ei tuota natiivia taitokäärettä, joten labin historiassa ei
näy taitosirua. Oikea Pi tuottaa sen, ja C näyttää, miltä se näyttää.

## A · Siru ja paneeli (suositus)

Aloita lisää sirun, ja vaiheet avautuvat oikealle paneeliin. Paneeli pysyy
auki keskustelun ajan, kunnes suljet sen. Yläpalkin **Opas** avaa sen uudelleen.

![A: Aloitan jälkeen](kuvat/a-aloitettu-1440-light.webp)
![A: sirun kortti](kuvat/a-kortti-1440-light.webp)

Lähetetty viesti näkyy historiassa tuotannon taitosirulla (`korjaa` /
*Korjaa havaittu ongelma*). Otsikoksi tulee tavoitteen nimi. Uudelleenlatauksen
jälkeen paneeli on kiinni, mutta **Opas** palaa, koska natiivi taitokutsu
kertoo tavoitteen.

![A: lähetetty, tumma](kuvat/a-lahetetty-1440-dark.webp)
![A: uudelleenladattu](kuvat/a-uudelleenladattu-1440-light.webp)

Puhelimessa paneeli ei aukea itsestään, koska se peittäisi juuri täytetyn
kentän. **Opas**-kuvake avaa sen koko ruudulle, ja rasti palauttaa
keskusteluun. Tämä on tuotannon paneelin puhelinkäytös.

![A: puhelin](kuvat/a-aloitettu-390-light.webp)
![A: puhelimen opas](kuvat/a-opas-390-dark.webp)
![A: puhelin, lähetetty](kuvat/a-lahetetty-390-dark.webp)

Pitkä pyyntö luetaan sirun kortista. **Muokkaa tekstinä** palauttaa nykyisen
raakatekstin:

![A: pitkä pyyntö](kuvat/a-pitka-pyynto-1440-light.webp)
![A: muokkaa tekstinä](kuvat/a-muokkaa-tekstina-1440-light.webp)

## B · Siru ja kortti

Siru on sama kuin A:ssa, mutta paneelia ei ole. Vaiheet ja pyyntö ovat
sirun kortissa, joka avataan erikseen. Historian sirusta avautuvat samat
vaiheet ja tallennettu ohje.

![B: Aloitan jälkeen](kuvat/b-aloitettu-1440-light.webp)
![B: kortti](kuvat/b-kortti-1440-light.webp)
![B: lähetetty](kuvat/b-lahetetty-1440-dark.webp)
![B: historian siru](kuvat/b-historia-siru-1440-light.webp)
![B: puhelimen kortti](kuvat/b-kortti-390-light.webp)
![B: puhelin, lähetetty](kuvat/b-lahetetty-390-dark.webp)

## C · Teksti ja paneeli

Kentän sisältö on sama kuin nyt, mutta vaiheet ovat paneelissa. Jos
tavoitteella on taito (Korjaa), historiaan tulee taitosiru, jonka perässä on
koko pitkä pyyntö. Otsikko on raakatekstiä. Ilman taitoa (Tutustu repoon)
natiivi historia ei kerro tavoitteesta mitään, joten opas katoaa
uudelleenlatauksessa.

![C: Aloitan jälkeen](kuvat/c-aloitettu-1440-light.webp)
![C: lähetetty](kuvat/c-lahetetty-1440-light.webp)
![C: ilman taitoa](kuvat/c-ilman-taitoa-lahetetty-1440-light.webp)
![C: puhelin](kuvat/c-aloitettu-390-dark.webp)
![C: puhelimen opas](kuvat/c-opas-390-light.webp)

## Mitä kysyn sinulta

- **A, B vai C?** Suosittelen A:ta.
- **Hyväksytkö 1b:n?** A ja B edellyttävät, että aloitussivutaito kirjoittaa
  jokaisesta tavoitteesta repoon oman taidon. Tavoitteet näkyvät silloin myös
  `/`-listassa ja terminaalin Pi:ssä.
- **Saako taidolla aloitettu keskustelu nimen tavoitteesta?** Nyt otsikko
  on raakatekstiä (`/skill:…`). Kuvissa näkyvä tavoitteen nimi on uusi
  host-tieto.
