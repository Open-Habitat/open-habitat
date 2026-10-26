# Workerit-paneeli · Kierros 1

Kapellimestari on keskustelussa *Iltakierros* (repositorio `kasvimaa`)
käynnistänyt seitsemän workeria. Kahta se odottaa taustalla, ja niistä toinen
on toisessa repositoriossa (`kirjasto`). Yhtä Claude-workeria se ei odota,
ja yksi Pi-worker odottaa pääagenttia. Päättyneistä yksi laskeutui, yhden työ
on tallessa ilman mergeä ja yksi epäonnistui. Kaikki nimet ja ajat ovat
keksittyjä.

Lähtökohta on tuotannon nykyinen paneeli ilman yläreunan selitettä
(”odotetaan / ei odotusta: agentti ei herää, kun worker valmistuu”). Siru on
sama kuin tuotannossa: Pisteet, yksi merkki jokaista elävää workeria kohden,
ja punainen piste, kun tallessa oleva työ vaatii huomiota. Siru on
tuotannossa kentän yläpuolella eikä yläpalkissa, joten se on täälläkin siinä.

Kierros vertailee yhtä asiaa: **missä rivin yksityiskohdat ja odotuksen
merkitys kerrotaan.**

## Kolme suuntaa

| Suunta | Mitä se näyttää | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Rivi | Kaksirivinen rivi. Ensimmäisellä rivillä on nimi ja aika, toisella tila sanoin (”agentti odottaa”, ”agentti ei odota”, ”laskeutui”, ”ei mergetty · työ tallessa”, ”epäonnistui”), ajo (Pi · profiili) ja toisen repositorion nimi. Odotetulla rivillä on ■ Lopeta odotus. | Kaikki näkyy kerralla ilman opettelua. Lähin nykyistä. | Sama sana toistuu joka rivillä. Rivit ovat noin puolitoista kertaa nykyistä korkeampia (paneeli 253 px, Avattava 207 px). |
| 2 Ryhmät | Selite on siirtynyt ryhmien otsikoiksi: *Agentti odottaa* (”jatkaa, kun nämä valmistuvat”), *Ei odotusta* (”ei herää, kun nämä valmistuvat”), *Odottaa pääagenttia* ja *Työ tallessa, ei mergetty*. Päättyneet ovat taitettuina alla. Rivit ovat yksirivisiä: nimi, toisen repositorion nimi, Pi/Claude ja aika. | Merkitys sanotaan kerran ryhmälle eikä jokaiselle riville. Huomiota vaativa työ nousee näkyviin eikä jää taitetun alle. | Korkein: otsikot ja nostettu tallessa-ryhmä tekevät paneelista puhelimessa 469 px (Rivi 253 px). Rivi vaihtaa ryhmää, kun odotus lopetetaan. |
| 3 Avattava | Rivi on tiivis: merkki, nimi, toisen repositorion nimi ja aika. Oikean reunan ⌄ avaa tiedot: tila kokonaisena lauseena, ajo ja profiili, repositorio, haara, aloitus- ja päättymisaika, workerin raportti, Lopeta odotus ja Avaa workerin näkymä. | Lyhin lista. Tiedoissa on tilaa raportille ja haaralle, joita kumpikaan muu ei näytä. | Merkki ◉/○ on opittava, tai sen merkitys luetaan avaamalla. Lopeta odotus on yhden painalluksen syvemmällä. |

Kaikissa suunnissa rivin nimen painaminen avaa workerin oman näkymän
(yksinkertaistettu Kehys kierroksesta proto-worker-view): Worker-merkki,
paluulinkki *‹ Iltakierros*, tila, ajo ja repositorio, Keskustelu- ja
Pääte-välilehdet sekä kentän paikalla ilmoitus ”Workerille ei kirjoiteta
suoraan”. Claude-worker aukeaa päätteeseen.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-worker-panel/prototypes/worker-panel/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin on ylhäällä.
Suuntaa vaihdetaan näppäimillä **1–3** tai **←/→**. **Tilanne** vaihtaa
tilanteiden *Agentti odottaa taustatyötä* (oletus) ja *Kaikki workerit
päättyneet* välillä. **Tumma/Vaalea** vaihtaa teeman.

