# Käyttöliittymän käyttökulut ja katselmointi

Ensimmäinen käyttöliittymä on suomenkielinen työpöytänäkymä yhdelle palvelimelle.
Se yhdistää kirjautumisen, workspacet, agenttilistan ja yhden valitun keskustelun.
Tämä sivu inventoi toteutettavan polun ja sen puuttuvat päätökset. Tuotetta ei ole
vielä toteutettu, ja kaikki nykyisten klikattavien vedosten data, ajastimet,
taustatoiminnot ja virheet ovat simuloituja.

## Kaksi vastaanotettua designia

1. [Keskustelutoimitus ja sen vedokset](../issues/receive-designer-v1/design/AGENTS.md)
   kattavat B1–B10, B12 ja B5a–B5f. B11-prosessipaneeli ei kuulu v1:een.
2. [Workspace- ja agenttinavigoinnin handoff](../issues/receive-designer-v1/design/workspaces/AGENTS.md)
   kattaa kirjautumisen ja A1–A9:n host-näkymät. Toimituksen A7 sisältää
   hyväksyttyjä workspacejen luonti-, asetus-, worktree-, piilotus- ja
   poistotoimintoja; A9:stä on vasta perustaso.

[Vastaanottoarvio](../issues/receive-designer-v1/review.md) kirjaa alkuperät,
checksumit ja Jarin jo hyväksymän suunnan. Yhteiset tokenit ja komponenttireferenssit
ovat [design systemissä](design-system.md). Tämä määrittely ei muuta tokeneita,
valitse komponenttikirjastoa eikä valitse frontend-runtimea.

## Yhtenäinen työpöytäpolku

1. **Saapuminen ja kirjautuminen.** URL määrää palvelimen. Käyttäjä käynnistää
   kirjautumisen, gateway mapittaa identiteetin Linux-käyttäjään ja näkymä odottaa
   myös käyttäjädaemonin tilaa. Unix-tunnusta ei valita selaimessa.
2. **Workspacejen löytäminen.** Vasen palkki näyttää `~/src`:stä löydetyt
   workspacet ja niiden agentit. Lataus, tyhjä tai puuttuva `~/src`, lukuvirhe ja
   viimeksi saatu katkostila eivät saa näyttää samalta.
3. **Agentin valinta.** Oikea palsta näyttää synopsiksen, tilan ja lähteistä
   saadut lisätiedot. Agentin avaaminen ei resumoi sitä. Löydetty mutta
   ohjauskyvyltään todentamaton agentti on luettavissa erillisessä tilassa.
   Käynnissä olevaan terminaali-TUI:hin ei yritetä liittää RPC:tä.
4. **Historia, resume ja siirto.** Natiivi Pi-historia ladataan. Päättynyt
   keskustelu jatketaan erillisellä toiminnolla käyttäen samaa resume-ID:tä;
   puuttuva tai vioittunut historia ei muutu tyhjäksi uudeksi keskusteluksi.
   Hallittu siirto terminaalista selaimeen on eri toiminto kuin live-liittyminen:
   käyttäjä vahvistaa TUI:n turvallisen pysäytyksen, UI odottaa historian
   asettumisen ja käynnistää sitten uuden runtimen muodossa
   `pi --mode rpc --session <session>`.
5. **Viesti ja vastaus.** Valmis agentti vastaanottaa viestin, käyttöliittymä
   erottaa hyväksytyn, hylätyn ja tulokseltaan epävarman lähetyksen ja näyttää
   tapahtumat elävänä. Pi:n tuetun `edit`-työkalun rakenteinen tulos näytetään
   diffina. Muiden työkalujen tulos näytetään niiden tarjoamassa yleisessä
   muodossa; bashilla tehty tiedostomuutos ei edellytä diffiä.
6. **Katkos ja paluu.** Sisältö jää luettavaksi mutta vanhentuneeksi merkittynä,
   kirjoittavat toiminnot estyvät ja reconnect jatkaa cursorista tai hakee uuden
   snapshotin. Luonnos, fokus ja lukukohta eivät saa rikkoutua päivityksestä.
