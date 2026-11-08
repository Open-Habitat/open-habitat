# Huomio-suunta tuotannossa

Työtilan sivun Worktreet-osio näyttää prototyypin suunnan 1 (Huomio):
näkyvissä ovat vain rivit, jotka tarvitsevat ihmistä, kukin nimettynä sen
mukaan, mitä se on (avustajan nimi, workerin tehtävä, päättyneen workerin
jäänne), keskustelu linkkinä ja tila, mikä työkopion pitää ja mitä
seuraavaksi tapahtuu. Muut ovat yhdellä rivillä, joka avautuu. Gitin nimet
ovat *Git-tiedot*-valinnan takana. *Siivoa kaikki yhdistetyt* on piilossa,
kun yhdistettyjä vapaita rivejä ei ole. Asetukset › Tallennustila käyttää
edelleen entistä listaa.

Host: daemonin olemassa oleva `taskfleet run list --repo` -luku antaa nyt
jokaiselle worktreelle `owner`-olion (`run_id`, `role` helper/worker/ended,
`title`/`name`, `state` working/waiting/attention/ended, `conversation_id`,
`releases_at`). Uutta komentoa ei tullut; poistoesteen (`taskfleet_run`)
käytös elävälle ajolle on ennallaan.

Kuvat `evidence/r-<fi|en>-<vaihe>-<1440|390>-<light|dark>.avif`:
`0-default`, `1-open` (muut auki ja Git-tiedot), `2-remove` (poistodialogi,
vaalea), `3-explain-T16/T19` (selitystilan kortit, 1440). Kaappaus:
`web/lab/capture-worktree-attention.mjs` (synteettinen labra, listaus
korvattu prototyypin viidellä rivillä).

Tarkistus: Go `TestWorktreeListNamesTheOwningRun` ja muut `TestWorktree*`,
sopimukset, web-yksikkötestit (`WorktreeAttention.test.tsx`), browser-specit
`lab-worktree-cleanup` ja `cross-workspace-agents`. Riippumaton katselmointi
(gpt-6-astra löysi, claude-fable-5-1 tarkisti): yksi korjattu virhe (kooste
lupasi vapautumisen myös avustajalle, jonka työ on yhdistämättä), yksi
kumottu.

## Decisions for later review

- **Interaktiivinen worker, jonka keskustelu on käynnissä, on "hoituu"-ryhmässä**
  (vaihtoehto: aina "tarvitsee sinua"). Keskustelun agentti päättää sen;
  arkistoidussa keskustelussa kukaan ei päätä, joten se nousee esiin
  *Palauta keskustelu* -painikkeella, kuten tuloksessa sovittiin.
- **Pysähtynyt ajo tai avustaja, jonka joutoaika jätti yhdistämätöntä työtä
  (`attention`), on "tarvitsee sinua"** *Avaa/Palauta keskustelu*
  -painikkeella; Habitat ei itse pysäytä eikä peru (Jari 6.11.).
- **Avustajan vapautumisaika näytetään vain, kun Git näkee työkopion
  yhdistettynä**, kierros on avoin ja worker ei aja (vaihtoehto: Taskfleetin
  `last_landing`-kierros). Git-tila koskee juuri tätä työkopiota ja on sama
  ehto, jolla Taskfleet sen poistaa. Avustaja, jonka työ on yhdistämättä,
  "odottaa agenttia".
- **Worktree, jota mikään ajo ei nimeä, on "tarvitsee sinua" hakemistonimellä**
  ja tuotannon poistotoiminnoilla (vaihtoehto: oma ryhmä käsin tehdyille).
  Habitat ei voi tietää, onko se jonkun käytössä terminaalissa; teksti sanoo
  vain, ettei mikään agentti pidä sitä.
- **Päättyneen ajon rivi nimetään uusimman sen polun nimeävän ajon
  tehtävällä**, eikä se koskaan estä poistoa.
- **Ajon keskustelu on vain Pi-istunto, joka loi ajon suoraan**
  (`created_by_session`, ei ajon luomaa ajoa). Muuten riviltä puuttuu
  keskustelulinkki ja -painike.
- **Epävarma palautus (verkko katkeaa) avaa silti keskustelun**, kuten
  arkistoilmoituksen Palauta tekee; keskustelu näyttää oman arkistotilansa.
- **Asetukset › Tallennustila pysyy entisellään** (kaikkien työtilojen lista);
  kierros koski työtilan sivua.
