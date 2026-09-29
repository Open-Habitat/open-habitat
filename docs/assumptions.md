# Mitä pitää vielä todentaa

Selain tuo käyttäjän natiiveihin työtiloihin ja Pi-keskusteluihin uuden
käyttötavan. Sen toimivuus riippuu siitä, että samat Git-tunnukset kelpaavat
agentin tavallisiin komentoihin ja että käyttäjä voi palata keskusteluun
selainkatkon jälkeen menettämättä tietoa työn tilanteesta. Näiden kokonaisuuksien
näyttö on vielä kesken.

Unix-käyttäjien erottelu, natiivien tietojen omistajuus ja daemonin vastuu
Pi-prosessista on sovittu [arkkitehtuurissa](architecture.md) ja
[ADR 0003:ssa](adr-0003-host-stack.md). Toteutus ja sen todentaminen jatkuvat
näiden päätösten pohjalta.

## Mitä alkuperäiset kokeet osoittivat

**Pi:n natiivi historia ja ohjaus soveltuvat selainadapterin pohjaksi.**
[Pi 0.85.1:n kokeessa](https://github.com/maintainer/native-agent-host/blob/4187da0ec40079ec09d98539c03f840102cde616/issues/probe-pi-control/result.md)
historia löytyi työtilan perusteella ja keskustelun tunnus säilyi jatkettaessa.
RPC-prosessi vastaanotti viestejä, välitti vastaus- ja työkalutapahtumia sekä
tuki keskeytystä, jonoja ja laajennuksen kysymysdialogia. Rakenteinen diffi
saatiin Pi:n omasta `edit`-työkalusta; kaikilta työkaluilta sitä ei voi odottaa.

Koe ei osoittanut selainkatkosta palautumista tai käyttäjädaemonin toimintaa.
Pi:n RPC ohjaa käynnistämäänsä prosessia; se ei liity käynnissä olevaan
terminaali-istuntoon. Kaksi prosessia pystyi avaamaan saman historian, joten
Pi ei yksin takaa yhtä kirjoittajaa. Sovitussa käyttötavassa terminaalihistoriat
ovat luettavia ja käyttäjä voi jatkaa päättynyttä selainkeskustelua. Saapuvat
kysymykset näytetään, mutta erilliset dialogien vastausohjaimet eivät kuulu
nykyiseen [agenttiohjauksen työhön](../issues/build-agent-control/item.md).

**Työtilat löytyvät natiiveista lähteistä ilman rinnakkaista rekisteriä.**
[Työtilakokeessa](https://github.com/maintainer/native-agent-host/blob/c1e06b0af9a2835106b5f27277dd1de31766856a/issues/probe-workspace-lifecycle/result.md)
2026-09-22 tutkittiin Git 2.53.0:aa, GitHub CLI 2.46.0:aa ja Taskfleet
0.11.0:aa. Synteettiset hakemistot löytyivät levyltä ja worktree-suhteet Gitistä
sekä Taskfleetistä. Raaka hakemistopoisto saattoi jättää Git-metatietoja tai
käynnissä olevan prosessin jälkeensä. Siksi poistamisen onnistumista arvioidaan
myös näiden vaikutusten perusteella. Piilotuksen ja arkistoinnin kaltaiset
käyttäjän valinnat tarvitsevat pienen erillisen tallenteen, koska niitä ei ole
natiiveissa lähteissä.

GitHubista tehtiin rajattuja autentikointi- ja lukuhavaintoja. Ne eivät
osoittaneet selaimesta tehtävää tunnusten asennusta tai etärepon kirjoituksia.
Kokeiden tarkat ympäristöt ja rajat ovat tulosraporteissa; muu alkuperäinen
tutkimus löytyy [tutkimussivulta](evidence.md).

## GitHubin natiivi käyttö kirjautumisen jälkeen

Valittu ratkaisu toimittaa GitHub-kirjautumisen tunnuksen kerran käyttäjän
daemonille natiivin `gh` HTTPS -käytön asentamista varten. Sama ympäristö
palvelee agentin tavallisia `git pull`- ja `git push` -komentoja.
Tunnuksia ei säilytetä gatewaylla eikä näytetä selaimelle.

Todennettava kokonaisuus on yhä se, että kirjautumisesta saatu käyttöoikeus ja
natiivi asennus riittävät repon luontiin, kloonaukseen, pulliin ja pushiin.
[GitHub-työtilojen toteutusissue](../issues/connect-github-workspaces/item.md)
omistaa käyttäjärajojen synteettiset testit ja yhden luvallisen väliaikaisen
yksityisen repon kokeen. Pelkkä onnistunut kirjautuminen ei osoita näitä kaikkia.
Jos valittu tunnusten käyttötapa ei riitä, tarvittava arkkitehtuurimuutos
ratkaistaan Jarin kanssa. Epäonnistunut valmistelu näkyy käyttäjälle eikä
Git-integraatio esitä työtilaa valmiina.

## Keskusteluun palaaminen ja työn jatkaminen

Daemon omistaa Pi-prosessin myös selaimen tai gateway-yhteyden katkettua.
Daemonin sammuminen tai palvelimen uudelleenkäynnistys voi katkaista aktiivisen
työn; natiivi historia jää myöhempää lukemista ja hallittua jatkamista varten.
Epävarmaa viestiä ei lähetetä automaattisesti uudestaan eikä keskeneräiseksi
jääneen työn rinnalle käynnistetä toista kirjoittajaa.

Selainohjauksesta on jo toteutusosia ja rajattuja synteettisiä todisteita.
Niiden revisiot ja kattavuus on kirjattu
[agenttiohjauksen tuloksiin](../issues/build-agent-control/result.md).
Yleinen SSE-tapahtumavirta ja päättyneen selainkeskustelun jatkaminen kuuluvat
edelleen [avoimeen toteutustyöhön](../issues/build-agent-control/item.md).
Kokonaisuudesta tarvitaan näyttö, jossa palaava selain näyttää työn todellisen
tilan ja jatkaminen säilyttää saman natiivin historian. Jos nykyinen
prosessiomistajuus ei mahdollista tätä, omistajuus tai palautumisen ratkaisu
on arvioitava uudelleen.

[Rajapintasivu](interfaces.md) kuvaa viestien ja katkosten merkityksen.
[Toteutuskartta](../issues/plan-v1-implementation/implementation-briefs.md)
ja [häiriötestien issue](../issues/verify-v1-resilience/item.md) jakavat testien
vastuut. Niiden tuloksista erotetaan selaimen, oikean Pi:n, Linux-käyttäjien ja
live-palvelimen näyttö: yhden kerroksen onnistuminen ei todista muita.