7. **Host-toiminnot.** Käyttäjä voi luoda, kloonata, nimetä, piilottaa ja poistaa
   workspaceja, integroida Git-repon, kytkeä GitHubin, käynnistää Taskfleetin
   hallitseman worktree-agentin sekä lopettaa, arkistoida ja jatkaa keskustelun.
   Git-repon ensimmäinen avaus odottaa estävän integrointidialogin valmistumista.
   UI ei tarjoa yleistä manuaalisten Git-worktreeiden hallintaa. Hyväksytyt
   automaattiset sivuvaikutukset avaavat luodun kohteen ja fokusoivat
   viestikentän.

Kohdat 1–6 rajattuna yhteen oikeaan workspaceen ja Pi-agenttiin muodostavat
[toimivan ytimen](product.md#toimiva-ydin). Katselmoitu keskustelukokemus,
kaikki kohdan 7 host-toiminnot, kahden käyttäjän erottelu ja operointi muodostavat
koko MVP:n. Ensimmäinen demo ei saa näyttää koko MVP:tä valmiina.

## Journey- ja tilainventaario

| Alue | Tavallinen polku | Tarvittavat vaihtoehtoiset tilat |
|---|---|---|
| Kirjautuminen | idle → pending → kirjautunut | puuttuva/väärä mappaus, auth hylätty tai vanhentunut, gateway ei vastaa, daemon ei vastaa, uudelleenyritys |
| Workspace-lista | loading → ready → valinta | tyhjä `~/src`, puuttuva `~/src`, lukuvirhe, osittainen metadata, päivitys, suodatus ilman osumia, piilotetut, yhteys poikki / viimeksi saatu |
| Agenttilista | ready/work/ask/off ja valittu agentti | vain havaittu, ohjattavuus tuntematon, stale, epäonnistunut käynnistys, emoagentin odottava lapsi, lista muuttuu muualta |
| Historia | loading → tapahtumat → pohja | tyhjä, pitkä historia, lukuvirhe, puuttuva/vioittunut historia, tuntematon tapahtumatyyppi, lyhennetty pitkä sisältö, uusi sisältö lukukohdan yläpuolella |
| Syöte | luonnos → lähetys → hyväksytty | tyhjä/IME, pending, hylätty, tulokseltaan epävarma, katkos, vanhentunut istunto, vain luku, agentti työskentelee, agentin vaihto ja reload |
| Vastaus | stream → valmis | työkalun pending/onnistui/virhe/keskeytetty, vuoro keskeytetty/virheellinen, käyttäjäpyyntö tuettu/ei tuettu/käsitelty muualla, yhteys katkeaa streamissa |
| Resume ja terminaalisiirto | historia ilman prosessia → pending → elävä; tai havaittu TUI → vahvistettu turvallinen stop → historia asettunut → uusi RPC-runtime | jo käynnissä, stop epäonnistui, historian asettumista ei voida varmistaa, kilpaileva resume, RPC-käynnistys epäonnistui, historia puuttuu; live-TUI-attachia ei tarjota |
| Reconnect | down → reconnecting → cursor tai snapshot → ok | cursor vanhentunut, snapshot epäonnistuu, lähetyshetki jäi epävarmaksi, natiivista lähteestä tullut rinnakkainen päivitys |
| Workspace-luonti | tyhjä → hakemisto → mahdollinen agentti → fokus; Git → hakemisto/clone → estävä Git-integrointi → mahdollinen agentti → fokus | nimi/permission-konflikti, osittainen `mkdir`/clone/`git init`/integraatio/agent start, peruutus, katkos |
| Asetukset ja näkyvyys | lue → muuta näyttönimi → tallenna; ota Git käyttöön olemassa olevassa hakemistossa → estävä Git-integrointi ennen seuraavaa avausta; piilota/palauta | tiedoston, `git init`in tai integraation virhe, ulkoinen muutos, Git-faktojen puute; piilotus ei poista levyltä |
| Git-integrointi ja GitHub | Git-repon valinta → estävä dialogi → tarkista/valmistele repo ja agentin `git pull`/`git push` -credential-ympäristö → avaa workspace; erikseen listaa/valitse tai luo remote, kloonaa/push ja varmista `origin` | toteutustapa ja selainkytkentä ovat avoimia; pelkkä `gh`-auth ei läpäise porttia; repo-, remote-, credential-, oikeus- ja verkkovaiheet voivat onnistua, epäonnistua tai jäädä tuntemattomiksi; dialogi näyttää osatuloksen ja turvallisen korjauksen/uusinnan avaamatta workspacea |
| Taskfleet-worktree | valitse base/nimi → Taskfleet luo omistetun worktreen ja agentin → fokus | ei Git-repo, nimi/branch/polku käytössä, Taskfleet-ajo onnistuu vain osittain; ulkoiset worktreet näkyvät tarvittaessa vaikutuksina, mutta UI ei luo, muokkaa tai hallitse niitä |
| Poisto | näytä prosessit ja myös `~/src`:n ulkopuoliset worktreet → täsmävahvistus → stop → poisto → lähteen päivitys | vahvistus väärin, vain havaittu tai muu pysäyttämätön prosessi estää poiston, ulkopuolista worktreeta ei poisteta hiljaa, stop epäonnistui, osittainen tiedostopoisto, katkos; piilota turvallisempana ulospääsynä |
| Arkisto | stop + arkistoi → pois aktiivisista → listaa → jatka | jo päättynyt, vain havaittu, stop tai annotaatio epäonnistuu, historia puuttuu, resume epäonnistuu; ei rinnakkaista historiatietokantaa |
| Uloskirjautuminen | sulje web-istunto | agentit jatkavat; paikallinen luonnos ja viimeksi saatu tila käsitellään katselmoinnissa sovitulla tavalla |

## Keskustelun sisältöinventaario

Keskustelutoimituksesta säilyvät katselmointiin seuraavat vaatimusehdokkaat:

- konteksti, tyhjä keskustelu, historian lataus ja lukuvirhe (B1);
- Markdown, koodi, kopiointi, pitkä sisältö ja tuntematon tapahtuma (B2);
- luonnos sekä pending-, epäonnistunut ja epävarma lähetys (B3, B10);
- streamaava vastaus ja sen valmis-, virhe- ja keskeytystilat (B4);
- yksittäiset ja ryhmitellyt työkaluajot, poikkeaman näkyminen suljetussa
  ryhmässä, koodi, Pi:n tuetun `edit`-tuloksen rakenteinen diffi sekä muiden
  työkalujen yleinen fallback samalla rakenteella historiassa ja streamissa
  (B5a–B5f);
- tuettu käyttäjäpyyntö, vastaus kesken, virhe, ei tuettu ja muualla käsitelty (B6);
- historia ilman prosessia, resume, resume-virhe ja puuttuva historia (B7);
- vain luku -agentin selitys ja estetyt toiminnot (B8);
- vuoron keskeytys erillään prosessin lopettamisesta (B9);
- reconnect ja natiivista lähteestä tuleva viesti tai mallinvaihto luonnosta ja
  lukukohtaa rikkomatta (B10, B12).

Jonotus ja kesken vuoron ohjaus ovat edelleen **ehdotuksia**, eivät hyväksyttyä
toimintaa. Samoin automaattisen synopsiksen sisältö ja päivitysrytmi, luonnoksen
säilytys reloadin yli sekä huomiotapa toisen agentin pyytäessä vastausta ovat
auki. Vedosten toimivatkin selaindemot ovat mockeja eivätkä todiste Pi-tuesta.

## Tarvittavat komponentit ja puuttuvat tilat

Tuotantodesign tarvitsee vähintään seuraavat komponenttiperheet. Niiden API:t,
kirjasto ja runtime päätetään myöhemmissä tehtävissä.

- kirjautumiskortti, koko sovelluksen tilapalkki ja yhteystilan ilmaisin;
- avattava workspace-/agenttipalkki, suodatus, laskurit, workspace-lohko,
  agenttirivi, tilapiste/-pilleri ja näppäimistönavigointi;
- keskustelun otsikko ja lisätietoruudukko, tapahtumalista, käyttäjä- ja
  agenttiviesti, Markdown, koodilohko ja kopiointipalaute;
- työkalurivi ja avattava työkaluryhmä, stdout/stderr-tulos, diffi sekä
  tuntemattoman tapahtuman turvallinen fallback;
- käyttäjäpyyntö ja sen vastausohjaimet, stream-/latausindikaattori,
  “Uutta sisältöä” -ohjain ja virhe-/vain luku -selite;
- viestieditori, luonnoksen tila, lähetyskuittaus, mahdollinen jonon esitys,
  keskeytys ja arkistointi;
- valikko, estävä Git-integrointidialogi, välilehdet, lomakekentät, vahvistus,
  progress-vaiheet ja osittaisen tuloksen yhteenveto workspace-, GitHub-,
  Taskfleet-worktree- ja poistotoimille;
- arkistolista ja resume-toiminto sekä saavutettava toast/ilmoitusratkaisu.

Vedoksista puuttuu tai on vielä ratkaisematta etenkin saavutettava tieto ilman
pelkkää väriä, fokuksen palautus dialogeista ja virheistä, screen readerin
stream-ilmoitusten rytmi, pitkien nimien ja lokalisoitujen virheiden käsittely,
osittaisten monivaiheoperaatioiden palautumistoimet, kilpailevat ulkoiset
muutokset, synopsiksen puuttuminen sekä huomiotapa palkin ollessa piilossa.
Nämä ovat inventaario tuotantodesignille, eivät uusia design-tokeneita.

## Kysymykset yhteisen UI-katselmoinnin valmisteluun

[Valmistelutehtävän](../issues/prepare-ui-review/item.md) tulee tuoda vähintään
seuraavat päätökset Jarin nähtäväksi Pi- ja elinkaarikokeiden näytön kanssa:

1. **Jono ja steering:** tukeeko Pi useaa odottavaa viestiä, perumista ja viestin
   toimittamista kesken vuoron? Jos ei, mikä rehellinen rajatumpi syöttötila
   korvaa kaksi lähetyspainiketta?
2. **Synopsis:** mistä otsikko tulee, milloin se päivittyy, näkyykö viimeksi saatu
   arvo katkoksen aikana ja mikä on fallback ilman uutta tallennusrekisteriä?
3. **Fokus ja luonnokset:** milloin fokus siirtyy automaattisesti, säilyykö
   luonnos vain agenttia vaihdettaessa vai myös reloadissa, missä se voidaan
   säilyttää, ja miten ulkoinen päivitys tai resume vaikuttaa siihen?
4. **Lukukohta:** milloin auto-scroll on sallittu, miten “Uutta sisältöä” toimii
   pitkällä historialla ja säilyvätkö avatut työkaluryhmät snapshotin vaihtuessa?
5. **Huomio:** miten käyttäjä huomaa toisen agentin tuetun käyttäjäpyynnön, kun
   agentti tai vasen palkki ei ole näkyvissä? Riittääkö sovelluksen sisäinen
   merkki ensimmäiseen selainversioon vai tarvitaanko selaimen/OS:n ilmoitus?
6. **Ohjattavuus:** millä tekstillä selitetään, ettei käynnissä olevaan
   terminaali-TUI:hin voi liittyä RPC:llä, ja miten käyttäjä vahvistaa erillisen
   stop–historian asettuminen–`pi --mode rpc --session` -siirron? Mitkä toiminnot
   sallitaan elävälle, päättyneelle ja vain havaitulle agentille?
7. **Epävarma lähetys ja reconnect:** mitä käyttäjä voi turvallisesti tehdä, kun
   kuittausta ei saatu, ja millä tapahtuma-ID:llä kaksoislähetys estetään?
8. **Osittaiset host-operaatiot:** mitä palautus- tai jatkotoimia näytetään, kun
   hakemisto, estävä Git-integrointi, GitHub, Taskfleet-worktree, agent start,
   stop tai poisto onnistuvat vain osittain?

Valmistelija suosittelee vastaukset, mutta [Jarin UI-katselmointi](../issues/review-ui-v1/item.md)
hyväksyy toteutettavan toiminnan. Sen jälkeen erilliset
[toteutusvalmiuden katselmointi](../issues/review-implementation-plan/item.md) ja
[koko MVP:n katselmointi](../issues/review-mvp/item.md) hyväksyvät omat rajatut
tuloksensa. Hiljaisuus tai mockin olemassaolo ei ole päätös.
