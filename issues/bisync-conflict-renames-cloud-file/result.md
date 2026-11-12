# Tulos: ristiriidassa pilven tiedosto pitää nimensä

Korjattu kaikille bisync-palveluille (Microsoft OneDrive/SharePoint, Google
Drive, Dropbox). Kaikki kolme rakentavat nyt jatkuvan synkronoinnin samasta
`bisyncCommand`-funktiosta (`internal/daemon/integrations/passes_linux.go`),
joten liput eivät voi enää erkaantua palveluittain.

Liput: `--conflict-resolve path2 --conflict-loser num --conflict-suffix
habitat-{DateOnly}- --suffix-keep-extension`. Tarkistettu rclone v1.71.2:n
lähteestä (`cmd/bisync/resolve.go`) ja oikealla binäärillä: kun tiedostoa on
muutettu molemmissa päissä, pilven versio pysyy nimellään `Budget.docx`
molemmissa päissä, ja agentin versio nimetään paikallisesti
`Budget.habitat-2026-11-12-1.docx` ja kopioidaan pilveen sen viereen, samalla
kierroksella. Pääte säilyy myös moniosaisessa nimessä
(`archive.habitat-…-1.tar.gz`). Mitään ei poisteta: häviävä versio nimetään
uudelleen ennen kuin voittaja kopioidaan sen nimelle.

Testit: `TestBisyncConflictKeepsTheCloudName` (oikea rclone alias-etäpäätä
vasten, `OH_TEST_RCLONE`) epäonnistui vanhalla koodilla
(`Budget.docx.conflict1` + `Budget.docx.conflict2`, ei `Budget.docx`ia) ja
menee läpi nyt. Palvelukohtaiset lippuja tarkistavat yksikkötestit
(`assertBisyncSafety`) ovat Dropboxin, Googlen ja Microsoftin
synkronointisilmukkatesteissä.

## Päätökset myöhempää tarkistusta varten

- **Kopion nimi `Nimi.habitat-VVVV-KK-PP-N.pääte`.** bisync lisää aina pisteen
  ennen päätettä ja numeron loppuun, joten tutkimuksen ehdottamaa
  `Budget (Habitat 2026-11-12).docx` -muotoa ei saa bisyncillä. Vaihtoehdot:
  `conflict`-sana (`Budget.conflict-…`) tai henkilön/agentin nimi. Valitsin
  sanan *habitat* ja päiväyksen, jotta sama sana toistuu tulevissa
  takaisinkirjoituksen kopioissa (tutkimuksen suositus 4); väliviiva ennen
  numeroa, koska bisync liimaa numeron suoraan päätteeseen. Päivä on
  daemonin aikavyöhykkeen mukainen.
- **Sama käytös kaikille palveluille.** Yksikään palvelu ei tarvinnut
  poikkeusta: Googlen natiividokumentit on jo suljettu synkronoinnin
  ulkopuolelle, ja Dropbox/Google eivät siirrä versiohistoriaa
  uudelleennimeämisessä, joten pilven nimen säilyminen on niissäkin parempi.
- **Agentin ohjetta ei muutettu.** Integraatioteksteissä mainitaan vain
  *ensimmäisen* synkronoinnin varmuuskopiot (`…-backups`), ei jatkuvan
  synkronoinnin ristiriitoja, joten `agent-text.md`:tä ei tarvittu.
- **`--conflict-loser pathname` hylätty**, koska tutkimuksessa paikallinen
  voittaja palasi vasta seuraavalla kierroksella.
