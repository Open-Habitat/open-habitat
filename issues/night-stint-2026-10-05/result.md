# Yörupeama 5.–6.10.2026: koonti

Rupeama alkoi 5.10. klo 18.31 (Suomen aikaa) TODO.md:n yöhandoffista
(`e370c87`) ja päättyi 6.10. illalla pilot.20:n asennukseen
testipalvelimelle. Kapellimestari oli yksi `/stint-start`-sessio; kaikki
koodimuutokset tehtiin Taskfleet-workereissa. Mainiin tuli 196 committia
(`e370c87..2f42077`). Yksittäisten töiden näyttö ja rajat ovat kunkin issuen
`result.md`:ssä; tämä tiedosto kertoo kokonaisuuden.

## Kulku

1. **5.10. ilta, ensimmäinen kierros.** Neljä rinnakkaista työtä handoffin
   mukaan, sitten otsikot ja työtilojen 512-raja. Klo 21.40 työ pysähtyi:
   kontrollitilat ja eristystodistus jäivät mergeämättä, eikä mitään
   julkaistu. Yö kului odottaen.
2. **6.10. aamu.** Jari kävi päätökset läpi ja linjasi, että työ viedään
   itsenäisesti niin pitkälle kuin mielekästä, visuaalinen hyväksyntä tehdään
   julkaisun jälkeen ja puuttuvat faktat toteutetaan parhaalla arviolla
   päätökset kirjaten.
3. **6.10. päivä.** Loput valmiit kaistat ajettiin sarjassa ja rinnakkain
   törmäysvarausten mukaan, sitten rename ja loppujulkaisu, joka vaati neljä
   yritystä (ks. keskeytykset).

## Laskeutunut ja suljettu

| Issue | Mitä se toi |
|---|---|
| `recover-sends-after-disconnection` | Lähetysesto yhteyskatkon aikana ja alkuperäisen lähetyksen kuittauksen automaattinen tarkistus ilman uusintalähetystä |
| `compare-draft-fidelity` | Toistettava vedos–lab-vertailu ja ensimmäinen raportti kuvapareineen |
| `generate-conversation-titles` | Pi:n natiivi nimi, automaattinen otsikko ja ”Luo uusi otsikko”; kapea terminaalin nimenmuutoskilpa hyväksytty (Jari 6.10.) |
| `remove-workspace-entry-cutoff` | Työtilojen haku eräinä, ei 512 merkinnän rajaa; kloonikohteen nimiristiriita koko joukosta |
| `apply-control-state-design` | Designerin kontrollitilat tokeneina ja `agentPresentation` host-faktoista, myös huomio- ja odotustilat |
| `apply-pi-block-design` | Pi:n keskustelulohkot live→historia |
| `manage-workspace-lifecycle` | Työtilan luonti, asetukset, Git-alustus, piilotus ja palautus (poisto pois käytöstä) |
| `align-navigation-design` | Navigaatio, tilin varanäkymä ja paluunäkymän ryhmittely |
| `add-conversation-recap` | Pyydettävä natiivi Pi-yhteenveto omana korttinaan |
| `align-settings-design` | Asetukset ja yhteinen uloskirjautumisen vahvistus |
| `connect-github-workspaces` | GitHub-kloonaus työtiloihin, vaiheittainen julkaisu GitHubiin ja `gh`:n irrotus |
| `account-profile-from-github` | Nimi, sähköposti ja kuva yhtenäisesti sivupalkissa, valikossa ja asetuksissa |
| `show-pi-status-in-settings` | Pi:n kirjautumistila asetuksissa |
| `align-onboarding-design` | GitHub-, repositorio- ja Pi-käyttöönoton näkymät designiin |
| `archive-agent-conversations` | Keskustelun arkistointi ja palautus työtilan alle; sama natiivi istunto jatkuu |
| `persist-browser-sign-in` | Pysyvä, revokoitava gateway-istunto yli uudelleenkäynnistysten ja päivitysten |
| `named-server-admin-settings` | Palvelimen nimi ja ylläpitosivu rooleineen |
| `server-administration-cli` | Root-only CLI nimelle ja ylläpitäjärooleille |
| `implement-diagnostic-emitter`, `correlate-diagnostics` | Lokitus ja korrelaatio gatewayn, brokerin ja daemonin yli |
| `plan-second-user-admission` | Allekirjoitetun Access-väitteen tarkistus todennettuna, allowlistiton broker, pilot.19 |
| `open-test-installation` | Testipalvelin auki kenelle tahansa GitHub-tilin haltijalle (Jari 6.10.) |
| `deploy-diagnostic-log-policy` | Pilot.20 asennettu; journal-rajat ja root-only-lukijapolitiikka |
| `decide-acme-creator-integration` | Suositus: Acme Creator pysyy erillään, kunnes integraatiotarve todennetaan |

Kaikki koodia muuttaneet työt läpäisivät puhtaan täyden gaten ennen
mergeä.

## Testipalvelimen tila

`https://omega-habitat-test.example.test/` ajaa pilot.20:tä Open Habitat
-nimillä. Testi-VM rakennettiin uudelleen, joten aiemmat tilit, työtilat ja
keskustelut hävisivät. Sisäänpääsy on pelkkä GitHub-kirjautuminen ilman
Cloudflaren sähköpostivaihetta, ja kuka tahansa GitHub-tilin haltija saa oman
Unix-tilin. Kuitit ovat Fleetrepossa (`markedly-witty-brick`,
`nah-diagnostic-log-access`) ja yksityisessä inventaariossa.

