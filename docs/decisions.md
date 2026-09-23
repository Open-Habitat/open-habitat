# Päätökset ja avoimet valinnat

[ADR 0001](adr-0001-unix-native-agent-host.md) on hyväksytty: käyttäjäkohtainen
Unix-daemon gatewayn takana, natiivit workspacet ja historiat sekä HTTP/SSE.
[Arkkitehtuuri](architecture.md) kuvaa sen käytännössä.

[ADR 0002](adr-0002-frontend-stack.md) ehdottaa React- ja stable TypeScript 7 -selainasiakasta, Biome-lint/format-rajaa, `tsc --noEmit` -typecheckia, yhtä Redux-tapahtumatilaa, React Aria -komponenttipohjaa sekä rajattua Markdown-, koodi- ja diffirenderöintiä. [ADR 0003](adr-0003-host-stack.md) ehdottaa yhtä Go-binaaria gatewaylle ja käyttäjädaemoneille, ensisijaista GitHub OAuth -kirjautumista ja natiivin `gh` HTTPS-helperin asennusta samalla authorizationilla, valinnaista Google-provideria, systemd-palveluita, Unix-socketteja ja Fleetrepon kautta hallittavaa Alder-deklaraatiota.
Molemmat päätökset ovat ehdotuksia: `review-implementation-plan` hyväksyy tai
palauttaa ne ennen tuotantopohjan rakentamista. Katselmoinnin suositus on hyväksyä
korjatut ADR 0002 ja ADR 0003 sekä se, että operaattori-CLI noudattaa AI-first
CLI -kanonia (`config path/show`, `doctor`, noun–verb-rajat, globaali `--json`,
rakenteiset virheet ja JSONL-lokit). Nykyinen JSX, klikkiprototyyppien simuloidut
toiminnot ja ehdotetut operointikomennot eivät ole näyttöä toimivasta
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
[Toteutusvalmiuden katselmointi](../issues/review-implementation-plan/item.md)
vahvistaa päätökset ennen tuotantokoodia. Sen
[katselmointipaketti](../issues/plan-v1-implementation/review.md) pyytää lisäksi
täsmälliset päätökset SSE-/ledger-/historiarajoista, neljästä lisättävästä
v1-sopimustäsmennyksestä, Pi:n ensimmäiset/viimeiset neljä viestiä käyttävästä kertakutsuotsikosta, GitHub OAuth-/session-/socket-/native `gh` -politiikasta, yhdestä focused private-repo -smokesta ja generic self-hosting/Fleetrepo-rajasta. Hyväksytty muutos päivitetään myös nykyistä arkkitehtuuria ja
rajapintaa kuvaaviin sivuihin.

Muut harnessit, sovelluskohtaiset Northwind-/Acme-integraatiot, vahvempi eristys
ja usean palvelimen käyttöliittymä tarvitsevat myöhemmin oman valintansa.
Niitä ei ratkaista ensimmäisen MVP:n sivuvaikutuksena.
