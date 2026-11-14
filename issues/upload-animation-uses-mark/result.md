# Tulos

## Kierros 1 (14.11.2026)

**Yhteenveto.** Kierros näyttää kirjoituskentän liitesirut tallennuksen
aikana kolmella tavalla käyttää merkkiä. Vertailukohtana on nykyinen
tuotanto. Suositus on **1 Merkki täyttyy**: merkin rengas piirtyy ovelta
myötäpäivään sitä mukaa kuin tavuja lähtee, ja se pysähtyy, jos siirto
pysähtyy. Asukas astuu sisään vasta, kun palvelin on tallentanut tiedoston,
ja ovi sulkeutuu. Prosentti näkyy edelleen numerona, ja
progressbar-semantiikka on ennallaan. Tallennus erottuu agentin työstä,
koska agentin merkissä asukas on aina kotona ja ovi kiertää, kun taas
tallennuksen rengas kasvaa ja seisoo paikallaan tyhjänä kotina.

Akseli: miten liitesirun tallennusanimaatio käyttää merkkiä.

- **Nyt**: tuotannon rengas ja prosentti, merkkiä ei käytetä.
- **1 Merkki täyttyy**: merkki on edistymispalkki (24 px), asukas tulee kotiin vasta tallennettuna.
- **2 Merkki ja palkki**: tuotannon `loading`-merkki ja ohut palkki sirun alareunassa.
- **3 Merkki kehyksenä**: 28 px:n merkki pikkukuvan paikalla, asukas kävelee ovelta keskelle, siru täyttyy ja kuva asettuu renkaan muotoon.

Tilanteet ovat samat kaikissa suunnissa: pieni tiedosto, iso hidas
tiedosto (37 %, siirto pysähtyy välillä), viisi tiedostoa agentin
työskennellessä (64 % ja kaksi odottaa), tallennus palvelimella ja
katkennut siirto (62 %) Yritä uudelleen -toimintoineen. Leveydet ovat
1440 ja 390, teemat Päivä, Yö ja Kontrasti, ja lisäksi on vähennetty liike
ja pakotetut värit. Rakennusohje, kuvaus ja tarkka erottelu
"tallennetaan" vs. "agentti työskentelee" ovat
`design-system/prototypes/rounds/2026-11-14-upload-mark/NOTES.md`:ssä.
`check.mjs` ajoi 688 tarkistusta, ja konsoli oli puhdas.

Sivu ja kuvat (scale 2 sekä lähikuvat scale 4):
`~/src/open-habitat-dev/worker-results/01m7dndj5tkgpnew9syvxrkc00/`
(`offline.html`, `shots/`).

**Kysymykset Jarille**

- Kelpaako 1, vai onko 3:n isompi merkki ja pikkukuvaan asettuminen
  sitä, mitä tarkoitit merkin käyttämisellä "kunnolla"? Suunnat 1 ja 3
  voi yhdistää: 1:n täyttyvä rengas 28 px:n kokoisena, ja valmis kuva
  asettuu renkaan muotoon.
- Saako valmis tiedosto lyhyen "Tallessa"-hetken (suljettu ovi, 1,2 s),
  ennen kuin siru muuttuu tiedostoksi? Tuotannossa siru vaihtuu heti.

**Decisions for later review**

- *Waiting file*: shows Odottaa tallennusta (the existing, unused catalog
  string) with a dashed or dim mark instead of production's "0 %".
  Alternative: keep 0 %. Why: production uploads one file at a time, so
  0 % reads as a stalled upload.
- *Saved moment*: a 1.2 s done phase (shut door, the word Tallessa) before
  the chip settles, in all three directions. Alternative: straight to the
  thumbnail as today. Why: the mark's door shutting is what makes "saved"
  read as the mark's meaning, and it needs a moment to be seen.
- *Retry stays in the banner*: production's `AttachmentRefusal` is
  unchanged and the chip only shows "Tallennus katkesi 62 %". Alternative:
  a retry button on the chip. Why: the round's axis is the animation, and
  the banner already says how much was sent and that the message was not
  sent.
- *Mark size*: 24 px in 1, 20 px in 2 (production chip icon size), 28 px
  in 3 (thumbnail size). Why: the partial ring has to be readable at 37 %,
  and 20 px was too faint in the screenshots.
- *Lane*: the run policy does not allow this worker to set a lane, so the
  issue is `open`, `preparation: pending`, without the brief's
  `upload-mark-proto` lane; the conductor sets it.

**Live check**: nothing to try on the test server yet. Open
`worker-results/01m7dndj5tkgpnew9syvxrkc00/offline.html`, switch
directions, press Toista on Iso tiedosto hitaasti and Yritä uudelleen on
Katkesi ja uudelleen.
