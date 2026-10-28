# Tulos: tilitason valinta Microsoft 365:lle ja Dropboxille (vaihe 2/3)

Toteutettu. Yhdistämisikkunassa valitaan taso korttina, ja tilin kortissa on
tason nimi ja *Vaihda taso…*, joka kirjautuu uudelleen valitulla tasolla.

- **Microsoft**: Täysi, Luonnokset ei lähetystä, Vain luku. Jokainen taso on
  oma Entra-sovelluksensa: `integrations.json`-osiot `microsoft`,
  `microsoft_drafts` ja `microsoft_read`. Brokerin `Valid`, ylläpitäjän
  CLI ja Palvelinintegraatiot-sivu tuntevat tasojen osiot. Tili käyttää sitä
  sovellusta, jonka client id sen natiiviasetuksissa on; Align ja verify
  käyttävät sitä. Tilin taso luetaan myönnöstä (palveluiden pääsytaso), ja
  *pyydettiin, ei myönnetty* lasketaan sovelluksen tason joukosta.
- **Dropbox**: Koko Dropbox, Vain sovelluskansio (oma App folder -sovellus,
  osio `dropbox_app_folder`, oma paikallinen kansio
  `~/cloud/dropbox-app-folder/<tili>/`), Vain luku (sama Full Dropbox
  -sovellus kapeammilla scopeilla).
- **Peili**: luku-oikeuden tiedostot synkronoidaan yksisuuntaisesti
  (`rclone sync`). Ensimmäinen peilikierros siirtää ristiriitaiset
  paikalliset tiedostot varmuuskopiokansioon.
- **Tason vaihto**: jos tiedostot lakkaisivat synkronoitumasta molempiin
  suuntiin tai juuri vaihtuu, tehdään ensin viimeinen kaksisuuntainen
  kierros vanhalla kirjautumisella; epäonnistuessa mitään ei vaihdeta
  (`final_sync_failed`) ja uusi myöntö perutaan. Korvattu Dropbox-kirjautuminen
  perutaan Dropboxissa.
- Valittujen kansioiden Microsoft-taso jätettiin pois.
- Operaattorin rekisteröinnit: `docs/operations.md` (Dropbox account levels,
  Microsoft account levels).

Katselmointi: riippumaton `/llm-review` (etsijä gpt-6-astra, varmistaja
claude-fable-5-1) ja `/assess-findings`. Kolme vahvistettua löydöstä
korjattiin testeineen (f3ab483f): lunastusajastin ei enää katkaise viimeistä
kaksisuuntaista kierrosta, kriittisesti keskeytynyt pari estää tason vaihdon
eikä ohita kierrosta, ja korvatun sovelluskansiosovelluksen tili saa oman
paikallisen kansion.

## Päätöksiä myöhempää tarkistusta varten

- **Tason sovellus on oma osionsa integrations.json:ssa**, ei lisäkenttiä
  `microsoft`-osiossa. Vaihtoehto oli yksi osio valinnaisin kentin. Erilliset
  osiot käyttävät brokerin olemassa olevaa yhden osion set/clear-polkua ja
  vastausmuotoa sellaisenaan; tenant toistuu jokaisessa osiossa.
- **Dropboxin myöntö tallennetaan rclonen asetuksiin tokenin viereen**
  (`habitat_grant`), koska Dropboxin tokenista ei voi lukea scopeja. Microsoftin
  juurille sama avain kertoo synkronoinnin suunnan ilman verkkoa; näkyvä taso
  luetaan edelleen tenantin vastauksesta. Kyse on palvelun vastauksesta, ei
  henkilön valinnasta. Vaihtoehto olisi ollut kysyä kirjoitusoikeutta
  kokeilemalla.
- **Sovelluskansiotaso synkronoituu omaan kansioonsa**, ja vaihdossa vanha
  kansio jää paikalleen synkronoimatta. Prototyyppi ehdotti muiden tiedostojen
  poistamista kotihakemistosta; mitään ei poisteta.
- **Korvattu Dropbox-kirjautuminen perutaan jokaisessa uudessa
  kirjautumisessa**, ei vain tason vaihdossa: korvattu refresh token ei enää
  ole missään käytössä. Peruminen on paras yritys; epäonnistuminen kirjataan
  lokiin (`integration_revoke`), eikä sitä näytetä sivulla. Poisto ei
  edelleenkään peru myöntöä.
- **Microsoftin uusi tili saa laajimman saatavilla olevan tason oletuksena**,
  ja uudelleenkirjautuminen ilman tasoa pitää tilin oman tason.
- **Pelkkä Microsoftin luku- tai luonnossovellus riittää**: Microsoft tarjotaan,
  vaikka täyttä sovellusta ei olisi.
- **Taso, joka ei vastaa mitään tasoa** (organisaatio rajasi), näytetään
  muodossa *Täysi, ilman: X* tai *Mukautettu*; Googlelle ei vielä näytetä tasoa
  (vaihe 3).

Ei todennettu: oikeat Entra- ja Dropbox-sovellukset (vain synteettiset);
`rclone sync` ja peruminen oikeaa Dropboxia vastaan.
