# Huomioääni asetuksissa – kierros 2

- **A Lista**: kahdeksan ääntä riveinä (työpöydällä kahdessa sarakkeessa), jokaisella kuuntelupainike; tämän laitteen mykistys ja voimakkuus sekä omat äänet ovat omissa korteissaan alla.
- **B Valikko**: yksi tiivis kortti; ääni valitaan valikosta kuuntelupainikkeen vierestä, laite ja omat äänet ovat kortin alaosassa, omat äänet yhtenä rivinä, jonka saa auki.
- **C Laatat**: äänet laattoina, painallus soittaa ja valitsee; omat äänet kaaviona Oletus › Työtila › Keskustelu.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-settings.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`.
Asetusten osioluettelo (`shownSettingsSections`) saa ladattaessa uuden
Äänet-osion Ulkoasun jälkeen, joten sivupalkki, h2 ja asetushaku tuntevat
sen tuotannon omalla koodilla; osion runko viedään portaalilla `.s-main`iin
h2:n jälkeen ja palvelinversion rivin edelle. Rungon palat ovat tuotannon
`s-card`/`s-row`-rivejä ja tuotannon `Segmented`, `ChoiceMenu`, `Checkbox`,
`ScaleSlider` ja `ControlButton`. Kierroksen omia ovat A:n äänirivit, C:n
laatat ja kaavio, omien äänten lista ja huomautusrivit.

Äänet ovat paikkamerkkejä: yhdestä kolmeen oskillaattorisävelestä Web
Audiolla (`SYNTH` `round.tsx`:ssä). Oikeat äänet suunnitellaan rinnakkaisessa
kierroksessa. Jokainen soitto kirjautuu `window.__rqPlays`-taulukkoon
tarkistusta varten.

`?s=<tilanne>`, `?theme=dark` ja `?lang=en` valitsevat alkutilan. Tilanteet:
`oletus`, `pois`, `mykistetty`, `estetty` (selain ei vielä salli ääntä),
`ei-omia`, `lukuvirhe`. Tiedot ovat keksittyjä (Aino Esimerkki, työtilat
`aurinkokello`, `kotisivu`).

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-17-attention-sound-settings/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-17-attention-sound-settings/check.mjs \
  design-system/prototypes/dist/attention-sound-settings/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/attention-sound-settings/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
Tarkistus käy kolme suuntaa ja kuusi tilannetta 1440 ja 390 px:n leveydellä
vaaleana ja tummana (ylivuoto, merkitty suuntarivi, Äänet nykyisenä
osiona, paikkamerkkimerkintä, tilanteen huomautukset, omien äänten lista tai
tyhjä rivi), sitten 1440 px:ssä jokaisen suunnan polun: äänen valinta soittaa
ja valitsee, kuuntelu, näkyvissä olevan keskustelun sääntö, voimakkuus
näppäimistöllä ja testi sillä voimakkuudella, mykistys, pois päältä
(valinnat lukittu, kuuntelu soi), omien äänten linkki, selaimen äänilupa
Testaa ääni -painikkeella, lukuvirheen uudelleenlataus. Lisäksi englanti ja
yksi polku 390 px:ssä. `--quick` ajaa vain 1440 px vaalean.

## Tallennusehdotus

Kaksi paikkaa, koska asetuksessa on kaksi eri omistajaa:

**Henkilön valinnat → `~/.config/open-habitat/preferences.json`** (daemonin
`/api/v1/account/preferences`, sama tiedosto kuin kieli, editori ja
kokeelliset ominaisuudet). Huomioääni päällä/pois, oletusääni, tapahtumat
(valmis, kysyy) ja näkyvissä olevan keskustelun sääntö. Ne kuvaavat, miten
henkilö haluaa agenttien hakevan huomiotaan, ja niiden kuuluu seurata häntä
koneelta toiselle samoin kuin kieli. Ehdotettu muoto, ei rakennettu:

```json
"attention_sound": {"on": true, "sound": "s3", "events": ["done", "asks"], "watch": "away"}
```

Kirjoitus on yksi kenttä kerrallaan (gatewayn 128 tavun raja riittää), ja
puuttuva arvo luetaan oletuksena: huomioääni pois (ks. issuen kysymykset),
äänisarjan ensimmäinen ääni, molemmat tapahtumat ja `away`. Tuntematon äänitunniste luetaan
oletusäänenä, jotta poistettu ääni ei hiljennä ketään huomaamatta.

**Laitteen valinnat → selaimen `localStorage`** kuten teema
(`web/src/theme.ts`) ja työn näkyvyys (`web/src/workPreference.ts`):
tämän laitteen mykistys ja voimakkuus. Ne riippuvat laitteen kaiuttimista
ja tilanteesta (puhelin kokouksessa, sama keskustelu auki koneella), ja
niiden tallentaminen henkilön tiedostoon mykistäisi kaikki laitteet yhdellä
kertaa. Selaimen äänilupa (autoplay) on selaimen tila, jota ei tallenneta
mihinkään; sovellus vain kertoo sen.

Valtarajat eivät muutu: henkilön daemon kirjoittaa vain henkilön omaa
tiedostoa, eikä hostin tarvitse tietää, soiko jokin selain. Äänen soittaa
selaimen sovelluskerros, kun keskustelun tila vaihtuu (vuoro päättyi /
agentti odottaa vastausta) jo nyt tulevista snapshot- ja SSE-tiedoista;
komponentti ei päättele tilaa itse.
