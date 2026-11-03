# Kentän listat – kierros 1

Issue `proto-composer-popover-placement`. Yksi näkymä: keskustelun
viestikenttä ja sen listat. Rakennettu tuotannon komponenteista (`AppShell`,
`WorkspaceRail`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `Composer` listoineen ja näppäimineen). Keskustelu,
komennot ja tiedostot ovat synteettisiä; mitään ei lähetetä.

Tuotannossa *Liitä* avaa nykyään suoraan järjestelmän tiedostovalitsimen, joten
listan avaavat enää *Komennot* (`/`) ja *Tiedosto* (`@`), napista tai
kirjoittamalla. Kumpikin lista avautuu koko kenttälaatikon yläpuolelle
(`composer.css`, `.ah-choice-pop`).

## Suunnat

Akseli: mihin lista avautuu suhteessa nappiinsa ja tekstiin.

0. **Nyt**: lista avautuu koko kentän yläpuolelle; pitkällä luonnoksella nappi ja lista ovat kaukana toisistaan.
1. **Napin luona**: lista avautuu heti napin yläpuolelle kentän päälle ja peittää tekstin alaosan; Esc palaa tekstiin.
2. **Kentän sisällä**: lista avautuu kentän sisään tekstin ja nappirivin väliin; teksti tiivistyy kursorin riveiksi, mitään ei peity.
3. **Napit ylhäällä**: Komennot ja Tiedosto ovat kentän yläreunassa, joten lista avautuu niiden viereen; Lähetä jää alas oikealle.

Suositus: **Kentän sisällä**.

Listan alareunan etäisyys napista (`check.mjs`, pitkä luonnos, Komennot):

| | Nyt | Napin luona | Kentän sisällä | Napit ylhäällä |
|---|---|---|---|---|
| työpöytä 1440 | 230 px | 4 px | 8 px | 12 px |
| puhelin 390 | 189 px | 2 px | 6 px | 12 px |

## Mitä kussakin tapahtuu

Kaikissa suunnissa näppäimet ovat tuotannon: napista avattu lista saa
kohdistuksen omaan hakuunsa, nuolet liikkuvat, Enter lisää kursorin kohtaan ja
Esc sulkee listan ja palauttaa kohdistuksen tekstiin samaan kursorin kohtaan.
Kirjoitettu `/` tai `@` pitää kohdistuksen tekstissä, ja kirjoitus jatkuu
suodattimena.

- **Napin luona.** Napista avattu lista peittää tekstin alaosan, ja peitetty
  teksti himmenee: kirjoitus on tauolla. Painallus näkyvään tekstiin sulkee
  listan. Kirjoitettu `/` tai `@` avaa listan heti kursoririvin yläpuolelle.
  Puhelimessa ja lyhyellä luonnoksella lista on kenttää korkeampi ja peittää
  koko tekstin.
- **Kentän sisällä.** Lista on osa kenttälaatikkoa: ei varjoa eikä
  leijumista. Teksti tiivistyy kahdeksi riviksi kursorin kohdalle, ja ylempi
  teksti häivytetään. Sulkeminen palauttaa kentän korkeuden. Laatikko kasvaa
  ylöspäin keskustelun kustannuksella.
- **Napit ylhäällä.** Nappirivi (Liitä, Komennot, Tiedosto, malli) on kentän
  yläreunassa ja Lähetä oikeassa alakulmassa. Lista avautuu tuotannon tapaan
  laatikon yläpuolelle, joka on nyt napin vieressä. Kirjoitettu `@` keskellä
  pitkää tekstiä avautuu yhä yläreunaan; `/`-komento kirjoitetaan yleensä
  viestin alkuun, joka on ylhäällä.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-03-kentan-listat/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-kentan-listat/check.mjs \
  design-system/prototypes/dist/kentan-listat/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana, 1440 ja 390 px
leveänä: oletusnäkymä (pitkä luonnos, Komennot auki), haku, nuoli, Esc takaisin
tekstiin, Tiedosto napista ja Enter, kirjoitettu `@` ja Esc, lyhyt luonnos sekä
Napin luona -suunnassa painallus tekstiin (174 tarkistuspistettä, konsoli
puhdas, kuvat kertoimella 2). Sivun yläreunassa on teema, luonnoksen pituus
ja *Alusta*, joka avaa Komennot uudelleen. `index.html` on sama ilman
upotettuja fontteja glasspadia varten.

Suunnat muuttavat vain listan paikkaa: `round.css` ja `round.tsx`:n
`usePlacement`, joka siirtää tuotannon listaa. Toteutus kuuluisi
`Composer.tsx`:n sijoitukseen ja `composer.css`:ään.
