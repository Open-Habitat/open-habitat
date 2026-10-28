# Tulos: tilitason valinta Googlelle (vaihe 3/3)

Toteutettu. Googlen yhdistämisikkunassa valitaan Täysi tai Vain luku, ja
Luonnokset, ei lähetystä näkyy harmaana kortin tekstillä "Google ei tarjoa
tätä tasoa" (Gmailin luonnosoikeus antaa aina myös lähetysoikeuden). Tilin
kortissa on tason nimi ja *Vaihda taso…*.

- **Tasot** ovat saman operaattorin asiakkaan scope-joukkoja: Täysi
  `drive gmail.modify calendar contacts`, Vain luku jokaisen palvelun
  `*.readonly`. Sopimukseen tuli tason syy (`reason`: `application_missing`
  tai `not_offered`), jotta harmaa kortti kertoo oikean syyn.
- **Taso luetaan myönnöstä** (gogin tallentamat scopet); *pyydettiin, ei
  myönnetty* lasketaan sen tason joukosta, josta myöntö tuli. Uusiminen ilman
  tasoa pitää tilin oman tason; jos sitä ei voi lukea gogista eikä rclonen
  `scope`-asetuksesta, uusiminen kieltäytyy arvaamasta.
- **Peili**: Vain luku -Drive synkronoidaan yksisuuntaisesti (`rclone sync`),
  ja suunta luetaan rclonen omasta `scope`-asetuksesta (`drive` /
  `drive.readonly`). Ensimmäinen peilikierros siirtää ristiriitaiset
  paikalliset tiedostot varmuuskopiokansioon.
- **Tason vaihto**: Googlen peruminen päättää koko henkilön myönnön
  asiakkaalle, joten vanhaa ei voi perua uuden kirjautumisen jälkeen kuten
  Dropboxilla. Relay ajaa ennen kirjautumista (kirjoituslukko, synkronointi
  pysäytetty) viimeisen kaksisuuntaisen Drive-kierroksen, kun Drive lakkaisi
  synkronoitumasta molempiin suuntiin, ja perii sitten vanhan myönnön
  Googlessa. Jos kumpi tahansa epäonnistuu, mitään ei muuteta
  (`final_sync_failed`, `revoke_failed`).
- Uusi yhteys, joka osuu jo yhdistettyyn tiliin toisella tasolla, hylätään
  (`already_connected`): vain tason vaihto voi perua vanhan myönnön ensin.
- Operaattorille: `docs/operations.md` (Google account levels); asetusohjeen
  scope-luettelossa ovat nyt myös `*.readonly`-scopet.

Katselmointi: riippumaton `/llm-review` (etsijä gpt-6-astra, varmistaja
claude-fable-5-1) ja `/assess-findings`. Kolme vahvistettua löydöstä
korjattiin testeineen: osoitteeton yhdistäminen olemassa olevaan tiliin
ohitti perumisen, epäonnistunut tokenin vienti gogista tulkittiin
"ei perittävää", ja uusiminen lukukelvottomalla myönnöllä pyysi täydet
oikeudet.

## Päätöksiä myöhempää tarkistusta varten

- **Vanha myöntö perutaan ennen uutta kirjautumista.** Vaihtoehto oli perua
  jälkeenpäin kuten Dropbox, mutta Googlen peruminen päättäisi samalla uuden
  myönnön. Seuraus: jos henkilö keskeyttää kirjautumisen perumisen jälkeen,
  tili jää kirjautumatta, kunnes hän kirjautuu uudelleen. Ikkuna kertoo sen.
- **Saman tason uusiminen ei peru mitään** (myöskään *Kirjaudu uudelleen*,
  jolla myönnetään aiemmin pois jätetty palvelu). Vaihtoehto oli perua aina
  kuten Dropboxilla; silloin jokainen keskeytetty uusiminen jättäisi tilin
  kirjautumatta, eikä uusiminen laajenna mitään.
- **Vain tason vaihto perii.** "Mukautettu" myöntö (esim. Täysi ilman Gmailia)
  lasketaan eri tasoksi kuin Täysi, joten vaihto Täyteen perii sen.
- **Suunta luetaan rclonen omasta `scope`-asetuksesta**, ei
  `habitat_grant`-avaimesta kuten Dropboxilla: rclone itse käyttää arvoa.
- **Vanha refresh token luetaan rclonen asetuksista, tai gogista**
  (`gog auth tokens export --out /dev/stdout`) tilille, jolla ei ole
  Drive-kirjautumista. Token kulkee vain putken kautta muistiin.
- **Perumisen jälkeen synkronointi käynnistyy uudelleen perutulla
  tokenilla** ja epäonnistuu kuten vanhentunut kirjautuminen, kunnes uusi
  kirjautuminen valmistuu. Vaihtoehto olisi ollut pitää se pysäytettynä,
  mutta tila johdetaan aina natiivista tilasta.
- **Uusi yhteys olemassa olevaan tiliin toisella tasolla hylätään**
  (`already_connected`) eikä myöntöä peruta, koska peruminen päättäisi
  myös tilin nykyisen kirjautumisen.
- **Sama Google-tili kahdella Habitat-käyttäjällä**: peruminen päättää
  molempien myönnön, koska myöntö on Google-tilin ja asiakkaan välinen. Ei
  käsitelty erikseen.

Ei todennettu: oikea Google (peruminen, osittainen suostumus readonly-joukolla,
`rclone sync` drive.readonly-tokenilla); vain synteettiset testit. `gog auth
tokens export --out /dev/stdout` kokeiltiin käsin gog v0.39.1:llä
kertakäyttöisessä kotihakemistossa.