Jarin ensimmäisen kirjautumisen jälkeen ajetaan
[valmis tarkistuslista](../deploy-diagnostic-log-policy/result.md):
ensimmäisen ylläpitäjän nimeäminen root-CLI:llä, istunnon pysyvyys
uudelleenkäynnistyksen yli ja UID-kohtaiset tarkistukset.

## Kesken tai ei tehty

- **`recoverable-workspace-deletion`:** kaksi yritystä; tarvitsee ensin
  suunnittelun (keskusteluohjaimen koordinointi, natiivin historian
  asettuminen, kaatumisen kestävä karanteenijournaali). `preparation:
  pending`.
- **`implement-user-storage-quotas`:** vain työtilojen hakua koskeva osa
  laskeutui; broker-, gateway-, daemon-, selain- ja Fleetrepon ext4-osat
  ovat issuessa.
- **`name-open-habitat`:** repo, paketit ja asennus on nimetty uudelleen,
  GitHub-repo on `Open-Habitat/open-habitat`. Paikallisten hakemistojen
  siirto ja tw-merkintä (`dotfiles/src/.config/tmux/projects.conf`) tehdään
  handoffin lopuksi.
- **`evaluate-northwind-adoption`:** suositus valmis; Jari selvittää
  issuessa listatut kysymykset kehittäjiltä.
- **`prove-jit-guest-isolation`:** suljettu `wontfix`; live-reboot-todistusta
  ei voitu tehdä testiasennuksella.
- **`observe-second-person-sign-in`:** Kaisan oma kirjautuminen ja kahden ihmisen
  eristystesti odottavat hänen osallistumistaan.

## Kapellimestarin tekemät päätökset jälkikatselmointiin

- Työtilan poisto toteutetaan karanteenin kautta kapeammalla takuulla
  (ei väärän kohteen sisällön tuhoamista; polun vaihtuminen voi siirtää
  hakemiston). Hyväksytty uudeksi issueksi `recoverable-workspace-deletion`.
- Aldern jaettu `cloudflared` käynnistettiin uudelleen 6.10. klo 21.11
  Suomen aikaa, jotta se lukisi testikoneen uuden CA:n. Muut reitit
  tarkistettiin ennen ja jälkeen (glasspad 404, deutschpad 200, hook 403
  molemmilla kerroilla); testipalvelin muuttui 502:sta 200:aan.
- Fleetrepon testipalvelinohjeet muutettiin Jarin päätöksellä (`e28b6a11`):
  agentit päättävät testi-VM:n uudelleenrakentamisesta ja tekevät sen itse;
  konsolivarmistukset ja ”Jari tekee rebuildin” poistettiin.
- Workerien `## Decisions for review` -osiot kunkin issuen `result.md`:ssä
  sisältävät ne valinnat, jotka tehtiin puuttuvien faktojen tilalle.

## Miksi työ pysähteli

Yksityiskohdat ovat TODO.md:n kohdissa 1–8. Lyhyesti:

1. Kapellimestarin worker-brief käski jättämään työn mergeämättä, jos se
   ”tarvitsee Jarin päätöksen”. Workerit pysähtyivät visuaaliseen
   hyväksyntään, vajaaseen kuvavertailuun ja puuttuviin host-faktoihin.
2. Kapellimestari tulkitsi handoffin järjestyksen koviksi porteiksi ja
   `/stint-start`-skillin säännön mukaan lykkäsi julkaisua, kunnes jokainen
   ajo oli laskeutunut. Aamulla ei ollut mitään testattavaa.
3. Skillin muoto ”kierros, raportti, odotus” pysäytti työn kysymyksiin
   Jarin ollessa poissa.
4. Admission-worker jäi tyhjäkäynnille odottamaan apuajoja, jotka olivat jo
   valmiita.
5. Loppujulkaisu pysähtyi kolme kertaa: ensin puuttuvaan paikallaan
   päivityksen operaattoriin (rename teki sen mahdottomaksi), sitten
   vanhentuneeseen egress-osoitetarkistukseen ja konsolin host-avainvarmistukseen,
   lopuksi jaetun `cloudflared`:n uudelleenkäynnistykseen, jonka kapellimestari
   oli itse kieltänyt briefissä.

Host-avainvaatimuksen alkuperä selvitettiin: se ei tullut review-prosessista
eikä workerin omasta päättelystä vaan Fleetrepon testipalvelinohjeista
(agenttien 24.9.–1.10. kirjaamia sääntöjä ilman Jarin kirjattua päätöstä),
ja kapellimestari kopioi sen ensimmäisen deploy-workerin ehdotuksesta
seuraavan workerin promptiin ehdoksi. Yhteinen juurisyy kaikissa:
kapellimestari välitti workerien ja ohjeiden rajoitukset eteenpäin
arvioimatta niitä repon politiikkaa ja Jarin tavoitetta vasten.

Korjattavat ohjeet: `/stint-start` (deploy-este, kierroksen muoto,
workerien rajoitusten arviointi), kapellimestarin worker-brief-pohja,
tämän repon julkaisuohje (nimen- tai polkumuutoksen jälkeen puhdas asennus)
ja Fleetrepon testipalvelinohjeet (tehty).
