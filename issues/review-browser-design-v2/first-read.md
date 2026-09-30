# Selainpolku v2 — ensimmäinen lukukierros

30.9.2026, lähderevisio `c29f77d`. Tämä on rethink-project-docs-läpikäynnin
kohta 1: toimituksen suunta ja ratkaistavat asiat. Komponenttikartta ja työnjako
valmistuvat saman läpikäynnin kohdassa 8 tilien ja onboardingin käsittelyn jälkeen.

## Tavoiteltu käyttökokemus

[Handoff](design/handoff.md) ja neljä vedosta muodostavat johdonmukaisen suunnan:
käyttäjä näkee kirjautumisen vaiheet etukäteen, valitsee repot yhdellä
etenemistoiminnolla ja palaa suoraan käynnissä oleviin tai aiempiin keskusteluihin.
Keskustelun sisältö saa pääosan tilasta. Tekninen tieto avataan tarvittaessa,
ohjaus ja jonotus erotetaan kahdeksi painikkeeksi, ja katkos tai epävarma lähetys
näkyy lähellä sitä sisältöä, jota se koskee. Tilivalikko kokoaa asetukset,
teeman ja uloskirjautumisen. Suosittelen tätä ilmeen ja jäsentelyn lähtökohdaksi.

## Mitä toimituksessa todella on

| Vedos | Sisältö ja rajat |
| --- | --- |
| `Selainpolku v2.dc.html` | Paluu, uusi keskustelu, hylätty lähetys, työ ja jono, valmis vastaus, katkos/epävarma lähetys, vain luku ja asetukset; avoin ja suljettu sivupalkki sekä tilivalikko. Työtilan oma sivu puuttuu. |
| `Onboarding v2.dc.html` | Kaikki kolme vaihetta tilavalitsimineen sekä 1440 että 390 px:n kehyksissä. Handoffin väite puuttuvasta puhelin-onboardingista on vanhentunut. |
| `Puhelin v2.dc.html` | Etusivu, valikkolaatikko, valmis vastaus, työ ja jono, vain luku sekä katkos. Tilipainike on mukana, mutta asetussivua tai toimivaa tilivalikkoa ei ole. |
| `Tummat näkymät.dc.html` | Upottaa kahdeksan pääsivun ja yhdeksän onboarding-tilan tummaa versiota. Otsikon ”kaikki tilat” ei tarkoita kaikkia virhetiloja tai puhelinnäkymiä. |

Tilavalitsimien sanat *sovittu* ja handoffin otsikko *Jari hyväksynyt vedoksissa*
ovat designerin väitteitä. Repo ei sisällä tämän design-keskustelun alkuperäisiä
hyväksyntöjä. Seuraava erottelu perustuu repossa oleviin päätöksiin; erikseen
designerin kanssa tehdyt päätökset voidaan täydentää Jarin tiedolla.

## Päätökset, ehdotukset ja ristiriidat

