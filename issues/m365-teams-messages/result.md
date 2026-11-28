# Tulos: suunnitelma

Suunnitelma on tiedostossa [design.md](design.md). Tuotekoodia ei ole
muutettu. Toteutus on oma ajonsa, joka tehdään Jarin hyväksynnän jälkeen ja
0.191.0-versionnoston päälle.

## Lyhyesti

- Teams-keskustelut ja -kanavat tulevat agentille kiinnitetyn
  ms-365-mcp-serverin omilla työkaluilla uutena kuudentena ryhmänä
  (`ms-teams`). Omia työkaluja ei tehdä.
- Luku (`Chat.Read`, `ChannelMessage.Read.All`) on kaikilla tasoilla.
  Lähetys (`ChatMessage.Send`, `ChannelMessage.Send`) on vain tasolla Täysi,
  ja jokainen lähetys kysyy luvan selaimessa.
- Organisaatiot hyväksyvät sovelluksen uudelleen. Nykyiset yhteydet toimivat
  koko ajan, ja Teams näkyy kortissa *ei hyväksytty* siihen asti.
  Asiakkaan pääkäyttäjä voi hyväksyä tason ilman Teams-viestejä.
- Käyttöliittymään tulee uusi palvelurivi, tasotekstejä, lupalistat ja yksi
  valintaruutu hyväksymispaneeliin. Kaikki tehdään nykyisillä
  komponenteilla, joten prototyyppiä ei tarvita.

## Päätökset myöhempää tarkistusta varten

1. Tasolta *Kaikki paitsi postin lähetys* ei voi lähettää Teams-viestejä, ja
   tason nimeksi tulee *Kaikki paitsi viestien lähetys*. (Suositus.)
2. Agentti näkee kaikki keskustelut ja kanavat, joihin ihmisellä on pääsy.
   Erillistä valintaa ei ole. (Suositus.)
3. Täysi-taso lähettää Teams-viestejä jo ensimmäisessä versiossa.
   (Suositus.)

Perustelut ja vaihtoehdot ovat luvussa 12 (*Questions for Jari*).
Oikeilla tileillä tarkistettavat asiat ovat luvussa 10.
