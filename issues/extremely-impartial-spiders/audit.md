# Selainkäyttöliittymän UX-katselmus · kierros 4

**UI:n tila Jarin luettavaksi.** Ensikäyttö vie selkeästi GitHub-kirjautumisesta valinnaisen repohaun kautta ChatGPT-kirjautumiseen; palaaja löytää historiansa nopeasti, ja uusi keskustelu saa pääosan näkymästä. Aiemman kierroksen lukutiheyden korjaus näkyy: historia tuntuu keskustelulta eikä korttiluettelolta. Yksi sovitun v1:n näkyvä puute jäi kuitenkin auki: tummaa järjestelmäteemaa ei käytetä tuotantosovelluksessa lainkaan, vaikka tumma tokenisto toimii katalogissa. Kolme pienempää kohtaamista horjuttaa selkeyttä: aloitusnäkymä lupaa jatkaa keskustelua, johon pääsee vain lukijana; ensikäytössä uloskirjautuminen on kirjautumisen aloitusta painavampi painike; reittifokus piirtää otsikoihin selaimen mustan laatikon. **Suositus:** korjaa teemakytkentä, tarkenna paluulinkin lupaus ja tasaa kahden muun kohdan hierarkia. Tämä issue on vasta vastaanotettu, ei aikataulutettu.

## Näyttö ja rajat

Lähtörevisio `e2f2be7138e97e1119838a63ddde2eca15b6a7c6`, 2026-09-29. `npm ci --prefix web`, `scripts/lab.sh start` rakensivat tuotantobundlen ja käynnistivät työpuun oman loopback-TLS-laboratorion. Headless Chromium, eristetyt kontekstit, keksitty Alice, synteettiset kodit, GitHub ja Pi; Playwright ajettiin paikallisella selaimella. Kävin kirjautumisen, `pi-onboarding`-repohaun, *Jatka ilman repoja* -polun, Pi:n synteettisen laitekoodin aloituksen (en avannut oikeaa vahvistussivua), työtilojen aloitussivun, työtilan, vanhan vain luettavan historian, uuden keskustelun ja `hidas`-viestin valmistumisen, paluun sekä historian reloadin ja asetukset. 1440×900-pikselin vaaleat näkymät, 390×844-historian leveys (`scrollWidth=innerWidth=390`) ja tummaa järjestelmäasetusta vastaava selainkonteksti tarkistettiin. Kuvien ympäristö on **synteettinen**, ei tuotanto eikä erillisten UID:ien, oikean OAuthin tai oikean Pi:n testi. En toistanut aiempien kierrosten virheskenaarioita, jonotoimintoja, näppäimistön päästä päähän -matkaa, ruudunlukijaa, 200 % zoomia tai live-historiaa. Ei puhdasta CI-gatea: vain issue ja kuvat muuttuivat.

## Defektit — tärkeysjärjestys

### 1 · Keskitaso · Järjestelmän tumma teema ei siirry tuotantosovellukseen

**Missä ja miltä tuntuu.** Uusi selainkonteksti asetuksella `colorScheme: 'dark'` näyttää saman vaalean työtilanäkymän kuin vaalea konteksti: [vaalea oletus](screenshots/return-home.avif) · [tumma järjestelmäasetus](screenshots/theme-system-dark.avif). Tarkistus palautti `matchMedia('(prefers-color-scheme: dark)').matches === true`, mutta `<html>`-elementin `data-theme` oli `null` ja rungon tausta `rgb(246, 247, 248)`. Kun asetin **vain testissä** `data-theme="dark"`, tausta vaihtui `rgb(20, 23, 26)`; tokenit toimivat. Tuotannon `web/src/` ei kytke järjestelmäasetusta eikä tarjoa Teema-valintaa. Katalogin tumma teema asetetaan testeissä suoraan attribuutilla, joten sen kuvat eivät todista tuotannon valintaa.

**Miksi / korjaus.** [Tuotantodesignin teemapäätös](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/production-v1.md) ja [design systemin dokumentaatio](../../docs/design-system.md) vaativat molemmat teemat, järjestelmäoletuksen ja laitteen oman Järjestelmä/Vaalea/Tumma-valinnan. Johda `data-theme` käyttäjän laitekohtaisesta valinnasta ja `prefers-color-scheme`sta, reagoi järjestelmämuutokseen ja näytä valinta käyttäjävalikossa. Lisää tuotantobundlen selainregressio; älä päättele teemaa host-snapshotista. Ei tarvitse muuttaa valmiita väritokeneita.

