# Yhteenveto Jarille

**Mitä tapahtui.** Pilotin agentilta pyydettiin tiedostoa SharePoint-kansiosta.
Se löysi tiedoston, mutta kutsui matkalla postikansion poistoa. Mitään ei
poistunut, koska kutsusta puuttui yksi tieto. Agentti etsii työkalunsa
hakusanoilla, ja "folder" osuu sekä tiedosto- että postikansiotyökaluihin.

**Mitä agentille kerrotaan** (`agent-text.md`). Microsoft-tili on postilaatikko
ja tiedostovarasto saman kirjautumisen takana, ja "kansio" tarkoittaa niissä
eri asiaa. Tiedostot eivät ole koneella: ne etsitään pilvestä haulla ja haetaan
yksi kerrallaan. Viesti jätetään luonnokseksi ja lähetetään vain pyynnöstä.
Kieltoja ei tullut lisää.

**Mitä työkaluille tehdään** (`tool-surface.md`). Agentti saa nyt 100
Microsoft-työkalua, ehdotus on 55. Agentilta ei voisi enää pyytää:

- postikansion, kalenterin tai yhteystietokansion luontia, nimeämistä tai
  poistoa ("tee näille kansio": siirto onnistuu, kansion tekee ihminen itse)
- kalenterin jakamista, Focused Inbox -sääntöjä, kokouskutsun välitystä

Tasot toimivat kuten nyt, uutta asetusta ei tule, kukaan ei kirjaudu uudelleen.

**Kolme kysymystä**

1. Lakkaako agentti järjestelemästä postilaatikkoa? Kyllä: tähän pilotin
   agentti tarttui, ja sitä tarvitaan muutaman kerran vuodessa.
2. Lähteekö posti vain luonnoksen kautta? Kyllä: mitään ei menetetä.
3. Piilotetaanko työkalut, joilla agentti voi kirjata tilin ulos? Kyllä:
   kukaan ei valinnut niitä, palvelin lisää ne itse.

Mitään ei ole viety tuotteeseen. Seurasin ohjeita `rethink-instructions`
(agentin teksti) ja `rethink-document` (ehdotus). Lyhyeksi ei taipunut
Microsoft-kohdan tiedostokappale: hakupolku ja tallennuspaikka ovat tietoa,
jota agentti ei voi päätellä.
