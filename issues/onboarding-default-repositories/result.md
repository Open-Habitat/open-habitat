# Oletusrepot uudelle henkilölle: haku kerran, pääsytarkistus yhdyskäytävässä, lukitut rivit

Uuden henkilön Repot-vaihe noudattaa nyt sivuston tapaa (ADR 0030, "Default
repositories are imported once").

- **Broker**: `ensure`n vastaus kertoo `created: true` vain siinä kutsussa, joka
  loi sidonnan. Tietoa ei tallenneta, joten epäonnistunut käynnistys, myöhempi
  kirjautuminen tai brokerin uudelleenkäynnistys ei voi toistaa sitä.
- **Yhdyskäytävä**: sidonnan luovassa kirjautumisessa jokainen oletusrepo
  tarkistetaan henkilön omalla, hetkellisellä kirjautumistunnisteella (yksi
  `GET /repos/{owner}/{repo}` kutakin, rinnakkain, 8 s:n yhteinen määräaika;
  aikakatkaisu tai virhe on `check_failed`, ei pääsyä on `no_access`). Tavoilla
  *Hae automaattisesti* ja *Ohita vaihe* luettavat repot menevät daemonille
  samassa kertaluonteisessa luovutuksessa tunnisteen kanssa. Henkilökohtainen
  kuitti (`onboarding_receipts` ylläpitotilassa) tallentaa jokaisen
  oletusrepon tuloksen: `no_access`, `check_failed`, `queued`,
  `already_present`, `unknown` (vastaus puuttui) tai `preselected`. Myöhemmät
  repolistapyynnöt ja henkilön `GET /api/v1/onboarding/site` (kenttä
  `imports`) ottavat suodatetun suunnitelman vain tästä kuitista.
- **Daemon**: luovutus asentaa tunnisteen ensin ja vastaa sitten jokaiseen
  oletusrepoon `queued` tai `already_present` (vain jos `~/src`:ssä on
  checkout, jonka origin on juuri tämä repo). Jonossa olevat haetaan yksi
  kerrallaan tavallisina kloonaustöinä GitHubin omalla kirjoitusasulla;
  torjuttu haku jää listaan syineen (`planned` kloonilistassa). Repolista
  merkitsee yhdyskäytävän antamat oletusrepot (`default: preselected|locked`)
  ja hakee nimellä ne, joita henkilön omassa listassa ei ole.
- **Selain**: `GitHubRepoChooser` sai `locked`-propin (kierros 6) ja storyn
  `LockedDefaults`. Esivalitse valitsee valmiiksi, Hae automaattisesti näyttää
  lukitut rivit sivuston haun tilalla, Ohita vaihe hakee ilman valitsinta ja
  näyttää haettavat nimet reitin Repot-rivillä; ilman oletusrepoja Repot-riviä
  ei ole. Reitti ei päättele "haettu" puuttuvasta rivistä vaan kysyy daemonin
  lukuoperaatiolta, mitä `~/src`:ssä on.
- `internal/AGENTS.md` sai oletusrepojen säännön.

## Näyttö

| Tarkistus | Tulos |
| --- | --- |
| `go test ./internal/provision` (`TestEnsureCreatedOncePerBinding`, `TestReplyCreatedOnlyOnRoute`) | Läpi: `created` vain luovassa kutsussa; ei toisessa ensuressa, authorizessa, uudelleenkäynnistetyllä brokerilla eikä epäonnistuneen aktivoinnin jälkeen. |
| `go test ./internal/transport` (`TestHandoffPlan`, `TestPlanReplyMustAnswerThePlan`) | Läpi: tunniste ensin, suunnitelma ilman kuluttajaa torjutaan ennen tunnisteen käyttöä, väärä kielioppi/raja/kaksoiskappale torjutaan, vastauksen pitää vastata jokaiseen oletukseen järjestyksessä. |
| `go test -race ./internal/daemon -run 'TestPlan\|TestClone\|Repo'` | Läpi: vain oikean originin checkout on `already_present`, muu puu samalla nimellä jää `checkout_exists`-torjunnaksi, kirjainkoko seuraa GitHubia, mitään ei aloiteta `~/src`:n ollessa varattu, torjuntaa ei yritetä uudelleen, repolistan merkinnät ja nimihaku. |
| `go test ./internal/gateway ./internal/cli` | Läpi: luettavat vain suunnitelmaan, tunniste ei hallintatilassa eikä lokissa, oletusnimet eivät lokissa, myöhempi kirjautuminen ei toista suunnitelmaa eikä tarkista uudelleen (poistettua työtilaa ei haeta uudestaan), kadonnut vastaus jättää `unknown`, esivalinta ei lähetä suunnitelmaa, konfiguraation muutos ei muuta liittynyttä henkilöä, `CheckRepository`n tilakoodit eikä uudelleenohjausta, repolistapyyntö kantaa vain oman kuitin nimet, `duplicate_destination`. |
| `./scripts/test-onboarding-defaults-uids.sh` | Läpi: verkoton kontti, yhdyskäytävä ja kahden henkilön daemonit kolmena ytimen UID:na, oikea luovutus ja vertaistarkistukset. Agent-b:n saamaton oletusrepo ei näy sen daemonin `gh`-kutsuissa, kotihakemiston tiedostoissa, daemonin argv:ssä eikä yhdyskäytävän vastauksissa (site, repos, clones); agent-a:lle (jolla on pääsy) se näkyy ja haetaan. Tunnisteet eivät kodeissa, yhdyskäytävän tilassa eivätkä vastauksissa. |
| Selain: vitest `src/app` + chooser (324 testiä), host-backed `onboarding-default-repos.spec.ts` (kaikki kolme tapaa ja ohitus ilman oletusrepoja), `site-onboarding.spec.ts` | Läpi. |
| Koko selainsarja (`test-focused.sh --area browser`) | Ensimmäinen ajo: 342 läpi, 1 kaatui (`site-onboarding.spec.ts`, tämän työn virhe henkilön luvun tavassa; korjattu). Toinen ajo korjauksen jälkeen: 343 läpi, 3 ohitettu, 0 kaatui. |
| Sopimukset: `validate-contracts.py`, `check-generated.sh` | Läpi. |
| Täysi portti `ci-local.sh --clean --json` | Go/sopimukset, web-tarkistukset, tavallinen selainsarja (343) ja paketointi läpi. Lab-sarja 124/131: kuusi kaatumista toistuu `main`issa (`lab-english-url-paths`, `lab-outage-account` ×2, `lab-conversation` hidas vuoro, ja `lab-browser-editor` heiluu: uusinta meni läpi), intake `positively-upbeat-basket`. Portti ei siksi kirjoittanut kuittia. Portin muotoilutarkistus pysähtyi ensin `main`in muotoilemattomaan `web/lab/capture-onboarding-ai-step-layout.mjs`:ään, joka muotoiltiin tässä haarassa. |
| Arvio: `/llm-review` (etsijä gpt-6-astra, tarkistaja claude-fable-5-1) + `/assess-findings` | Neljä havaintoa, kaikki vahvistettu ja korjattu (ks. alla). |

### VM-testi kahdella oikealla UID:lla

Hyväksymiskriteeri pyysi VM-testiä. Molemmat nykyiset kahden käyttäjän
VM-skenaariot kaatuvat jo ennen tämän työn koodia: `two-user-routing` ei saa
broker-socketia käyntiin (22.10. lisätyt `open-habitat-storage`- ja
`binding@`-riippuvuudet puuttuvat sen fixturesta), ja `host-boot-binding`
kaatuu myöhemmässä käynnistyksessä (`admitted sibling not restored`) sekä
`main`issa että tässä haarassa. Haaran rauhallisessa ajossa molemmat oikean
brokerin ensuret (uusi `created`-kenttä mukana) onnistuivat vieraassa; yksi
kuormitettu ajo kaatui aiemmin `drift`iin tilin luonnissa. Ks. intake-issue
`greatly-grey-milk`.
Väite on siksi todistettu kontissa kolmella ytimen UID:lla (yllä) — sama
näyttöluokka kuin `test-repo-catalog-uids.sh` — eikä VM:ssä. Kontti ei todista
systemd-aktivointia, oikeaa brokeria eikä oikeaa GitHubia.

### Arvion havainnot (kaikki korjattu)

1. Reitti näytti "Haettu" oletusrepolle, jolla ei ollut kloonausriviä
   (esim. daemonin uudelleenkäynnistys unohti jonon). Nyt tila tulee daemonin
   checkout-havainnosta.
2. Pääsytarkistus hyväksyi kirjainkoon eron, kloonaus ei. Kloonaus seuraa nyt
   GitHubin kirjoitusasua.
3. Sama kohdenimi eri omistajilla katosi hiljaa, ja mikä tahansa samanniminen
   kansio laskettiin haetuksi. Nyt vain oikean originin checkout on haettu,
   muu jää näkyväksi ristiriidaksi, ja asetus hylkää `duplicate_destination`.
4. Kloonilistan kaksi erillistä lukitusta saattoivat näyttää haun alkavan
   tyhjästä. Nyt yksi lukitus.

## Päätöksiä myöhempään tarkistukseen

- **Esivalitse ei lähetä daemonille suunnitelmaa.** Se ei hae mitään itse,
  joten daemonilla ei ole tehtävää; kuittiin luettavat merkitään
  `preselected`. ADR:n tulossanasto ei kattanut tätä tapaa.
- **Kuitti tallennetaan jo nyt** (`onboarding_receipts`), koska repolistapyyntö
  tarvitsee henkilön suodatetun suunnitelman myöhemmin. `onboarding-signin-receipt`
  lisää näkymän ja `ai_key`-kentän. Ylläpitotiedoston raja nostettiin 64 KiB:stä
  3 MiB:hen; jos kuitti ei mahdu, kirjautuminen jatkuu ilman merkittyjä rivejä.
- **Henkilön luku näyttää sivuston nykyisen tavan**, ei ensimmäisen
  kirjautumisen tapaa; vain haettavat nimet tulevat kuitista. Repolistan
  merkinnät (lukittu/esivalittu) tulevat kuitin tavasta.
- **Kaksi samannimistä oletusrepoa eri omistajilla hylätään** asetuksissa
  (`duplicate_destination`), koska molempia ei voi hakea `~/src`:hen.
- **Daemonin jono odottaa `~/src`:n kirjoituslukkoa** henkilön oman haun
  takana. Se ei ole automaattinen uudelleenyritys: jokainen nimi yritetään
  kerran, ja torjunta jää näkyviin uudelleenyrityspainikkeen kanssa.
- **Oletusrepo, jota ei ole henkilön omassa repolistassa** (esim. julkinen
  repo organisaatiossa, johon hän ei kuulu), haetaan nimellä ja näytetään
  lukittuna tai esivalittuna.

## Ei todennettu

Oikea GitHub (tilakoodit 403/404/451 ja nopeusraja) ja oikea systemd-asennus
kahdella UID:lla. Kuvakaappauksia ei otettu; lukitun rivin ulkoasu on
kierroksen 6 ehdotus sellaisenaan.