## Viimeistely — tärkeysjärjestys

### 2 · Keskitaso · Aloitusnäkymän ”Jatka keskustelua” on osin vain lukemista

**Tila: korjattu tässä työpuussa.** Otsikko on *Palaa keskusteluihin*. Linkki kertoo *Vain luettavissa* tai jo olemassa olevan selainkeskustelun kohdalla *Jatka työtä*. Historiaan avaaminen ei käynnistä Pi:tä. Synteettinen paluunäkymä ja selaintesti tarkistettu; kuvapari ja rajoitukset [visual-notes.md](visual-notes.md).

**Missä ja miltä tuntuu.** Palatessa [aloitusnäkymä](screenshots/return-home.avif) tarjoaa kolme linkkiä otsikon *Jatka keskustelua* alla. Synteettinen *Miksi CI epäonnistuu macOS:llä?* avaa [historian](screenshots/return-history.avif), jossa lukee *Vain luku · Ohjausta ei ole* ja *Historian avaaminen ei käynnistä eikä jatka Pi:tä*. Lukemista voi jatkaa, mutta työn jatkamista ei; etusivun ingressi sanoo tarkemmin *jatkaa lukemista*, mikä lieventää ristiriitaa mutta ei poista otsikon lupausta. `web/src/app/App.tsx` valitsee kolme ensimmäistä luettavaa agenttia; vain jo tuttu browserSession-linkki vie ohjattavaan keskusteluun.

