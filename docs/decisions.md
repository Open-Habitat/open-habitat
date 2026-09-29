# Päätökset ja avoimet valinnat

[ADR 0001](adr-0001-unix-native-agent-host.md) on hyväksytty: käyttäjäkohtainen
Unix-daemon gatewayn takana, natiivit workspacet ja historiat sekä HTTP/SSE.
[Arkkitehtuuri](architecture.md) kuvaa sen käytännössä.

[ADR 0002](adr-0002-frontend-stack.md) hyväksyy React- ja stable TypeScript 7 -selainasiakkaan, Biome-lint/format-rajan, `tsc --noEmit` -typecheckin, yhden Redux-tapahtumatilan, React Aria -komponenttipohjan sekä rajatun Markdown-, koodi- ja diffirenderöinnin. [ADR 0003](adr-0003-host-stack.md) hyväksyy yhden Go-binaarin gatewaylle ja käyttäjädaemoneille, ensisijaisen GitHub OAuth -kirjautumisen ja natiivin `gh` HTTPS-helperin asennuksen samalla authorizationilla, valinnaisen Google-providerin, systemd-palvelut, Unix-socketit ja Fleetrepon kautta hallittavan Alder-deklaraation.
[ADR 0004](adr-0004-first-login-user-provisioning.md) hyväksyy ensimmäisellä sallitulla GitHub-verkkokirjautumisella tapahtuvan Unix-käyttäjän luomisen erillisellä root-omisteisella paikallisella brokerilla. Varmennettu numeerinen GitHub-ID on pysyvä avain, nimi vain ensimmäisen käyttökerran nimiehdokas. Broker tarkistaa rootin hallitseman sallittujen ID:iden listan ja sidoksen; gateway pysyy ei-root-käyttäjänä. Jari hyväksyi tämän muutoksen 2026-09-24; se ei ole vielä toteutus- tai vieraskonetesti.

[ADR 0005](adr-0005-clone-progress-stream.md) hyväksyy GitHub-onboardingin suuren kloonauksen rajatun, CSRF-suojatun ja käyttäjädaemonin UID:hen sidotun vaihevirran. Katkennut yhteys keskeyttää kirjoituksen; refresh selvittää tilanteen vain natiivista Gitistä. Edistymistä ei tallenneta eikä kloonausta uusita automaattisesti. Jari hyväksyi sopimusrajan 2026-09-29 [toteutustehtävän päätöksessä](../issues/show-large-clone-progress/item.md); protokollaa tai pidempiä rajoja ei ole vielä toteutettu.

Jari hyväksyi molemmat päätökset ja muun kahdeksanosaisen toteutuspaketin
2026-09-23 revision `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`
mukaisena. [Päätöspöytäkirja](../issues/review-implementation-plan/review.md)
tallentaa rajat. Operaattori-CLI noudattaa AI-first CLI -kanonia (`config
path/show`, `doctor`, noun–verb-rajat, globaali `--json`, rakenteiset virheet ja
JSONL-lokit). Nykyinen JSX, klikkiprototyyppien simuloidut toiminnot ja
alustavat operointikomennot eivät silti ole näyttöä toimivasta
tuotantojärjestelmästä.

| Päätettävä kokonaisuus | Valmistelu | Päätöksen aineisto |
|---|---|---|
| Toteutettava käyttökokemus | [UI-katselmoinnin valmistelu](../issues/prepare-ui-review/item.md) | Käyttökulut ja Pi-/elinkaarikokeen osoittamat rajat. |
| Frontend, tilanhallinta, renderöinti ja komponenttipohja | [Frontend-valinta](../issues/choose-frontend-stack/item.md) | [Ehdotettu ADR 0002](adr-0002-frontend-stack.md), vaihtoehdot ja kokeet. |
| Gateway, autentikointi, daemon ja paketointi | [Host-valinta](../issues/choose-host-stack/item.md) | [Ehdotettu ADR 0003](adr-0003-host-stack.md), käyttäjärajat, prosessiomistajuus, operointikomennot ja testikohde. |
| Rajapinnat ja tietojen omistajuus | [Sopimukset](../issues/define-host-contracts/item.md) | Komennot, tapahtumat, kuittaukset, palautuminen ja annotaatiot. |
| Tuotantodesign ja komponenttisopimukset | [Tuotantodesign](../issues/design-production-ui/item.md) | Yhtenäinen design system ja vuorovaikutus. |
| Toteutus- ja käyttöönottovalmius | [Toteutuspalat](../issues/plan-v1-implementation/item.md) | Rajatut työt, tarkistuskomennot, kohde ja valtuudet. |

Uudet tekniset päätökset kirjoitetaan ehdotetuiksi ADR:iksi valmistelun aikana
ja linkitetään tälle sivulle. Niiden perusteet ja kokeiden versiot säilytetään.
[Toteutusvalmiuden katselmointi](../issues/review-implementation-plan/review.md)
vahvisti lisäksi SSE-/ledger-/historiarajat, neljä v1-sopimustäsmennystä, Pi:n
ensimmäiset/viimeiset neljä viestiä käyttävän otsikon, GitHub
OAuth-/session-/socket-/native `gh` -politiikan, yhden focused private-repo
-smoken sekä generic self-hosting/Fleetrepo-rajan.

Muut harnessit, sovelluskohtaiset Northwind-/Acme-integraatiot, vahvempi eristys
ja usean palvelimen käyttöliittymä tarvitsevat myöhemmin oman valintansa.
Niitä ei ratkaista ensimmäisen MVP:n sivuvaikutuksena.
