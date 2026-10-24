# Pilvikansio siltana: missä ja milloin se opitaan

**[Avaa kierros](https://glasspad.example.test/p/iraxuncffrxiqgdoe427j7ncdi/).** Valitse suunta alareunasta (myös näppäimet 1–4 ja nuolet). Yläreunan *Lähtötilanne* vaihtaa tilaa *Dropbox yhdistetty* ja *Ei vielä pilveä* välillä. Kaikki tiedot ovat keksittyjä: henkilö on `aino@example.test`, ja kansio on *Dropbox › Open Habitat*.

## Akseli ja suunnat

Akseli on se, **missä kohtaa** ihminen oppii, että Dropboxin tai OneDriven kansio kuljettaa tiedostoja hänen koneensa ja agentin välillä. Sisältö on kaikissa suunnissa sama: siltarivi *Oma kone ⇄ Dropbox › Open Habitat ⇄ Agentti* ja lyhyt käyttöönotto-ohje (Mac / Windows / Puhelin: asenna sovellus, kansio näkyy Finderissa tai Resurssienhallinnassa, Macilla kuvakaappaukset suoraan kansioon `⇧⌘5` › Valinnat).

1. **Aloitus**: käyttöönoton oma vaihe *Oma kone* Googlen jälkeen. Sivusto voi lisätä sen reitille kuten Googlen. Vaiheessa yhdistetään Dropbox tai OneDrive, kansio avataan omalla koneella ja silta kokeillaan yhdellä tiedostolla. Vaihe odottaa, että kansioon ilmestyy tiedosto (*Tiedosto saapuu* -painike simuloi sen). Ratkaisee: kaikki oppivat asian heti ja kerralla, mutta silloin kun sille ei vielä ole tarvetta, ja sovelluksen asentaminen koneelle on sivupolku keskellä käyttöönottoa.
2. **Liitä**: tarpeen hetkellä. Liitä-valikossa on tavallisen liitteen alla *Oman koneen kansio*. Siinä näkyy kansio, *Kerro agentille* (kirjoittaa kenttään "Katso Dropboxin Open Habitat -kansio.") ja *Koneellani?* -ohje, tai ilman pilveä *Yhdistä Dropbox / OneDrive*. Kokeile myös *Pudota 48 Mt tiedosto*: liian iso liite ohjaa kansioon. Ratkaisee: asia tulee vastaan juuri silloin, kun ihminen yrittää saada tiedoston agentille.
3. **Kortti**: Asetukset › Integraatiot alkaa osiolla *Oma kone*. Dropbox-kortin alla on kansio koneella ja palvelimella, uusin tiedosto, ohje ja *Kokeile siltaa*: agentti kirjoittaa kansioon `Tervetuloa.txt`, ja ihminen vastaa *Näkyy* tai *Ei näy*. *Ei näy* antaa kolme tarkistettavaa asiaa. Ratkaisee: paikka, josta Jari etsi asiaa, ja vianetsintä löytyvät samasta kohdasta. Ihminen oppii asian kuitenkin vain, jos hän menee asetuksiin.
4. **Agentti**: etukäteen ei opasteta mitään. Kun agentti vie tiedostoja pilvikansioon, vastauksessa on kortti *Koneellesi Dropboxin kautta*: polku, tiedostot, synkronoinnin aika ja *Eikö näy koneellasi?*. Kun agentti lukee kansiosta, vastauksen yllä on rivi *Koneeltasi Dropboxin kautta · tiedosto*. Jos pilveä ei ole, agentti kertoo, ettei pääse koneelle, ja vastauksessa ovat yhdistämispainikkeet. Ratkaisee: ihminen oppii asian siitä, mitä agentti tekee, eikä ohjeesta.

## Suositus

**Liitä ja Agentti yhdessä, Kortti tietolähteeksi.** Silta on merkityksellinen vasta, kun tiedoston pitää liikkua, ja silloin ihminen on keskustelussa joko Liitä-valikossa tai pyytämässä agenttia. Nämä kaksi kattavat suunnat *koneelta agentille* ja *agentilta koneelle*. Integraatiokortin *Oma kone* -osio korvaa nykyisen kappaleen ja on paikka, johon molemmat ohjeet viittaavat. Käyttöönottovaihetta en suosittele nyt: vaihe pidentää reittiä kaikille, ja vain osa tarvitsee siltaa ensimmäisenä päivänä. Jos jokin sivusto haluaa sen, sama ohje sopii myöhemmin vaiheeksi.

## Mitä näkymät olettavat hostilta

- **Kansio `Open Habitat`** on tämän kierroksen ehdotus. Nyt Dropbox synkronoi koko tilin kansioon `~/cloud/dropbox/<tili>/`, ja agentti voi kirjoittaa minne tahansa sen alle. Erillinen kansio tekee ohjeesta konkreettisen, ja agentin kirjoitukset pysyvät yhdessä paikassa. Daemon tai agentti luo kansion ensimmäisellä käyttökerralla.
- **20 Mt** on daemonin nykyinen liiteraja (`host-context.md`).
- **Synkronointi:** Dropboxin bisync kulkee noin minuutin välein, joten ohjeessa lukee "noin minuutti". Kortin *Dropboxissa klo 10.42* edellyttää, että daemon kertoo, milloin kansion viimeinen bisync-kierros valmistui.
- **Uusin tiedosto** on kansion uusimman tiedoston nimi ja muokkausaika. Host ei tiedä, tuliko tiedosto ihmisen koneelta, joten näkymä ei väitä sitä.
- **Agentin toimituskortti** johdetaan agentin työkalukutsujen kirjoituspoluista, jos ne osuvat pilvikansioon, ja vastaavasti lukemisista. Kortti ei ole agentin oma väite. Tämä on uusi esitystapa keskustelussa.
- *Kokeile siltaa* kirjoittaa yhden tiedoston synkronoituun kansioon. Kirjoitus on todellinen, ja se näkyy ihmisen muilla laitteilla.
- Ihmisen koneen tilaa (onko asiakasohjelma asennettu, synkronoiko se) host ei voi tietää. Siksi kortit kysyvät *Näkyykö se koneellasi?* eivätkä päättele sitä.

## Sivulöydös

Liitä-valikon popoverilla ei ole tuotannossa enää yhtään tyylisääntöä. Säännöt olivat `LocalFolder.css`:ssä, joka poistettiin kansionjaon mukana (22c53a9b). Kierros palauttaa ne omana ohituksenaan, ja korjaus on kirjattu issueksi (`attachment-menu-lost-styles`).

## Kysymykset Jarille

1. Otetaanko käyttöön oma kansio *Open Habitat* Dropboxissa ja OneDrivessa, vai riittääkö koko synkronoitu juuri?
2. Näytetäänkö Liitä-valikossa *Oman koneen kansio* myös silloin, kun pilveä ei ole yhdistetty? Silloin se on käytännössä kehotus yhdistää.
3. Onko agentin toimituskortti (suunta 4) tarpeeksi arvokas, jotta keskustelu tunnistaa pilvikansioon kirjoittamisen omaksi esitystavakseen, vai riittääkö agentin oma teksti?
4. Pidetäänkö käyttöönoton *Oma kone* -vaihe sivuston valintana myöhempää varten, vai hylätäänkö se?

## Rakentaminen ja tarkistus

```
cd design-system/prototypes/rounds/2026-10-24-pilvikansio-silta
node build.mjs                      # dist/cloud-folder-bridge/{index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node check.mjs <html-tai-url> <kuvakansio>
```

`check.mjs` käy läpi neljä suuntaa kolmella leveydellä (1440, 820 ja 390 px) vaaleana ja tummana, klikkaa vuorovaikutukset ja tarkistaa, että konsoli on puhdas: 66 tarkistuspistettä, sekä paikallinen tiedosto että julkaistu sivu. Komponentit ovat tuotannon omia (`Composer`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`, `AccountCard`, `IntegrationsOverview`, `InlineNotice`, `Segmented`, Kartta-kehyksen tyylit). Kierroksen omia ovat Liitä-valikko (`menu.tsx`, korvaa tuotannon `AttachmentMenu`n rakennuksessa), kehys *Oma kone* -vaiheella (`frame.tsx`) ja yhteiset palat (`bridge.tsx`).