**Miksi / korjaus.** [UI:n historia- ja jatkamissopimus](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md#kirjautuminen-ja-työtilan-valinta) erottaa natiivihistorian lukemisen uuden tai päättyneen selainkeskustelun ohjaamisesta. Nimeä osio esim. *Palaa keskusteluihin* ja merkitse linkissä/kuvauksessa *Vain luku*, jos jatkamistoimintoa ei ole vahvistettu. Näytä *Jatka työtä* vain niille, joissa jatko on oikeasti mahdollinen; älä käynnistä Pi:tä pelkällä historiaklikkauksella. Ei ehdotusta keskustelureittien yhdistämisestä tässä.

### 3 · Matala · Ensikäytön keskeytys ohittaa päätehtävän visuaalisesti

**Tila: korjattu tässä työpuussa.** Pi-kirjautumisen aloitus on ensisijainen, uloskirjautuminen erillinen hillitty vaarapainike sekä Pi- että GitHub-vaiheessa. Koodia odottaessa yrityksen peruuttaminen pysyy erillisenä. Synteettiset kuvaparit ja selaintestit [visual-notes.md](visual-notes.md).

**Missä ja miltä tuntuu.** [Repojen valinnassa](screenshots/first-chooser.avif) sinivihreä *Jatka ilman repoja* toimii. Seuraavassa [Pi-kirjautumisen aloituksessa](screenshots/first-pi-gate.avif) *Aloita kirjautuminen* on hillitty ääriviivapainike, mutta suuri täytetty punainen *Keskeytä käyttöönotto ja kirjaudu ulos* on heti alla katseen vetävin toiminto. Ensikertalaisen tehtävä kääntyy visuaalisesti päinvastaiseksi, vaikka molemmat ohjaimet toimivat. Lähdekoodissa aloitus käyttää `variant="secondary"` (`web/src/components/PiDeviceSignIn.tsx`).

**Miksi / korjaus.** [Ensikäytön polku](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md#kirjautuminen-ja-työtilan-valinta) johtaa agentin kirjautumiseen, ja [designin kontrollihierarkian](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/production-v1.md) tulee ilmaista se. Tee *Aloita kirjautuminen* ensisijaiseksi start-tilassa; pidä keskeytys löydettävänä, mutta toissijaisena ja erillään etenemistoiminnosta. Punainen säästetään vaaran/virheen merkkiin; tarkista tila myös koodia odottaessa, jolloin peruuttaminen on eri toiminto kuin keskeytys ja uloskirjautuminen.

### 4 · Matala · Ohjelmallinen reittifokus näyttää otsikon mustana laatikkona

**Tila: korjattu tässä työpuussa.** Reittiotsikko ottaa edelleen ohjelmallisen fokuksen ruudunlukijalle, mutta `tabindex=-1`-otsikon kehys poistetaan. Näppäimistöllä tabuloitavien ohjainten design-tokenin mukainen näkyvä kehys tarkistetaan selaintestissä. Synteettiset kuvaparit [visual-notes.md](visual-notes.md).

**Missä ja miltä tuntuu.** [Repohaun otsikko](screenshots/first-chooser.avif) ja [työtilan aloitusotsikko](screenshots/return-home.avif) ympäröityvät ohuella, mustalla selaimen oletusfokuskehyksellä myös hiiren kautta navigoitaessa. Sama näkyi kirjautumisessa ja asetuksissa. Historiassa, viestikentässä ja tavallisissa kontrollifokuksissa käytetään sovelluksen pehmeämpää ilmettä. `App.tsx` kohdistaa fokuksen `h1`:een navigoinnissa; `components.css` antaa kontrollien `:focus-visible`-kehykset muttei otsikolle, joten natiivi outline jää näkyviin.

**Miksi / korjaus.** [Fokussopimus](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md#luonnokset-lukukohta-ja-huomio) edellyttää mielekästä kohdistusta navigoidessa ja [saavutettavuuspäätös](https://github.com/maintainer/native-agent-host/blob/90ef1565f1df46da9ade73b885db2d5bb2c4a837/docs/ui.md#designin-lähteet-ja-toteutuksen-arviointi) näkyvää näppäimistöpolkua. Säilytä ohjelmallinen fokus ruudunlukijalle; sovita otsikon näkyvä fokus teeman mukaiseen fokustokeniin tai erota ohjelmallinen/keyboard-fokus testatusti. Älä vain poista outlinea ilman korvaavaa näppäimistömerkkiä.

## Jarin suunnittelupäätökset

Ei uutta arkkitehtuuri- tai sopimuspäätöstä näistä havainnoista. Edellisten kierrosten tilin tunnistettava näyttönimi ja keskustelun yksi reitti ovat jo [@decide-account-display](../decide-account-display/item.md):ssa; niitä ei kirjata uudeksi löydökseksi. Jos teemavalinnan sijoittaminen käyttäjävalikkoon halutaan vaihtaa, kyse on sovitun tuotantodesignin muuttamisesta, ei tämän raportin automaattinen koodiratkaisu.

## Myönteiset havainnot ja todisteen rajaus

Paluunäkymä ei enää toista kaikkia työtilakortteja, luettavan historian malli-ID on lyhyt metadata eikä koodilohko, ja tavallinen tarkistuspainike on viestin lähetykseen nähden hiljainen ([uusi vapaa keskustelu](screenshots/new-idle.avif)). `hidas` näytti ensin työn ja valmistui synteettisen Pi:n vastaukseen; historian reload pysyi samalla URL:lla. Nämä ovat yksittäisiä synteettisiä tarkistuksia, eivät kaikkien sessio- ja katkotilojen varmennus.

## Työkalujen ja alityönkulkujen häiriöt

Yksi valinnainen suora kokeilu `/auth/login/github`-osoitteeseen palautti 404, koska se ei ole kirjautumispainikkeen oikea OAuth-reitti; painikkeella tehty ensikäyttö onnistui. Lokit `.cache/lab/r4.log` ja korjattu `.cache/lab/r4-first.log`; kyse oli testin navigointivirheestä, ei tuotevirheestä. Ensimmäinen uuden keskustelun kuvakaappaus otettiin vielä *Varmistetaan istuntoa* -välitilassa; odotettu `new-idle.png` otettiin seuraavassa yrityksessä (`.cache/lab/r4-return.log`). Tummaa teemaa kokeiltiin ensin jo avatussa kontekstissa (`.cache/lab/r4-visual.log`); uusi alusta asti tumma konteksti sekä attribuutin pakotuksen kontrolli toistivat havainnon (`.cache/lab/r4-dark.log`, `.cache/lab/r4-theme-proof.log`). Mikään raportin johtopäätös ei nojaa keskeneräiseen kuvaan. Ulkoista paneelia, delegoitua tarkistusta tai live-palvelua ei käytetty.