| Asia | Lähde ja johtopäätös | Suositus jatkoon |
| --- | --- | --- |
| GitHub → repot → OpenAI | [Jarin 29.9. päätös](../github-repos-first-onboarding/item.md) hyväksyy järjestyksen, yhden Jatka-toiminnon ja etenemisen ilman repoja. Pi omistaa tunnukset [onboarding-päätöksen](../design-first-use-onboarding/item.md) mukaan. | Vaiheilmaisin ja koodin selkeä esitys sopivat tähän. Palaavalle, jo valmiille käyttäjälle ei luvata pakollista uutta kierrosta. |
| Repohaun osittainen ja epävarma tulos | [UI-päätöksen](../review-ui-v1/review.md) kohta 8 ja Jarin 29.9. päätös edellyttävät totuudenmukaista tulosta ja natiivin tilan tarkistusta. `GitHubOnboarding.reconcile` tarkistaa tuloksen jo nyt; myös tämä tarkistus voi epäonnistua. | Korvaa tekninen ”osittainen” repokohtaisella kuvauksella, esimerkiksi ”2 repoa haettu”. Jos kolmannen tulos ei selviä, näytä ”Haun tulosta ei voitu varmistaa” ja tarkistustoiminto. Kadonnut vastaus ei todista epäonnistumista. Uusi haku tarvitsee tuoreen havainnon ja käyttäjän toiminnon. |
| Nimi, sähköposti ja avatar | [Jarin 30.9. päätös](../decide-account-display/item.md) on etunimi perustilassa ja kirjautuneen sähköposti avattuna. Koko nimi ja GitHub-kuva eivät seuraa tästä automaattisesti. Snapshotin `auth` ei vielä sisällä näitä näyttötietoja. | Selvitä tietolähde tiliasetusten kohdalla. Näyttötietoa ei käytetä Unix-identiteetin auktoriteettina. Avatar on erillinen ehdotus. |
| Omega Habitat | [Kirjautumisnäkymän työ](../refine-login-screen/item.md), kirjattu commitissa `cbcefb6`, käyttää jo tätä käyttäjälle näkyvää nimeä. [Koko projektin uudelleennimeäminen](../rename-omega-habitat/item.md) on erillinen työ. | Käytä UI:ssa Omega Habitatia. Handoffin nimikysymystä ei tarvitse avata uudelleen. |
| Puhelin | [Toimeksianto](../assemble-browser-redesign-handoff/design-package/REQUEST.md) pyysi 390 px:n suunnitteluvariantit. [UI-päätös](../review-ui-v1/review.md) rajasi mobiilin toteutustavoitteen ulkopuolelle. | Kapea vedos on pyydetty aineisto; siitä ei yksin seuraa mobiilin toteutuspäätöstä. Laajuus täsmennetään ennen toteutusjakoa. |
| OpenAI asetuksissa | Handoff itse nimeää rivin ehdotukseksi. Nykyinen `AccountSettings` näyttää GitHubin tilan, myös `partial`-tilan, joka asetusten vedoksesta puuttuu. OpenAI-vedos näyttää aina ”Yhdistetty” ja toimettoman uudelleenkirjautumispainikkeen. | Suosittelen Pi:n todellisen kirjautumistilan näyttämistä. Uudelleenkirjautuminen ja tunnusten irrotus käsitellään erikseen tiliasetuksissa; selainuloskirjautuminen ei poista natiiveja tunnuksia. |
| Keskustelun avaaminen lopusta | Handoff sanoo aina viimeisimpään; vedoksen `openConv` tyhjentää luonnoksen ja vierittää alas. [UI-kuvaus](../../docs/ui.md) ja `BrowserConversation` säilyttävät luonnoksen ja lukukohdan keskustelua vaihdettaessa. | Ensimmäinen avaus voi alkaa lopusta. Paluu samaan keskusteluun palauttaa lukukohdan; Viimeisimpään-toiminto säilyy. Vedoksen tilalogiikkaa ei siirretä tuotteeseen. |
| Ohjaa, Lähetä ja jonon tyhjennys | Natiivit steer/follow-up ja koko jonon tyhjennys ovat [hyväksyttyjä](../review-ui-v1/review.md). Kahden painikkeen esitys on v2-ehdotus. Vedoksen `clearQueue` korvaa jo kirjoitetun luonnoksen jonon tekstillä. | Painikkeet voivat selkeyttää eroa. Säilytä tuotannon tapa liittää Pi:n vahvistamat poistetut viestit olemassa olevaan luonnokseen. Älä lupaa tarkempaa ohjauksen ajoitusta kuin Pi tarjoaa. |
| Repojen aktiivisuussuodin | Kuukausi oletuksena ja aikavälivalitsin ovat uusia ehdotuksia. Nykyinen lista suodattaa nimellä ja sopimus toimittaa `pushed_at`-ajan; handoff puhuu GitHubin päivitysajasta. | Suosittelen aluksi kaikkia repoja näkyviin ja aikarajausta käyttäjän valintana: vanha mutta tarpeellinen repo ei katoa oletusnäkymästä. Täsmennä, suodatetaanko viimeistä pushia vai muuta päivitystä. |

