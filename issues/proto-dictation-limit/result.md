# Tulos

## Kierros 1 (15.11.2026)

**Yhteenveto.** Nykyinen 10 minuutin katto **ei hukkaa jo sanottua
tekstiä**. Selain lopettaa 9:58 kohdalla, odottaa Sonioxin viimeiset sanat
ja kirjoittaa kaiken kenttään. Tämän todentaa myös olemassa oleva
selaintesti, joka meni läpi. Pilotissa hävinneet viisi minuuttia puhuttiin
pysähdyksen *jälkeen*, kun mikrofoni oli jo kiinni. Varoitus tulee vain
harmaana rivinä kentän yllä, eikä siitä kuulu ääntä, joten ruutuun
katsomaton ei huomaa sitä. Kyse on siis puuttuvasta varoituksesta eikä
koodivirheestä, joka pudottaisi tekstiä.

Sonioxin oma raja on 300 minuuttia istuntoa kohden. 10 minuuttia on meidän
asetuksemme väliaikaisessa avaimessa. Hinta on 0,12 $ tunnilta (10 min =
0,02 $). Istuntoa ei voi jatkaa rajan yli, mutta uuden voi aloittaa saumatta
edellisen perään.

Suositus on **2 Tunnin ketju**. Selain vaihtaa Soniox-istunnon
huomaamatta 10 minuutin välein tauon kohdalla, ja yhden sanelun raja on
tunti. Viimeisellä minuutilla palkin aika muuttuu lukemaksi ”0:58
jäljellä”, kentän yllä on varoitus, ja hiljainen äänimerkki soi minuuttia ja
10 sekuntia ennen sekä lopussa. Ruudunlukija kuulee kunkin rajan kerran.
Rajalla teksti on kentässä tavallisena tekstinä, ilmoitus kertoo
mikrofonin olevan kiinni, ja yksi painike, **Jatka sanelua**, jatkaa tekstin
perään. Daemoniin ja sopimukseen ei tarvita muutoksia.

Akseli: missä raja on ja miten sen lähestyminen kerrotaan.

- **Nyt**: tuotanto sellaisenaan (10 min, harmaa rivi, ei ääntä).
- **1 Kuuluva varoitus**: 10 min, ”/ 10:00” näkyy palkissa koko ajan, lähtölaskenta ja äänimerkit.
- **2 Tunnin ketju**: istunnot ketjuun, raja tunti, varoitus ja äänimerkit vasta viimeisellä minuutilla.
- **3 Tauko päättää**: kuten 2, mutta sanelu päättyy tunnin jälkeen vasta seuraavaan taukoon (enintään 30 s), ja jäljellä oleva aika näkyy hupenevana viivana.

Tilanteet: alussa, minuutti jäljellä, 10 s jäljellä (Toista loppu soittaa
rajan äänineen), raja täynnä ja teksti tallessa sekä yhteyskatko. Mukana
ovat leveydet 1440 ja 390, teemat Päivä, Yö ja Kontrasti, suomi ja
englanti sekä vähennetty liike ja pakotetut värit. Sivu on rakennettu
tuotannon Composerista ja oikeasta saneluosasta; vain mikrofoni,
Soniox-yhteys ja kello on käsikirjoitettu. Tutkimus lähteineen ja ”What the
host would need” ovat tiedostossa
`design-system/prototypes/rounds/2026-11-15-dictation-limit/NOTES.md`.
`check.mjs` ajoi 866 tarkistusta, ja konsoli oli puhdas.

Sivu ja kuvat (scale 2):
`~/src/open-habitat-dev/worker-results/01m7fzkw2mc90w36ra5bdz8y46/`
(`offline.html`, `shots/`).

**Kysymykset Jarille**

- Kelpaako tunti rajaksi, vai halutaanko käytännössä rajaton sanelu
  (esimerkiksi Sonioxin 300 min)? Raja on olemassa unohtunutta
  mikrofonia vastaan, ei kustannusten takia.
- Saako äänimerkki soida oletuksena? Sanelu-asetuksiin voi lisätä
  myöhemmin kytkimen, jolla sen saa pois.
- Onko 3:n ”päättyy taukoon” tarpeen, vai riittääkö 2:n kymmenen sekunnin
  varoitus siihen, että lause ehtii loppua?

**Decisions for later review**

- *Defect or design gap*: treated as a design gap, with no immediate code
  fix. The code and a host-backed spec show that text transcribed before
  the ceiling is kept. Alternative: treat it as a loss defect. Why not: the
  lost words were spoken after the microphone closed, so no code path
  dropped them.
- *Length*: 60 minutes per dictation, as 10-minute chained streams.
  Alternatives: keep 10 min and only warn louder (direction 1), or raise
  the key's `max_session_duration_seconds` towards Soniox's 300 min. Why:
  an hour covers any real explanation. Short keys keep a leaked token's
  reach small, and the daemon and contract stay unchanged.
- *Audible cue*: soft tones at −60 s, −10 s and the end, on by default.
  Alternatives: no sound, or vibration. Vibration works only on Android and
  never on desktop. Why: a person dictating is often not looking. The tone
  is too short and quiet to transcribe, and echo cancellation removes it
  anyway.
- *Announcements*: one persistent live region that speaks once per
  threshold, instead of production's countdown line, which is mounted late
  and changes every second.
- *Network drop*: keep reconnecting while audio is buffered, with the
  buffer raised from 30 s to about 120 s, instead of today's single
  reconnect. Shown as "Mikrofoni kuuntelee yhä · Ääntä tallessa 0:07".
- *End notice*: check icon and green rather than production's info icon,
  and it says the microphone is off. Why: the person needs to know their
  words are safe *and* that they are no longer being heard.

**Review**: focused self-review (prototype round only; no daemon, contract,
session state or authority path changed).

**Live check**: nothing changes in the product yet. Open
`offline.html` from the worker results. In the "10 sekuntia jäljellä"
scene, press Toista loppu with sound on: you should hear two tones at ten
seconds and a falling pair at the limit, then find every word in the field
and Jatka sanelua below it. Today's behaviour can be tried on the test
server with the mic: it ends at 9:58 with the text in the field and no
sound.
