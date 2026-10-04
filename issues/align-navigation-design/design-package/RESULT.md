# Navigaation ja asetusten suunnittelupaketti

Yhteisen kierroksen rajattu paketti on koottu nykyisestä
[pyynnöstä](REQUEST.md) ja toimitettu Jarille. Designerin vastausta ei ole vielä saatu.

## Toimitettu aineisto

Paketin lähdecommit on `7364709396830ebf8fdb9a4b5fa9fc29c3c402e9`.
Navigaation `landing-*`, `workspace-*`, `history-*`, `account-menu-*` ja
`workspace-details-*` sekä asetusten `settings-*` tuottivat yhteensä 24
onnistunutta synteettistä kaappausta neljässä esitystavassa. Näiden lisäksi
kuuden kierrokseen kuuluvan aukkotilan 24 esitystä puuttuu. Paketin
`rendered-pages/inventory.json` ja `COVERAGE.md` näyttävät tämän rajauksen,
puuttuvat kaappaukset ja vedosvastaavuuden aukot; koko repositorion inventaario
on lähdetiedostossa `web/lab/inventory.json`. Mukana ovat kolme pyydettyä
vedosta, `SettingsDensity`-story sekä navigaation ja asetusten kannalta
olennaiset aiemmat synteettiset kontrollimigraation tallenteet. Pi-lohkojen
kaappauksia ja erillisen kontrollitilakierroksen aineistoa ei ole mukana.

Pakettikopioiden henkilönnimen viittaukset ja issueiden reporter-kentät
anonymisoitiin; varsinaisia lähdetiedostoja ei muutettu. Kaappaukset ovat
synteettisestä labista. Paketin sisältö, rajaus ja zipin eheys tarkistettiin.

Paketti toimitettiin 4.10.2026 maplein tiedostoon
`~/Downloads/align-navigation-design.zip`. Tiedoston koko oli 6 213 694 tavua
ja mapleilla tarkistettu SHA-256:

```text
1e97b68d6e9329ed3b8ac4b1104b2c41cb1d9a8bf8523d49cf16d5fd8e5cc7cb
```

Paketin palvelinkopio on
`/var/tmp/nah-design-package-build/align-navigation-design.zip`. Design-tekoälylle
ei lähetetty aineistoa.