## Jatkoläpikäynneissä huomioitavaa

Onboardingin vedoksesta puuttuu Pi-yrityksen `interrupted`-tila. Lisäksi tyhjä
GitHub-lista sanoo ”tililläsi ei ole repoja”, vaikka puuttuva näkyvyys ei todista
repojen puuttumista. Täsmennä nämä onboarding-issuen käsittelyssä. Pilot.12:n
raportoidut viat ovat lähtöhavaintoja: [yön tulokset](../../TODO.md) kuvaavat
myöhempiä synteettisiä korjauksia, eivät uutta live-hyväksyntää.

Puhelimen tuntematon sisältö näyttää vain esimerkkiotsikon eikä koko saapunutta
sisältöä. Työkaluryhmästä näytetään esimerkissä kolme yhdeksästä kutsusta.
Tuotannon pitää edelleen antaa lukea saapunut sisältö turvallisena tekstinä.
Koko otsikon pitää olla luettavissa myös näppäimistöllä ja kosketuksella;
työpöydän Tiedot-paneeli tarjoaa tähän paikan, pelkkä `title`-attribuutti ei
ratkaise puhelinta. Näihin palataan komponenttisopimusten kohdalla.

Handoffin vaatimus säilyttää nykyinen pollaus ei korvaa sovittua
[agenttiohjauksen SSE-työtä](../build-agent-control/item.md). Ilmeen toteutus
käyttää kulloinkin voimassa olevaa ohjainta. Vedosten vakioitu ”Jatkettavissa”
ei myöskään todista, että päättyneen selainkeskustelun jatkaminen on toteutettu.

## Avoimet kysymykset ja seuraava vaihe

Jarin tietoa tarvitaan siitä, hyväksyikö hän designerin kanssa myös mobiilin
toteutuksen tai repojen oletusarvoisen kuukausisuodattimen. Repossa näkyvä
aineisto ei ratkaise näitä. Muut v2:n uudet vuorovaikutusvalinnat voidaan
sovittaa ehdotuksina kohtien 4–8 käsittelyssä. Epävarman kirjoituksen,
lukukohdan ja luonnoksen säilyttämiseen on jo päätösperusta.

Seuraava dokumenttiläpikäynti on `prove-jit-guest-isolation`, sen jälkeen
käyttäjän poistaminen ja onboarding. Tämä ensiluku ei sulje design-issuea.
Toimituksen handoff ja HTML:t säilyvät alkuperäisenä vertailuaineistona;
tämä arvio ohjaa niiden sovittamista nykyisiin päätöksiin.

## Tarkistuksen näyttö

Luettu handoff, kaikkien neljän HTML:n sisältö ja tilalogiikka sekä taulukon
päätöslähteet. Nykykoodista tarkistettu `GitHubRepoChooser`,
`GitHubOnboarding`, `PiDeviceSignIn`, `Account`, `BrowserConversation`,
snapshotin auth-skeema ja väritokenit. Täysi tila- ja komponenttikartta jää
myöhemmäksi.

Kaikki neljä vedosta avautuivat paikallisessa erillisessä Playwright Chromium
-kontekstissa ilman JavaScriptin `pageerror`-tapahtumia; aloitusnäkymät
katsottiin. CDN-riippuvuudet ladattiin, joten tämä ei ollut offline-koe.
Joistakin tekstimerkki-ikoneista näkyi tässä ympäristössä puuttuvan merkin
ruutu: ikonien toteutustapa tarvitsee tarkistuksen komponenttivaiheessa.
Kaikkia tiloja ei testattu selaimessa, eikä saavutettavuutta tai tuotannon
toimintaa hyväksytty tällä kokeella. Oikeita profiileja tai testipalvelinta ei
käytetty. Tarkistuskuvat ovat paikallista scratch-aineistoa.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. `issuectl doctor`
ei löytänyt skeema- tai viitevirheitä; muiden issueiden aiemmat
PNG-kuvamuotohavainnot säilyvät. Täyttä CI-porttia ei ajettu, koska muutos
koskee vain dokumentteja ja issueiden tekstiä.
