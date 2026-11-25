# pbcopy ja pbpaste: kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-25-pbcopy-pbpaste/`. Sivu
rakennetaan sieltä (`NOTES.md`) hakemistoon
`design-system/prototypes/dist/pbcopy-pbpaste/offline.html`, ja se on koottu
tuotannon komponenteista. Malli, host-tiedot, exit-koodit ja rajat ovat
[design.md](design.md):ssä. Tarkistus (`check.mjs`): 920 tarkistusta, neljä
suuntaa, kolme teemaa, 1440 ja 390 px, vähennetty liike, suomi ja englanti,
konsoli puhdas.

## Host-tiedot lyhyesti

- `runtime/core/agent-bin` on viimeisenä PATHissa selaimen Pi-keskusteluilla,
  Taskfleetin workereilla ja selaimen terminaalilla ja editorilla. Komennot
  menevät sinne (`CoreAgentTools` sallii ne), ja ihmisen oma `pbcopy` voittaa.
- Selaimen Pi tietää keskustelunsa (`OPEN_HABITAT_CONVERSATION_ID` ja
  launch-tunnisteet). Worker tietää vain luojansa
  (`TASKFLEET_CREATOR_SESSION`), ja terminaali ei kumpaakaan.
- Terminaali muuttaa OSC 52:n jo nyt Kopioi-toiminnoksi, joten `pbcopy`
  terminaalissa on lähes valmis ja toimii myös SSH:n yli.
- Ainoa kaikissa selaimissa toimiva tie on painallus. Chromium kirjoittaa
  ilman elettä, jos keskustelu on fokuksessa, ja lukee luvan jälkeen
  huomaamatta. Firefox ja Safari vaativat eleen ja näyttävät lukiessaan
  oman Liitä-painikkeensa. Paste-tapahtuma (⌘V) toimii kaikkialla.

## Akseli ja suunnat

Akseli: missä kopiointi ja leikepöydän pyyntö näkyvät. Kaikissa suunnissa
lukeminen vaatii painalluksen, teksti näytetään ennen kuin se lähtee, ja
avaimen näköisestä tekstistä varoitetaan. Tarina etenee kopioinnista
pyyntöön, antamiseen, avaimeen, kieltäytymiseen ja vanhenemiseen.

- **Nyt.** Komennot puuttuvat (`exit 127`). Agentti kirjoittaa tekstin
  koodilohkoon, ja sinä liität leikepöydän omana viestinäsi. Avaimesta ei
  varoiteta, ja se menee keskusteluun sinun kuplassasi.
- **A Kortti.** Habitatin kortti agentin vuorossa heti komentorivin
  jälkeen. Kopiointikortissa on tekstin alku ja *Kopioi*. Pyyntökortissa
  on *Liitä leikepöydältä* ja *Älä anna*, sitten esikatselu ja *Anna
  agentille*. Ratkennut pyyntö jää yhdeksi riviksi (annettu, ei annettu,
  vanheni).
- **B Kenttä.** Chromiumissa kopiointi menee suoraan, ja aikajanalla lukee
  *Kopioitu leikepöydällesi*. Safarissa ja Firefoxissa samassa rivissä on
  *Kopioi*. Pyyntö telakoituu kentän yläpuolelle, ja liitettyä tekstiä voi
  muokata ennen antamista.
- **C Ilmoitus.** Kumpikin näkyy sivun ilmoituksena (tuotannon
  `WarningBannerView`) missä keskustelussa tahansa olet. Aikajanalla on
  vain komennon rivi.

**Suositus: A Kortti.** Kopiointi ja pyyntö jäävät siihen kohtaan, jossa
agentti ne teki, joten näet, mihin ne liittyvät. Ne säilyvät ja näkyvät
joka laitteella. Jos olet poissa, löydät pyynnön palatessasi. A toimii
samoin kaikissa selaimissa. B:n suora kirjoitus toimii vain Chromiumissa,
ja silloin kaksi selainta käyttäytyy eri tavalla. Se myös korvaa
leikepöydälläsi olleen tekstin kysymättä. B:n muokattava kenttä on hyvä
idea, ja sen voi ottaa A:n esikatseluun myöhemmin. C tavoittaa sinut
toisesta keskustelusta, mutta ilmoitus irtoaa yhteydestään ja katoaa, kun
se on käsitelty. Odottavasta pyynnöstä kertovat jo nyt yläpalkin *Odottaa
sinua* ja rail, joten A:n kortti tavoittaa sinut samoin kuin agentin
kysymys.

## Päätökset myöhempään katselmointiin

- Pyynnön oletusaika 10 min, enintään 60 min. Pyyntö ei herätä mitään
  uutta ilmoituskanavaa, vaan se käyttää odottavan vuoron nykyistä
  huomiota.
- Worker ja cron eivät voi pyytää leikepöytää (`exit 3 no_person`), mutta
  workerin `pbcopy` menee luojan keskusteluun.
- Rajat: `pbcopy` 1 MiB (sama kuin terminaalin OSC 52 -raja), `pbpaste`
  256 KiB. Suuremmat ohjataan tiedostoksi.
- Exit-koodit 0–6 design.md:n taulukon mukaan.
- Ei `xclip`/`xsel`/`wl-copy`-aliaksia. Agenttiohje nimeää `pbcopy`n ja
  `pbpaste`n.
- Avainvaroitus on heuristiikka (`…TOKEN=`, `…KEY=`, `PRIVATE KEY`). Se
  varoittaa, mutta ei estä.
- Selaimesta tuleva vastaus on uusi komento `contracts/v1/`:ssä.
  Auktoriteetti ei siirry: daemon pitää pyynnön ja odottavan kutsun.

## Kysymykset

1. Saako `pbcopy` kirjoittaa leikepöydällesi ilman painallusta, kun selain
   sen sallii (B)? Suositus on, että ei saa: painallus aina, koska suora
   kirjoitus korvaa leikepöydälläsi olleen tekstin ja toimii vain
   Chromiumissa.
2. Riittääkö yksi painallus antamiseen, kun teksti näkyy kortissa jo
   ennen painallusta? Nyt painalluksia on kaksi: *Liitä* lukee ja *Anna*
   lähettää. Kahden painalluksen syy on se, että näet ennen lähettämistä,
   mitä mallin tarjoaja saa.
3. Pitäisikö terminaalin `pbpaste` toteuttaa ensimmäisessä versiossa (vaatii
   paneelin tunnisteen shellin ympäristöön), vai riittääkö aluksi
   keskustelun `pbpaste` ja terminaalin `pbcopy` (OSC 52)?