1. Avaa Workerit-siru. Näkyykö ilman selitettä, mitä Lomakkeen
   saavutettavuuden katkoviivarengas tarkoittaa?
2. Avaa *päättyneet*. Erottuuko laskeutunut, tallessa oleva ja epäonnistunut
   toisistaan?
3. Lopeta Hakuindeksin päivityksen odotus (■, suunnassa 3 tiedoista).
4. Paina jonkin workerin nimeä ja palaa *‹ Iltakierros* -linkistä.
5. Kokeile puhelinleveydellä: mahtuuko lista ja riittääkö kosketusala?

Kuvat ovat hakemistossa `evidence/`. Jokaisesta suunnasta on kuva
työpöydällä (1440 px) ja puhelimessa (390 px), vaaleana ja tummana: paneeli
auki (`-paneeli`) ja päättyneet auki (`-paattyneet`). Lisäksi on suunnan 3
tiedot (`-tiedot`), tilanne *Kaikki workerit päättyneet* (`-vain-paattyneet`)
ja workerin näkymä (`worker-*`). Kuvat on otettu kaksinkertaisella
tarkkuudella.

## Mitä host-tietoja suunnat tarvitsevat

| Tieto | Onko olemassa? | Kuka tarvitsee |
| --- | --- | --- |
| Tila (työskentelee, odottaa pääagenttia, mergetty, ei mergetty), työ tallessa, raportti, haara, aloitusaika | Kyllä, spinoffs-sopimuksessa | Kaikki |
| Odotetaanko workeria (odotus liitetty ajoon ja herättää agentin) | Kyllä | Kaikki |
| Ajo: Pi vai Claude | Taskfleetillä (`run list`: `harness`), daemon lukee sen mutta ei vie sopimukseen | Kaikki |
| Profiili | Taskfleetillä (`run show`: `manifest.selection.profile`), ei sopimuksessa | 1 ja 3 (2 näyttää vain Pi/Claude) |
| Repositorio | Taskfleetillä (`source_repo`), daemon lukee mutta ei vie sopimukseen | Kaikki |
| Epäonnistui vai jäi tallessa ilman mergeä | Taskfleetin `status: failed` on olemassa, mutta daemon niputtaa failed, done ja cancelled tilaksi `unmerged`. Sopimuksessa on vain `preserved` | Kaikki, jotta epäonnistunut ei näytä samalta kuin tallessa oleva työ |
| Päättymisaika | Taskfleetillä likimain (`run show`: päättyneen ajon `manifest.updated_at`), ei sopimuksessa. Tuotanto näyttää päättyneelle nyt vain tilan | Kaikki (1 ja 2 rivillä, 3 tiedoissa) |
| Workerin oma näkymä | Toteutuksessa (`worker-view-conversation`) | Kaikki |

## Rakentaminen ja tarkistus

```sh
node issues/proto-worker-panel/prototypes/worker-panel/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-worker-panel/prototypes/worker-panel/check.mjs
```

`check.mjs` rakentaa sivun, käy jokaisen suunnan läpi kummallakin
leveydellä ja kummassakin teemassa ja ottaa kuvat. Se tarkistaa, ettei
selitettä ole ja että odotuksen merkitys luetaan rivistä, otsikosta tai
tiedoista. Lisäksi se tarkistaa päättyneet, odotuksen lopettamisen, workerin
näkymän ja paluun, Escapen palauttaman kohdistuksen, vaakavierityksen
puuttumisen ja valitsimen. Sivu ei saa kirjoittaa konsoliin virheitä eikä
tehdä verkkopyyntöjä.
