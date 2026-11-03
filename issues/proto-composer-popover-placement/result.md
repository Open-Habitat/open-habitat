# Kierros 1: mihin kentän listat avautuvat

Kierros: `design-system/prototypes/rounds/2026-11-03-kentan-listat/`
(muistiinpanot ja rakennuskomento `NOTES.md`:ssä). Tuotannon `Composer`
synteettisellä keskustelulla. Oletusnäkymä on pitkä luonnos, jossa Komennot on
auki napista, joten suuntien ero näkyy heti. Luonnoksen voi vaihtaa lyhyeksi,
listoja voi avata, kirjoittaa ja selata nuolilla, ja Esc toimii kuten
tuotannossa.

Lähtötilanne: *Liitä* avaa nykyään suoraan järjestelmän tiedostovalitsimen.
Listan avaavat enää *Komennot* (`/`) ja *Tiedosto* (`@`), ja molemmat
avautuvat koko kentän yläpuolelle. Pitkällä luonnoksella listan alareuna on
230 px (työpöytä) tai 189 px (puhelin) napin yläpuolella.

## Suunnat

Akseli: mihin lista avautuu suhteessa nappiinsa ja tekstiin.

0. **Nyt**: lista avautuu koko kentän yläpuolelle; pitkällä luonnoksella nappi ja lista ovat kaukana toisistaan.
1. **Napin luona**: lista avautuu heti napin yläpuolelle kentän päälle ja peittää tekstin alaosan; Esc palaa tekstiin.
2. **Kentän sisällä**: lista avautuu kentän sisään tekstin ja nappirivin väliin; teksti tiivistyy kursorin riveiksi, mitään ei peity.
3. **Napit ylhäällä**: Komennot ja Tiedosto ovat kentän yläreunassa, joten lista avautuu niiden viereen; Lähetä jää alas oikealle.

Listan etäisyys napista on suunnissa 1–3 enintään 12 px.

Mitä kukin päättää:

- *Napin luona* tekee napin listasta ponnahdusvalikon tekstin päälle.
  Kirjoitus on tauolla, ja painallus tekstiin sulkee listan. Kirjoitettu `/`
  tai `@` avaa listan kursoririvin yläpuolelle. Puhelimessa ja lyhyellä
  luonnoksella lista peittää koko tekstin.
- *Kentän sisällä* tekee listasta osan kenttää. Teksti tiivistyy kahdeksi
  riviksi kursorin kohdalle, ylempi teksti häivytetään, eikä mitään peity
  (myöskään keskustelua). Sama paikka napista ja kirjoittaessa.
- *Napit ylhäällä* jättää listan paikalleen ja siirtää napit. Kentän rivi
  muuttuu kaikkialla. Kirjoitettu `@` pitkän tekstin keskellä avautuu yhä
  yläreunaan.

## Suositus

**Kentän sisällä.** Lista on aina siinä, mistä se avattiin: napin
yläpuolella ja kursorin alla. Se ei peitä kirjoitettua tekstiä eikä
keskustelua, ja se toimii samoin puhelimessa, jossa leijuva lista peittäisi
koko kentän. Hinta on, että pitkä teksti tiivistyy listan ajaksi kahteen
riviin. Kursorin rivit pysyvät kuitenkin näkyvissä, ja kirjoitettu `/` tai
`@` suodattaa listaa niissä.

Host-tietoja suunnat eivät tarvitse: kaikki on selaimen sommittelua samoista
lähteistä kuin nyt (komennot, tiedostot, Ctrl/⌘+P-valitsin ennallaan).

## Kysymykset Jarille

1. Kelpaako Kentän sisällä niin, että pitkä teksti tiivistyy listan ajaksi
   kahdeksi riviksi kursorin kohdalle, vai haluatko tekstin pysyvän
   täysikokoisena (Napin luona, jolloin lista peittää osan siitä)?
2. Pitäisikö kirjoittamalla avattu lista (`/`, `@` keskellä tekstiä) avautua
   samaan paikkaan kuin napin lista, kuten suosituksessa, vai kursorin
   kohdalle tekstin päälle?
3. Jos Napit ylhäällä houkuttaa: saako kentän nappirivi siirtyä yläreunaan
   kaikkialla, myös silloin kun mitään listaa ei ole auki?

## Todisteet

`evidence/`: jokaisesta suunnasta pitkä luonnos (Komennot, Tiedosto,
kirjoitettu `@`) ja lyhyt luonnos, 1440 vaalea ja tumma sekä 390 vaalea,
kertoimella 2. `gaps.json` sisältää listan ja napin etäisyydet.
`check.mjs`: 174 tarkistuspistettä, konsoli puhdas. Synteettinen
komponenttilabra, ei hostia vasten ajettu.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-03-kentan-listat/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/kentan-listat/offline.html \
  --title "Kentän listat – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```
