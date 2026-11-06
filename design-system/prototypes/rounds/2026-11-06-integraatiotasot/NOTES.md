# Integraatioiden tasot – kierros 1

Issue `proto-integration-levels`. Kolme näkymää samassa sivussa: ylläpitäjän
Palvelinintegraatiot, henkilön tason valinta (Yhdistä tili -dialogin sisältö)
ja henkilön tilikortti Integraatiot-sivulla, kukin Microsoft 365:lle, Googlelle
ja Dropboxille. Rakennettu tuotannon palasista (`ServerIntegrations.css`,
`Integrations.css`, `Settings.css`, `ControlButton`, `Segmented`,
`StatusMark`, `InlineNotice`, `Checkbox`, `ProviderMark`). Palvelin, tilit ja
osoitteet ovat synteettisiä.

## Akseli ja suunnat

Akseli: miten taso kootaan ja nimetään. Ensimmäinen valinta on nykytila.

0. **Nyt**: kolme tasoa, joiden nimi on ainoa kuvaus ylläpitäjän listassa; Luonnokset on todellisuudessa vain luku postin luonnoksia lukuun ottamatta.
1. **Neljä tasoa**: uusi taso Kaikki paitsi postin lähetys Täyden ja Luonnosten väliin, ja jokaisen tason rivillä lukee, mitä se sallii, mitä ei ja mitä ei voi estää.
2. **Ruudukko**: tasot korvataan palveluittaisella ruudukolla Lukee / Muokkaa / Lähettää; solut, joita palvelu ei osaa erottaa, on yhdistetty.
3. **Pohja ja poikkeukset**: kaksi tasoa, Vain luku ja Täysi, ja Vain lukuun valittavat poikkeukset palveluittain lauseina.

Suositus: **Neljä tasoa**.

## Sama kaikissa suunnissa

- Palvelun tekniset rajat (result.md): Microsoft ei erota kalenterin
  muokkausta kutsuista eikä tiedostojen muokkausta jakolinkeistä, ja jokainen
  Microsoftin yhdistelmä on oma sovelluksensa. Gmailissa jokainen
  muutosoikeus sisältää lähetyksen. Dropbox erottaa muokkauksen jakamisesta.
- Mitä ei voi estää, näkyy omana rivinään varoitusmerkin kanssa (”Ei voi
  estää: osallistujat saavat aina kutsun · tiedostolle voi luoda
  jakolinkin”), ei piilossa yleistekstissä.
- Ylläpitäjän listassa Microsoftin pääsovellus nimetään tasoksi (Taso: Täysi,
  ”Yllä oleva sovellus”); tänään se on nimetön rivi. Googlen ja Dropboxin
  tasot, jotka eivät tarvitse omia tunnuksia, kertovat millä sovelluksella ne
  toimivat.
- Aseta tunnukset… avaa dialogin, joka näyttää tason oikeudet palveluittain
  ennen tunnuksia ja merkitsee tason asetetuksi. Varsinainen sovelluksen
  luonti on `proto-m365-setup-flow`-prototyypin asia.
- Alkutila: Microsoftin Täysi ja Vain luku asetettu, Luonnokset ja uusi taso
  ei. Palauta alkutila palauttaa sen.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-integraatiotasot/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-integraatiotasot/check.mjs \
  design-system/prototypes/dist/integraatiotasot/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px:n levyisenä, vaaleana ja
tummana, tarkistaa ylläpitäjän listan kuvaukset, asettaa puuttuvat tunnukset,
valitsee tason tai yhdistelmän kaikille kolmelle palvelulle, tarkistaa
tilikortin, ottaa kuvat kertoimella 2 ja vaatii konsolin puhtaaksi
(80 tarkistuspistettä).
