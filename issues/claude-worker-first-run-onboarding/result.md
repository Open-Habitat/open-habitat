# Tulos: Claude Code -työntekijä ei pysähdy ensikäynnistyksen teemavalintaan

## Toistui yhä (30.10.), rajatummin kuin issue arveli

Claude Coden 2.1.301 binääri (ydinruntimen versio) näyttää ensikäynnistyksen
näkymän, siis tervetulon ja teemavalinnan, aina kun `~/.claude.json`issa ei ole
`hasCompletedOnboarding: true`. Ohitukselle ei ole lippua eikä
ympäristömuuttujaa. Lisäksi kirjautuminen, joka vaihtaa tiliä, nollaa
kentän. Tämä tarkistettiin binääristä ja kertakäyttöisellä HOMElla
interaktiivisesti tmuxissa: tuore HOME avautuu tervetulonäkymään.

Autonomiset työntekijät eivät kärsi tästä. Taskfleet ajaa autonomisen
Claude-työntekijän `--print`-tilassa, ja se ei näytä ensikäynnistystä
(tuore HOME: `Not logged in`, ei kehotetta). Ongelma koskee interaktiivisia
Claude Code -ajoja: interaktiivista Taskfleet-ajoa (kuten havainnossa) ja
ihmisen omaa `claude`a selaimen päätteessä.

## Mitä tehtiin

Kun Claude-kirjautuminen Habitatissa onnistuu, daemon merkitsee Claude Coden
ensikäynnistyksen tehdyksi (`markClaudeOnboarded`,
`internal/daemon/claude_onboarding_linux.go`). Sama tapahtuu sekä selaimen
että agentin kirjautumisessa.

- Vain `hasCompletedOnboarding` muuttuu. Muut kentät säilyvät.
- Kirjoitus pitää Claude Coden oman konfiguraatiolukon
  (`~/.claude.json.lock`-hakemisto), joten samaan aikaan käynnissä oleva
  Claude Code ei menetä kirjoitustaan. Vierasta lukkoa ei poisteta.
- Tiedosto korvataan atomisesti tilassa 0600.
- Jäsentymätöntä, symlinkattua tai muille luettavaa tiedostoa ei kosketa.
- Vanhaa `~/.claude/.config.json`ia käyttävä tili jätetään rauhaan.
- Valmiiksi merkittyä tiedostoa ei kirjoiteta uudelleen.
- Epäonnistuminen kirjataan (`claude_onboarding` WARN). Kirjautuminen
  näkyy silti onnistuneena.

Birchlla tarkistettiin päästä päähän oikealla Claude Codella. Claude Code
kirjoitti ensin oman `.claude.json`insa, ja sen jälkeen merkintä tehtiin.
Kaikki 10 kenttää säilyivät, ja interaktiivinen käynnistys meni suoraan
kansion luottamuskysymykseen ohi teemavalinnan.

## Päätökset myöhempää katselmointia varten

- **Kirjautuminen kirjoittaa tilan, ei käynnistys tai Taskfleet.**
  Vaihtoehto oli, että Taskfleetin claude-harness tai työntekijän käynnistys
  välittää ohituksen. Claude Code ei tarjoa siihen lippua eikä
  ympäristömuuttujaa, joten harness joutuisi kirjoittamaan saman tiedoston
  jokaisen ajon alussa. Habitat-kirjautuminen on ihmisen ensimmäinen Claude
  Coden käyttö, joten merkintä kuuluu luontevasti siihen. Se auttaa myös
  ihmisen omaa `claude`a päätteessä, ei vain työntekijöitä. Taskfleetiin ei
  siksi tehty issueta.
- **Vain uusi kirjautuminen merkitsee.** Tilit, jotka kirjautuivat ennen
  tätä (testipalvelin, pilotit), saavat merkinnän kirjautumalla uudelleen
  tai käymällä teemavalinnan kerran läpi. Tilan lukeminen (GET) ei kirjoita
  mitään. Vaihtoehto oli merkitä tila aina, kun status-luku näkee
  kirjautuneen tilin, mutta lukeminen ei saa muuttaa ihmisen tiedostoja.
- **Teema jää Claude Coden oletukseen (tumma).** Ihminen voi vaihtaa sen
  komennolla `/theme`. Teemavalinta ohitetaan myös ihmisen omasta
  päätteestä, mikä on hyväksyttävä hinta siitä, ettei mikään Claude Code
  -käynnistys jää odottamaan näkymää, jota kukaan ei katso.
- **Kansion luottamuskysymys jää.** Interaktiivinen Claude Code kysyy yhä
  kerran kansiota kohden, luotetaanko siihen. Se on turvallisuuspäätös
  ihmiselle, joka interaktiivisen ajon näkee, eikä ensikäynnistyksen tila.
  Autonominen `--print`-ajo ei kysy sitä.
- **Onnistunut kirjautuminen ei muutu virheeksi, jos merkintä epäonnistuu.**
  Esimerkiksi Claude Coden lukko voi olla varattuna yli kaksi sekuntia.
  Kirjautuminen itse onnistui, ja ensikäynnistyksen voi aina käydä läpi
  Claude Codessa.
