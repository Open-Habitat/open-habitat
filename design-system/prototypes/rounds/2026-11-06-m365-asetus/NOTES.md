# Microsoft 365: aseta tunnukset – kierros 1

Issue `proto-m365-setup-flow`, johon kuuluvat myös `setup-console-path-too-small`
ja `ms-permissions-copy-one-by-one`. Yksi näkymä: Asetukset ›
Palvelinintegraatiot, Microsoft 365 *Aseta tunnukset…* -ohjattu asetus
rekisteröinnistä tallennukseen, työpöydällä (1440) ja puhelimessa (390),
vaaleana ja tummana. Nyt on tuotannon `AppSetupDialog` sellaisenaan; suunnat
käyttävät sen dialogikehystä ja luokkia (`si-progress`, `si-foot`, `si-cols`),
`ControlButton`ia, `TextField`iä, `Checkbox`ia ja tuotannon tunnusten
tarkistusta (`appErrors`). Arvot (oikeudet, redirect, sovellusten nimet) ovat
tuotannon kopioita. Kaikki on synteettistä: sivulta ei lähde pyyntöjä, ja
Microsoftin hyväksyntäsivu on C:ssä simuloitu.

## Akseli ja suunnat

Akseli: miten Entrassa tehtävä työ kerrotaan, ja montako vaihetta siihen
tarvitaan.

- **Nyt**: tuotannon neljä vaihetta; polut pienellä ja himmeinä, oikeudet yhtenä listana yhdellä kopiolla.
- **A Lista**: samat neljä vaihetta luettavana listana; polku leipätekstinä, jokainen Entran kenttä omana rivinään, oikeudet yksitellen rasteineen ja joka vaiheessa "Valmis, kun".
- **B Rinnakkain**: jokaisen ohjeen vieressä pienoiskuva Entran sivusta, ja arvo kopiointeineen on siinä kentässä, johon se kuuluu.
- **C Kolme**: oikeusvaihe pois; tunnukset ensin, sitten hyväksyntälinkki, joka antaa oikeudet sovellukselle kerralla.

Suositus: **C Kolme**, kun yksi oikea tenant on vahvistanut sen (ks.
`issues/proto-m365-setup-flow/result.md`). Jos vahvistus ei onnistu, A.

## Sama kaikissa suunnissa

- Polku on vaiheen pääohje: leipätekstin koko (`--ah-size-body`, 14,5 px)
  ja täysi mustevärin sävy, erottimet `›` hillittyinä, ei nuolta, joka
  näyttäisi avattavalta. Nyt: 12,5 px ja himmeä (mitattu `check.mjs`:llä).
- Oikeudet kopioidaan yksi kerrallaan (A, B), koska Entran *Select
  permissions* on suodatin: välilyönnein eroteltu lista ei osu mihinkään.
  Rasti on vain ylläpitäjän oma muistilista tällä sivulla; se ei tallennu
  eikä todista mitään Entrasta.
- Redirect URI rastitetaan Entran ehdotuksista (*Mobile and desktop
  applications* tarjoaa `…/oauth2/nativeclient`-osoitteen valintaruutuna);
  kopio on mukana *Custom redirect URIs* -kenttää varten.
- *Minulla on jo sovellus* avaa vain tunnukset; kapeammat tasot (Luonnokset,
  Vain luku) saavat oman sovelluksen nimen ja oman oikeuslistansa.
- Tallennus näyttää rivillä *Tunnukset asetettu*.

## Yläpalkin ohjaimet

- *Taso*: Täysi pääsy, Luonnokset tai Vain luku; vaihtaa sovelluksen nimen ja
  oikeudet ja aloittaa alusta.
- *Teema*, *Alusta*. Valitsin alhaalla vaihtaa suuntaa.
- B:ssä ohjeen alavaiheet ovat painikkeita: valittu alavaihe näyttää
  pienoiskuvassa kohdan, jossa arvo on. Oikeusvaiheessa rivin valinta
  vaihtaa hakukentän sisällön.
- C:ssä *Hyväksy oikeudet Microsoftilla* aukeaa, kun molemmat tunnukset on
  liitetty; Accept vie simuloidulle tyhjälle sivulle, ja *Palaa tänne*
  merkitsee hyväksynnän tehdyksi.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-asetus/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-asetus/check.mjs \
  design-system/prototypes/dist/m365-asetus/m365.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi kaikki vaiheet
tallennukseen asti 1440 ja 390 px vaaleana ja tummana (kerroin 2, koko
vaihe yhdessä kuvassa), mittaa polun koon ja värin, varmistaa että A ja B
kopioivat yhden oikeuden kerrallaan, että C:ssä ei ole oikeusvaihetta ja
sen linkki nimeää oikeudet, kokeilee *Minulla on jo sovellus* -polun ja
Vain luku -tason listan (368 tarkistuspistettä, konsoli puhdas). `index.html`
on sama ilman upotettuja fontteja glasspadia varten.
