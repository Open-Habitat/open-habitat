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

## Implementation (21.11.2026)

Direction 1 Merkki täyttyy is in production, without an experimental flag.
`HabitatMark` takes a `progress` (0–1) and three upload states beside the
existing `done` and `error`: `queued` (dim dashed mark), `uploading` (faint
whole mark, ring drawn from the door, nobody home) and `saving` (the
resident steps in; still, it stands in the door). `AttachmentChips` draws
it for every pending chip and, for 1.2 s after the host has saved a file,
the shut door with Tallessa before the icon or thumbnail; the composer
keeps those references in a short local list. The percentage stands
`--ah-s3` from the name, a waiting file says Odottaa tallennusta, and a
broken upload says Tallennus katkesi with how far it got. The explain card
V36 describes the mark. The round's sources are removed (history keeps
them), and `design-system/design.md` records the direction.

Checks: `./scripts/test-web-fast.sh` green; component tests for every chip
state and the Tallessa moment (fake timers); the lab spec
`lab-attachment-upload-progress.spec.ts` checks spacing (≥ 8 px, no
overlap, same line), the queued and error marks, the resident's motion and
its still door position under reduced motion, and that Tallessa shows and
then gives way to the file. 12/12 with `--repeat-each 3`. The other specs
that attach files (11 files, 128 cases) passed; one case in
`browser-conversation.spec.ts` failed once under load and passed 4/4 on a
rerun, as it does on main.

Evidence (not committed): `/var/tmp/agent-keep/upload-animation-uses-mark/`
on the staging host, composer captures at 1440 and 390 in fi and en for uploading,
saving, saved, failure and the explain cards, each in Päivä, Yö and
Kontrasti.

**Decisions for later review**

- *Mark size*: 14 px, the button's icon size. The round meant 24 px, but
  the button primitive's icon rule overrode it there too, so the round
  Jari approved showed 14 px. Alternative: 24 px as the notes say (the chip
  grows a little). Why: build what was seen and approved.
- *Explain-mode test at desktop width*: the lab spec points at the chips
  with explain mode on at 1440 for both widths. At 390 the state card can
  stand over the composer once the waiting chip's longer text takes a
  second row, and a pointer cannot reach a chip under it. Alternative:
  change the state card's placement to keep the composer clear. Why: the
  cards do not depend on width, and the placement is a separate explain-
  mode matter.
- *Saved chip is openable*: during Tallessa the chip already opens the
  preview and can be removed. Alternative: disabled for the moment. Why:
  the file is saved; blocking it for 1.2 s would only get in the way.
- *Reduced motion keeps the moment*: Tallessa still lasts 1.2 s, since it
  is a state shown in shape and word, not motion.
